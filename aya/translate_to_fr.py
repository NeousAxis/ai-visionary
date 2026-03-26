"""
Translate gemini_description (EN) to gemini_description_fr (FR) for all entities missing FR.
Uses UPDATE — safe, no data loss. Retry on 429.

Usage:
    cd ~/AI\ VISIONARY/aya && python3 translate_to_fr.py
"""

import os, sys, json, time, re
from urllib.parse import urlparse

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"), "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip().strip('"')

from supabase import create_client
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

print("=== FR Translation ===")
print("Fetching all entities...", flush=True)
all_ent = []
offset = 0
while True:
    batch = sb.table("aya_registry").select("entity_id,display_name,website,asr_payload").range(offset, offset + 999).execute()
    all_ent.extend(batch.data or [])
    if len(batch.data or []) < 1000: break
    offset += 1000
    print(f"  {len(all_ent)} loaded...", flush=True)

needs = []
for e in all_ent:
    p = e.get("asr_payload") or {}
    if isinstance(p, str):
        try: p = json.loads(p)
        except: p = {}
    enr = p.get("enrichment") or {}
    has_en = bool(enr.get("gemini_description") and len(str(enr["gemini_description"])) > 10)
    has_fr = bool(enr.get("gemini_description_fr") and len(str(enr["gemini_description_fr"])) > 10)
    if has_en and not has_fr:
        needs.append(e)

print(f"Total: {len(all_ent)} | Already have FR: {len(all_ent)-len(needs)} | Need FR: {len(needs)}")
if not needs:
    print("All good!")
    sys.exit(0)

BATCH_SIZE = 20
done = 0
failed = 0

for i in range(0, len(needs), BATCH_SIZE):
    batch = needs[i:i + BATCH_SIZE]
    bn = i // BATCH_SIZE + 1
    tb = (len(needs) + BATCH_SIZE - 1) // BATCH_SIZE

    lines = []
    for j, e in enumerate(batch):
        p = e.get("asr_payload") or {}
        if isinstance(p, str):
            try: p = json.loads(p)
            except: p = {}
        en = p.get("enrichment", {}).get("gemini_description", "")
        name = e.get("display_name") or ""
        lines.append(f'{j+1}. {name} | EN: "{en}"')

    prompt = f"""Translate each English company description to French. Keep it factual, 1 sentence max.
Return ONLY a JSON array of strings (French translations), same order.

{chr(10).join(lines)}"""

    results = None
    for attempt in range(3):
        try:
            resp = model.generate_content(prompt)
            text = resp.text.strip()
            match = re.search(r'\[.*\]', text, re.DOTALL)
            results = json.loads(match.group()) if match else None
            break
        except Exception as ex:
            if "429" in str(ex) and attempt < 2:
                wait = 30 * (attempt + 1)
                print(f"  ⏳ Rate limit 429 — retry in {wait}s (attempt {attempt+1}/3)", flush=True)
                time.sleep(wait)
                continue
            print(f"  ERROR batch {bn}: {ex}", flush=True)
            break

    if not results:
        failed += len(batch)
        continue

    for entity, fr in zip(batch, results):
        if not fr or not isinstance(fr, str) or len(fr) < 5:
            failed += 1
            continue
        eid = entity["entity_id"]
        try:
            payload = entity.get("asr_payload") or {}
            if isinstance(payload, str):
                try: payload = json.loads(payload)
                except: payload = {}
            payload.setdefault("enrichment", {})["gemini_description_fr"] = fr
            sb.table("aya_registry").update({"asr_payload": payload}).eq("entity_id", eid).execute()
            done += 1
        except Exception as ex:
            print(f"  FAIL {eid}: {ex}", flush=True)
            failed += 1

    sample_fr = results[0][:50] if results and results[0] else "?"
    print(f"Batch {bn}/{tb} — {done}/{len(needs)} done (sample: {sample_fr}...)", flush=True)
    time.sleep(4)

print(f"\n=== Done: {done} translated, {failed} failed ===", flush=True)
