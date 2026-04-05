// lib/micro-agents/detect-services.ts — Extract services/products/audience/use-cases via focused LLM

import type { ServicesResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You extract business offering details from websites. Content can be in ANY language (French, English, German, etc.).

Extract:
- services: list of services, offerings, expertise areas, consulting activities (max 10). Include methodology names, workshop types, consulting approaches.
- products: list of products, platforms, tools, apps, software (max 10)
- target_audience: who the business serves. Look for: "pour les entreprises", "for businesses", "PME", "startups", "developers", "particuliers", etc.
- use_cases: concrete use cases or problems solved. Look for: "vous aide à", "helps you", "pour", scenarios described.
- pricing: any pricing info. Look for: "tarifs", "pricing", "à partir de", "gratuit", "free", "devis", "sur demande".

Return ONLY JSON: {"services":[],"products":[],"target_audience":"","use_cases":[],"pricing":""}
Extract ONLY what is explicitly mentioned. Do NOT invent.`;

export async function detectServices(content: string): Promise<ServicesResult> {
  try {
    const raw = await llmExtract(PROMPT, content, 10000);
    const data = parseJson<{
      services?: string[];
      products?: string[];
      target_audience?: string;
      use_cases?: string[];
      pricing?: string;
    }>(raw);
    if (!data) return { services: [], products: [], q: 0 };

    const services = (data.services || []).slice(0, 15);
    const products = (data.products || []).slice(0, 15);
    const total = services.length + products.length;

    const q: Quality = total >= 3 ? 1 : total > 0 ? 0.5 : 0;
    return {
      services,
      products,
      q,
      target_audience: data.target_audience || '',
      use_cases: data.use_cases || [],
      pricing: data.pricing || '',
    };
  } catch {
    return { services: [], products: [], q: 0 };
  }
}
