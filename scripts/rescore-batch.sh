#!/bin/bash
# V2 Batch Re-scoring Script for AYA entities
# Usage:
#   ./scripts/rescore-batch.sh                          # default: batch_size=3, no dry-run
#   ./scripts/rescore-batch.sh --dry-run                # test without writing
#   ./scripts/rescore-batch.sh --batch-size 5           # custom batch size
#   ./scripts/rescore-batch.sh --start-offset 100       # resume from offset
#   ./scripts/rescore-batch.sh --delay 10               # seconds between batches
#
# Env vars:
#   ADMIN_SECRET  — required
#   API_BASE      — defaults to http://localhost:3002

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3002}"
BATCH_SIZE=3
START_OFFSET=0
DELAY=5
DRY_RUN=false
LOGFILE="rescore-$(date +%Y%m%d-%H%M).log"

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --batch-size) BATCH_SIZE="$2"; shift 2 ;;
        --start-offset) START_OFFSET="$2"; shift 2 ;;
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

echo "=== V2 Batch Re-scoring ==="
echo "API: $API_BASE"
echo "Batch size: $BATCH_SIZE"
echo "Start offset: $START_OFFSET"
echo "Delay: ${DELAY}s"
echo "Dry run: $DRY_RUN"
echo "Log: $LOGFILE"
echo ""

# Status check
echo "Checking status..."
STATUS=$(curl -s -X POST "$API_BASE/api/admin/rescore" -H "$AUTH" -H "$CT" -d '{"status":true}')
echo "$STATUS" | python3 -m json.tool 2>/dev/null || echo "$STATUS"
echo ""

TOTAL=$(echo "$STATUS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null || echo "?")
echo "Remaining: $TOTAL entities"
echo ""

if [ "$TOTAL" = "0" ]; then
    echo "Nothing to rescore. Done."
    exit 0
fi

# Batch loop
OFFSET=$START_OFFSET
TOTAL_SUCCESS=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
BATCH_NUM=0

while true; do
    BATCH_NUM=$((BATCH_NUM + 1))
    echo "--- Batch #$BATCH_NUM (offset=$OFFSET) ---"

    PAYLOAD="{\"batch_size\":$BATCH_SIZE,\"offset\":$OFFSET,\"dry_run\":$DRY_RUN}"
    RESULT=$(curl -s -X POST "$API_BASE/api/admin/rescore" -H "$AUTH" -H "$CT" -d "$PAYLOAD" --max-time 180)

    # Log raw result
    echo "$RESULT" >> "$LOGFILE"

    # Parse results
    SUCCESS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',0))" 2>/dev/null || echo 0)
    FAILED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failed',0))" 2>/dev/null || echo 0)
    SKIPPED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('skipped',0))" 2>/dev/null || echo 0)
    REMAINING=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('remaining',0))" 2>/dev/null || echo 0)
    NEXT_OFFSET=$(echo "$RESULT" | python3 -c "import sys,json; r=json.load(sys.stdin).get('next_offset'); print(r if r else 'null')" 2>/dev/null || echo "null")

    TOTAL_SUCCESS=$((TOTAL_SUCCESS + SUCCESS))
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))

    echo "  Success: $SUCCESS | Failed: $FAILED | Skipped: $SKIPPED | Remaining: $REMAINING"

    # Check if done
    if [ "$NEXT_OFFSET" = "null" ] || [ "$REMAINING" = "0" ]; then
        echo ""
        echo "=== DONE ==="
        echo "Total success: $TOTAL_SUCCESS"
        echo "Total failed: $TOTAL_FAILED"
        echo "Total skipped: $TOTAL_SKIPPED"
        echo "Log: $LOGFILE"
        exit 0
    fi

    OFFSET=$NEXT_OFFSET
    echo "  Waiting ${DELAY}s..."
    sleep "$DELAY"
done
