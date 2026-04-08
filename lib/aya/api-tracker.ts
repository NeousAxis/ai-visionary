/**
 * AYA API Call Tracker
 *
 * In-memory buffer + periodic flush to Supabase.
 * Classifies callers: llm_agent, developer, crawler, browser, unknown.
 * Fire-and-forget — never blocks the API response.
 */

import { NextRequest } from 'next/server';

// ── Caller classification ──────────────────────────────────

export type CallerType = 'llm_agent' | 'developer' | 'crawler' | 'browser' | 'unknown';

const LLM_PATTERNS = [
    'chatgpt', 'gptbot', 'oai-searchbot', 'openai',
    'perplexitybot', 'perplexity',
    'claudebot', 'anthropic', 'claude-web',
    'googleother', 'google-extended', 'gemini',
    'cohere-ai', 'coherebot',
    'ccbot', 'meta-externalagent', 'facebookbot',
    'ai2bot', 'amazonbot', 'bytespider',
];

const CRAWLER_PATTERNS = [
    'bot', 'crawl', 'spider', 'googlebot', 'bingbot',
    'yandex', 'baidu', 'duckduckbot', 'slurp',
];

const DEV_PATTERNS = [
    'curl', 'wget', 'httpie', 'postman', 'insomnia',
    'python-requests', 'axios', 'node-fetch', 'go-http-client',
    'ruby', 'java/', 'okhttp',
];

export function classifyCallerType(userAgent: string): CallerType {
    if (!userAgent) return 'unknown';
    const ua = userAgent.toLowerCase();

    // LLM agents first (some contain "bot" too)
    if (LLM_PATTERNS.some(p => ua.includes(p))) return 'llm_agent';
    if (CRAWLER_PATTERNS.some(p => ua.includes(p))) return 'crawler';
    if (DEV_PATTERNS.some(p => ua.includes(p))) return 'developer';
    if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) return 'browser';
    return 'unknown';
}

// ── In-memory buffer ────────────────────────────────────────

interface BufferEntry {
    count: number;
    sampleUAs: Set<string>;
    domain?: string;
}

// Key: "endpoint:caller_type"
const buffer = new Map<string, BufferEntry>();
let totalBuffered = 0;
let lastFlushTime = Date.now();

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FLUSH_COUNT_THRESHOLD = 100;

/**
 * Track an API call. Non-blocking, fire-and-forget.
 */
export function trackAyaCall(req: NextRequest, endpoint: string, domain?: string): void {
    try {
        const ua = req.headers.get('user-agent') || '';
        const callerType = classifyCallerType(ua);
        const key = `${endpoint}:${callerType}`;

        const entry = buffer.get(key) || { count: 0, sampleUAs: new Set<string>() };
        entry.count++;
        if (ua && entry.sampleUAs.size < 5) entry.sampleUAs.add(ua.slice(0, 200));
        if (domain) entry.domain = domain;
        buffer.set(key, entry);
        totalBuffered++;

        // Flush if threshold reached
        if (totalBuffered >= FLUSH_COUNT_THRESHOLD || Date.now() - lastFlushTime > FLUSH_INTERVAL_MS) {
            flushBuffer().catch(() => {});
        }
    } catch {
        // Never block the API
    }
}

/**
 * Force flush — call from cron or shutdown.
 */
export async function forceFlush(): Promise<number> {
    return flushBuffer();
}

// ── Flush to Supabase ───────────────────────────────────────

async function flushBuffer(): Promise<number> {
    if (buffer.size === 0) return 0;

    // Snapshot and clear
    const snapshot = new Map(buffer);
    const flushedCount = totalBuffered;
    buffer.clear();
    totalBuffered = 0;
    lastFlushTime = Date.now();

    try {
        // Dynamic import to avoid circular deps
        const { db } = await import('@/lib/db');
        const rows = [];

        for (const [key, entry] of snapshot) {
            const [endpoint, callerType] = key.split(':');
            rows.push({
                recorded_at: new Date().toISOString(),
                endpoint,
                caller_type: callerType,
                call_count: entry.count,
                sample_ua: [...entry.sampleUAs][0] || null,
                domain: entry.domain || null,
            });
        }

        await db.insertAyaAnalytics(rows);
        return flushedCount;
    } catch {
        // Put data back on failure
        for (const [key, entry] of snapshot) {
            const existing = buffer.get(key);
            if (existing) {
                existing.count += entry.count;
                entry.sampleUAs.forEach(ua => { if (existing.sampleUAs.size < 5) existing.sampleUAs.add(ua); });
            } else {
                buffer.set(key, entry);
            }
            totalBuffered += entry.count;
        }
        return 0;
    }
}
