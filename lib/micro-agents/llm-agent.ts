// lib/micro-agents/llm-agent.ts — Shared LLM caller for micro-agents
// Each agent = 1 focused Gemini Flash call + Zod validation

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

let _model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null = null;

function getModel() {
  if (_model) return _model;
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  if (!key) throw new Error('No Gemini API key found (GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)');
  const google = createGoogleGenerativeAI({ apiKey: key });
  _model = google('gemini-3-flash-preview');
  return _model;
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
  const model = getModel();
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
    console.log(`[llm-agent] Calling Gemini with ${truncated.length} chars, system prompt: ${systemPrompt.substring(0, 80)}...`);
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
    console.error('[llm-agent] Gemini call FAILED:', err instanceof Error ? err.message : err);
    throw err;
  }
}

/**
 * Parse JSON from LLM response, stripping markdown code fences if present.
 */
export function parseJson<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return JSON.parse(cleaned);
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
      return JSON.parse(fixed);
    } catch {
      console.error('[parseJson] Failed to parse even after fix attempt:', text.substring(0, 200));
      return null;
    }
  }
}
