#!/usr/bin/env python3
"""Réécriture COMPLÈTE du dataset HuggingFace depuis le Postgres du VPS.

`export_huggingface_vps.py` ne fait que de l'ajout (dédup par entity_id) : il ne
corrige jamais une ligne déjà publiée. Après une correction de masse en base,
comme les 309 pays non ISO du 1er octobre 2026, il faut republier les deux
fichiers en entier, et c'est le rôle de ce script.

La forme des lignes vient de `export_huggingface.py` et l'extraction de
`export_github_flat_vps.py` (score >= 20, jamais de contenu adulte), donc les
surfaces HuggingFace et GitHub ne peuvent pas diverger. HuggingFace sert les
fichiers en clair, GitHub les sert gzippés.

Usage, sur le VPS (Postgres en localhost), avec le venv qui porte psycopg2 et
huggingface_hub :
    ./venv/bin/python export_huggingface_full_vps.py            # dry-run, fichiers locaux
    ./venv/bin/python export_huggingface_full_vps.py --apply    # envoi vers HF Hub
"""

import argparse
import csv
import json
import os
import sys
from pathlib import Path

try:
    from huggingface_hub import HfApi
except ImportError:
    print("ERROR: huggingface_hub not installed. Run: pip install huggingface_hub")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from export_github_flat_vps import (  # noqa: E402
    _json_default,
    _plain,
    fetch_vps_entities,
    load_env,
)
from export_huggingface import (  # noqa: E402
    entity_to_csv_row,
    entity_to_jsonl_row,
)
from export_huggingface_vps import (  # noqa: E402
    CSV_FIELDS,
    CSV_NAME,
    HF_REPO_ID,
    HF_REPO_TYPE,
    JSONL_NAME,
)

PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")
OUT_DIR = Path(SCRIPT_DIR) / "exports"


def load_hf_token() -> str:
    token = os.environ.get("HF_TOKEN")
    if token:
        return token
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("HF_TOKEN="):
                return line.partition("=")[2].strip().strip('"').strip("'")
    print(f"ERROR: HF_TOKEN absent de {ENV_FILE}")
    sys.exit(1)


def write_files(entities: list) -> tuple:
    """Mêmes lignes que l'export GitHub, sans gzip (HuggingFace sert en clair)."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / CSV_NAME
    jsonl_path = OUT_DIR / JSONL_NAME

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for entity in entities:
            writer.writerow({k: _plain(v) for k, v in entity_to_csv_row(entity).items()})

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for entity in entities:
            f.write(json.dumps(entity_to_jsonl_row(entity), ensure_ascii=False, default=_json_default) + "\n")

    return csv_path, jsonl_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Republie tout le dataset HuggingFace depuis le registre du VPS")
    parser.add_argument("--apply", action="store_true", help="Envoie vers HF Hub (défaut : dry-run)")
    args = parser.parse_args()

    print("=" * 62)
    print("AYA Registry -> HuggingFace (réécriture complète)")
    print(f"Mode : {'APPLY (envoi)' if args.apply else 'DRY-RUN (fichiers locaux)'}")
    print("=" * 62)

    load_env()
    token = load_hf_token()

    print("\n[1/3] Lecture du Postgres VPS...")
    entities = fetch_vps_entities()
    certified = sum(1 for e in entities if e.get("payment_completed"))
    countries = len({e.get("country_legal") for e in entities if e.get("country_legal")})
    print(f"      {len(entities):,} entités, {certified} certifiées, {countries} pays")

    print("\n[2/3] Écriture des deux fichiers...")
    csv_path, jsonl_path = write_files(entities)
    for path in (csv_path, jsonl_path):
        print(f"      {path}  ({path.stat().st_size:,} octets)")

    if not args.apply:
        print("\n[3/3] DRY-RUN : rien n'est envoyé. Relancer avec --apply.")
        return

    print("\n[3/3] Envoi vers HF Hub...")
    api = HfApi(token=token)
    message = f"Full rewrite from the VPS registry: {len(entities):,} entities"
    for path, name in ((csv_path, CSV_NAME), (jsonl_path, JSONL_NAME)):
        api.upload_file(
            path_or_fileobj=str(path),
            path_in_repo=name,
            repo_id=HF_REPO_ID,
            repo_type=HF_REPO_TYPE,
            commit_message=message,
        )
        print(f"      ✓ {name} envoyé")

    print(f"\nTerminé : https://huggingface.co/datasets/{HF_REPO_ID}")


if __name__ == "__main__":
    main()
