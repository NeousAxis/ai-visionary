"""
AYA Pipeline — Scrapes domains and generates AYA_PREINDEX records.
"""

import sys
import time

from scraper import scrape_site
from generator import build_record, save_record


def load_domains(filepath: str = "domains.txt") -> list:
    with open(filepath, "r", encoding="utf-8") as f:
        lines = []
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                lines.append(line)
        return lines


def main():
    filepath = sys.argv[1] if len(sys.argv) > 1 else "domains.txt"
    domains = load_domains(filepath)
    print(f"=== AYA Pipeline — {len(domains)} domains to process ===\n")

    success = 0
    errors = 0

    for i, domain in enumerate(domains, 1):
        print(f"[{i}/{len(domains)}] {domain}")
        try:
            t0 = time.time()
            scraped = scrape_site(domain)
            record = build_record(scraped)
            filepath_out = save_record(record)
            elapsed = round(time.time() - t0, 1)

            score = record["aoi_readiness"]["estimated_aio_score"]
            name = record["entity"]["name"][:40]
            blocks = len(record["aoi_readiness"]["blocks_present"])

            print(f"  -> {name} | score={score} | blocks={blocks}/7 | {elapsed}s")
            print(f"  -> Saved: {filepath_out}")
            success += 1
        except Exception as e:
            print(f"  -> ERROR: {e}")
            errors += 1

    print(f"\n=== Done: {success} OK, {errors} errors ===")


if __name__ == "__main__":
    main()
