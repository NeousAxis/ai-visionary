#!/usr/bin/env python3
"""Extrait du WDC min3 les hôtes = entreprise individuelle (host=domaine), format aya_registry."""
import json, re, uuid, collections, sys, pathlib
# Normaliseur strict partagé (aya/country_iso.py) : dépôt, puis prod VPS.
for _p in (pathlib.Path(__file__).resolve().parent.parent, pathlib.Path("/home/ubuntu/app/aya")):
    if (_p / "country_iso.py").exists():
        sys.path.insert(0, str(_p)); break
from country_iso import to_iso_country
IN="/tmp/wdc_min3.jsonl"; OUT="/tmp/aya_min3_consolidated.jsonl"; OBS="2026-06-04"
NS=uuid.NAMESPACE_URL

CC={"fr":"FR","de":"DE","es":"ES","it":"IT","nl":"NL","be":"BE","ch":"CH","at":"AT","pl":"PL","pt":"PT","se":"SE","no":"NO","dk":"DK","fi":"FI","ie":"IE","ca":"CA","jp":"JP","cn":"CN","ru":"RU","cz":"CZ","sk":"SK","hu":"HU","ro":"RO","gr":"GR","si":"SI","hr":"HR","ua":"UA","tr":"TR","za":"ZA","in":"IN","br":"BR","mx":"MX","au":"AU","nz":"NZ","uk":"GB"}
CC2={"co.uk":"GB","com.au":"AU","co.nz":"NZ","co.jp":"JP","co.za":"ZA","com.br":"BR"}
def canon(d): return re.sub(r"^https?://","",str(d or "")).split("/")[0].lower().replace("www.","").split(":")[0]
def tld_c(d):
    p=canon(d).split(".")
    if len(p)>=3 and ".".join(p[-2:]) in CC2: return CC2[".".join(p[-2:])]
    if len(p)>=2 and p[-1] in CC: return CC[p[-1]]
    return None
def norm_c(v,host):
    # Pays déclaré s'il est reconnu par le normaliseur strict, sinon ccTLD du domaine.
    return to_iso_country(v) or tld_c(host)

# group by host
hosts=collections.defaultdict(list)
for l in open(IN):
    o=json.loads(l); hosts[o["listed_by"]].append(o)

rows={}; single=0; skipped_dir=0
for host, items in hosts.items():
    names={(i.get("name") or "").strip().lower() for i in items if i.get("name")}
    if len(names)>2:  # plusieurs noms = annuaire -> skip
        skipped_dir+=1; continue
    single+=1
    dom=canon(host)
    if not dom or "." not in dom: continue
    best=max(items, key=lambda i: len(i.get("name") or ""))
    rows[dom]={
        "entity_id":str(uuid.uuid5(NS,dom)),
        "website":"https://"+dom,
        "legal_name":(best.get("name") or "").strip(),
        "display_name":(best.get("name") or "").strip(),
        "entity_type":"company",
        "country_legal":norm_c(best.get("country_iso"),host),
        "sector_macro":None,"contact_email":None,"data_origin":"FUSION-WDC-MIN3",
        "asr_payload":{"city":best.get("city") or None,"description":best.get("description") or None,
            "telephone":best.get("telephone") or None,"sources":["wdc-localbusiness-min3"],"observed_at":OBS},
    }
with open(OUT,"w",encoding="utf-8") as f:
    for r in rows.values(): f.write(json.dumps(r,ensure_ascii=False)+"\n")
cc=collections.Counter(r["country_legal"] for r in rows.values() if r["country_legal"])
print(f"hôtes total: {len(hosts)} · entreprises individuelles: {single} · annuaires skippés: {skipped_dir}")
print(f"=> {len(rows)} entités domain-keyed -> {OUT} · avec pays: {sum(cc.values())}")
print("top pays:", dict(cc.most_common(10)))
