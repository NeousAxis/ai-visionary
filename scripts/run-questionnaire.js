/**
 * Script qui remplit le questionnaire AYO en appelant l'API /api/chat directement.
 * Simule un vrai utilisateur mais en 2 minutes au lieu de 20.
 * Les données sont sauvegardées en Firestore exactement comme un vrai client.
 */

const API_URL = 'http://localhost:3002/api/chat';

// Réponses réalistes pour Api-glossaries.com
const ANSWERS = [
    // 1. URL
    "https://api-glossaries.com",
    // 2. Confirmation propriétaire
    "✅ Oui, c'est mon site",
    // 3. Confirmation données exactes
    "✅ J'ai compris, je poursuis l'analyse",
    // 4. Type d'activité / business type
    "API de glossaires techniques spécialisés en écologie et philosophie, destinés aux bots IA. Nous fournissons des vocabulaires structurés via API REST et JSON pour aider les IA à mieux répondre à leurs utilisateurs.",
    // 5. Email de contact
    "contact@api-glossaries.com",
    // 6. Ville / localisation
    "Paris, France",
    // 7. Services proposés
    "Accès à des glossaires ESG spécialisés (CSRD, GHG Protocol, TCFD, Taxonomie EU), données structurées en JSON, API REST pour l'intégration dans les systèmes IA, scraping de données ESG qualifiées",
    // 8. Produits
    "Glossaires ESG techniques, API de vocabulaires écologiques, base de données philosophiques structurées pour agents IA",
    // 9. Cas d'usage
    "Intégration de vocabulaires ESG dans les chatbots IA, entraînement de modèles sur la terminologie durabilité, structuration de données philosophiques pour les agents conversationnels",
    // 10. Audience cible
    "Développeurs IA, entreprises tech, chercheurs en durabilité, consultants ESG, startups green-tech",
    // 11. Tarification
    "Gratuit pour l'accès basique. Plans premium à partir de 49 euros/mois pour l'accès API complet avec SLA et support dédié.",
    // 12. Étapes du processus
    "1. Inscription et obtention d'une clé API. 2. Consultation du catalogue de glossaires disponibles. 3. Appel API REST avec la clé pour récupérer les données JSON. 4. Intégration des données structurées dans votre système IA.",
    // 13. Mode de livraison
    "100% en ligne via API REST. Les données sont servies en JSON standardisé avec métadonnées riches.",
    // 14. Zone géographique
    "International - les API sont accessibles mondialement. Documentation en français et anglais.",
    // 15. Certifications
    "Données sous licence Creative Commons. Conformité RGPD pour le traitement des données utilisateurs. Architecture sécurisée avec chiffrement TLS.",
    // 16. Frameworks / normes
    "RGPD, Creative Commons, standards OpenAPI pour la documentation API, JSON-LD pour les données structurées",
    // 17. Mesures de sécurité
    "Chiffrement TLS pour toutes les communications API, authentification par clé API, rate limiting pour prévenir les abus, logs d'accès et monitoring continu",
    // 18. KPIs / indicateurs
    "Plus de 15 000 termes ESG indexés, 4 frameworks majeurs couverts (CSRD, GHG Protocol, TCFD, Taxonomie EU), temps de réponse API moyen inférieur à 200ms, disponibilité 99.9%",
    // 19. FAQ
    "Oui, nous avons une FAQ sur le site qui explique comment utiliser l'API, les formats de données disponibles et les conditions d'utilisation.",
    // 20. Glossaire
    "Oui bien sûr, c'est notre produit principal. Nous avons plusieurs glossaires spécialisés couvrant l'écologie, la philosophie environnementale et les normes ESG.",
    // 21. Documentation
    "Oui, documentation technique complète accessible en ligne avec exemples de code, guide d'intégration et référence API.",
    // 22. Dernière mise à jour
    "Mars 2026 - les glossaires sont mis à jour mensuellement avec les nouvelles réglementations ESG.",
    // 23. LinkedIn
    "https://www.linkedin.com/in/neous-axis-8624803b2/",
];

async function sendMessage(messages) {
    const resp = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`API error ${resp.status}: ${txt.substring(0, 300)}`);
    }

    const data = await resp.json();
    return data.text || data.response || JSON.stringify(data).substring(0, 500);
}

async function run() {
    const messages = [];

    for (let i = 0; i < ANSWERS.length; i++) {
        const answer = ANSWERS[i];
        messages.push({ role: 'user', content: answer });

        console.log(`\n[${i+1}/${ANSWERS.length}] USER: ${answer.substring(0, 80)}${answer.length > 80 ? '...' : ''}`);

        try {
            const response = await sendMessage(messages);
            messages.push({ role: 'assistant', content: response });

            // Show truncated response
            const shortResp = response.substring(0, 150).replace(/\n/g, ' ');
            console.log(`    AYO: ${shortResp}...`);

            // Check if we got a score
            if (response.includes('SCORE') || response.includes('/100') || response.includes('score')) {
                console.log('\n========================================');
                console.log('SCORE DÉTECTÉ - Extraction terminée !');
                console.log('========================================');
                // Continue to get the final extraction
            }

            // Check if questionnaire is done
            if (response.includes('Félicitations') || response.includes('terminé') || response.includes('Pack PRO')) {
                console.log('\n========================================');
                console.log('QUESTIONNAIRE TERMINÉ !');
                console.log('========================================');
                break;
            }

        } catch (err) {
            console.error(`    ERROR: ${err.message}`);
            // If it's a timeout or server error, wait and retry
            if (i > 0) {
                console.log('    Waiting 3s and retrying...');
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const response = await sendMessage(messages);
                    messages.push({ role: 'assistant', content: response });
                    console.log(`    AYO (retry): ${response.substring(0, 150).replace(/\n/g, ' ')}...`);
                } catch (err2) {
                    console.error(`    RETRY FAILED: ${err2.message}`);
                }
            }
        }
    }

    console.log('\n\nDone. Les données sont maintenant en Firestore.');
    console.log('Tu peux vérifier: http://localhost:3002/api/debug/test-ayo?url=api-glossaries.com');
}

run().catch(e => { console.error(e); process.exit(1); });
