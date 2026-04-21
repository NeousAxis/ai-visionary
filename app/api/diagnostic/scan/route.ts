// app/api/diagnostic/scan/route.ts — SSE endpoint for micro-agent scanning

import { NextRequest } from 'next/server';
import { runAllAgents, mergeAgentResultsToExtract } from '@/lib/micro-agents/orchestrator';
import { computeAioScore } from '@/lib/aio-score-engine';
import { db } from '@/lib/db';
import type { AgentEvent } from '@/lib/micro-agents/types';

export const maxDuration = 60; // Puppeteer SPA rendering can take up to 15s

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
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

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
        send({ phase: 'merge', status: 'running' });
        const extract = await mergeAgentResultsToExtract(url, fetchResult, results);
        send({ phase: 'merge', status: 'done' });

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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
