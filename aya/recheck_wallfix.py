"""
Relecture du 14.10.2026 apres le correctif de page_check.py (commit 5fd9631d).

Avant ce correctif, read_wdc_sites.py a :
- note 3 a 7/100 des murs anti-bot servis en 200 (« request is being verified ») ;
- refuse de vrais sites a cause d'un reCAPTCHA de formulaire ou du script Cloudflare
  (status blocked alors que la page repondait 200) ;
- classe redirected des sites qui ne changent que d'un tiret (tecease.com vers tec-ease.com).

Ce script remet ces entites dans l'etat d'avant leur lecture, pour que le bot les relise
avec le nouveau code au prochain demarrage :
  A. read note 7 ou moins : asr_score revient a score_before (seulement si la note du bot
     est encore en place), puis la ligne aya_bot_reads est supprimee ;
  B. blocked servi en 200 : ligne supprimee (le registre n'avait pas ete touche) ;
  C. redirected que same_site accepte desormais : ligne supprimee.
Seules les entites encore d'origine WDC et non payantes sont concernees. Les lignes
supprimees sont copiees dans aya_bot_reads_bak_wallfix, avec la note du registre au moment
du correctif. A lancer bot arrete (pm2 stop aya-wdc-read).

Retour arriere :
    UPDATE aya_registry r SET asr_score = k.registry_score_at_fix
    FROM aya_bot_reads_bak_wallfix k WHERE k.entity_id = r.entity_id AND k.fix_group = 'A'
      AND r.asr_score = k.score_before;
    INSERT INTO aya_bot_reads SELECT entity_id, domain, data_origin, status, http_status, final_url,
        score_before, score_after, scoring, error, read_at
    FROM aya_bot_reads_bak_wallfix ON CONFLICT (entity_id) DO NOTHING;

Usage (sur le VPS, depuis ~/aya) : venv/bin/python recheck_wallfix.py [--apply]
"""

import sys
from urllib.parse import urlparse

from psycopg2.extras import execute_values

import scraper
from page_check import same_site
from read_wdc_sites import WDC_ORIGINS, connect

ELIGIBLE = "r.data_origin IN %(origins)s AND r.payment_completed IS NOT TRUE"


def hyphen_redirects(cur) -> list:
    cur.execute(f"""
        SELECT b.entity_id::text, b.domain, b.final_url FROM aya_bot_reads b
        JOIN aya_registry r USING (entity_id)
        WHERE b.status = 'redirected' AND b.final_url IS NOT NULL AND {ELIGIBLE}""",
        {"origins": WDC_ORIGINS})
    ids = []
    for eid, domain, final_url in cur.fetchall():
        asked = urlparse(scraper.normalize_url(domain)).hostname or ""
        final = urlparse(final_url).hostname or ""
        if asked and final and same_site(asked, final):
            ids.append(eid)
    return ids


def main():
    apply = "--apply" in sys.argv[1:]
    conn = connect()
    with conn.cursor() as cur:
        cur.execute("CREATE TEMP TABLE wallfix_targets (entity_id uuid PRIMARY KEY, fix_group text) ON COMMIT DROP")
        cur.execute(f"""
            INSERT INTO wallfix_targets
            SELECT b.entity_id, 'A' FROM aya_bot_reads b JOIN aya_registry r USING (entity_id)
            WHERE b.status = 'read' AND b.score_after <= 7 AND b.score_before IS NOT NULL
              AND r.asr_score = b.score_after AND {ELIGIBLE}""", {"origins": WDC_ORIGINS})
        cur.execute(f"""
            INSERT INTO wallfix_targets
            SELECT b.entity_id, 'B' FROM aya_bot_reads b JOIN aya_registry r USING (entity_id)
            WHERE b.status = 'blocked' AND b.http_status = 200 AND {ELIGIBLE}""", {"origins": WDC_ORIGINS})
        execute_values(cur, "INSERT INTO wallfix_targets VALUES %s",
                       [(eid, "C") for eid in hyphen_redirects(cur)], template="(%s::uuid, %s)")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS aya_bot_reads_bak_wallfix AS
            SELECT b.*, r.asr_score AS registry_score_at_fix, ''::text AS fix_group, now() AS fixed_at
            FROM aya_bot_reads b JOIN aya_registry r USING (entity_id) WHERE false""")
        cur.execute("""
            INSERT INTO aya_bot_reads_bak_wallfix
            SELECT b.*, r.asr_score, t.fix_group, now()
            FROM wallfix_targets t JOIN aya_bot_reads b USING (entity_id) JOIN aya_registry r USING (entity_id)""")
        backed_up = cur.rowcount
        cur.execute("""
            UPDATE aya_registry r SET asr_score = b.score_before, updated_at = now()
            FROM wallfix_targets t JOIN aya_bot_reads b USING (entity_id)
            WHERE t.fix_group = 'A' AND r.entity_id = t.entity_id AND r.asr_score = b.score_after""")
        restored = cur.rowcount
        cur.execute("DELETE FROM aya_bot_reads b USING wallfix_targets t WHERE b.entity_id = t.entity_id")
        deleted = cur.rowcount
        cur.execute("SELECT fix_group, count(*) FROM wallfix_targets GROUP BY 1 ORDER BY 1")
        groups = dict(cur.fetchall())

    print(f"A (lus notes <= 7) : {groups.get('A', 0)} · B (bloques en 200) : {groups.get('B', 0)}"
          f" · C (redirections a un tiret pres) : {groups.get('C', 0)}")
    print(f"sauvegardees : {backed_up} · notes remises a score_before : {restored} · lignes supprimees : {deleted}")
    if apply and backed_up == deleted == sum(groups.values()) and restored == groups.get("A", 0):
        conn.commit()
        print("APPLIQUE")
    else:
        conn.rollback()
        print("essai a blanc, rien n'est ecrit" if not apply else "comptes incoherents, ANNULE")


if __name__ == "__main__":
    main()
