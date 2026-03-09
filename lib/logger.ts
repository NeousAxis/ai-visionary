import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import crypto from 'crypto';

// ============================================================
// AYO Structured Logger — Centralized logging with correlation IDs
// Writes to: console (structured for Vercel) + Firestore 'system_logs'
// ============================================================

export type LogLevel = 'info' | 'warn' | 'error' | 'critical';
export type LogSource = 'chat' | 'webhook' | 'scanner' | 'crypto' | 'db' | 'auth' | 'admin' | 'checkout' | 'email' | 'system' | 'stripe';

interface LogEntry {
    correlation_id: string;
    level: LogLevel;
    source: LogSource;
    step: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp: string;
}

/** Generate a unique correlation ID for a session */
export function generateCorrelationId(): string {
    return `ayo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Get Firestore instance safely (returns null if not initialized) */
function getDb() {
    if (!getApps().length) return null;
    try {
        return getFirestore();
    } catch {
        return null;
    }
}

/** Format log for Vercel console output */
function formatConsoleLog(entry: LogEntry): string {
    const levelEmoji: Record<LogLevel, string> = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        critical: '🔴',
    };
    return `${levelEmoji[entry.level]} [AYO:${entry.correlation_id}] [${entry.source.toUpperCase()}] [${entry.step}] ${entry.message}`;
}

/** Write log entry to Firestore (non-blocking, best-effort) */
async function persistLog(entry: LogEntry): Promise<void> {
    const db = getDb();
    if (!db) return;

    try {
        await db.collection('system_logs').add({
            ...entry,
            _created: new Date().toISOString(),
        });
    } catch {
        // Silent fail — logging should never break the app
    }
}

/** Main log function */
export function log(
    correlationId: string,
    level: LogLevel,
    source: LogSource,
    step: string,
    message: string,
    data?: Record<string, unknown>
): void {
    const entry: LogEntry = {
        correlation_id: correlationId,
        level,
        source,
        step,
        message,
        data,
        timestamp: new Date().toISOString(),
    };

    // Console output (structured for Vercel logs)
    const formatted = formatConsoleLog(entry);
    switch (level) {
        case 'critical':
        case 'error':
            console.error(formatted, data ? JSON.stringify(data) : '');
            break;
        case 'warn':
            console.warn(formatted, data ? JSON.stringify(data) : '');
            break;
        default:
            console.log(formatted, data ? JSON.stringify(data) : '');
    }

    // Async persist to Firestore (fire-and-forget)
    persistLog(entry).catch(() => {});
}

/** Create a scoped logger for a specific source + correlation ID */
export function createLogger(correlationId: string, source: LogSource) {
    return {
        info: (step: string, message: string, data?: Record<string, unknown>) =>
            log(correlationId, 'info', source, step, message, data),
        warn: (step: string, message: string, data?: Record<string, unknown>) =>
            log(correlationId, 'warn', source, step, message, data),
        error: (step: string, message: string, data?: Record<string, unknown>) =>
            log(correlationId, 'error', source, step, message, data),
        critical: (step: string, message: string, data?: Record<string, unknown>) =>
            log(correlationId, 'critical', source, step, message, data),
        correlationId,
    };
}
