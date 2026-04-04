// lib/micro-agents/detect-social.ts — Extract social links (deterministic, no LLM needed)

import type { SocialResult, Quality } from './types';

// Social links are URL patterns — deterministic is perfect here
const SOCIAL_PATTERNS: [RegExp, string][] = [
  [/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>)]+/gi, 'LinkedIn'],
  [/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>)]+/gi, 'Twitter/X'],
  [/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi, 'Facebook'],
  [/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi, 'Instagram'],
  [/https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[^\s"'<>)]+/gi, 'YouTube'],
  [/https?:\/\/(?:www\.)?github\.com\/[^\s"'<>)]+/gi, 'GitHub'],
  [/https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>)]+/gi, 'TikTok'],
  [/https?:\/\/(?:www\.)?bsky\.app\/profile\/[^\s"'<>)]+/gi, 'Bluesky'],
];

const IGNORE = /\/sharer|\/share|\/intent\/|\/plugins\/|\/widgets\/|\/embed|\.js|\.css|\/hashtag\//i;

export function detectSocial(html: string): SocialResult {
  const links: string[] = [];
  const platforms: string[] = [];
  const seen = new Set<string>();

  for (const [pattern, platform] of SOCIAL_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = re.exec(html)) !== null) {
      const url = match[0].replace(/["'<>)]+$/, '').replace(/\/$/, '');
      if (IGNORE.test(url)) continue;
      // Skip placeholder links (href="#")
      if (url.endsWith('#') || url.length < 15) continue;

      const key = platform.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        links.push(url);
        platforms.push(platform);
      }
    }
  }

  const q: Quality = links.length >= 2 ? 1 : links.length === 1 ? 0.5 : 0;
  return { links, platforms, q };
}
