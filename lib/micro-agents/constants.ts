// lib/micro-agents/constants.ts — Shared constants for AYO micro-agents

export const AYOBOT_UA = 'AYOBot/2.0 (+https://ai-visionary.xyz/ayo-bot)';

/**
 * Caracteres visibles (titre compris, scripts et styles exclus) en dessous desquels une page
 * ne dit rien de l'entreprise : AYO refuse alors de la noter et de l'inscrire au registre.
 * Meme seuil que MIN_VISIBLE_TEXT dans aya/page_check.py (bot Python, 14.10.2026).
 */
export const MIN_VISIBLE_TEXT = 40;
