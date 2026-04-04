// app/api/diagnostic/scan/route.ts — SSE endpoint for micro-agent scanning

import { NextRequest } from 'next/server';
import { runAllAgents, mergeAgentResultsToExtract } from '@/lib/micro-agents/orchestrator';
import { computeAioScore } from '@/lib/aio-score-engine';
import type { AgentEvent } from '@/lib/micro-agents/types';

export const maxDuration = 60; // Puppeteer SPA rendering can take up to 15s

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== 'string') {
    return new Response(JSON.stringify({ error: 'URL required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
        const { fetchResult, results, events } = await runAllAgents(url, (event: AgentEvent) => {
          send({ phase: 'agent', ...event });
        });

        if (!fetchResult.isReachable) {
          send({ phase: 'error', message: 'Site unreachable', statusCode: fetchResult.statusCode });
          controller.close();
          return;
        }

        send({ phase: 'fetch', status: 'done', durationMs: Date.now() - startTime });

        // Phase 3: Merge results into AyoExtract
        send({ phase: 'merge', status: 'running' });
        const extract = mergeAgentResultsToExtract(url, fetchResult, results);
        send({ phase: 'merge', status: 'done' });

        // Phase 4: Compute current score
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

        // Phase 5: Final summary
        send({
          phase: 'complete',
          totalDurationMs: Date.now() - startTime,
          agentResults: results,
          extract,
          score,
          proScore, // Score WITH AYO PRO files
          url: fetchResult.url,
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
