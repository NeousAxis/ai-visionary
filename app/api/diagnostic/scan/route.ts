// app/api/diagnostic/scan/route.ts — SSE endpoint for micro-agent scanning

import { NextRequest } from 'next/server';
import { runAllAgents, mergeAgentResultsToExtract, retryFailedAgents } from '@/lib/micro-agents/orchestrator';
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

/**
 * Reglages de la passe de secours du scan.
 *
 * RESCUE_PAUSE_MS : le temps laisse a la vague de latence pour retomber. Mesure du
 * 26 aout 2026 : les memes six appels passent de 3 s a 16 s puis reviennent a 3 s d'un
 * essai a l'autre. Rejouer sans attendre, c'est rejouer dans le creux.
 * RESCUE_RESERVE_MS : ce qu'on garde pour le calcul du score, l'ecriture en base et
 * l'inscription au registre, une fois le rattrapage fini.
 * RESCUE_MIN_ATTEMPT_MS : sous ce plancher, un essai n'a aucune chance d'aboutir ; on
 * rend la main plutot que de faire patienter le visiteur pour rien.
 */
const RESCUE_PAUSE_MS = Number(process.env.SCAN_RESCUE_PAUSE_MS || 4_000);
const RESCUE_RESERVE_MS = 10_000;
/**
 * Reserve gardee pour le rejeu du merge quand son extraction LLM avait deja repondu :
 * un appel qui vient de passer coute quelques secondes, pas un plafond entier.
 */
const MERGE_REPLAY_RESERVE_MS = 30_000;
const RESCUE_MIN_ATTEMPT_MS = 8_000;

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
        // La phase merge porte elle aussi une extraction LLM (process/indicateurs). Elle est
        // rejouable telle quelle, d'ou la closure : la passe de secours la relance a
        // l'identique une fois les agents repares.
        // llmRetries: 0 — aucune relance sur place. Une extraction muette part en secours
        // apres une pause, la ou un retry colle a la tentative precedente retombe dans la
        // meme vague de latence tout en mangeant une seconde tranche du budget.
        const runMerge = async (llmTimeoutMs?: number) => {
          const failures: string[] = [];
          send({ phase: 'merge', status: 'running' });
          const merged = await mergeAgentResultsToExtract(url, fetchResult, results, (a) => {
            if (!failures.includes(a)) failures.push(a);
          }, { llmRetries: 0, llmTimeoutMs });
          send({ phase: 'merge', status: 'done' });
          return { merged, failures };
        };

        let degraded: string[] = events.filter((e) => e.status === 'error').map((e) => e.agent);
        let { merged: extract, failures } = await runMerge();
        for (const f of failures) if (!degraded.includes(f)) degraded.push(f);

        // Passe de secours. Le refus de publier un score ampute est la bonne regle, mais
        // sans seconde chance elle rendait le visiteur a un ecran vide des qu'Infomaniak
        // ralentissait (sondes des 21, 24 et 25 aout 2026, toujours sur detect-services
        // puis process/indicateurs). Ces vagues durent quelques secondes : une pause puis
        // un essai franc les traverse, et le budget du scan a de quoi le payer.
        if (degraded.length > 0) {
          const elapsed = Date.now() - startTime;
          const budgetLeft = SCAN_DEADLINE_MS - elapsed - RESCUE_RESERVE_MS;
          if (budgetLeft >= RESCUE_PAUSE_MS + RESCUE_MIN_ATTEMPT_MS) {
            console.warn(`[scan] passe de secours pour ${degraded.join(', ')} sur ${fetchResult.url} — ${Math.round(budgetLeft / 1000)}s de budget restant`);
            await new Promise((r) => setTimeout(r, RESCUE_PAUSE_MS));
            // Repartition du budget entre le rattrapage des agents et le rejeu du merge.
            // Quand process/indicateurs a repondu du premier coup, le merge rejoue n'a
            // qu'a refaire un appel deja connu pour passer : une reserve suffit, et tout
            // le reste va a l'agent en panne, qui est justement le plus lent a repondre.
            // Quand c'est lui qui est tombe, les deux etapes ont un vrai cout LLM et se
            // partagent le budget a parts egales.
            const agentFailures = degraded.filter((a) => a !== 'process/indicators');
            const rescueBudget = budgetLeft - RESCUE_PAUSE_MS;
            const perStage = degraded.length > agentFailures.length
              ? Math.floor(rescueBudget / 2)
              : Math.max(RESCUE_MIN_ATTEMPT_MS, rescueBudget - MERGE_REPLAY_RESERVE_MS);
            let stillFailed = agentFailures.length > 0
              ? await retryFailedAgents(url, fetchResult, results, agentFailures,
                  (event: AgentEvent) => send({ phase: 'agent', ...event }),
                  { timeoutMs: perStage })
              : [];
            // Le merge est rejoue des que le rattrapage n'a laisse aucun agent au tapis :
            // c'est lui qui reconstruit l'extract avec les resultats repares, et c'est lui
            // aussi qui redonne sa chance a process/indicateurs.
            if (stillFailed.length === 0) {
              const second = await runMerge(perStage);
              extract = second.merged;
              stillFailed = second.failures;
            }
            if (stillFailed.length === 0) {
              console.log(`[scan] passe de secours reussie pour ${fetchResult.url} — diagnostic complet en ${Date.now() - startTime}ms`);
            }
            degraded = stillFailed;
          } else {
            console.error(`[scan] budget epuise apres ${elapsed}ms pour ${fetchResult.url} : pas de passe de secours possible.`);
          }
        }

        if (degraded.length > 0) {
          console.error(`[scan] diagnostic INCOMPLET pour ${fetchResult.url} : ${degraded.join(', ')} sans reponse, rattrapage compris. Aucun score publie, aucune ecriture en base ni au registre.`);
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
