"""
AYA : lecture par le bot des sites venus de Web Data Commons.

Les entites chargees le 4 juin 2026 depuis Web Data Commons (data_origin
FUSION-WDC et FUSION-WDC-MIN3) portent toutes un score par defaut de 20.0 :
leur site n'a jamais ete lu. Ce script les fait lire par le bot AYA (memes
scraper, parser et generator que run_pipeline_fast.py, aucun LLM) et remplace
ce score par defaut par le score reellement mesure.

Regles :
- reprenable : la table aya_bot_reads sert de registre, une entite deja
  traitee n'est jamais relue (relancer le script reprend ou il s'est arrete) ;
- un site que le bot n'a pas vraiment pu lire garde son score actuel : injoignable,
  mur anti-bot, domaine en parking, page sans texte, redirection vers un autre
  site, page par defaut ou site en construction (voir page_check.py) ;
- si le reseau du VPS tombe (presque tout echoue sans reponse HTTP), le run
  s'arrete sans enregistrer ces faux echecs, PM2 le relance plus tard ;
- seules les lignes encore d'origine WDC et non payantes sont modifiees ;
- domaines de la blocklist (porno, armes) et entites is_adult : non lus.

Retour arriere (ne touche que les notes posees par ce script et jamais modifiees depuis) :
    UPDATE aya_registry r SET asr_score = b.score_before
    FROM aya_bot_reads b
    WHERE b.entity_id = r.entity_id AND b.status = 'read' AND r.asr_score = b.score_after
      AND r.data_origin IN ('FUSION-WDC', 'FUSION-WDC-MIN3') AND r.payment_completed IS NOT TRUE;

Usage (sur le VPS, depuis ~/aya) :
    venv/bin/python -u read_wdc_sites.py [--workers 16] [--limit N] [--dry-run]
    venv/bin/python read_wdc_sites.py --status [--telegram]
"""

import os
import random
import socket
import signal
import statistics
import sys
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime

import psycopg2
import requests
from psycopg2.extras import Json, execute_values

import scraper
from blocklist import is_blocked
from page_check import READABLE, classify_homepage
from generator import build_record, save_record
from parser import get_domain

WDC_ORIGINS = ("FUSION-WDC", "FUSION-WDC-MIN3")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "data_wdc")
ENV_FILE = "/home/ubuntu/app/.env.local"
TELEGRAM_ENV = "/home/ubuntu/aya-report/telegram.env"
FLUSH_EVERY = 100
SHUFFLE_SEED = 20261014
STUCK_AFTER = 300          # secondes : au dela, une lecture est abandonnee (serveur qui retient le bot)
OUTAGE_RATIO = 0.95        # part d'un lot echouee sans reponse HTTP qui declenche la verification reseau
PROBE_HOSTS = ("infomaniak.com", "admin.ch", "wikipedia.org")

scraper.TIMEOUT = 8  # meme valeur que run_pipeline_fast.py (plafond de taille, UTF-8 et relances : scraper.fetch_url)
def db_password() -> str:
    pw = os.environ.get("VPS_PG_PASSWORD", "")
    if pw:
        return pw
    with open(ENV_FILE, encoding="utf-8") as f:
        for line in f:
            if line.startswith("VPS_PG_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("VPS_PG_PASSWORD introuvable")


def connect():
    return psycopg2.connect(host="localhost", dbname="aya_local", user="aya_app", password=db_password())


def ensure_table(conn):
    with conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS aya_bot_reads (
                entity_id    uuid PRIMARY KEY,
                domain       text NOT NULL,
                data_origin  text NOT NULL,
                status       text NOT NULL,  -- read | unreachable | blocked | parked | no_text | redirected | placeholder | error | skipped
                http_status  int,
                final_url    text,
                score_before numeric(5,1),
                score_after  numeric(5,1),
                scoring      jsonb,
                error        text,
                read_at      timestamptz NOT NULL DEFAULT now()
            )""")
        cur.execute("CREATE INDEX IF NOT EXISTS aya_bot_reads_status_idx ON aya_bot_reads (status)")


def pending_rows(conn) -> list:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT r.entity_id::text, COALESCE(NULLIF(r.website, ''), r.website_normalized),
                   r.data_origin, r.asr_score, COALESCE(r.is_adult, false)
            FROM aya_registry r
            LEFT JOIN aya_bot_reads b ON b.entity_id = r.entity_id
            WHERE r.data_origin IN %s AND r.payment_completed IS NOT TRUE AND b.entity_id IS NULL
        """, (WDC_ORIGINS,))
        return cur.fetchall()


def read_site(row) -> dict:
    eid, site, origin, before, _ = row
    res = {"entity_id": eid, "domain": site, "data_origin": origin, "score_before": before,
           "status": "error", "http_status": None, "final_url": None,
           "score_after": None, "scoring": None, "error": None}
    try:
        base = scraper.normalize_url(site)
        home = scraper.fetch_homepage(base)
        res["http_status"], res["final_url"] = home["status_code"], home["url"]
        status, reason = classify_homepage(home, base)
        if status != READABLE:
            res["status"], res["error"] = status, reason
            return res
        # meme assemblage que scraper.scrape_site, sans relire la page d'accueil
        scraped = {
            "input_url": base,
            "canonical_domain": get_domain(home["url"] or base),
            "homepage": home,
            "sitemap": scraper.fetch_sitemap(base),
            "key_pages": scraper.fetch_key_pages(base, home),
        }
        record = build_record(scraped)
        save_record(record, folder=OUT_DIR)
        res["status"] = "read"
        res["score_after"] = int(record["aio_scoring"]["final_score"])
        res["scoring"] = {
            "aio_scoring": record["aio_scoring"],
            "structured_data_found": record["source"]["structured_data_found"],
            "blocks_present": record["aoi_readiness"]["blocks_present"],
            "pages_scanned_count": record["source"]["pages_scanned_count"],
        }
    except Exception as e:
        res["status"] = "error"
        res["error"] = f"{type(e).__name__}: {e}"[:300]
    return res


def flush(conn_box: list, batch: list):
    reads = [(r["entity_id"], r["domain"], r["data_origin"], r["status"], r["http_status"],
              r["final_url"], r["score_before"], r["score_after"],
              Json(r["scoring"]) if r["scoring"] else None, r["error"]) for r in batch]
    scores = [(r["entity_id"], r["score_after"]) for r in batch if r["status"] == "read"]
    for attempt in range(6):
        try:
            conn = conn_box[0]
            with conn, conn.cursor() as cur:
                execute_values(cur, """
                    INSERT INTO aya_bot_reads (entity_id, domain, data_origin, status, http_status,
                        final_url, score_before, score_after, scoring, error)
                    VALUES %s ON CONFLICT (entity_id) DO NOTHING""", reads,
                    template="(%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s)")
                if scores:
                    execute_values(cur, """
                        UPDATE aya_registry AS a SET asr_score = v.score::numeric, updated_at = now()
                        FROM (VALUES %s) AS v(entity_id, score)
                        WHERE a.entity_id = v.entity_id::uuid
                          AND a.data_origin IN ('FUSION-WDC', 'FUSION-WDC-MIN3')
                          AND a.payment_completed IS NOT TRUE""", scores)
            return
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            print(f"[db] {type(e).__name__}, reconnexion ({attempt + 1}/6)", flush=True)
            time.sleep(10 * (attempt + 1))
            try:
                conn_box[0] = connect()
            except Exception:
                pass
    raise SystemExit("[db] base injoignable, arret (relancer reprend ou on en etait)")


STATUS_LABELS = {"read": "lus et notes", "unreachable": "injoignables", "blocked": "bloques (anti-bot)",
                 "parked": "domaines en parking", "no_text": "sans texte (JS)",
                 "redirected": "rediriges vers un autre site",
                 "placeholder": "pages par defaut ou en construction", "error": "erreurs",
                 "skipped": "ecartes (blocklist/adulte)"}


def status_text(conn) -> str:
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM aya_registry WHERE data_origin IN %s", (WDC_ORIGINS,))
        total = cur.fetchone()[0]
        cur.execute("SELECT status, count(*) FROM aya_bot_reads GROUP BY 1 ORDER BY 2 DESC")
        by_status = dict(cur.fetchall())
        cur.execute("""SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY score_after), round(avg(score_after), 1)
                       FROM aya_bot_reads WHERE status = 'read'""")
        med, avg = cur.fetchone()
        # rythme du run en cours : 6 dernieres heures, a partir de la derniere interruption de plus de 10 min
        cur.execute("""
            WITH r AS (SELECT read_at, read_at - lag(read_at) OVER (ORDER BY read_at) AS gap
                       FROM aya_bot_reads WHERE status <> 'skipped' AND read_at > now() - interval '6 hours'),
                 s AS (SELECT COALESCE(max(read_at) FILTER (WHERE gap > interval '10 minutes'), min(read_at)) AS t0 FROM r)
            SELECT count(*), EXTRACT(EPOCH FROM now() - (SELECT t0 FROM s)) / 3600
            FROM r WHERE read_at >= (SELECT t0 FROM s)""")
        recent, hours = cur.fetchone()
    done = sum(by_status.values())
    lines = [f"AYA, lecture des sites WDC : {done:,} / {total:,} traites ({done / max(total, 1):.1%})"]
    if done >= total:
        lines[0] += " · TERMINE"
    for key, label in STATUS_LABELS.items():
        if by_status.get(key):
            lines.append(f"  {label} : {by_status[key]:,}")
    if med is not None:
        lines.append(f"Score des sites lus : mediane {med:g}/100, moyenne {avg}")
    if recent and hours and done < total:
        per_hour = recent / max(float(hours), 0.25)
        lines.append(f"Rythme : {per_hour:,.0f} sites/h, fin estimee dans {(total - done) / per_hour / 24:.1f} j")
    return "\n".join(lines)


def send_telegram(text: str):
    """Canal d'alerte de Cyril (meme bot et meme chat que la sentinelle du VPS)."""
    conf = {}
    try:
        with open(TELEGRAM_ENV, encoding="utf-8") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    conf[k] = v.strip().strip('"')
        requests.post(f"https://api.telegram.org/bot{conf['TELEGRAM_TOKEN']}/sendMessage",
                      json={"chat_id": conf["TELEGRAM_CHAT_ID"], "text": text,
                            "disable_web_page_preview": True}, timeout=15)
    except Exception as e:
        print(f"[telegram] envoi impossible : {type(e).__name__}", flush=True)


def network_ok() -> bool:
    """Le VPS joint-il encore Internet ? (resolution DNS + connexion TCP 443)"""
    for host in PROBE_HOSTS:
        try:
            socket.create_connection((host, 443), timeout=5).close()
            return True
        except OSError:
            continue
    return False


def main():
    args = sys.argv[1:]
    workers = int(args[args.index("--workers") + 1]) if "--workers" in args else 16
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None
    dry = "--dry-run" in args

    conn_box = [connect()]
    if "--status" in args:
        text = status_text(conn_box[0])
        print(text)
        if "--telegram" in args and "TERMINE" not in text:   # la fin est annoncee une fois par le run
            send_telegram(text)
        return
    ensure_table(conn_box[0])

    rows = pending_rows(conn_box[0])
    random.Random(SHUFFLE_SEED).shuffle(rows)

    skipped, todo = [], []
    for row in rows:
        blocked, _ = is_blocked(scraper.normalize_url(row[1]).split("//", 1)[-1])
        if blocked or row[4]:
            skipped.append({"entity_id": row[0], "domain": row[1], "data_origin": row[2],
                            "score_before": row[3], "status": "skipped", "http_status": None,
                            "final_url": None, "score_after": None, "scoring": None,
                            "error": "blocklist" if blocked else "is_adult"})
        else:
            todo.append(row)
    if skipped and not dry:
        for i in range(0, len(skipped), 1000):
            flush(conn_box, skipped[i:i + 1000])
    if limit:
        todo = todo[:limit]

    total = len(todo)
    print(f"=== AYA, lecture des sites WDC · {datetime.now():%Y-%m-%d %H:%M} ===", flush=True)
    print(f"A lire : {total:,} · ecartes (blocklist/adulte) : {len(skipped):,} · workers : {workers}"
          f"{' · DRY RUN' if dry else ''}", flush=True)

    stop = {"flag": False}

    def on_signal(signum, _frame):
        stop["flag"] = True
        print(f"[signal {signum}] arret propre demande", flush=True)

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    counts = {"read": 0, "unreachable": 0, "blocked": 0, "parked": 0, "no_text": 0, "redirected": 0,
              "placeholder": 0, "error": 0}
    scores, batch = [], []
    t0, done, it = time.time(), 0, iter(todo)

    def report():
        rate = done / max(time.time() - t0, 1e-6) * 3600
        med = statistics.median(scores) if scores else 0
        eta = (total - done) / max(rate, 1) / 24
        print(f"[{datetime.now():%m-%d %H:%M}] {done:,}/{total:,} · lus {counts['read']:,}"
              f" · injoignables {counts['unreachable']:,} · bloques {counts['blocked']:,}"
              f" · parking {counts['parked']:,} · sans texte {counts['no_text']:,}"
              f" · rediriges {counts['redirected']:,} · en construction {counts['placeholder']:,}"
              f" · erreurs {counts['error']:,}"
              f" · {rate:,.0f}/h · reste {eta:.1f} j · mediane {med:g}", flush=True)

    ex = ThreadPoolExecutor(max_workers=workers)
    inflight, started = set(), {}
    outage = False

    def record(res):
        nonlocal done
        done += 1
        counts[res["status"]] = counts.get(res["status"], 0) + 1
        if res["status"] == "read":
            scores.append(res["score_after"])
        if dry:
            print(f"  {res['status']:<11} {str(res['score_after']):>4}  {res['domain']}"
                  f"  {res['error'] or ''}", flush=True)
        else:
            batch.append(res)

    while True:
        while not stop["flag"] and len(inflight) < workers * 2:
            row = next(it, None)
            if row is None:
                break
            fut = ex.submit(read_site, row)
            inflight.add(fut)
            started[fut] = (time.monotonic(), row)
        if not inflight:
            break
        finished, inflight = wait(inflight, timeout=30, return_when=FIRST_COMPLETED)
        for fut in finished:
            started.pop(fut, None)
            record(fut.result())
        # lecture bloquee par un serveur qui retient la connexion : on l'abandonne
        now = time.monotonic()
        for fut in [f for f in inflight if now - started[f][0] > STUCK_AFTER]:
            inflight.discard(fut)
            row = started.pop(fut)[1]
            record({"entity_id": row[0], "domain": row[1], "data_origin": row[2], "score_before": row[3],
                    "status": "error", "http_status": None, "final_url": None, "score_after": None,
                    "scoring": None, "error": f"stuck > {STUCK_AFTER}s"})
        if stop["flag"]:
            break   # arret demande : les lectures en cours seront refaites a la relance
        if len(batch) >= FLUSH_EVERY:
            # panne reseau du VPS : ne pas enregistrer des centaines de faux "injoignables"
            no_answer = [r for r in batch if r["status"] in ("unreachable", "error") and r["http_status"] is None]
            if len(no_answer) >= OUTAGE_RATIO * len(batch) and not network_ok():
                batch = [r for r in batch if r not in no_answer]
                outage = stop["flag"] = True
                print("[reseau] le VPS ne joint plus Internet : arret sans enregistrer ces echecs", flush=True)
                send_telegram("Lecture des sites WDC suspendue : le VPS ne joint plus Internet. "
                              "PM2 la relance dans 15 min.")
                break
            flush(conn_box, batch)
            batch = []
            report()
    if batch:
        flush(conn_box, batch)
    report()
    print("=== arret propre ===" if stop["flag"] else "=== termine ===", flush=True)
    if not (stop["flag"] or dry or limit):
        send_telegram("Lecture des sites WDC TERMINEE.\n" + status_text(conn_box[0]))
    # des threads peuvent rester accroches a un serveur lent : ne pas les attendre
    sys.stdout.flush()
    os._exit(3 if outage else 0)


if __name__ == "__main__":
    main()
