// lib/micro-agents/llm-agent.ts — Shared LLM caller for micro-agents
//
// Thin wrapper over lib/llm-provider.ts that adds the agents' content-truncation
// strategy. Provider routing (Infomaniak Apertus vs Gemini fallback) and JSON-mode
// enforcement live in lib/llm-provider.ts. The micro-agents' system prompts stay
// untouched — JSON shape is guaranteed at the API level (json_schema on Infomaniak).

import { llmJson, llmProvider } from '@/lib/llm-provider';

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
  opts: { retries?: number } = {},
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
    const { text } = await llmJson({
      system: systemPrompt,
      prompt: truncated,
      temperature: 0,
      maxTokens: 4000,
      retries: opts.retries ?? 1,
    });
    console.log(`[llm-agent] Response (${text.length} chars): ${text.substring(0, 200)}`);
    return text;
  } catch (err) {
    console.error(`[llm-agent] ${provider} call FAILED:`, err instanceof Error ? err.message : err);
    throw err;
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
