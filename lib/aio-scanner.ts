
/**
 * AIO Scanner Logic
 * Ce module effectue une "vraie" analyse technique de la page cible
 * pour nourrir le contexte de l'IA avec des faits avérés, pas des hallucinations.
 */

export interface AioScanResult {
    url: string;
    isReachable: boolean;
    hasJsonLd: boolean;
    jsonLdCount: number;
    hasAsrFile: boolean;
    hasFaqContent: boolean; // Détecte un lien ou une section FAQ visible
    hasFaqSchema: boolean; // Détecte le schéma spécifique FAQPage
    metaTitle: string | null;
    metaDescription: string | null;
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
        metaTitle: null,
        metaDescription: null,
        scoreFactors: []
    };

    try {
        // 1. Normaliser l'URL
        let url = targetUrl;
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        // 2. Fetch du HTML Principal
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

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

            // --- ANALYSE JSON-LD ---
            // On cherche les blocs de script type="application/ld+json"
            const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>/gi;
            const jsonLdMatches = html.match(jsonLdRegex);

            if (jsonLdMatches) {
                result.hasJsonLd = true;
                result.jsonLdCount = jsonLdMatches.length;
                result.scoreFactors.push(`✅ ${jsonLdMatches.length} blocs de Données Structurées détectés.`);

                // Check for specific schemas inside the HTML logic (simple string check for robustness without heavy parsing)
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
                    result.scoreFactors.push(`⚠️ Contenu FAQ détecté mais NON STRUCURÉ pour l'IA (Manque Schema.org).`);
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
        } catch (e) {
            // Ignore URL parse errors
        }

    } catch (error) {
        result.scoreFactors.push(`❌ Erreur technique lors du scan: Site inaccessible.`);
    }

    return result;
}
