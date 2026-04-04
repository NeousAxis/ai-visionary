// lib/micro-agents/detect-services.ts — Extract services/products via focused LLM

import type { ServicesResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You are a service/product extractor. From the website content below, extract:
- services: list of services or offerings the business provides (max 10)
- products: list of products if any (max 10)

Extract REAL services mentioned on the page. Do NOT invent or generalize.
Return ONLY valid JSON: {"services": ["Service A", "Service B"], "products": ["Product A"]}
If none found, return empty arrays. No explanation.`;

export async function detectServices(content: string): Promise<ServicesResult> {
  try {
    const raw = await llmExtract(PROMPT, content);
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
