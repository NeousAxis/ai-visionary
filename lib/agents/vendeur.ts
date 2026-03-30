/**
 * AGENT VENDEUR
 *
 * Rôle : Tunnel de vente post-score. Templates HTML. Zéro LLM.
 *
 * Gère :
 * - Affichage des packs (Light / PRO / AYA Sub)
 * - Liens Stripe Checkout
 * - Détection du pack depuis un événement Stripe
 *
 * Ne gère PAS :
 * - La génération de fichiers (→ ARCHITECTE)
 * - Le scoring (→ ANALYSTE)
 * - Les questions (→ GREFFIER)
 */

import type { Locale } from '../ayo-system-prompt';

// --- STRIPE CONFIG ---

export const STRIPE_PRICES = {
    PRO: process.env.STRIPE_PRO_PRICE_ID || '',
    AYA_SUB: process.env.STRIPE_AYA_SUB_PRICE_ID || '',
} as const;

export const STRIPE_LINKS = {
    PRO: (process.env.STRIPE_LINK_PRO || '').trim(),
    AYA_SUB: (process.env.STRIPE_LINK_AYA_SUB || '').trim(),
} as const;

export type PackType = 'LIGHT' | 'PRO' | 'AYA_SUB';

// --- PACK DETECTION ---

/**
 * Détecte le type de pack à partir du price_id Stripe.
 */
export function detectPackFromPriceId(priceId: string): PackType {
    if (priceId === STRIPE_PRICES.PRO) return 'PRO';
    if (priceId === STRIPE_PRICES.AYA_SUB) return 'AYA_SUB';
    // Fallback par mode Stripe
    return 'PRO';
}

/**
 * Détecte le pack à partir du mode Stripe (subscription vs payment).
 */
export function detectPackFromMode(mode: string): PackType {
    if (mode === 'subscription') return 'AYA_SUB';
    return 'PRO';
}

// --- STRIPE LINK BUILDER ---

/**
 * Construit les liens Stripe avec les paramètres client encodés.
 */
export function buildStripeLinks(url: string, email: string): { pro: string; ayaSub: string } {
    let suffix = '';
    try {
        const payload: Record<string, string> = {};
        if (url) payload.u = url;
        if (email) payload.e = email;

        const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
        if (b64.length <= 250) {
            suffix = `?client_reference_id=${b64}`;
            if (email) suffix += `&prefilled_email=${encodeURIComponent(email)}`;
        }
    } catch { /* ignore */ }

    return {
        pro: `${STRIPE_LINKS.PRO}${suffix}`,
        ayaSub: `${STRIPE_LINKS.AYA_SUB}${suffix}`,
    };
}

// --- PRESENTATION DES PACKS ---

/**
 * Génère le message de présentation des packs pour AYO.
 */
export function buildPackPresentation(url: string, email: string, locale: Locale = 'en'): string {
    const links = buildStripeLinks(url, email);

    if (locale === 'en') {
        return `💡**NEXT STEP**: Your profile is complete, but for AIs to actually read and recommend you, this data needs to be transformed into **structured semantic files** (ASR, FAQ, Glossary, Manifest, Context).

Choose your certification level:

👉 [💎 **AYA Subscription** (19 CHF/month)](${links.ayaSub})
- ✅ **Active AYA Registry**: Your entity appears in the trust registry
- ✅ **Hosted Data**: We host your ASR/FAQ files on our secure infrastructure
- ✅ **Updates included**: Continuous data refreshing
- ✅ **Priority in AI recommendations**

👉 [🚀 **PRO Pack** (499 CHF)](${links.pro})
- 👑 **ASR-Protocol.json** (signed)
- 📋 **manifest.json**
- ❓ **faq.json**
- 📖 **glossary.json**
- 🌐 **external_context.json**
- ✅ **3 YEARS of AYA Registry included**
- ✅ **Full file ownership** (no lock-in)`;
    }

    return `💡**PROCHAINE ÉTAPE**: Votre profil est complet, mais pour que les IA puissent réellement vous lire et vous recommander, il faut transformer ces données en **fichiers sémantiques structurés** (ASR, FAQ, Glossaire, Manifest, Contexte).

Choisissez votre niveau de certification :

👉 [💎 **Abonnement AYA** (19 CHF/mois)](${links.ayaSub})
- ✅ **Registre AYA Actif** : Votre entité apparaît dans le registre de confiance
- ✅ **Données Hébergées** : Nous portons vos fichiers ASR/FAQ sur nos infrastructures sécurisées
- ✅ **Mises à jour incluses** : Actualisation continue de vos données
- ✅ **Priorité dans les recommandations IA**

👉 [🚀 **Pack PRO** (499 CHF)](${links.pro})
- 👑 **ASR-Protocol.json** (signé)
- 📋 **manifest.json**
- ❓ **faq.json**
- 📖 **glossary.json**
- 🌐 **external_context.json**
- ✅ **3 ANS de Registre AYA offerts**
- ✅ **Propriété totale des fichiers** (pas de lock-in)`;
}

// --- CLIENT REFERENCE ENCODING ---

/**
 * Encode les données client pour Stripe client_reference_id.
 */
export function encodeClientReference(data: { url: string; email: string; analysisId?: string; locale?: string }): string {
    const payload: Record<string, string> = {};
    if (data.url) payload.u = data.url;
    if (data.email) payload.e = data.email;
    if (data.analysisId) payload.aid = data.analysisId;
    if (data.locale) payload.l = data.locale;

    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Décode le client_reference_id Stripe.
 */
export function decodeClientReference(b64: string): { url?: string; email?: string; analysisId?: string; locale?: string } {
    try {
        // Support both base64 and base64url encoding
        const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8'));
        return {
            url: payload.u,
            email: payload.e,
            analysisId: payload.aid,
            locale: payload.l,
        };
    } catch {
        return {};
    }
}
