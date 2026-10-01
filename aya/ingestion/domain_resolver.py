#!/usr/bin/env python3
"""Résolveur de domaine : nom d'entreprise -> teste les domaines probables en vrai (HTTP) + VÉRIFIE le nom sur la page.
Usage: python3 domain_resolver.py <fichier.jsonl avec legal_name+country_legal> [N] [concurrence]
Sortie: <fichier>.resolved.jsonl (name, country, domain trouvé ou null)."""
import sys, json, re, unicodedata, urllib.request, urllib.error, ssl, pathlib
from concurrent.futures import ThreadPoolExecutor
# Normaliseur strict partagé (aya/country_iso.py) : dépôt, puis prod VPS.
for _p in (pathlib.Path(__file__).resolve().parent.parent, pathlib.Path("/home/ubuntu/app/aya")):
    if (_p / "country_iso.py").exists():
        sys.path.insert(0, str(_p)); break
from country_iso import to_iso_country

IN=sys.argv[1] if len(sys.argv)>1 else "/tmp/zefix_full.jsonl"
N=int(sys.argv[2]) if len(sys.argv)>2 else 200
CONC=int(sys.argv[3]) if len(sys.argv)>3 else 40
CTX=ssl.create_default_context(); CTX.check_hostname=False; CTX.verify_mode=ssl.CERT_NONE
UA={"User-Agent":"Mozilla/5.0 (AYA domain-resolver)"}
# TLD par pays : ccTLD du pays + .com en repli. Cas particuliers (2e niveau) ci-dessous.
TLD_SPECIAL={"CH":[".ch",".com",".swiss"],"GB":[".co.uk",".uk",".com"],"US":[".com",".net",".org"],
 "AU":[".com.au",".au",".com"],"NZ":[".co.nz",".nz",".com"],"JP":[".co.jp",".jp",".com"],
 "ZA":[".co.za",".com"],"BR":[".com.br",".br",".com"],"MX":[".com.mx",".mx",".com"],
 "IN":[".in",".co.in",".com"],"KR":[".co.kr",".kr",".com"],"AE":[".ae",".com"],"SG":[".com.sg",".sg",".com"]}
def iso(country):
    return to_iso_country(country)  # strict : jamais « 日本 » ni « EN » pris pour un code pays
def tlds_for(country):
    cc=iso(country)
    if not cc: return [".com",".net",".org"]
    if cc in TLD_SPECIAL: return TLD_SPECIAL[cc]
    return ["."+cc.lower(),".com"]   # ccTLD du pays + .com pour TOUS les autres pays
# mots à IGNORER (formes juridiques + génériques + géo) — ni dans le slug ni pour vérifier
STOP=set("ag sa sarl gmbh sagl ltd inc llc holding group groupe co kg se plc bv nv srl spa oy ab "
 "fondation foundation stiftung association associazione verein cooperative cooperativa "
 "swiss suisse schweiz svizzera switzerland espace space business businesses solution solutions "
 "complete services service consulting conseil management partners advisors advisory capital "
 "invest investment finance financial trading trade global international worldwide europe "
 "company entreprise enterprise societe société immobiliere immobilier real estate properties "
 "gestion process processus montage formation systeme systems agence atelier centre center maison "
 "online shop store boutique studio projet project sport sports media digital "
 "and the les des une und der die von the für et de la le du en of for".split())

def words(name):
    n=unicodedata.normalize("NFKD",name).encode("ascii","ignore").decode().lower()
    n=re.sub(r"[^a-z0-9 ]"," ",n)
    return [w for w in n.split() if w]
def distinctive(name):
    return [w for w in words(name) if w not in STOP and len(w)>=3]

def slugs(name):
    d=distinctive(name)
    out=[]
    if d:
        out.append("".join(d)); out.append("-".join(d))
        if len(d)>=3: out.append("".join(d[:2]))   # 2 premiers mots distinctifs
        if len(d)==1 and len(d[0])>=5: out.append(d[0])  # mono-mot distinctif seulement
    seen=set(); return [s for s in out if 3<=len(s)<=45 and not (s in seen or seen.add(s))]

def candidates(name,country):
    return [s+t for s in slugs(name) for t in tlds_for(country)]

def tokens(name):
    # vérif sur les mots DISTINCTIFS uniquement (>=4 lettres) — évite "stiftung"/"espace"
    return [w for w in distinctive(name) if len(w)>=4][:3]

def fetch(domain):
    for sch in ("https","http"):
        try:
            req=urllib.request.Request(f"{sch}://{domain}",headers=UA)
            with urllib.request.urlopen(req,timeout=7,context=CTX) as r:
                if r.status<400:
                    return r.read(6000).decode("utf-8","ignore").lower()
        except Exception: continue
    return None

def NAME(rec): return rec.get("legal_name") or rec.get("name") or ""
def CTRY(rec): return rec.get("country_legal") or rec.get("country_iso") or rec.get("country") or ""
def PURP(rec): return rec.get("purpose") or rec.get("description") or None

def resolve(rec):
    name=NAME(rec); country=CTRY(rec)
    toks=tokens(name)
    if not toks: return {**rec,"_domain":None}
    for d in candidates(name,country)[:8]:
        html=fetch(d)
        if html and any(t in html for t in toks) and "domain for sale" not in html and "buy this domain" not in html:
            return {**rec,"_domain":d}
    return {**rec,"_domain":None}

import uuid
OBS="2026-06-04"; DATA_ORIGIN="FUSION-RESOLVED"
recs=[]
for l in open(IN):
    recs.append(json.loads(l))
    if N and len(recs)>=N: break
print(f"Résolution de {len(recs)} noms (concurrence {CONC})…")
res=list(ThreadPoolExecutor(max_workers=CONC).map(resolve,recs))
found=[r for r in res if r.get("_domain")]

# Sortie 1 : format aya_registry (résolus seulement, PRÊT À CHARGER via aya_load_wdc.py)
seen=set()
with open(IN+".aya.jsonl","w",encoding="utf-8") as f:
    for r in found:
        dom=r["_domain"]
        if dom in seen: continue
        seen.add(dom)
        f.write(json.dumps({
            "entity_id":str(uuid.uuid5(uuid.NAMESPACE_URL,dom)),
            "website":"https://"+dom,
            "legal_name":NAME(r),"display_name":NAME(r),
            "entity_type":"company","country_legal":iso(CTRY(r)),  # jamais la valeur brute si elle n'est pas un pays ISO
            "sector_macro":None,"contact_email":None,"data_origin":DATA_ORIGIN,
            "asr_payload":{"description":PURP(r),"city":r.get("city"),
                "uid":r.get("zefix_id"),"sources":["resolved-by-name"],"observed_at":OBS},
        },ensure_ascii=False)+"\n")
print(f"\n=== {len(found)}/{len(res)} sites trouvés ET vérifiés ({round(100*len(found)/max(len(res),1))}%) ===")
print(f"=> {len(seen)} entités prêtes à charger -> {IN}.aya.jsonl (data_origin={DATA_ORIGIN})")
for r in found[:12]: print(f"  {NAME(r)[:42]:42} → {r['_domain']}")
