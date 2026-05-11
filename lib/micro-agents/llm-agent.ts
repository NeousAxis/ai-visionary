// lib/micro-agents/llm-agent.ts — Shared LLM caller for micro-agents
// Routes to Infomaniak AI (Apertus-70B, Swiss-hosted) if INFOMANIAK_AI_TOKEN is set,
// otherwise falls back to Google Gemini Flash. OpenAI-compatible API on both sides.

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

type Provider = 'infomaniak' | 'gemini';

function pickProvider(): Provider {
  if ((process.env.INFOMANIAK_AI_TOKEN || '').trim()) return 'infomaniak';
  return 'gemini';
}

let _model: any = null;
let _provider: Provider | null = null;

function getModel() {
  if (_model) return { model: _model, provider: _provider! };

  const provider = pickProvider();
  if (provider === 'infomaniak') {
    const token = (process.env.INFOMANIAK_AI_TOKEN || '').trim();
    const productId = (process.env.INFOMANIAK_AI_PRODUCT_ID || '').trim();
    const modelName = (process.env.INFOMANIAK_AI_MODEL || 'swiss-ai/Apertus-70B-Instruct-2509').trim();
    if (!productId) throw new Error('INFOMANIAK_AI_TOKEN set but INFOMANIAK_AI_PRODUCT_ID missing');

    const infomaniak = createOpenAI({
      apiKey: token,
      baseURL: `https://api.infomaniak.com/2/ai/${productId}/openai/v1`,
    });
    _model = infomaniak(modelName);
    _provider = 'infomaniak';
    return { model: _model, provider: _provider };
  }

  // Fallback: Gemini
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  if (!key) throw new Error('No LLM provider configured (INFOMANIAK_AI_TOKEN or GEMINI_API_KEY)');
  const google = createGoogleGenerativeAI({ apiKey: key });
  _model = google('gemini-3-flash-preview');
  _provider = 'gemini';
  return { model: _model, provider: _provider };
}

/**
 * Run a focused LLM extraction.
 * - systemPrompt: what the agent does (2-3 lines)
 * - content: the text to analyze (truncated to maxChars)
 * - maxChars: limit content size (default 8000)
 */
export async function llmExtract(
  systemPrompt: string,
  content: string,
  maxChars = 8000,
): Promise<string> {
  const { model, provider } = getModel();
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

  try {
    console.log(`[llm-agent] Calling ${provider} with ${truncated.length} chars, system prompt: ${systemPrompt.substring(0, 80)}...`);
    const { text } = await generateText({
      model,
      temperature: 0,
      maxOutputTokens: 4000,
      system: systemPrompt,
      prompt: truncated,
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
 * Apertus often wraps the JSON in a "response" key — unwrap it if present and
 * the inner shape matches what callers expect.
 */
export function parseJson<T>(text: string): T | null {
  const tryUnwrap = (parsed: any): T => {
    // Apertus quirk: when asked for a JSON object, it sometimes wraps it as { response: {...} }.
    // Unwrap only if "response" is the sole top-level key AND its value is an object/array.
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
