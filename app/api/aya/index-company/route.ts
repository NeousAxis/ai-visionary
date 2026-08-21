// app/api/aya/index-company/route.ts
// Indexe dans AYA une entreprise découverte par la recherche d'un agent, EN PASSANT PAR AYO.
//
// Flux : un agent (via le MCP distant) trouve une entreprise absente d'AYA → appelle cet
// endpoint avec son domaine → AYO scanne le site (micro-agents) → entrée INDEXÉE dans le
// registre (data_origin='AYO-SCAN', payment_completed=false, dédup par URL).
//
// Réponse IMMÉDIATE : si l'entité existe déjà → renvoyée tout de suite ; sinon le scan tourne
// en tâche de fond (next/after, le process PM2 du VPS le mène à terme) et l'entrée apparaît
// dans ~30s. Pas de blocage de l'agent.

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runAllAgents, mergeAgentResultsToExtract } from '@/lib/micro-agents/orchestrator';
import { computeAioScore } from '@/lib/aio-score-engine';
import { indexEntityFromDiagnostic } from '@/lib/aya/registry';
import { db } from '@/lib/db';

export const maxDuration = 60;

function toBareDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0];
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const raw = (body.url || body.domain || '').toString().trim();
  if (!raw) {
    return NextResponse.json({ error: 'url or domain required' }, { status: 400 });
  }

  const bare = toBareDomain(raw);
  if (!bare || bare.length < 3 || !bare.includes('.')) {
    return NextResponse.json({ error: 'invalid domain', domain: bare }, { status: 400 });
  }
  const target = `https://${bare}`;

  // 1. Dédup — déjà dans AYA ? (rapide, ms) → on ne re-scanne pas (économie + pas de doublon)
  try {
    const existing = await db.getAyaEntityByUrl(target);
    const existingId = existing?.entity_id || existing?.aya_entity_id;
    if (existing && existingId) {
      return NextResponse.json({
        status: 'exists',
        domain: bare,
        entity_id: existingId,
        certificate_url: `https://ai-visionary.xyz/aya/e/${existingId}`,
        message: 'Already in AYA — nothing to do.',
      });
    }
  } catch (e) {
    console.error('[index-company] dedup check failed:', e instanceof Error ? e.message : e);
    // En cas d'erreur de lecture on s'abstient (évite les doublons).
    return NextResponse.json({ error: 'lookup failed' }, { status: 503 });
  }

  // 2. Scan AYO + index en tâche de fond (non bloquant pour l'agent).
  after(async () => {
    try {
      const { fetchResult, results, events } = await runAllAgents(target);
      if (!fetchResult.isReachable) {
        console.log(`[index-company] ${bare} unreachable — not indexed.`);
        return;
      }
      // Panne LLM != site vide : un score plancher ecrit ici serait PERMANENT (la dedup
      // par URL fait que tout scan correct ulterieur est un no-op). Meme garde-fou que
      // /api/diagnostic/scan (incident groupealliance.eu, 19 aout 2026).
      const degraded: string[] = events.filter((e) => e.status === 'error').map((e) => e.agent);
      const extract = await mergeAgentResultsToExtract(target, fetchResult, results, (a) => {
        if (!degraded.includes(a)) degraded.push(a);
      });
      if (degraded.length > 0) {
        console.error(`[index-company] ${bare} NON indexe — scan degrade (${degraded.join(', ')})`);
        return;
      }

      // Mêmes ajustements de caps que le diagnostic V2 (app/api/diagnostic/scan/route.ts) :
      // on neutralise les caps non-ASR ; le cap doctrinal 50-sans-ASR reste actif.
      extract.source.scan.has_jsonld = true;
      if (extract.fields.engagements_conformite.certifications.q === 0) {
        extract.fields.engagements_conformite.certifications.evidence = ['v2_no_cap'];
        extract.fields.engagements_conformite.certifications.na = true;
      }
      if (extract.fields.indicateurs.key_indicators.q > 0) {
        extract.fields.indicateurs.key_indicators.evidence = ['v2_no_cap', 'https://v2-scan'];
      }
      if (!extract.fields.indicateurs.last_review_date.value) {
        extract.fields.indicateurs.last_review_date.na = true;
      }

      const score = computeAioScore(extract);
      const id = extract.fields.identite;
      const entityId = await indexEntityFromDiagnostic({
        url: fetchResult.url,
        score: score.total,
        name: id.legal_name?.value || id.name?.value || '',
        country: id.country?.value || '',
        sector: extract.source.scan.industry_keywords?.[0] || '',
        contactEmail: (id.contact_email?.value && id.contact_email.value !== 'contact_form')
          ? id.contact_email.value : undefined,
      });
      console.log(`[index-company] ${bare} indexed via AYO — entity_id=${entityId} score=${score.total}`);
    } catch (e) {
      console.error(`[index-company] background scan failed for ${bare}:`, e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({
    status: 'indexing',
    domain: bare,
    message: 'Scanning the site via AYO and indexing it into AYA — the entry will be available within ~30 seconds. Call get_company_details again shortly to read its AIO score.',
  });
}
