#!/usr/bin/env python3
"""Normalise country_legal -> ISO-2 sur TOUT le registre (déterministe, gratuit). UPDATE seulement les changés."""
import os, sys, pathlib, psycopg2
# Normaliseur strict partagé (aya/country_iso.py) : dépôt, dossier du script (copie scp), puis prod VPS.
for _p in (pathlib.Path(__file__).resolve().parent.parent, pathlib.Path(__file__).resolve().parent, pathlib.Path("/home/ubuntu/app/aya")):
    if (_p / "country_iso.py").exists():
        sys.path.insert(0, str(_p)); break
from country_iso import to_iso_country, is_iso_country
PW=os.environ["VPS_PG_PASSWORD"]

def norm(v):
    # Ancien piège : `len(s)==2 and s.isalpha()` gardait « 日本 », « 台灣 », « РФ » tels quels (16 sept. 2026).
    return to_iso_country(v)  # inconnu -> None -> ne pas toucher

conn=psycopg2.connect(host="localhost",dbname="aya_local",user="aya_app",password=PW)
cur=conn.cursor()
cur.execute("SELECT entity_id, country_legal FROM aya_registry WHERE country_legal IS NOT NULL")
rows=cur.fetchall()
changes=[];
for eid, c in rows:
    n=norm(c)
    if n and n!=c:
        changes.append((n, eid))
print(f"{len(rows)} entités · {len(changes)} à normaliser")
from psycopg2.extras import execute_batch
execute_batch(cur, "UPDATE aya_registry SET country_legal=%s, updated_at=now() WHERE entity_id=%s", changes, page_size=1000)
conn.commit()
print(f"=== {len(changes)} pays normalisés ===")
cur.execute("SELECT country_legal, count(*) c FROM aya_registry WHERE country_legal IS NOT NULL GROUP BY 1 ORDER BY c DESC")
counts=cur.fetchall()
print("top pays après:", counts[:12])
# Contrôle réel contre la liste ISO (length()=2 ne prouvait rien : « 日本 » fait 2 caractères).
rest={c: n for c, n in counts if c!="XX" and not is_iso_country(c)}
print("valeurs non ISO restantes (hors XX):", rest or 0)
cur.close(); conn.close()
