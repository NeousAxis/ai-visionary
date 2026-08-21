// app/api/diagnostic/scan/route.ts — SSE endpoint for micro-agent scanning

import { NextRequest } from 'next/server';
import { runAllAgents, mergeAgentResultsToExtract } from '@/lib/micro-agents/orchestrator';
import { computeAioScore } from '@/lib/aio-score-engine';
import { db } from '@/lib/db';
import type { AgentEvent } from '@/lib/micro-agents/types';

export const maxDuration = 60; // Puppeteer SPA rendering can take up to 15s

/**
 * Delai maximum accorde a un scan complet. Au-dela, le visiteur reprend la main avec un
 * message clair au lieu de rester devant un ecran qui tourne. Le 21 aout 2026, un
 * ralentissement d'Infomaniak a etire un scan a 179 s : le flux restait ouvert grace au
 * keepalive, mais aucun score n'arrivait jamais. Budget nominal : environ 18 s.
 */
const SCAN_DEADLINE_MS = Number(process.env.SCAN_DEADLINE_MS || 150_000);

export async function POST(req: NextRequest) {
  const { url, email, htmlContent } = await req.json();

  if (!url || typeof url !== 'string') {
    return new Response(JSON.stringify({ error: 'URL required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate optional HTML content (upload fallback) — cap at 2 MB
  const safeHtml = (htmlContent && typeof htmlContent === 'string' && htmlContent.length <= 2_000_000)
    ? htmlContent : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true; // le visiteur a ferme l'onglet, on arrete d'ecrire
        }
      };

      // Battement de coeur SSE. Sans le moindre octet pendant ~45 s, les proxys et les
      // reseaux mobiles coupent la connexion : le visiteur reste devant un ecran fige et
      // le scan ne rend jamais son score (cas denimtearsofficial.fr, 3 aout 2026, coupe
      // deux fois a 48 s). Un commentaire toutes les 10 s garde le tuyau ouvert pendant
      // les phases longues (Puppeteer sur les SPA, appels LLM). Le client ignore toute
      // ligne qui ne commence pas par "data: ", c'est donc transparent pour lui.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          closed = true;
        }
      }, 10000);

      // Filet de securite de bout en bout : le keepalive garde le tuyau ouvert, il ne garantit
      // pas un resultat. Le pipeline peut se bloquer ailleurs que dans le LLM (Puppeteer,
      // Postgres), donc on rend la main au visiteur quoi qu'il arrive.
      const deadline = setTimeout(() => {
        if (closed) return;
        console.error(`[scan] deadline ${SCAN_DEADLINE_MS}ms depassee pour ${url}, flux ferme sans score`);
        send({ phase: 'error', message: 'scan_timeout', timeoutMs: SCAN_DEADLINE_MS });
        clearInterval(heartbeat);
        closed = true;
        try { controller.close(); } catch { /* deja ferme */ }
      }, SCAN_DEADLINE_MS);

      try {
        // Phase 1: Fetch HTML
        send({ phase: 'fetch', status: 'running' });

        const startTime = Date.now();

        // Phase 2: Run all agents with live events
        if (safeHtml) {
          send({ phase: 'fetch', status: 'running', source: 'user_provided' });
        }

        const { fetchResult, results, events } = await runAllAgents(url, (event: AgentEvent) => {
          send({ phase: 'agent', ...event });
        }, safeHtml);

        if (!fetchResult.isReachable) {
          send({ phase: 'error', message: 'Site unreachable', statusCode: fetchResult.statusCode });
          return; // finally block will close controller
        }

        send({ phase: 'fetch', status: 'done', durationMs: Date.now() - startTime });

        // Phase 3: Merge results into AyoExtract
        // Un agent qui n'a pas repondu, ce n'est pas "ce site n'a rien" : c'est une panne.
        // Publier le score dans ce cas revient a sous-estimer le site, a l'ecrire en base et
        // a l'inscrire au registre AYA avec un chiffre faux. On refuse.
        const degraded: string[] = events.filter((e) => e.status === 'error').map((e) => e.agent);
        send({ phase: 'merge', status: 'running' });
        const extract = await mergeAgentResultsToExtract(url, fetchResult, results, (a) => {
          if (!degraded.includes(a)) degraded.push(a);
        });
        send({ phase: 'merge', status: 'done' });

        if (degraded.length > 0) {
          console.error(`[scan] diagnostic INCOMPLET pour ${fetchResult.url} : ${degraded.join(', ')} sans reponse. Aucun score publie, aucune ecriture en base ni au registre.`);
          send({ phase: 'error', message: 'scan_incomplete', agents: degraded });
          return; // le finally ferme le flux
        }

        // Phase 4: Compute current score
        // V2: caps V1 désactivés SAUF le cap ASR doctrinal (50 sans ASR)
        extract.source.scan.has_jsonld = true;           // Disable cap 50 (no JSON-LD)
        // NE PAS désactiver has_asr_file ni is_aya_registered — le cap 50 sans ASR
        // doit s'appliquer aux sites qui ne sont ni dans AYA ni porteurs d'un ASR (règle doctrinale AYO)

        // Disable per-block caps: certifications cap (8), indicators cap (8/10)
        // Add a dummy certification evidence so the cap doesn't trigger
        if (extract.fields.engagements_conformite.certifications.q === 0) {
          extract.fields.engagements_conformite.certifications.evidence = ['v2_no_cap'];
          extract.fields.engagements_conformite.certifications.na = true;
        }
        // Add dummy indicator evidence so the cap doesn't trigger
        if (extract.fields.indicateurs.key_indicators.q > 0) {
          extract.fields.indicateurs.key_indicators.evidence = ['v2_no_cap', 'https://v2-scan'];
        }
        if (!extract.fields.indicateurs.last_review_date.value) {
          extract.fields.indicateurs.last_review_date.na = true;
        }

        send({ phase: 'score', status: 'running' });
        const score = computeAioScore(extract);

        // Phase 4b: Compute PRO score (what happens when AYO adds ASR files)
        // Deep clone extract and add what AYO PRO generates
        const proExtract = JSON.parse(JSON.stringify(extract));
        // AYO PRO adds: ASR file, FAQ, glossary, documentation, JSON-LD
        proExtract.fields.contenus_pedagogiques.has_faq = { value: true, q: 1, evidence: ['ayo_pro_generated'] };
        proExtract.fields.contenus_pedagogiques.has_glossary = { value: true, q: 1, evidence: ['ayo_pro_generated'] };
        proExtract.fields.contenus_pedagogiques.has_documentation = { value: true, q: 1, evidence: ['ayo_pro_generated'] };
        proExtract.fields.structure_technique.has_asr = { value: true, q: 1, evidence: ['ayo_pro_generated'] };
        proExtract.fields.structure_technique.has_jsonld = { value: true, q: 1, evidence: ['ayo_pro_generated'] };
        proExtract.fields.structure_technique.has_sitemap = { value: true, q: 1, evidence: ['ayo_pro_generated'] };
        proExtract.source.scan.has_asr_file = true;
        proExtract.source.scan.has_jsonld = true;
        proExtract.source.scan.is_aya_registered = true;
        const proScore = computeAioScore(proExtract);

        send({ phase: 'score', status: 'done', data: score });

        // Save V2 extract to analyses table (so webhook finds it after Stripe payment)
        let savedAnalysisId = '';
        try {
          savedAnalysisId = crypto.randomUUID();
          await db.saveAnalysis(savedAnalysisId, {
            url: fetchResult.url,
            email: email || null,
            score: score.total,
            data: { fields: extract.fields, source: extract.source, version: extract.version, blocks: score.blocks, proScore: proScore.total, proBlocks: proScore.blocks },
          });
          console.log(`[scan] Analysis saved: ${savedAnalysisId} score=${score.total} url=${fetchResult.url}`);
        } catch (e) {
          console.error('[scan] Failed to save analysis:', e instanceof Error ? e.message : e);
        }

        // Inscription automatique dans AYA : toute entreprise diagnostiquée entre au
        // registre comme entrée INDEXÉE (non certifiée). Dédup par URL + non bloquant.
        try {
          const { indexEntityFromDiagnostic } = await import('@/lib/aya/registry');
          const id = extract.fields.identite;
          await indexEntityFromDiagnostic({
            url: fetchResult.url,
            score: score.total,
            name: id.legal_name?.value || id.name?.value || '',
            country: id.country?.value || '',
            sector: extract.source.scan.industry_keywords?.[0] || '',
            contactEmail: (id.contact_email?.value && id.contact_email.value !== 'contact_form')
              ? id.contact_email.value : undefined,
          });
        } catch (e) {
          console.error('[scan] AYA index failed:', e instanceof Error ? e.message : e);
        }

        // Phase 5: Final summary
        send({
          phase: 'complete',
          totalDurationMs: Date.now() - startTime,
          agentResults: results,
          extract,
          score,
          proScore, // Score WITH AYO PRO files
          url: fetchResult.url,
          analysisId: savedAnalysisId, // Pass to client so checkout can reference it
        });
      } catch (err) {
        send({ phase: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
      } finally {
        clearInterval(heartbeat);
        clearTimeout(deadline);
        closed = true;
        try { controller.close(); } catch { /* deja ferme par la deconnexion du client */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Interdit tout tampon intermediaire : chaque evenement part immediatement.
      'X-Accel-Buffering': 'no',
    },
  });
}
