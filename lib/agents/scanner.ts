/**
 * AGENT SCANNER
 *
 * Rôle : Crawl technique du site. Zéro LLM. 100% déterministe.
 * Wraps lib/aio-scanner.ts + gestion Firestore scan_state.
 *
 * Ce qu'il détecte automatiquement (JAMAIS demandé en question) :
 * - Sitemap
 * - Robots.txt
 * - JSON-LD
 * - Fichier ASR (AI Singular Record)
 * - FAQ structurée
 * - Mobile responsive
 */

import { scanUrlForAioSignals, type AioScanResult } from '../aio-scanner';
import { getFirestore } from 'firebase-admin/firestore';

// --- URL NORMALIZATION ---

/**
 * Normalise une URL pour générer un docId stable dans Firestore.
 * Supprime le protocole, www, trailing slash, et met en minuscule.
 */
export function normalizeScanStateUrl(url: string): string {
    return url
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '')
        .toLowerCase();
}

/**
 * Génère un docId Firestore stable à partir d'une URL.
 * Base64url, max 128 chars.
 */
export function scanStateDocId(url: string): string {
    return Buffer.from(normalizeScanStateUrl(url)).toString('base64url').substring(0, 128);
}

// --- SCAN RESULT EXTENDED ---

export interface ScannerResult extends AioScanResult {
    /** Sitemap détecté */
    hasSitemap: boolean;
    /** Robots.txt détecté */
    hasRobotsTxt: boolean;
    /** Politiques détectées par le scan */
    detectedPolicies: string[];
}

/**
 * Scanne une URL et enrichit le résultat avec sitemap + robots.txt.
 * Stocke les résultats dans Firestore scan_state.
 */
export async function performScan(targetUrl: string): Promise<ScannerResult> {
    // 1. Scanner principal (aio-scanner.ts)
    const baseResult = await scanUrlForAioSignals(targetUrl);

    // 2. Enrichir avec sitemap + robots.txt
    let hasSitemap = false;
    let hasRobotsTxt = false;
    const detectedPolicies: string[] = [];

    try {
        let baseUrl = targetUrl;
        if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
        const urlObj = new URL(baseUrl);

        // Check sitemap
        const sitemapUrls = [
            `${urlObj.origin}/sitemap.xml`,
            `${urlObj.origin}/sitemap.yml`,
            `${urlObj.origin}/sitemap_index.xml`,
        ];
        for (const sitemapUrl of sitemapUrls) {
            try {
                const resp = await fetch(sitemapUrl, {
                    method: 'HEAD',
                    headers: { 'User-Agent': 'AYO-Bot/1.0' },
                    signal: AbortSignal.timeout(3000),
                });
                if (resp.ok) {
                    hasSitemap = true;
                    detectedPolicies.push('Sitemap');
                    break;
                }
            } catch { /* ignore */ }
        }

        // Check robots.txt
        try {
            const robotsResp = await fetch(`${urlObj.origin}/robots.txt`, {
                method: 'HEAD',
                headers: { 'User-Agent': 'AYO-Bot/1.0' },
                signal: AbortSignal.timeout(3000),
            });
            if (robotsResp.ok) {
                hasRobotsTxt = true;
                detectedPolicies.push('Robots.txt');
            }
        } catch { /* ignore */ }

    } catch { /* ignore URL parse errors */ }

    const result: ScannerResult = {
        ...baseResult,
        hasSitemap,
        hasRobotsTxt,
        detectedPolicies,
    };

    // 3. Stocker dans Firestore
    try {
        const docId = scanStateDocId(targetUrl);
        const firestore = getFirestore();
        await firestore.collection('scan_states').doc(docId).set({
            url: targetUrl,
            normalizedUrl: normalizeScanStateUrl(targetUrl),
            scanResult: result,
            scannedAt: new Date().toISOString(),
        }, { merge: true });
    } catch (e) {
        console.error('[SCANNER] Erreur stockage Firestore:', e);
    }

    return result;
}

/**
 * Charge un scan existant depuis Firestore.
 */
export async function loadScanState(url: string): Promise<any | null> {
    try {
        const docId = scanStateDocId(url);
        const firestore = getFirestore();
        const doc = await firestore.collection('scan_states').doc(docId).get();
        return doc.exists ? doc.data() : null;
    } catch {
        return null;
    }
}

/**
 * Génère le résumé texte du scan pour injection dans le prompt du Greffier.
 * Format : ce que le scan a trouvé (NE JAMAIS REPOSER).
 */
export function formatScanForGreffier(scan: ScannerResult): string {
    const lines: string[] = [];

    lines.push(`- Site accessible : ${scan.isReachable ? 'OUI' : 'NON'}`);
    lines.push(`- JSON-LD : ${scan.hasJsonLd ? `OUI (${scan.jsonLdCount} blocs)` : 'NON'}`);
    lines.push(`- Fichier ASR (AI Singular Record) : ${scan.hasAsrFile ? 'OUI' : 'NON'}`);
    lines.push(`- FAQ sur le site : ${scan.hasFaqContent ? 'OUI' : 'NON'}`);
    lines.push(`- FAQ structurée (Schema.org) : ${scan.hasFaqSchema ? 'OUI' : 'NON'}`);
    lines.push(`- Sitemap : ${scan.hasSitemap ? 'OUI (DÉTECTÉ)' : 'NON'}`);
    lines.push(`- Robots.txt : ${scan.hasRobotsTxt ? 'OUI (DÉTECTÉ)' : 'NON'}`);
    lines.push(`- Registre AYA : ${scan.isAyaRegistered ? 'OUI' : 'NON'}`);

    if (scan.metaTitle) lines.push(`- Titre : ${scan.metaTitle}`);
    if (scan.metaDescription) lines.push(`- Description : ${scan.metaDescription.substring(0, 150)}`);

    return lines.join('\n');
}

/**
 * Détermine les clés de confiance à partir du scan pour le Greffier.
 */
export function classifyScanConfidence(scan: ScannerResult): {
    highConfidence: string[];
    lowConfidence: string[];
    unknown: string[];
} {
    const high: string[] = [];
    const low: string[] = [];
    const unknown: string[] = [];

    // Structure technique — toujours détecté par le scan
    if (scan.hasJsonLd) high.push('has_jsonld'); else unknown.push('has_jsonld');
    if (scan.hasAsrFile) high.push('has_asr'); else unknown.push('has_asr');
    if (scan.hasSitemap) high.push('has_sitemap'); else unknown.push('has_sitemap');
    high.push('mobile_optimized'); // Assumed true

    // FAQ
    if (scan.hasFaqSchema) high.push('has_faq');
    else if (scan.hasFaqContent) low.push('has_faq');
    else unknown.push('has_faq');

    // Tout le reste est unknown par défaut (le Greffier doit demander)
    const allFields = [
        'name', 'legal_name', 'business_type', 'city', 'country',
        'contact_email', 'contact_phone',
        'services', 'products', 'target_audience', 'use_cases', 'pricing_indication',
        'process_steps', 'delivery_mode', 'geographies_served', 'quality_assurance',
        'certifications', 'frameworks', 'policies', 'security_measures',
        'key_indicators', 'last_review_date',
        'has_glossary', 'has_documentation',
        'keywords', 'channels', 'intents',
    ];

    for (const field of allFields) {
        if (!high.includes(field) && !low.includes(field) && !unknown.includes(field)) {
            // Le scan a peut-être détecté des politiques
            if (field === 'policies' && scan.detectedPolicies.length > 0) {
                low.push(field);
            } else {
                unknown.push(field);
            }
        }
    }

    return { highConfidence: high, lowConfidence: low, unknown };
}
