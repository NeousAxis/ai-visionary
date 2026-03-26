#!/usr/bin/env python3
"""
Migration script: Add lifecycle columns to aya_registry table.
Loads credentials from .env.local and runs ALTER TABLE via Supabase REST API.

Usage:
    cd "~/AI VISIONARY/aya"
    python3 migrate_lifecycle.py
"""

import os
import sys
import httpx
from dotenv import load_dotenv

# Load .env.local from project root
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
load_dotenv(env_path)

SUPABASE_URL = os.getenv('SUPABASE_URL', '').rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    sys.exit(1)

SQL = """
ALTER TABLE aya_registry
ADD COLUMN IF NOT EXISTS pack_type TEXT,
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS next_review_due TIMESTAMP,
ADD COLUMN IF NOT EXISTS renewal_reminder_sent BOOLEAN DEFAULT false;
"""

def run_migration():
    """Execute ALTER TABLE via Supabase REST RPC (pg_query wrapper) or raw SQL endpoint."""
    # Supabase exposes a /rest/v1/rpc endpoint for custom functions.
    # However, ALTER TABLE requires the SQL endpoint at /pg/query (available on newer Supabase)
    # or we can use the supabase-py client's rpc.
    # Simplest approach: use the PostgREST /rpc endpoint if an rpc function exists,
    # or fall back to the management API.

    # Try the raw SQL approach via supabase-py
    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        # supabase-py doesn't have a direct .sql() method, so we use httpx
        # to call the Supabase SQL endpoint directly
        raise ImportError("Using httpx directly")
    except (ImportError, Exception):
        pass

    # Use the Supabase SQL API (available at /pg/query for service_role)
    # This is the most reliable way to run DDL
    headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    }

    # Try multiple SQL execution methods

    # Method 1: /rest/v1/rpc (requires a helper function — may not exist)
    # Method 2: Direct PostgreSQL query via /pg/query (Supabase Management API)
    # Method 3: Use the built-in exec_sql RPC if available

    # First, let's try creating a temporary RPC function and calling it
    # Actually, the simplest way is to use the /rest/v1/rpc endpoint
    # with a pre-existing function, or we can just print the SQL for manual execution.

    print("=" * 60)
    print("AYA Registry — Lifecycle Migration")
    print("=" * 60)
    print()

    # Try the Supabase /pg endpoint (newer versions support this)
    sql_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
    try:
        resp = httpx.post(
            sql_url,
            headers=headers,
            json={"query": SQL.strip()},
            timeout=30,
        )
        if resp.status_code in (200, 201, 204):
            print("✅ Migration executed successfully via exec_sql RPC!")
            return True
        else:
            print(f"⚠️  exec_sql RPC not available (status {resp.status_code})")
    except Exception as e:
        print(f"⚠️  exec_sql RPC failed: {e}")

    # Fallback: execute each ALTER individually via supabase-py postgrest
    # This won't work for DDL — PostgREST only handles DML.
    # So we print the SQL for manual execution in Supabase Dashboard.

    print()
    print("⚠️  Could not execute DDL via API (Supabase PostgREST doesn't support ALTER TABLE).")
    print()
    print("Please run this SQL in the Supabase Dashboard SQL Editor:")
    print("  → https://supabase.com/dashboard/project/hxoywzhrvacdmtopureh/sql/new")
    print()
    print("-" * 60)
    print(SQL.strip())
    print("-" * 60)
    print()

    # Verify if columns already exist by querying a row
    try:
        check_url = f"{SUPABASE_URL}/rest/v1/aya_registry?select=pack_type,subscription_id,subscription_status,next_review_due,renewal_reminder_sent&limit=1"
        resp = httpx.get(check_url, headers=headers, timeout=10)
        if resp.status_code == 200:
            print("✅ Columns already exist! Migration may have been applied previously.")
            return True
        else:
            print(f"❌ Columns do NOT exist yet (status {resp.status_code}). Please run the SQL above.")
            return False
    except Exception as e:
        print(f"⚠️  Could not verify columns: {e}")
        return False


if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
