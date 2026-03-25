"""
Merge domains_web3_ai.txt into domains.txt without duplicates.

Usage:
    python merge_domains.py
"""

import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_FILE = os.path.join(SCRIPT_DIR, "domains.txt")
WEB3_AI_FILE = os.path.join(SCRIPT_DIR, "domains_web3_ai.txt")


def normalize(domain: str) -> str:
    d = domain.strip().lower()
    d = d.replace("https://", "").replace("http://", "")
    if d.startswith("www."):
        d = d[4:]
    d = d.rstrip("/")
    return d


def main():
    if not os.path.exists(WEB3_AI_FILE):
        print(f"ERROR: {WEB3_AI_FILE} not found")
        return

    # Load existing domains (normalized for dedup)
    existing_raw = []
    existing_normalized = set()
    if os.path.exists(MAIN_FILE):
        with open(MAIN_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    existing_raw.append(line)
                    existing_normalized.add(normalize(line))

    # Load new domains
    new_domains = []
    with open(WEB3_AI_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                new_domains.append(line)

    # Find truly new domains
    added = []
    for d in new_domains:
        n = normalize(d)
        if n and n not in existing_normalized:
            existing_normalized.add(n)
            # Store as https:// URL for consistency with existing format
            url = d if d.startswith("http") else f"https://{d}"
            added.append(url)

    # Append to file
    if added:
        with open(MAIN_FILE, "a") as f:
            f.write("\n")
            for url in added:
                f.write(f"{url}\n")

    print(f"Existing: {len(existing_raw)} domains")
    print(f"New file: {len(new_domains)} domains")
    print(f"Added: {len(added)} new domains (duplicates skipped: {len(new_domains) - len(added)})")
    print(f"Total: {len(existing_raw) + len(added)} domains in domains.txt")


if __name__ == "__main__":
    main()
