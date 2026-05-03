/**
 * Verifie qu'une entite N'EST PAS deja citee par les LLM dans une recherche
 * type. Si l'entite est deja citee, l'angle "X ne sera pas mentionnee" du
 * post LinkedIn serait factuellement faux : on doit skip.
 *
 * Implementation : appel a Gemini avec une question type, parse la reponse
 * JSON pour voir si l'entite cible apparait dans les 5 noms cites.
 *
 * Cout : ~$0.0005 par appel (Gemini 3 Flash). Negligeable.
 *
 * Reference : Cyril a teste manuellement le 2 mai 2026 et constate que
 * Zalando sortait en 2e position derriere ASOS — donc inadequate pour le post.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_TIMEOUT_MS = 20_000;

export interface VisibilityResult {
    visible: boolean;
    position?: number;          // 1-N si listed, undefined sinon
    cited_companies: string[];  // Top 5 cites par le LLM
    error?: string;             // Si la verification a echoue (par defaut on skip = visible:true)
}

function getModel() {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing');
    const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });
    return google('gemini-3-flash-preview');
}

/**
 * Normalise un nom pour matching (lowercase, strip accents, strip TLD common,
 * strip common suffixes like "AG", "SA", "GmbH").
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')           // strip accents
        .replace(/\.(com|ch|fr|de|it|es|nl|be|co\.uk|net|org|so|io|co|ai)$/i, '')
        .replace(/\b(ag|sa|gmbh|plc|inc|ltd|llc|group|holding|holdings|corp|corporation)\b/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

/**
 * Demande a Gemini de citer 5 entreprises dans un secteur+pays donne.
 * Si l'entite cible apparait dans la liste -> visible=true, on skippe le post.
 */
export async function checkVisibility(opts: {
    entityName: string;
    sectorPhrase: string;
    country?: string;
}): Promise<VisibilityResult> {
    if (!GEMINI_API_KEY) {
        // En l'absence de la cle, on est conservateur : on assume visible (skip)
        return { visible: true, cited_companies: [], error: 'GEMINI_API_KEY missing' };
    }

    const where = opts.country ? ` in ${opts.country}` : '';
    const prompt = `List the 5 best-known ${opts.sectorPhrase}${where}. Reply STRICTLY in JSON, no markdown, no commentary, format exactly:
{"companies": ["Name1", "Name2", "Name3", "Name4", "Name5"]}`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        const { text } = await generateText({
            model: getModel(),
            prompt,
            temperature: 0,
            abortSignal: controller.signal,
        });

        clearTimeout(timer);

        // Strip markdown fences if any
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        let parsed: { companies?: string[] };
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // Sometimes Gemini answers a free-form list, retry with a regex
            const match = cleaned.match(/"companies"\s*:\s*\[([^\]]+)\]/);
            if (!match) {
                return { visible: true, cited_companies: [], error: `JSON parse fail: ${cleaned.slice(0, 100)}` };
            }
            const items = match[1].split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
            parsed = { companies: items };
        }

        const cited = (parsed.companies || []).map((s) => String(s).trim()).filter(Boolean);
        const target = normalizeName(opts.entityName);
        const position = cited.findIndex((c) => normalizeName(c).includes(target) || target.includes(normalizeName(c)));

        if (position >= 0) {
            return { visible: true, position: position + 1, cited_companies: cited };
        }
        return { visible: false, cited_companies: cited };
    } catch (e: any) {
        // Conservateur : si l'appel rate, on assume visible (skip post)
        return { visible: true, cited_companies: [], error: e?.message || 'unknown' };
    }
}

/**
 * Verifie la visibilite via OpenAI ChatGPT (gpt-4o-mini par defaut).
 * Necessite OPENAI_API_KEY dans l'env. Si absent, retourne une erreur claire.
 */
export async function checkVisibilityChatGPT(opts: {
    entityName: string;
    sectorPhrase: string;
    country?: string;
}): Promise<VisibilityResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        return { visible: false, cited_companies: [], error: 'OPENAI_API_KEY missing — add it to .env.local on the VPS' };
    }

    const where = opts.country ? ` in ${opts.country}` : '';
    const prompt = `List the 5 best-known ${opts.sectorPhrase}${where}. Reply STRICTLY in JSON, no markdown, no commentary, format exactly:
{"companies": ["Name1", "Name2", "Name3", "Name4", "Name5"]}`;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0,
                response_format: { type: 'json_object' },
                messages: [{ role: 'user', content: prompt }],
            }),
            signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
            const errText = await res.text();
            return { visible: true, cited_companies: [], error: `OpenAI ${res.status}: ${errText.slice(0, 150)}` };
        }
        const data: { choices?: Array<{ message?: { content?: string } }> } = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        let parsed: { companies?: string[] };
        try {
            parsed = JSON.parse(content);
        } catch {
            return { visible: true, cited_companies: [], error: `JSON parse fail: ${content.slice(0, 100)}` };
        }
        const cited = (parsed.companies || []).map((s) => String(s).trim()).filter(Boolean);
        const target = normalizeName(opts.entityName);
        const position = cited.findIndex((c) => normalizeName(c).includes(target) || target.includes(normalizeName(c)));
        if (position >= 0) {
            return { visible: true, position: position + 1, cited_companies: cited };
        }
        return { visible: false, cited_companies: cited };
    } catch (e: any) {
        return { visible: true, cited_companies: [], error: e?.message || 'unknown' };
    }
}
