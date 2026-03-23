"""
AYA API — Serves indexed entities, search, and ASR_DERIVED data.
"""

import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AYA API",
    description="AI-readiness index for organizations. Search, browse, and retrieve ASR_DERIVED records.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

DATA_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def load_all_records() -> list:
    records = []
    if not os.path.exists(DATA_FOLDER):
        return records
    for filename in sorted(os.listdir(DATA_FOLDER)):
        if filename.endswith(".json"):
            path = os.path.join(DATA_FOLDER, filename)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    records.append(json.load(f))
            except (json.JSONDecodeError, OSError):
                pass
    return records


def record_to_summary(record: dict) -> dict:
    sector = record.get("sector", {})
    return {
        "name": record.get("entity", {}).get("name", ""),
        "domain": record.get("source", {}).get("canonical_domain", ""),
        "website": record.get("entity", {}).get("website", ""),
        "country": record.get("entity", {}).get("country", ""),
        "city": record.get("entity", {}).get("city", ""),
        "sector": sector.get("sector_label", "") if sector else "",
        "sector_id": sector.get("sector_id", "") if sector else "",
        "aio_score": record.get("aoi_readiness", {}).get("estimated_aio_score", 0),
        "blocks_present": len(record.get("aoi_readiness", {}).get("blocks_present", [])),
        "blocks_missing": len(record.get("aoi_readiness", {}).get("blocks_missing", [])),
        "asr_status": record.get("asr_derived", {}).get("asr_status", ""),
        "has_jsonld": record.get("source", {}).get("structured_data_found", {}).get("jsonld_found", False),
        "confidence": record.get("asr_derived", {}).get("confidence", 0),
    }


@app.get("/")
def root():
    records = load_all_records()
    return {
        "name": "AYA API",
        "version": "0.1.0",
        "status": "ok",
        "total_entities": len(records),
        "endpoints": {
            "search": "/search?q=<query>",
            "list": "/entities?limit=50&offset=0&sort=score",
            "entity": "/entity/{domain}",
            "asr": "/asr/{domain}",
            "stats": "/stats",
            "docs": "/docs",
        },
    }


@app.get("/search")
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(50, ge=1, le=200),
):
    q_lower = q.lower()
    results = []
    for record in load_all_records():
        name = record.get("entity", {}).get("name", "").lower()
        domain = record.get("source", {}).get("canonical_domain", "").lower()
        desc = record.get("aio_blocks", {}).get("offre", {}).get("fields", {}).get("meta_description", "").lower()
        country = record.get("entity", {}).get("country", "").lower()

        if q_lower in name or q_lower in domain or q_lower in desc or q_lower in country:
            results.append(record_to_summary(record))

    results.sort(key=lambda x: x["aio_score"], reverse=True)
    return {
        "query": q,
        "count": len(results[:limit]),
        "total_matches": len(results),
        "results": results[:limit],
    }


@app.get("/entities")
def list_entities(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort: str = Query("score", description="Sort by: score, name, domain"),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    sector: Optional[str] = Query(None, description="Filter by sector_id"),
    country: Optional[str] = Query(None, description="Filter by country code"),
    has_jsonld: Optional[bool] = Query(None, description="Filter by JSON-LD presence"),
):
    records = load_all_records()
    summaries = [record_to_summary(r) for r in records]

    if min_score is not None:
        summaries = [s for s in summaries if s["aio_score"] >= min_score]
    if sector:
        summaries = [s for s in summaries if s.get("sector_id") == sector]
    if country:
        summaries = [s for s in summaries if s.get("country", "").upper() == country.upper()]
    if has_jsonld is not None:
        summaries = [s for s in summaries if s.get("has_jsonld") == has_jsonld]

    if sort == "name":
        summaries.sort(key=lambda x: x["name"].lower())
    elif sort == "domain":
        summaries.sort(key=lambda x: x["domain"])
    else:
        summaries.sort(key=lambda x: x["aio_score"], reverse=True)

    return {
        "total": len(summaries),
        "offset": offset,
        "limit": limit,
        "results": summaries[offset : offset + limit],
    }


@app.get("/entity/{domain}")
def get_entity(domain: str):
    path = os.path.join(DATA_FOLDER, f"{domain}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Entity '{domain}' not found")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/asr/{domain}")
def get_asr(domain: str):
    path = os.path.join(DATA_FOLDER, f"{domain}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"ASR not found for '{domain}'")
    with open(path, "r", encoding="utf-8") as f:
        record = json.load(f)
    return {
        "entity": record.get("entity", {}),
        "aio_blocks": record.get("aio_blocks", {}),
        "aio_scoring": record.get("aio_scoring", {}),
        "aoi_readiness": record.get("aoi_readiness", {}),
        "asr_derived": record.get("asr_derived", {}),
    }


@app.get("/stats")
def stats():
    records = load_all_records()
    if not records:
        return {"total": 0, "avg_score": 0, "with_jsonld": 0, "with_sitemap": 0}

    scores = [r.get("aoi_readiness", {}).get("estimated_aio_score", 0) for r in records]
    with_jsonld = sum(
        1 for r in records
        if r.get("source", {}).get("structured_data_found", {}).get("jsonld_found")
    )
    with_sitemap = sum(
        1 for r in records
        if r.get("source", {}).get("structured_data_found", {}).get("sitemap_found")
    )

    # Sector breakdown
    sectors = {}
    countries = {}
    for r in records:
        s = r.get("sector", {})
        sid = s.get("sector_id", "unknown") if s else "unknown"
        sectors[sid] = sectors.get(sid, 0) + 1
        c = r.get("entity", {}).get("country", "") or "unknown"
        countries[c] = countries.get(c, 0) + 1

    return {
        "total": len(records),
        "avg_score": round(sum(scores) / len(scores), 1),
        "min_score": min(scores),
        "max_score": max(scores),
        "with_jsonld": with_jsonld,
        "with_sitemap": with_sitemap,
        "pct_jsonld": round(with_jsonld / len(records) * 100, 1),
        "pct_sitemap": round(with_sitemap / len(records) * 100, 1),
        "by_sector": dict(sorted(sectors.items(), key=lambda x: x[1], reverse=True)),
        "by_country": dict(sorted(countries.items(), key=lambda x: x[1], reverse=True)),
    }
