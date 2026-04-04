// lib/micro-agents/detect-services.ts — Extract services/products via focused LLM

import type { ServicesResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You extract services and products from websites. The content can be in ANY language (French, English, German, etc.).

Extract:
- services: list of services, offerings, expertise areas, or consulting activities the business provides (max 10). Include methodology names, workshop types, consulting approaches.
- products: list of products, platforms, tools, or apps (max 10)

Look for headings like "Nos services", "Services", "Expertises", "What we do", "Mes expertises", "Notre offre", and the items listed under them.

Return ONLY JSON: {"services": ["Service A", "Service B"], "products": ["Product A"]}
Extract ONLY what is explicitly mentioned. Do NOT invent.`;

export async function detectServices(content: string): Promise<ServicesResult> {
  try {
    const raw = await llmExtract(PROMPT, content, 10000);
    const data = parseJson<{ services?: string[]; products?: string[] }>(raw);
    if (!data) return { services: [], products: [], q: 0 };

    const services = (data.services || []).slice(0, 15);
    const products = (data.products || []).slice(0, 15);
    const total = services.length + products.length;

    const q: Quality = total >= 3 ? 1 : total > 0 ? 0.5 : 0;
    return { services, products, q };
  } catch {
    return { services: [], products: [], q: 0 };
  }
}
