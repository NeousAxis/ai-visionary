"""
AYA Fast Pipeline — Parallel scraping + record generation for all domains.
Uses ThreadPoolExecutor (10 workers), 8s timeout, real-time progress.
"""

import time
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import scraper
from scraper import scrape_site
from generator import build_record, save_record

# Override timeout to 8s
scraper.TIMEOUT = 8

MAX_WORKERS = 10
DOMAINS_FILE = "domains.txt"

# Allow override via --file <path>
for _i, _arg in enumerate(sys.argv):
    if _arg == "--file" and _i + 1 < len(sys.argv):
        DOMAINS_FILE = sys.argv[_i + 1]
    if _arg == "--workers" and _i + 1 < len(sys.argv):
        MAX_WORKERS = int(sys.argv[_i + 1])


def load_domains(path: str) -> list[str]:
    # Blocklist filter — exclude porn/weapons domains
    try:
        from blocklist import is_blocked
    except ImportError:
        is_blocked = lambda d: (False, '')

    domains = []
    blocked_count = 0
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            blocked, reason = is_blocked(line)
            if blocked:
                blocked_count += 1
                continue
            domains.append(line)
    if blocked_count > 0:
        print(f"[blocklist] {blocked_count} domains filtered out (porn/weapons)")
    return domains


# Thread-safe counters
lock = threading.Lock()
stats = {"success": 0, "error": 0, "done": 0}


def process_domain(url: str) -> dict:
    """Scrape one domain, build record, save to disk. Returns summary."""
    try:
        scraped = scrape_site(url)
        record = build_record(scraped)
        filepath = save_record(record)
        score = record["aio_scoring"]["final_score"]
        name = record["entity"]["name"][:40]
        return {"url": url, "ok": True, "score": score, "name": name, "file": filepath}
    except Exception as e:
        return {"url": url, "ok": False, "error": str(e)[:120]}


def main():
    domains = load_domains(DOMAINS_FILE)
    total = len(domains)
    print(f"=== AYA Fast Pipeline ===")
    print(f"Domaines : {total}")
    print(f"Workers  : {MAX_WORKERS}")
    print(f"Timeout  : {scraper.TIMEOUT}s")
    print(f"{'='*50}")
    print()

    t0 = time.time()
    errors = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_domain, url): url for url in domains}

        for future in as_completed(futures):
            result = future.result()
            with lock:
                stats["done"] += 1
                n = stats["done"]
                if result["ok"]:
                    stats["success"] += 1
                    print(
                        f"[{n:3d}/{total}] OK  {result['score']:3d}/100  {result['name']:<40s}  {result['url']}",
                        flush=True,
                    )
                else:
                    stats["error"] += 1
                    errors.append(result)
                    print(
                        f"[{n:3d}/{total}] ERR {result['url']}  — {result['error']}",
                        flush=True,
                    )

    elapsed = time.time() - t0

    print()
    print(f"{'='*50}")
    print(f"=== RÉSUMÉ ===")
    print(f"Total     : {total}")
    print(f"Succès    : {stats['success']}")
    print(f"Erreurs   : {stats['error']}")
    print(f"Temps     : {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"Vitesse   : {total/elapsed:.1f} domaines/s")

    if errors:
        print(f"\n--- Domaines en erreur ---")
        for e in errors:
            print(f"  {e['url']}  — {e['error']}")

    print()
    print("Fichiers sauvegardés dans data/")


if __name__ == "__main__":
    main()
