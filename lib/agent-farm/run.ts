/**
 * lib/agent-farm/run.ts
 *
 * Orchestrateur de la FERME À AGENTS. Fait tourner N agents IA verticaux qui interrogent
 * le registre AYA (via la route /api/pollen-agents/ask) avec des besoins réalistes,
 * récupèrent une recommandation + d'éventuelles offres cashback, et logguent la demande.
 *
 * But : bootstrap du côté demande (on est notre propre premier opérateur d'agent),
 * preuve de la boucle end-to-end, et signal réel « des agents interrogent AYA ».
 *
 * Coût : 2 appels Infomaniak AI par agent (mot-clé + recommandation), modèle suisse
 * in-house. Plafonné par `count` (défaut 10, max 50).
 */

import { pickQuery } from './personas';
import { localPgInsertAgentFarmRun } from '@/lib/db-local-pg';

export interface AgentFarmSummary {
    ran: number;
    with_picks: number;
    with_cashback: number;
    errors: number;
    sample: Array<{ persona: string; query: string; chosen: string | null; cashback: boolean; answer: string | null }>;
}

function baseUrl(): string {
    // Sur le VPS, on tape localhost (pas de round-trip externe, pas de CORS).
    return (process.env.AGENT_FARM_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runOneAgent(i: number): Promise<{ ok: boolean; hadPicks: boolean; hadCashback: boolean; row: any }> {
    const { persona, query } = pickQuery(i);
    const b = baseUrl();
    try {
        const res = await fetch(`${b}/api/pollen-agents/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, locale: persona.lang }),
            signal: AbortSignal.timeout(35000),
        });
        const data = await res.json();
        const picks: any[] = Array.isArray(data?.picks) ? data.picks : [];
        const chosen = picks[0] ?? null;
        const hadCashback = picks.some((p) => p && p.cashback);
        const row = {
            persona: persona.key,
            lang: persona.lang,
            query,
            keyword: data?.keyword ?? null,
            picksCount: picks.length,
            chosenDomain: chosen?.domain ?? null,
            chosenName: chosen?.name ?? chosen?.domain ?? null,
            hadCashback,
            answer: (data?.answer ?? null),
        };
        await localPgInsertAgentFarmRun(row);
        return { ok: true, hadPicks: picks.length > 0, hadCashback, row };
    } catch (err) {
        return { ok: false, hadPicks: false, hadCashback: false, row: { persona: persona.key, query, error: String(err) } };
    }
}

export async function runAgentFarm(opts: { count?: number } = {}): Promise<AgentFarmSummary> {
    const count = Math.min(Math.max(opts.count ?? 10, 1), 50);
    const CONC = 4;
    const gapMs = Number(process.env.AGENT_FARM_GAP_MS || '300');

    const summary: AgentFarmSummary = { ran: 0, with_picks: 0, with_cashback: 0, errors: 0, sample: [] };

    for (let i = 0; i < count; i += CONC) {
        const batch = [];
        for (let j = i; j < Math.min(i + CONC, count); j++) batch.push(runOneAgent(j));
        const results = await Promise.all(batch);
        for (const r of results) {
            summary.ran++;
            if (!r.ok) { summary.errors++; continue; }
            if (r.hadPicks) summary.with_picks++;
            if (r.hadCashback) summary.with_cashback++;
            if (summary.sample.length < 12) {
                summary.sample.push({
                    persona: r.row.persona, query: r.row.query,
                    chosen: r.row.chosenName, cashback: r.hadCashback,
                    answer: r.row.answer ? String(r.row.answer).slice(0, 220) : null,
                });
            }
        }
        if (gapMs) await sleep(gapMs);
    }
    return summary;
}
