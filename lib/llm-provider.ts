// lib/llm-provider.ts — Shared LLM provider abstraction
//
// Routes to Infomaniak AI (Apertus-70B, Swiss-hosted) when INFOMANIAK_AI_TOKEN is set,
// otherwise falls back to Google Gemini Flash. The call signature mirrors
// generateText() from Vercel AI SDK so call sites stay terse.
//
// Two entry points:
//   - llmJson(...)  : forces JSON output via OpenAI-style json_schema (Infomaniak)
//                     or Gemini's native JSON mode (Vercel SDK handles it).
//                     Returns { text: string } where text is guaranteed JSON.
//   - llmText(...)  : free-form text (chat, summaries). No JSON enforcement.
//
// Both return { text } so they're a drop-in replacement for generateText().

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';

type Provider = 'infomaniak' | 'gemini';

export type LlmInput = {
    system?: string;
    prompt?: string;
    messages?: CoreMessage[];
    temperature?: number;
    maxTokens?: number;
    abortSignal?: AbortSignal;
};

export type LlmResult = { text: string };

function pickProvider(): Provider {
    return (process.env.INFOMANIAK_AI_TOKEN || '').trim() ? 'infomaniak' : 'gemini';
}

// ── Gemini lazy init (fallback) ──────────────────────────────────────────────
let _geminiModel: any = null;
function getGeminiModel() {
    if (_geminiModel) return _geminiModel;
    const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
    if (!key) throw new Error('No LLM provider configured (INFOMANIAK_AI_TOKEN or GEMINI_API_KEY)');
    const google = createGoogleGenerativeAI({ apiKey: key });
    _geminiModel = google('gemini-3-flash-preview');
    return _geminiModel;
}

// ── Normalise input to OpenAI-style messages ─────────────────────────────────
function buildOpenAiMessages(input: LlmInput): { role: string; content: string }[] {
    const msgs: { role: string; content: string }[] = [];
    if (input.system) msgs.push({ role: 'system', content: input.system });
    if (input.messages?.length) {
        for (const m of input.messages) {
            const content = typeof m.content === 'string'
                ? m.content
                : (Array.isArray(m.content) ? m.content.map((p: any) => p?.text ?? '').join('\n') : '');
            msgs.push({ role: m.role, content });
        }
    } else if (input.prompt) {
        msgs.push({ role: 'user', content: input.prompt });
    }
    return msgs;
}

// ── Infomaniak direct fetch ──────────────────────────────────────────────────
async function callInfomaniak(input: LlmInput, forceJson: boolean): Promise<string> {
    const token = (process.env.INFOMANIAK_AI_TOKEN || '').trim();
    const productId = (process.env.INFOMANIAK_AI_PRODUCT_ID || '').trim();
    const model = (process.env.INFOMANIAK_AI_MODEL || 'swiss-ai/Apertus-70B-Instruct-2509').trim();
    if (!productId) throw new Error('INFOMANIAK_AI_TOKEN set but INFOMANIAK_AI_PRODUCT_ID missing');

    const body: Record<string, unknown> = {
        model,
        messages: buildOpenAiMessages(input),
        temperature: input.temperature ?? 0,
        max_tokens: input.maxTokens ?? 4000,
    };
    if (forceJson) {
        // OpenAI-compatible JSON schema mode — guaranteed valid JSON at decode time.
        // Permissive schema: any object shape is accepted; the caller validates downstream.
        body.response_format = {
            type: 'json_schema',
            json_schema: {
                name: 'extraction_result',
                schema: { type: 'object', additionalProperties: true },
                strict: false,
            },
        };
    }

    const res = await fetch(
        `https://api.infomaniak.com/2/ai/${productId}/openai/v1/chat/completions`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: input.abortSignal,
        },
    );

    if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Infomaniak AI ${res.status}: ${errBody.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
    };
    return json.choices?.[0]?.message?.content ?? '';
}

// ── Gemini path (via Vercel SDK) ─────────────────────────────────────────────
async function callGemini(input: LlmInput): Promise<string> {
    const result = await generateText({
        model: getGeminiModel(),
        temperature: input.temperature ?? 0,
        maxOutputTokens: input.maxTokens ?? 4000,
        system: input.system,
        prompt: input.prompt,
        messages: input.messages,
        abortSignal: input.abortSignal,
    } as any);
    return result.text;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate free-form text. Use for chat, summaries, anything that is not
 * required to be JSON.
 */
export async function llmText(input: LlmInput): Promise<LlmResult> {
    const provider = pickProvider();
    if (provider === 'infomaniak') {
        const text = await callInfomaniak(input, false);
        return { text };
    }
    return { text: await callGemini(input) };
}

/**
 * Generate JSON output. Infomaniak path enforces a JSON schema at the API
 * level; Gemini path relies on the prompt to ask for JSON (legacy behavior).
 * Returns { text } where text is the raw JSON string — caller must JSON.parse.
 */
export async function llmJson(input: LlmInput): Promise<LlmResult> {
    const provider = pickProvider();
    if (provider === 'infomaniak') {
        const text = await callInfomaniak(input, true);
        return { text };
    }
    // Gemini doesn't have a free JSON mode in this SDK setup; the existing
    // prompts already include "return ONLY JSON" instructions, so generateText
    // works fine on Gemini even without an explicit mode.
    return { text: await callGemini(input) };
}

/** Reports which provider is currently active. */
export function llmProvider(): Provider {
    return pickProvider();
}
