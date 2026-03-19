import { db } from './db';
import { isAllowedUrl } from './validators';

export interface AioScanResult {
    url: string;
    isReachable: boolean;
    hasJsonLd: boolean;
    jsonLdCount: number;
    hasAsrFile: boolean;
    hasFaqContent: boolean; // Détecte un lien ou une section FAQ visible
    hasFaqSchema: boolean; // Détecte le schéma spécifique FAQPage
    isAyaRegistered: boolean; // Détecte la présence dans le Registre AYA
    metaTitle: string | null;
    metaDescription: string | null;
    h1: string[];
    text: string;
    scoreFactors: string[];
}

export async function scanUrlForAioSignals(targetUrl: string): Promise<AioScanResult> {
    const result: AioScanResult = {
        url: targetUrl,
        isReachable: false,
        hasJsonLd: false,
        jsonLdCount: 0,
        hasAsrFile: false,
        hasFaqContent: false,
        hasFaqSchema: false,
        isAyaRegistered: false,
        metaTitle: null,
        metaDescription: null,
        h1: [],
        text: "",
        scoreFactors: []
    };

    // 0. CHECK AYA REGISTRY (M4 fix: check aya_registry, not analyses)
    try {
        const ayaEntity = await db.getAyaEntityByUrl(targetUrl);
        if (ayaEntity && ayaEntity.payment_completed) {
            result.isAyaRegistered = true;
            result.scoreFactors.push(`✅ Entité présente dans le Registre de Confiance AYA.`);
        }
    } catch (_e) {
        // Safe skip
    }

    try {
        // 1. Normaliser l'URL
        let url = targetUrl;
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        // SECURITY: Anti-SSRF check — block private IPs, localhost, metadata endpoints
        const ssrfCheck = isAllowedUrl(url);
        if (!ssrfCheck.allowed) {
            result.scoreFactors.push(`❌ URL non autorisée: ${ssrfCheck.reason}`);
            return result;
        }

        // 2. Fetch du HTML Principal
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (Strict)

        const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'AYO-Bot/1.0 (AI Visionary Scanner)' } });
        clearTimeout(timeoutId);

        if (response.ok) {
            result.isReachable = true;
            const html = await response.text();
            const lowerHtml = html.toLowerCase();

            // --- ANALYSE META ---
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            result.metaTitle = titleMatch ? titleMatch[1] : null;

            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
            result.metaDescription = descMatch ? descMatch[1] : null;

            // --- EXTRACTION CONTENU (H1 & TEXTE BRUT) ---
            const h1Regex = /<h1[^>]*>([^<]+)<\/h1>/gi;
            let h1Match;
            while ((h1Match = h1Regex.exec(html)) !== null) {
                result.h1.push(h1Match[1].trim());
            }

            // Simple text extraction (stripping tags) - for LLM context
            result.text = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
                .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
                .replace(/<[^>]+>/g, "\n")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 15000); // Limit context size

            // --- ANALYSE JSON-LD (CONTENU) ---
            const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
            let match;
            let meaningfulSchemaFound = false;
            const foundTypes: string[] = [];

            while ((match = jsonLdRegex.exec(html)) !== null) {
                try {
                    const content = match[1];
                    const data = JSON.parse(content);
                    const typeLower = (data['@type'] || "").toLowerCase();

                    // On collecte tous les types trouvés
                    foundTypes.push(data['@type']);

                    // VERIFICATION QUALITATIVE
                    // On cherche des types "Entity" qui définissent l'entreprise, pas juste la page.
                    if (
                        typeLower.includes('organization') ||
                        typeLower.includes('localbusiness') ||
                        typeLower.includes('corporation') ||
                        typeLower.includes('professionalservice') ||
                        typeLower.includes('store') ||
                        typeLower.includes('medicalbusiness')
                    ) {
                        meaningfulSchemaFound = true;
                    }
                } catch (_e) {
                    // Ignore parse errors
                }
            }

            result.jsonLdCount = foundTypes.length;

            if (foundTypes.length > 0) {
                if (meaningfulSchemaFound) {
                    result.hasJsonLd = true;
                    result.scoreFactors.push(`✅ Sémantique d'Entité DÉTECTÉE (Types: ${foundTypes.join(', ')}).`);
                } else {
                    result.hasJsonLd = false; // ON FORCE À FAUX SI CE N'EST PAS UNE ENTITE
                    result.scoreFactors.push(`⚠️ JSON-LD détecté mais FAIBLE VALEUR (Types: ${foundTypes.join(', ')}). Ce n'est pas une déclaration d'Entité (Organization).`);
                }

                // FAQ Check Specific
                if (lowerHtml.includes('"@type": "faqpage"') || lowerHtml.includes('"@type":"faqpage"')) {
                    result.hasFaqSchema = true;
                    result.scoreFactors.push(`✅ Schéma FAQPage officiel détecté.`);
                }
            } else {
                result.scoreFactors.push(`❌ Aucun balisage sémantique (JSON-LD) trouvé.`);
            }

            // --- ANALYSE CONTENU (FAQ) ---
            // On cherche des indices de présence de FAQ (Lien ou Section)
            // Liens : href="/faq" ou href="...faq..."
            // Texte : "Foire aux questions"
            const hasFaqLink = /href=["'][^"']*faq[^"']*["']/i.test(html);
            const hasFaqText = /foire aux questions|frequently asked questions/i.test(html);

            if (hasFaqLink || hasFaqText) {
                result.hasFaqContent = true;
                if (!result.hasFaqSchema) {
                    result.scoreFactors.push(`⚠️ Contenu FAQ détecté mais NON STRUCTURÉ pour l'IA (Manque Schema.org).`);
                }
            }

        } else {
            result.scoreFactors.push(`⚠️ Site difficilement accessible (Code ${response.status}).`);
        }

        // 3. CHECK ASR FILE (Le test ultime)
        // On essaie de taper sur /.ayo/asr.json
        try {
            const asrUrl = new URL(url);
            asrUrl.pathname = '/.ayo/asr.json';
            const asrResponse = await fetch(asrUrl.toString(), { method: 'HEAD', headers: { 'User-Agent': 'AYO-Bot/1.0' } });

            if (asrResponse.ok) {
                result.hasAsrFile = true;
                result.scoreFactors.push(`🏆 FICHIER ASR OFFICIEL DÉTECTÉ (${asrUrl.toString()}).`);
            }
        } catch (_e) {
            // Ignore URL parse errors
        }

    } catch (_error) {
        result.scoreFactors.push(`❌ Erreur technique lors du scan: Site inaccessible.`);
    }

    return result;
}
