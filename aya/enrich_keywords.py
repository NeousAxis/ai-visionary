"""
Generate business keywords for all AYA entities using Gemini.
Skips entities that already have gemini_keywords.

Usage:
    cd ~/AI\ VISIONARY/aya && python3 enrich_keywords.py

Requires: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in ../.env.local
"""

import os, json, time, re, sys

# Load env
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

from urllib.parse import urlparse
def domain_from_url(url):
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return (parsed.hostname or "").replace("www.", "")
    except:
        return url

# Fetch ALL entities in one paginated pass
print("Fetching all entities...", flush=True)
all_ent = []
offset = 0
while True:
    batch = sb.table("aya_registry").select("entity_id,display_name,legal_name,website,sector_macro,asr_payload").range(offset, offset + 999).execute()
    all_ent.extend(batch.data or [])
    if len(batch.data or []) < 1000:
        break
    offset += 1000
    print(f"  {len(all_ent)} loaded...", flush=True)

# Filter: only entities without gemini_keywords
needs = []
for e in all_ent:
    p = e.get("asr_payload") or {}
    if isinstance(p, str):
        try: p = json.loads(p)
        except: p = {}
    if not p.get("enrichment", {}).get("gemini_keywords"):
        needs.append(e)

print(f"Total: {len(all_ent)} | Already done: {len(all_ent) - len(needs)} | Need keywords: {len(needs)}", flush=True)
if not needs:
    print("Nothing to do!")
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
        name = e.get("display_name") or e.get("legal_name") or ""
        domain = domain_from_url(e.get("website", ""))
        sector = e.get("sector_macro", "")
        p = e.get("asr_payload") or {}
        if isinstance(p, str):
            try: p = json.loads(p)
            except: p = {}
        desc = p.get("enrichment", {}).get("gemini_description", "")
        lines.append(f'{j + 1}. {name} | {domain} | {sector} | "{desc[:100]}"')

    prompt = f"""For each company, generate 5-8 business keywords from their description.
Keywords = their actual activity (football, automobile, banking, cloud computing, etc).
NO generic: service, platform, app, website, solution, digital, company, business.
Return ONLY a JSON array of arrays of strings.

{chr(10).join(lines)}"""

    try:
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        match = re.search(r'\[.*\]', text, re.DOTALL)
        results = json.loads(match.group()) if match else [None] * len(batch)
    except Exception as ex:
        print(f"  ERROR batch {bn}: {ex}", flush=True)
        time.sleep(5)
        continue

    for entity, kws in zip(batch, results):
        if not kws or not isinstance(kws, list):
            failed += 1
            continue
        eid = entity["entity_id"]
        try:
            full = sb.table("aya_registry").select("*").eq("entity_id", eid).single().execute()
            if not full.data:
                failed += 1
                continue
            row = full.data
            payload = row.get("asr_payload") or {}
            if isinstance(payload, str):
                try: payload = json.loads(payload)
                except: payload = {}
            payload.setdefault("enrichment", {})["gemini_keywords"] = kws
            # DELETE + INSERT (trigger workaround)
            sb.table("aya_registry").delete().eq("entity_id", eid).execute()
            new_row = {k: v for k, v in row.items() if k != "website_normalized"}
            new_row["asr_payload"] = payload
            sb.table("aya_registry").insert(new_row).execute()
            done += 1
        except Exception as ex:
            failed += 1

    sample = results[0][:3] if results and results[0] else "?"
    print(f"Batch {bn}/{tb} — {done}/{len(needs)} done (sample: {sample})", flush=True)
    time.sleep(4)

print(f"\n=== Done: {done} keywords generated, {failed} failed ===", flush=True)
