// lib/micro-agents/llm-agent.ts — Shared LLM caller for micro-agents
// Each agent = 1 focused Gemini Flash call + Zod validation

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

let _model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null = null;

function getModel() {
  if (_model) return _model;
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  if (!key) throw new Error('No Gemini API key');
  const google = createGoogleGenerativeAI({ apiKey: key });
  _model = google('gemini-3.0-flash');
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
  const truncated = content.length > maxChars ? content.substring(0, maxChars) : content;

  const { text } = await generateText({
    model,
    temperature: 0,
    maxOutputTokens: 1000,
    system: systemPrompt,
    prompt: truncated,
  });

  return text;
}

/**
 * Parse JSON from LLM response, stripping markdown code fences if present.
 */
export function parseJson<T>(text: string): T | null {
  try {
    // Strip ```json ... ``` wrappers
    const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
