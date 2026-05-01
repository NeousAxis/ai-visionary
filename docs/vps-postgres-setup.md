# VPS Postgres 16 — Setup Reference

> Installed: 2026-04-28 on `aya-bot` VPS (`beta.ai-visionary.xyz`, IP `83.228.229.212`)
> Purpose: Local staging database for ~50 000 scraped AYA entities while Supabase is in grace period (until 2026-05-07).

---

## What Was Installed

| Package | Version |
|---------|---------|
| `postgresql-16` | 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) |
| `postgresql-contrib` | 16 |
| `python3-psycopg2` | system package |

OS: Ubuntu 24.04.4 LTS (Noble)

---

## Database & Role

| Item | Value |
|------|-------|
| Database | `aya_local` |
| Role | `aya_app` |
| Password | `***` (see `.env.local` on VPS) |
| Auth method | `scram-sha-256` |
| Listen address | `localhost` only (NOT exposed to internet) |

---

## Connection String

```
postgresql://aya_app:***@localhost:5432/aya_local
```

Connect manually (from the VPS):
```bash
PGPASSWORD='<password>' psql -h localhost -U aya_app -d aya_local
```

Connect as postgres superuser (from the VPS):
```bash
sudo -u postgres psql -d aya_local
```

---

## Schema — `aya_registry` Table

Mirrors the Supabase `aya_registry` table for migration parity.

```sql
CREATE TABLE aya_registry (
  entity_id          UUID PRIMARY KEY,
  legal_name         TEXT,
  display_name       TEXT,
  entity_type        TEXT,
  country_legal      TEXT,
  sector_macro       TEXT,
  website            TEXT,
  asr_score          INTEGER,
  payment_completed  BOOLEAN DEFAULT false,
  contact_email      TEXT,
  data_origin        TEXT,
  asr_payload        JSONB,
  recommendability   JSONB,
  valid_until        TIMESTAMPTZ,
  last_update        TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  missing_contact_email  BOOLEAN DEFAULT false,
  email_research_status  TEXT
);

CREATE INDEX idx_aya_website ON aya_registry (website);
CREATE INDEX idx_aya_sector  ON aya_registry (sector_macro);
CREATE INDEX idx_aya_country ON aya_registry (country_legal);
CREATE INDEX idx_aya_paid    ON aya_registry (payment_completed);
```

---

## Security Configuration

**`/etc/postgresql/16/main/pg_hba.conf`** (appended entry):
```
host aya_local aya_app 127.0.0.1/32 scram-sha-256
```

**`/etc/postgresql/16/main/postgresql.conf`** (changed):
```
listen_addresses = 'localhost'
```

Port 5432 is NOT exposed to the internet. Only local connections from 127.0.0.1 are accepted for `aya_app`.

---

## Daily Backup Cron

Runs at 03:00 UTC every day. Registered in ubuntu's crontab on the VPS.

```cron
0 3 * * * PGPASSWORD='...' pg_dump -h localhost -U aya_app aya_local | gzip > /home/ubuntu/backups/aya_local_$(date +%Y-%m-%d).sql.gz
```

Backups stored at: `/home/ubuntu/backups/` on the VPS.

---

## Restore a Backup

```bash
# On the VPS
gunzip -c /home/ubuntu/backups/aya_local_2026-05-01.sql.gz | PGPASSWORD='...' psql -h localhost -U aya_app -d aya_local
```

---

## Environment Variables (VPS `/home/ubuntu/app/.env.local`)

```
VPS_PG_HOST=localhost
VPS_PG_PORT=5432
VPS_PG_DB=aya_local
VPS_PG_USER=aya_app
VPS_PG_PASSWORD=***
```

---

## Push AYA Bot Data to Local Postgres

After the Supabase grace period ends (2026-05-07), use `push_to_aya.py` targeting the local DB. Until then, push only to local Postgres using a psycopg2 connection string built from `VPS_PG_*` env vars.

Example push command (adapt `push_to_aya.py` to accept `--target local`):
```bash
cd /home/ubuntu/app/aya
python push_to_aya.py --target local --min-score 20
```

---

## Systemd Service

The Postgres instance runs as `postgresql@16-main.service`:
```bash
sudo systemctl status postgresql@16-main
sudo systemctl restart postgresql@16-main
```
