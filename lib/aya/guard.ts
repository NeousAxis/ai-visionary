// lib/aya/guard.ts
//
// Protections des routes publiques /api/aya/ask et /api/aya/contact.
//
// - Limite par IP RÉELLE : nginx écrit l'IP de connexion dans X-Real-IP
//   ($remote_addr), alors que X-Forwarded-For garde ce que le client envoie
//   ($proxy_add_x_forwarded_for) et peut donc être falsifié.
// - Nombre de recherches simultanées borné, pour ne jamais occuper plus de deux
//   des cinq connexions Postgres partagées avec tout le site.

import type { NextRequest } from 'next/server';

export function realIp(req: NextRequest): string {
    return (req.headers.get('x-real-ip') || '').trim() || 'local';
}

const buckets = new Map<string, { n: number; reset: number }>();
let lastSweep = Date.now();

/** Vrai si l'appel est autorisé (au plus `max` appels par fenêtre de `windowMs`). */
export function allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    if (now - lastSweep > 60_000) {
        lastSweep = now;
        for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    }
    const b = buckets.get(key);
    if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
    b.n += 1;
    return b.n <= max;
}

let running = 0;
const waiting: (() => void)[] = [];

/** Exécute fn avec au plus `max` exécutions simultanées ; null si l'attente dépasse waitMs. */
export async function withSlot<T>(fn: () => Promise<T>, max = 2, waitMs = 8_000): Promise<T | null> {
    if (running >= max) {
        const ok = await new Promise<boolean>((resolve) => {
            const go = () => { clearTimeout(timer); resolve(true); };
            const timer = setTimeout(() => {
                const i = waiting.indexOf(go);
                if (i >= 0) waiting.splice(i, 1);
                resolve(false);
            }, waitMs);
            waiting.push(go);
        });
        if (!ok) return null;
    }
    running += 1;
    try {
        return await fn();
    } finally {
        running -= 1;
        waiting.shift()?.();
    }
}
