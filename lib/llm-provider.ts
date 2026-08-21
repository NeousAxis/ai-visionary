// lib/llm-provider.ts — Shared LLM provider abstraction
//
// 100% Swiss: routes exclusively to Infomaniak AI (Ministral-3-14B, Swiss-hosted).
// No Google / Gemini path — the project doctrine bans non-CH services.
//
// Two entry points:
//   - llmJson(...)  : forces JSON output via OpenAI-style json_schema.
//                     Returns { text: string } where text is guaranteed JSON.
//   - llmText(...)  : free-form text (chat, summaries). No JSON enforcement.
//
// Both return { text } so they're a drop-in replacement for generateText().

import { type CoreMessage } from 'ai';

type Provider = 'infomaniak';

/**
 * Ceiling on a single Infomaniak call.
 *
 * Node's fetch carries no request timeout, so an upstream stall used to hang the whole
 * visitor journey. On 21 Aug 2026 a detect-services call took 90s (normal: 4 to 13s), the
 * two post-agent calls added 59s and 36s on top, and the diagnostic returned no score for
 * 179s. Every call is bounded from now on, so a slow provider degrades one block instead
 * of stranding the visitor.
 */
const DEFAULT_TIMEOUT_MS = Number(process.env.INFOMANIAK_AI_TIMEOUT_MS || 35_000);

/** An HTTP-level rejection (4xx/5xx). Never worth retrying, unlike a stall. */
class InfomaniakHttpError extends Error {}

export type LlmInput = {
    system?: string;
    prompt?: string;
    messages?: CoreMessage[];
    temperature?: number;
    maxTokens?: number;
    abortSignal?: AbortSignal;
    /** Per-call ceiling in ms. Defaults to INFOMANIAK_AI_TIMEOUT_MS (35s). */
    timeoutMs?: number;
    /** Extra attempts when the call times out or the socket drops. Default 0. */
    retries?: number;
};

export type LlmResult = { text: string };

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
    const model = (process.env.INFOMANIAK_AI_MODEL || 'mistralai/Ministral-3-14B-Instruct-2512').trim();
    if (!token) throw new Error('INFOMANIAK_AI_TOKEN missing — no LLM provider configured');
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

    const timeoutMs = Math.max(1_000, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const attempts = 1 + Math.max(0, input.retries ?? 0);
    const payload = JSON.stringify(body);
    let lastErr: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        const deadline = AbortSignal.timeout(timeoutMs);
        const signal = input.abortSignal
            ? AbortSignal.any([input.abortSignal, deadline])
            : deadline;
        try {
            const res = await fetch(
                `https://api.infomaniak.com/2/ai/${productId}/openai/v1/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: payload,
                    signal,
                },
            );

            if (!res.ok) {
                const errBody = await res.text().catch(() => '');
                throw new InfomaniakHttpError(`Infomaniak AI ${res.status}: ${errBody.slice(0, 400)}`);
            }
            const json = (await res.json()) as {
                choices?: { message?: { content?: string } }[];
            };
            return json.choices?.[0]?.message?.content ?? '';
        } catch (err) {
            // The caller gave up (visitor closed the tab): propagate as-is, never retry.
            if (input.abortSignal?.aborted) throw err;

            const timedOut = deadline.aborted;
            lastErr = timedOut
                ? new Error(`Infomaniak AI timeout after ${timeoutMs}ms (attempt ${attempt}/${attempts})`)
                : err;

            const retryable = timedOut || !(err instanceof InfomaniakHttpError);
            if (!retryable || attempt === attempts) throw lastErr;
            console.warn(
                `[llm-provider] attempt ${attempt}/${attempts} failed (${timedOut ? 'timeout' : 'network'}), retrying`,
            );
        }
    }
    throw lastErr;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate free-form text. Use for chat, summaries, anything that is not
 * required to be JSON.
 */
export async function llmText(input: LlmInput): Promise<LlmResult> {
    return { text: await callInfomaniak(input, false) };
}

/**
 * Generate JSON output. Enforces a JSON schema at the API level.
 * Returns { text } where text is the raw JSON string — caller must JSON.parse.
 */
export async function llmJson(input: LlmInput): Promise<LlmResult> {
    return { text: await callInfomaniak(input, true) };
}

/** Reports which provider is currently active. */
export function llmProvider(): Provider {
    return 'infomaniak';
}
