// lib/micro-agents/llm-agent.ts — Shared LLM caller for micro-agents
//
// Thin wrapper over lib/llm-provider.ts that adds the agents' content-truncation
// strategy. Provider routing (Infomaniak Apertus vs Gemini fallback) and JSON-mode
// enforcement live in lib/llm-provider.ts. The micro-agents' system prompts stay
// untouched — JSON shape is guaranteed at the API level (json_schema on Infomaniak).

import { llmJson, llmProvider } from '@/lib/llm-provider';

/**
 * Panne technique de l'appel LLM lui-meme : timeout, coupure reseau, 4xx ou 5xx.
 * A distinguer d'une reponse valide qui ne contient simplement rien.
 *
 * Les agents la laissent remonter au lieu de renvoyer un resultat vide : sans cela, un
 * 500 d'Infomaniak passait pour "ce site n'a pas d'offre" et le score sous-estime partait
 * en base et au registre AYA. Cas verifie le 19 aout 2026 sur groupealliance.eu.
 */
export class LlmCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmCallError';
  }
}

/**
 * Run a focused LLM extraction.
 * - systemPrompt: what the agent does (2-3 lines)
 * - content: the text to analyze (truncated to maxChars)
 * - maxChars: limit content size (default 8000)
 * - opts.retries: extra attempts when Infomaniak stalls (default 1). Scoring-critical
 *   agents keep the retry; callers that already degrade gracefully pass 0 so the scan
 *   stays inside its budget when the provider is slow across the board.
 */
export async function llmExtract(
  systemPrompt: string,
  content: string,
  maxChars = 8000,
  opts: { retries?: number; maxTokens?: number } = {},
): Promise<string> {
  // Smart truncation: keep start (70%) + end (30%) to preserve footer content
  // Footer often contains critical data: legal pages, contact, address, copyright
  let truncated: string;
  if (content.length > maxChars) {
    const headSize = Math.floor(maxChars * 0.7);
    const tailSize = maxChars - headSize - 20;
    truncated = content.substring(0, headSize) + '\n\n[...truncated...]\n\n' + content.substring(content.length - tailSize);
  } else {
    truncated = content;
  }

  const provider = llmProvider();
  try {
    console.log(`[llm-agent] Calling ${provider} with ${truncated.length} chars, system prompt: ${systemPrompt.substring(0, 80)}...`);
    // Plafond calibre par agent sur les sorties reelles observees en prod (contact et
    // location tiennent en moins de 100 caracteres, seuls services et process depassent
    // 2000). Un plafond juste convertit les generations en boucle (40 s et plus a 4000
    // tokens, source des timeouts) en reponses rapides.
    const maxTokens = opts.maxTokens ?? 4000;
    let { text, truncated: cut } = await llmJson({
      system: systemPrompt,
      prompt: truncated,
      temperature: 0,
      maxTokens,
      retries: opts.retries ?? 1,
    });
    console.log(`[llm-agent] Response (${text.length} chars): ${text.substring(0, 200)}`);
    if (cut && parseJson(text) === null) {
      // Coupee au plafond ET irreparable. Rejouer a l'identique reproduirait la meme
      // coupure (temperature 0) : UNE relance a budget double la depasse. Si meme le
      // double ne suffit pas, c'est une panne technique, pas un site sans donnees.
      console.warn(`[llm-agent] truncated+unparseable at ${maxTokens} tokens, retrying once at ${maxTokens * 2}`);
      ({ text, truncated: cut } = await llmJson({
        system: systemPrompt,
        prompt: truncated,
        temperature: 0,
        maxTokens: maxTokens * 2,
        retries: 0,
      }));
      if (cut && parseJson(text) === null) {
        throw new LlmCallError(`response truncated at ${maxTokens * 2} tokens and unparseable (${text.length} chars)`);
      }
    }
    return text;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[llm-agent] ${provider} call FAILED:`, detail);
    throw new LlmCallError(detail);
  }
}

/**
 * Parse JSON from LLM response, stripping markdown code fences if present.
 * Apertus sometimes wraps the JSON in {"response": {...}} — unwrap when that is
 * the sole top-level key and its value is an object/array (safe heuristic).
 */
export function parseJson<T>(text: string): T | null {
  const tryUnwrap = (parsed: any): T => {
    if (
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      Object.keys(parsed).length === 1 && 'response' in parsed &&
      parsed.response !== null && typeof parsed.response === 'object'
    ) {
      return parsed.response as T;
    }
    return parsed as T;
  };

  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return tryUnwrap(JSON.parse(cleaned));
  } catch {
    // Try to fix truncated JSON by closing brackets
    try {
      let fixed = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      // Remove trailing incomplete values
      fixed = fixed.replace(/,\s*"[^"]*$/, '').replace(/,\s*$/, '');
      // Count and close open brackets
      const opens = (fixed.match(/\{/g) || []).length;
      const closes = (fixed.match(/\}/g) || []).length;
      const arrOpens = (fixed.match(/\[/g) || []).length;
      const arrCloses = (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < arrOpens - arrCloses; i++) fixed += ']';
      for (let i = 0; i < opens - closes; i++) fixed += '}';
      console.log('[parseJson] Fixed truncated JSON, attempting parse...');
      return tryUnwrap(JSON.parse(fixed));
    } catch {
      console.error('[parseJson] Failed to parse even after fix attempt:', text.substring(0, 200));
      return null;
    }
  }
}
