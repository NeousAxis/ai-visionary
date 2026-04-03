// lib/micro-agents/detect-social.ts — Find social media links

import type { SocialResult, Quality } from './types';

const SOCIAL_PATTERNS: [RegExp, string][] = [
  [/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/gi, 'LinkedIn'],
  [/https?:\/\/(?:www\.)?twitter\.com\/[^\s"'<>]+/gi, 'Twitter'],
  [/https?:\/\/(?:www\.)?x\.com\/[^\s"'<>]+/gi, 'X (Twitter)'],
  [/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi, 'Facebook'],
  [/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi, 'Instagram'],
  [/https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[^\s"'<>]+/gi, 'YouTube'],
  [/https?:\/\/(?:www\.)?github\.com\/[^\s"'<>]+/gi, 'GitHub'],
  [/https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>]+/gi, 'TikTok'],
  [/https?:\/\/(?:www\.)?pinterest\.com\/[^\s"'<>]+/gi, 'Pinterest'],
  [/https?:\/\/(?:www\.)?mastodon\.[^\s"'<>]+/gi, 'Mastodon'],
];

// Filter out generic/non-profile links
const IGNORE_PATHS = /\/sharer|\/share|\/intent\/|\/plugins\/|\/widgets\/|\/embed|\.js|\.css|\/hashtag\//i;

export function detectSocial(html: string): SocialResult {
  const links: string[] = [];
  const platforms: string[] = [];
  const seen = new Set<string>();

  for (const [pattern, platform] of SOCIAL_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(html)) !== null) {
      let url = match[0].replace(/["'<>].*$/, '').replace(/\/$/, '');

      // Skip share/intent links
      if (IGNORE_PATHS.test(url)) continue;

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
