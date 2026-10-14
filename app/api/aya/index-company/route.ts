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
//
// Un site qu'AYO n'a pas réellement lu (parking, mur anti-bot, page vide, redirection vers
// un autre site) n'est jamais inscrit : la porte est dans fetchHtml (14.10.2026).

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runAllAgents, mergeAgentResultsToExtract } from '@/lib/micro-agents/orchestrator';
import { computeAioScore } from '@/lib/aio-score-engine';
import { indexEntityFromDiagnostic, type ExistingEntityRow } from '@/lib/aya/registry';
import { db } from '@/lib/db';

export const maxDuration = 60;

/**
 * Une ligne AYO-SCAN non payee plus vieille que ca est rescannee quand un agent la demande :
 * c'est le seul chemin qui corrige un score ecrit sur une page non lue. Sans seuil, n'importe
 * quel agent pourrait forcer un scan payant a chaque appel de get_company_details.
 */
const RESCAN_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** Un meme domaine n'est scanne qu'une fois par heure, quel que soit le nombre d'agents. */
const SCAN_COOLDOWN_MS = 60 * 60 * 1000;
/** Dernier scan lance par domaine (process PM2 unique sur le VPS, une Map suffit). */
const recentScans = new Map<string, { at: number; outcome: string }>();

function rememberScan(bare: string, outcome: string) {
  if (recentScans.size > 5000) {
    const cutoff = Date.now() - SCAN_COOLDOWN_MS;
    for (const [k, v] of recentScans) if (v.at < cutoff) recentScans.delete(k);
  }
  recentScans.set(bare, { at: Date.now(), outcome });
}

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

  // 1. Dédup — déjà dans AYA ? (rapide, ms) → on ne re-scanne pas (économie + pas de doublon),
  // sauf une ligne AYO-SCAN non payée trop ancienne : elle peut porter un score faux.
  let existing: ExistingEntityRow | null = null;
  try {
    existing = await db.getAyaEntityByUrl(target);
  } catch (e) {
    console.error('[index-company] dedup check failed:', e instanceof Error ? e.message : e);
    // En cas d'erreur de lecture on s'abstient (évite les doublons).
    return NextResponse.json({ error: 'lookup failed' }, { status: 503 });
  }
  const existingId = existing?.entity_id || existing?.aya_entity_id;
  const existsResponse = (refreshing: boolean) => NextResponse.json({
    status: 'exists',
    domain: bare,
    entity_id: existingId,
    certificate_url: `https://ai-visionary.xyz/aya/e/${existingId}`,
    message: refreshing ? 'Already in AYA — AYO is rescanning the site to refresh its score.' : 'Already in AYA — nothing to do.',
  });
  const lastUpdate = existing?.last_update ? new Date(existing.last_update).getTime() : 0;
  const staleOwnRow = Boolean(existing && existingId
    && existing.data_origin === 'AYO-SCAN' && existing.payment_completed !== true
    && Date.now() - lastUpdate > RESCAN_AFTER_MS);
  if (existing && existingId && !staleOwnRow) return existsResponse(false);

  // Un scan de ce domaine a deja ete lance il y a moins d'une heure : on rend son issue.
  const recent = recentScans.get(bare);
  if (recent && Date.now() - recent.at < SCAN_COOLDOWN_MS) {
    if (existing && existingId) return existsResponse(false);
    if (recent.outcome.startsWith('unreadable')) {
      const reason = recent.outcome.split(':')[1] || 'unreachable';
      return NextResponse.json({
        status: 'not_indexed',
        domain: bare,
        reason,
        message: `AYO could not read this website (${reason}), so it was not added to AYA: AYO only scores sites it has actually read.`,
      });
    }
    if (recent.outcome === 'failed') {
      return NextResponse.json({ status: 'not_indexed', domain: bare, reason: 'scan_failed', message: 'The AYO scan of this site failed recently. Try again later.' });
    }
    return NextResponse.json({ status: 'indexing', domain: bare, message: 'AYO is already scanning this site. Call get_company_details again shortly.' });
  }
  rememberScan(bare, 'scanning');

  // 2. Scan AYO + index en tâche de fond (non bloquant pour l'agent).
  after(async () => {
    try {
      const { fetchResult, results, events } = await runAllAgents(target);
      if (!fetchResult.isReachable) {
        // Site non lu : rien n'est ecrit. Une ligne existante reste telle quelle (elle ne se
        // corrige que par un scan lisible).
        const reason = fetchResult.unreadableReason || 'unreachable';
        console.log(`[index-company] ${bare} non lisible (${reason}: ${fetchResult.unreadableDetail || ''}) — not indexed.`);
        rememberScan(bare, `unreadable:${reason}`);
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
        rememberScan(bare, 'failed');
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
        contentChars: fetchResult.textContent.length,
        name: id.legal_name?.value || id.name?.value || '',
        country: id.country?.value || '',
        sector: extract.source.scan.industry_keywords?.[0] || '',
        contactEmail: (id.contact_email?.value && id.contact_email.value !== 'contact_form')
          ? id.contact_email.value : undefined,
      });
      rememberScan(bare, entityId ? 'indexed' : 'failed');
      console.log(`[index-company] ${bare} indexed via AYO — entity_id=${entityId} score=${score.total}`);
    } catch (e) {
      rememberScan(bare, 'failed');
      console.error(`[index-company] background scan failed for ${bare}:`, e instanceof Error ? e.message : e);
    }
  });

  if (staleOwnRow) return existsResponse(true);

  return NextResponse.json({
    status: 'indexing',
    domain: bare,
    message: 'Scanning the site via AYO and indexing it into AYA — the entry will be available within ~30 seconds. Call get_company_details again shortly to read its AIO score.',
  });
}
