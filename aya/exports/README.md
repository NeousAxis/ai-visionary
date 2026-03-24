---
license: cc-by-4.0
task_categories:
  - text-classification
  - question-answering
language:
  - en
  - fr
  - de
tags:
  - business
  - companies
  - ai-readability
  - structured-data
  - organizations
size_categories:
  - 1K<n<10K
---

# AYA Business Dataset

Structured data on 1,800+ businesses worldwide, scored for AI readability (AIO score 0-100).

## Description

The AYA Business Dataset is a curated collection of structured business data extracted from the **AYA Registry**, maintained by [AI Visionary](https://ai-visionary.com) (Geneva, Switzerland). Each entry represents a business entity with standardized fields covering identity, sector, geographic location, AI-readability score, and extracted keywords.

The **AIO score** (AI-readability Intelligence Optimization) measures how well a website communicates structured information to AI systems, on a scale from 0 to 100. It is computed across 7 weighted blocks: Identity, Offer Clarity, Processes, Trust & Compliance, Indicators, Pedagogy, and Technical Foundation.

## Source

Data is sourced from:
- **AYA Bot**: Automated web scraping and analysis of business websites (majority of entries)
- **AYO Diagnostic**: Manual AI-readability audits completed by business owners

Registry URL: [https://ai-visionary.com/aya](https://ai-visionary.com/aya)

## Fields

### CSV format (`aya_business_dataset.csv`)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Business display name |
| `website` | string | Primary website URL |
| `country` | string | ISO 2-letter country code (e.g., CH, FR, US) |
| `sector` | string | Macro sector classification (e.g., technology, finance, healthcare) |
| `entity_type` | string | Organization type: `company`, `association`, `public_body` |
| `aio_score` | integer | AI-readability score (0-100) |
| `certified` | boolean | Whether the entity is a paying AYA-certified member |
| `keywords` | string | Semicolon-separated keywords extracted from the website |
| `source` | string | Always "AYA Registry by AI Visionary" |
| `url` | string | Direct link to the entity's AYA certificate page |

### JSONL format (`aya_business_dataset.jsonl`)

The JSONL format includes all CSV fields plus:

| Field | Type | Description |
|-------|------|-------------|
| `entity_id` | string | Unique UUID identifier |
| `legal_name` | string | Legal/registered name of the entity |
| `description` | string | Short description extracted from the website |
| `data_origin` | string | Data source: `AYA-BOT` (scraped) or `AYO` (user diagnostic) |
| `keywords` | array | List of extracted keywords |
| `services` | array | List of detected services/products |
| `aio_blocks` | object | Individual scores per AIO block (identity, offer, process, trust, indicators, pedagogy, technical) |
| `registry_url` | string | URL of the full AYA registry |

## Usage

### Load with pandas

```python
import pandas as pd

# CSV
df = pd.read_csv("aya_business_dataset.csv")
print(f"{len(df)} businesses from {df['country'].nunique()} countries")

# JSONL
df = pd.read_json("aya_business_dataset.jsonl", lines=True)
```

### Load with HuggingFace datasets

```python
from datasets import load_dataset

dataset = load_dataset("ai-visionary/aya-business-dataset")
```

### Filter by country or sector

```python
swiss = df[df["country"] == "CH"]
tech = df[df["sector"] == "technology"]
high_score = df[df["aio_score"] >= 60]
```

## Use Cases

- **Business intelligence**: Analyze AI-readiness across industries and geographies
- **Text classification**: Train models to classify businesses by sector from structured data
- **Question answering**: Build QA systems over structured business data
- **Recommendation systems**: Use AIO scores and keywords for business matching
- **Research**: Study how well businesses communicate structured data to AI systems

## Data Quality

- Entries with AIO score < 20 are excluded
- Names are cleaned (slogans, generic titles, encoding issues removed)
- Countries are normalized to ISO 2-letter codes
- Contact emails are **not included** (privacy protection)
- Raw ASR payloads are **not included** (size optimization)

## License

This dataset is released under the [Creative Commons Attribution 4.0 International License (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this dataset for any purpose, provided you give appropriate credit to AI Visionary and the AYA Registry.

## Citation

```bibtex
@dataset{aya_business_dataset_2026,
  title={AYA Business Dataset: AI-Readability Scores for Global Businesses},
  author={AI Visionary},
  year={2026},
  url={https://ai-visionary.com/aya},
  license={CC-BY-4.0}
}
```

## Contact

- Website: [ai-visionary.com](https://ai-visionary.com)
- Registry: [ai-visionary.com/aya](https://ai-visionary.com/aya)
- API documentation: [ai-visionary.com/developers](https://ai-visionary.com/developers)
