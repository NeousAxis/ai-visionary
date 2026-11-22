import { NextResponse } from 'next/server';
import { llmText, llmJson } from '@/lib/llm-provider';
import { localPgGetActiveCashbackOffersForDomains } from '@/lib/db-local-pg';

// L'agent Pollen : question en langage naturel → mot-clé (Infomaniak AI) → entreprises
// vérifiées du registre AYA → recommandation rédigée par Infomaniak AI (Ministral-3-14B, CH).
// Stack souveraine : Infomaniak (moteur) + AYA (carte).
export const maxDuration = 30;

interface Candidate {
  name?: string;
  domain?: string;
  country?: string;
  sector?: string;
  score?: number;
  certified?: boolean;
  entity_id?: string;
  url?: string;
  cashback?: { type: string; value: number; currency: string };
}

function bareDomain(input: string): string {
  return (input || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
}

async function searchAya(term: string): Promise<Candidate[]> {
  try {
    const res = await fetch(
      `https://ai-visionary.xyz/api/aya/search?q=${encodeURIComponent(term)}&limit=8`,
      { signal: AbortSignal.timeout(8000) },
    );
    const data = await res.json();
    return Array.isArray(data?.results) ? data.results.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  let query = '';
  let locale: 'fr' | 'en' = 'fr';
  try {
    const body = await req.json();
    query = (body?.query ?? '').toString().slice(0, 200).trim();
    locale = body?.locale === 'en' ? 'en' : 'fr';
  } catch {
    /* ignore malformed body */
  }

  if (!query) {
    return NextResponse.json(
      { answer: null, picks: [], error: 'empty_query' },
      { status: 400 },
    );
  }

  // 1) Infomaniak AI : convertit le besoin NL en un mot-clé ANGLAIS (le registre matche l'anglais).
  let keyword = query;
  try {
    const kw = await llmJson({
      system:
        'You convert a user business need into ONE short ENGLISH keyword for a company directory search (e.g. "cybersecurity", "accounting", "logistics", "law firm"). Output STRICT JSON: {"keyword": "..."} — a single lowercase English term, no sentence.',
      prompt: query,
      temperature: 0,
      maxTokens: 40,
      abortSignal: AbortSignal.timeout(15000),
    });
    const parsed = JSON.parse(kw.text);
    if (parsed && typeof parsed.keyword === 'string' && parsed.keyword.trim()) {
      keyword = parsed.keyword.trim();
    }
  } catch {
    /* fall back to raw query */
  }

  // 2) Le VRAI registre AYA (API prod → Postgres VPS, côté serveur, sans CORS).
  let picks = await searchAya(keyword);
  if (picks.length === 0 && keyword !== query) picks = await searchAya(query);

  if (picks.length === 0) {
    return NextResponse.json({ answer: null, picks: [], keyword });
  }

  // 2b) Annoter les candidats avec les offres cashback ACTIVES (lecture indexee VPS).
  try {
    const offers = await localPgGetActiveCashbackOffersForDomains(
      picks.map((p) => p.domain || '').filter(Boolean),
    );
    if (offers.size > 0) {
      for (const p of picks) {
        const o = offers.get(bareDomain(p.domain || ''));
        if (o) {
          p.cashback = { type: o.cashback_type, value: o.cashback_value, currency: o.currency };
        }
      }
    }
  } catch {
    /* le cashback est un bonus d'affichage — jamais bloquant pour la reco */
  }

  // 3) Infomaniak AI (Ministral, Suisse) rédige la recommandation à partir des candidats.
  const list = picks
    .map(
      (p, i) =>
        `${i + 1}. ${p.name || p.domain} — ${p.domain}` +
        `${p.sector ? `, ${p.sector}` : ''}` +
        `${p.country ? `, ${p.country}` : ''}` +
        `${p.certified ? ' [certifié ASR]' : ''} (AIO ${p.score ?? '?'})` +
        `${p.cashback ? ` [cashback ${p.cashback.value}${p.cashback.type === 'percent' ? '%' : ` ${p.cashback.currency}`}]` : ''}`,
    )
    .join('\n');

  const system =
    locale === 'en'
      ? 'You are a sovereign AI agent that recommends VERIFIED businesses from the AYA registry. Answer in English, 2-3 sentences max. Recommend ONLY from the provided list — never invent a company. Be concrete and helpful. If an entry shows [cashback ...], briefly note that choosing it earns the user cashback.'
      : "Tu es un agent IA souverain qui recommande des entreprises VÉRIFIÉES du registre AYA. Réponds en français, 2-3 phrases max. Recommande UNIQUEMENT dans la liste fournie — n'invente jamais d'entreprise. Sois concret et utile. Si une entrée affiche [cashback ...], signale brièvement que la choisir fait gagner du cashback à l'utilisateur.";

  const prompt =
    locale === 'en'
      ? `User need: "${query}"\n\nVerified businesses available:\n${list}\n\nRecommend the best match(es) and briefly say why.`
      : `Besoin de l'utilisateur : "${query}"\n\nEntreprises vérifiées disponibles :\n${list}\n\nRecommande la ou les meilleures et explique brièvement pourquoi.`;

  let answer: string | null = null;
  try {
    const r = await llmText({
      system,
      prompt,
      temperature: 0.3,
      maxTokens: 400,
      abortSignal: AbortSignal.timeout(20000),
    });
    answer = (r.text || '').trim() || null;
  } catch {
    answer = null; // l'agent n'a pas pu rédiger → on renvoie quand même les fiches
  }

  return NextResponse.json({
    answer,
    picks,
    keyword,
    model: 'Ministral-3-14B · Infomaniak (CH)',
  });
}
