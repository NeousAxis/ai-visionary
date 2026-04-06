#!/bin/bash
# V2 Batch Re-scoring Script for AYA entities
# Runs detached via nohup — survives terminal close.
#
# Usage:
#   ./scripts/rescore-batch.sh                              # process all remaining
#   ./scripts/rescore-batch.sh --max-entities 1000           # process 1000 then stop
#   ./scripts/rescore-batch.sh --dry-run                     # test without writing
#   ./scripts/rescore-batch.sh --start-offset 500            # resume from offset
#   ./scripts/rescore-batch.sh --batch-size 5 --delay 10     # tune speed
#
# Split into 4 sessions of ~1100:
#   ADMIN_SECRET=$SECRET ./scripts/rescore-batch.sh --max-entities 1100 --start-offset 0
#   ADMIN_SECRET=$SECRET ./scripts/rescore-batch.sh --max-entities 1100 --start-offset 1100
#   ADMIN_SECRET=$SECRET ./scripts/rescore-batch.sh --max-entities 1100 --start-offset 2200
#   ADMIN_SECRET=$SECRET ./scripts/rescore-batch.sh --max-entities 1100 --start-offset 3300
#
# Env vars:
#   ADMIN_SECRET  — required
#   API_BASE      — defaults to http://localhost:3002

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3002}"
BATCH_SIZE=3
START_OFFSET=0
MAX_ENTITIES=0  # 0 = unlimited
DELAY=5
DRY_RUN=false
LOGFILE="rescore-$(date +%Y%m%d-%H%M).log"

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --batch-size) BATCH_SIZE="$2"; shift 2 ;;
        --start-offset) START_OFFSET="$2"; shift 2 ;;
        --max-entities) MAX_ENTITIES="$2"; shift 2 ;;
        --delay) DELAY="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 1 ;;
    esac
done

if [ -z "${ADMIN_SECRET:-}" ]; then
    echo "ERROR: ADMIN_SECRET env var required"
    exit 1
fi

AUTH="Authorization: Bearer $ADMIN_SECRET"
CT="Content-Type: application/json"

log() { echo "$(date '+%H:%M:%S') $1" | tee -a "$LOGFILE"; }

log "=== V2 Batch Re-scoring ==="
log "API: $API_BASE"
log "Batch size: $BATCH_SIZE | Max entities: $MAX_ENTITIES | Start offset: $START_OFFSET"
log "Delay: ${DELAY}s | Dry run: $DRY_RUN"
log "Log: $LOGFILE"
log ""

# Status check
STATUS=$(curl -s --max-time 15 -X POST "$API_BASE/api/admin/rescore" -H "$AUTH" -H "$CT" -d '{"status":true}' 2>/dev/null || echo '{}')
REMAINING=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null || echo "?")
RESCORED=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('already_rescored',0))" 2>/dev/null || echo "?")
log "Status: $RESCORED rescored, $REMAINING remaining"
log ""

if [ "$REMAINING" = "0" ]; then
    log "Nothing to rescore. Done."
    exit 0
fi

# Batch loop
OFFSET=$START_OFFSET
TOTAL_SUCCESS=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
ENTITIES_PROCESSED=0
BATCH_NUM=0
CONSECUTIVE_ERRORS=0

while true; do
    BATCH_NUM=$((BATCH_NUM + 1))

    # Max entities limit
    if [ "$MAX_ENTITIES" -gt 0 ] && [ "$ENTITIES_PROCESSED" -ge "$MAX_ENTITIES" ]; then
        log ""
        log "=== MAX ENTITIES REACHED ($MAX_ENTITIES) ==="
        log "Success: $TOTAL_SUCCESS | Failed: $TOTAL_FAILED | Skipped: $TOTAL_SKIPPED"
        log "Next offset to use: $OFFSET"
        exit 0
    fi

    PAYLOAD="{\"batch_size\":$BATCH_SIZE,\"offset\":$OFFSET,\"dry_run\":$DRY_RUN}"
    RESULT=$(curl -s --max-time 180 -X POST "$API_BASE/api/admin/rescore" -H "$AUTH" -H "$CT" -d "$PAYLOAD" 2>/dev/null || echo '{"error":"curl_timeout"}')

    # Log raw result
    echo "$RESULT" >> "$LOGFILE"

    # Check for errors
    HAS_ERROR=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'error' in d else 'no')" 2>/dev/null || echo "yes")

    if [ "$HAS_ERROR" = "yes" ]; then
        CONSECUTIVE_ERRORS=$((CONSECUTIVE_ERRORS + 1))
        log "  ERROR batch #$BATCH_NUM (attempt $CONSECUTIVE_ERRORS): $(echo "$RESULT" | head -c 200)"

        if [ "$CONSECUTIVE_ERRORS" -ge 5 ]; then
            log "5 consecutive errors — stopping. Resume with --start-offset $OFFSET"
            exit 1
        fi

        log "  Retrying in 30s..."
        sleep 30
        continue
    fi

    CONSECUTIVE_ERRORS=0

    # Parse results
    SUCCESS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',0))" 2>/dev/null || echo 0)
    FAILED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failed',0))" 2>/dev/null || echo 0)
    SKIPPED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('skipped',0))" 2>/dev/null || echo 0)
    BATCH_REMAINING=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null || echo 0)
    NEXT_OFFSET=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin).get('next_offset'); print(r if r else 'null')" 2>/dev/null || echo "null")
    BATCH_SIZE_ACTUAL=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('batch_size',0))" 2>/dev/null || echo 0)

    TOTAL_SUCCESS=$((TOTAL_SUCCESS + SUCCESS))
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
    ENTITIES_PROCESSED=$((ENTITIES_PROCESSED + BATCH_SIZE_ACTUAL))

    log "Batch #$BATCH_NUM offset=$OFFSET | +$SUCCESS ok +$FAILED fail +$SKIPPED skip | Total: $ENTITIES_PROCESSED done | Remaining: $BATCH_REMAINING"

    # Check if done
    if [ "$NEXT_OFFSET" = "null" ] || [ "$BATCH_REMAINING" = "0" ]; then
        log ""
        log "=== ALL DONE ==="
        log "Success: $TOTAL_SUCCESS | Failed: $TOTAL_FAILED | Skipped: $TOTAL_SKIPPED"
        exit 0
    fi

    OFFSET=$NEXT_OFFSET
    sleep "$DELAY"
done
