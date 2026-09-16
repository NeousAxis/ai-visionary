#!/usr/bin/env python3
"""Consolidation : WDC rest -> format aya_registry (domaine canonique, pays ISO-2, dédup). Fichier seulement."""
import json, re, uuid, collections, sys, pathlib

# Normaliseur strict partagé (aya/country_iso.py) : dépôt, puis prod VPS.
for _p in (pathlib.Path(__file__).resolve().parent.parent, pathlib.Path("/home/ubuntu/app/aya")):
    if (_p / "country_iso.py").exists():
        sys.path.insert(0, str(_p)); break
from country_iso import to_iso_country

IN="/tmp/wdc_global.jsonl"; OUT="/tmp/aya_consolidated.jsonl"; OBS="2026-06-04"
NS=uuid.NAMESPACE_URL  # namespace standard pour entity_id déterministe par domaine

def norm_country(v):
    # Jamais `len(s)==2 and s.isalpha()` : « 日本 » ou « РФ » passaient pour des codes ISO (16 sept. 2026).
    return to_iso_country(v)  # non reconnu -> None, on ne fabrique pas de faux ISO

def canon_domain(d):
    d=re.sub(r"^https?://","",str(d)).split("/")[0].lower().replace("www.","").split(":")[0].strip()
    return d if "." in d else None

best={}  # domaine -> meilleure ligne (plus de champs remplis)
n_in=0; n_country_ok=0; n_country_raw=0
for l in open(IN):
    o=json.loads(l); n_in+=1
    dom=canon_domain(o.get("domain"))
    if not dom: continue
    ci=norm_country(o.get("country_iso"))
    if o.get("country_iso"): n_country_raw+=1
    if ci: n_country_ok+=1
    row={
        "entity_id":str(uuid.uuid5(NS, dom)),
        "website":"https://"+dom,
        "legal_name":(o.get("legal_name") or "").strip(),
        "display_name":(o.get("legal_name") or "").strip(),
        "entity_type":"company",
        "country_legal":ci,
        "sector_macro":None,                       # dérivé plus tard (Infomaniak sélectif)
        "contact_email":None,
        "data_origin":"FUSION-WDC",
        "asr_payload":{
            "city":o.get("city") or None,
            "description":o.get("description") or None,
            "telephone":o.get("telephone") or None,
            "sources":["wdc-localbusiness"],
            "observed_at":OBS,
        },
    }
    cur=best.get(dom)
    fill=sum(1 for x in [row["country_legal"],row["asr_payload"]["city"],row["asr_payload"]["description"],row["asr_payload"]["telephone"]] if x)
    if cur is None or fill>cur[0]:
        best[dom]=(fill,row)

with open(OUT,"w",encoding="utf-8") as f:
    for _,row in best.values():
        f.write(json.dumps(row,ensure_ascii=False)+"\n")

cc=collections.Counter(r["country_legal"] for _,r in best.values() if r["country_legal"])
print(f"=== CONSOLIDATION terminée : {len(best)} entités domain-keyed -> {OUT} ===")
print(f"lignes lues: {n_in} · domaines uniques: {len(best)} (dédup -{n_in-len(best)})")
print(f"pays : {n_country_raw} bruts -> {n_country_ok} normalisés ISO-2 ({round(100*n_country_ok/max(n_country_raw,1))}% reconnus)")
print(f"top pays ISO-2 : {dict(cc.most_common(12))}")
print("\n--- 4 lignes aya_registry produites ---")
for _,r in list(best.values())[:4]:
    print(json.dumps(r,ensure_ascii=False)[:240])
