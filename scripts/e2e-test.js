/**
 * E2E Test — Questionnaire AYO complet pour AI Visionary
 *
 * Ce script:
 * 1. Envoie l'URL https://www.ai-visionary.com/ au chat AYO
 * 2. Repond a toutes les questions du questionnaire
 * 3. Appelle /api/debug/test-ayo pour generer les 5 fichiers Pack PRO
 * 4. Sauvegarde les fichiers sur le bureau
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3002/api/chat';
const DEBUG_URL = 'http://localhost:3002/api/debug/test-ayo';
const ADMIN_SECRET = 'df3a1115bfc638441b779d4fbb4c7754068de895d858b1daef51d1d34293a240';
const OUTPUT_DIR = '/Users/cyrilleger/Desktop/AYO_Pack_PRO_Test';

// Reponses pour AI Visionary
const ANSWERS = [
    // 1. URL
    "https://www.ai-visionary.com/",
    // 2. Confirmation proprietaire
    "✅ Oui, c'est mon site",
    // 3. Confirmation donnees exactes (truth warning)
    "✅ J'ai compris, je poursuis l'analyse",
    // 4. Calibration activite
    "Rendre les entreprises visibles par les IA grâce à la création de fichiers structurés ASR (AI Singular Record). Nous analysons la présence digitale des entreprises et générons des fichiers de données structurées pour que les IA comme ChatGPT, Gemini et Claude puissent les identifier, les comprendre et les recommander.",
    // 5+ Reponses generiques adaptees selon la question
    "hello@ai-visionary.com",
    "Genève, Suisse",
    "Audit de visibilité IA (score AIO), Génération de fichiers ASR, Certification AYA, Accompagnement à l'optimisation AIO",
    "Pack PRO ASR (fichiers structurés), Pack Plateforme (abonnement mensuel), Certificat AYA de conformité IA",
    "Entreprises qui veulent être recommandées par ChatGPT, PME qui veulent apparaître dans les réponses IA, Consultants en marketing digital",
    "B2B principalement : PME, startups, consultants, agences digitales, grandes entreprises en transformation digitale",
    "Pack PRO : 499 CHF achat unique, Abonnement AYA : 19 CHF/mois, Audit gratuit via le chatbot AYO",
    "1. Scan automatique du site web. 2. Questionnaire intelligent avec AYO. 3. Génération des fichiers ASR structurés. 4. Déploiement et certification AYA.",
    "100% en ligne via la plateforme ai-visionary.com et le chatbot AYO",
    "International - service accessible mondialement. Focus marché francophone (Suisse, France, Belgique, Canada)",
    "Aucune certification formelle pour le moment",
    "Aucun framework ou fédération spécifique",
    "Chiffrement TLS, données hébergées sur infrastructure Vercel/Firebase, conformité RGPD",
    "Pas encore de chiffres à déclarer, service en phase de lancement",
    "Oui, le chatbot AYO fait office de FAQ interactive",
    "Non, pas de glossaire dédié pour le moment",
    "Oui, documentation accessible via le site et le chatbot",
    "Mars 2026",
    "visibilité IA, optimisation AIO, fichier ASR, référencement IA, recommandation ChatGPT, être visible par les IA, score AIO",
    "Comment rendre mon entreprise visible par l'IA, Comment être recommandé par ChatGPT, Comment apparaître dans les réponses de Gemini, Optimiser sa présence IA",
];

async function sendMessage(messages, retryCount = 0) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!resp.ok) {
            const txt = await resp.text();
            throw new Error(`API error ${resp.status}: ${txt.substring(0, 500)}`);
        }

        const data = await resp.json();
        return data.text || data.response || JSON.stringify(data).substring(0, 1000);
    } catch (err) {
        if (retryCount < 2) {
            console.log(`    ⏳ Retry ${retryCount + 1}/2 apres erreur: ${err.message.substring(0, 100)}`);
            await new Promise(r => setTimeout(r, 3000));
            return sendMessage(messages, retryCount + 1);
        }
        throw err;
    }
}

function analyzeResponse(response, turnNumber) {
    const lower = response.toLowerCase();
    return {
        hasScore: lower.includes('score') || lower.includes('/100'),
        hasFinalScore: lower.includes('score final aio'),
        hasOwnership: response.includes('ownership_confirm'),
        hasTruth: response.includes('truth_confirmation'),
        hasCalibration: response.includes('activity_calibration'),
        hasQuestionBlock: response.includes('question_block'),
        // Ne detecter Pack que APRES le score final (pas dans le scan initial)
        hasPack: turnNumber > 5 && (lower.includes('pack pro') || lower.includes('pack plateforme')),
        isComplete: turnNumber > 5 && (lower.includes('félicitations') || lower.includes('terminé')),
    };
}

async function runQuestionnaire() {
    console.log('='.repeat(60));
    console.log('  E2E TEST — Questionnaire AYO pour AI Visionary');
    console.log('='.repeat(60));

    const messages = [];
    let answerIndex = 0;
    let maxTurns = 35; // Safety limit
    let turn = 0;
    let lastResponseAnalysis = {};

    while (turn < maxTurns && answerIndex < ANSWERS.length) {
        turn++;
        const answer = ANSWERS[answerIndex];
        messages.push({ role: 'user', content: answer });

        console.log(`\n--- Tour ${turn} (reponse #${answerIndex + 1}) ---`);
        console.log(`USER: ${answer.substring(0, 100)}${answer.length > 100 ? '...' : ''}`);

        try {
            const response = await sendMessage(messages);
            messages.push({ role: 'assistant', content: response });
            answerIndex++;

            // Analyze response
            lastResponseAnalysis = analyzeResponse(response, turn);

            // Show truncated response
            const shortResp = response.substring(0, 200).replace(/\n/g, ' ');
            console.log(`AYO: ${shortResp}...`);

            // Log key events
            if (lastResponseAnalysis.hasOwnership) console.log('  >> OWNERSHIP QUESTION');
            if (lastResponseAnalysis.hasTruth) console.log('  >> TRUTH WARNING');
            if (lastResponseAnalysis.hasCalibration) console.log('  >> CALIBRATION');
            if (lastResponseAnalysis.hasFinalScore) {
                console.log('\n' + '='.repeat(60));
                console.log('  SCORE FINAL DETECTE!');
                console.log('='.repeat(60));
            }
            if (lastResponseAnalysis.hasPack) {
                console.log('  >> PACK SELECTION DISPONIBLE');
                // Repondre avec Pack PRO
                if (answerIndex >= ANSWERS.length) {
                    messages.push({ role: 'user', content: '🚀 Pack PRO — 499 CHF (Propriété)' });
                    console.log(`\n--- Tour ${turn + 1} (Pack PRO) ---`);
                    console.log('USER: 🚀 Pack PRO — 499 CHF (Propriété)');
                    const packResp = await sendMessage(messages);
                    messages.push({ role: 'assistant', content: packResp });
                    console.log(`AYO: ${packResp.substring(0, 200).replace(/\n/g, ' ')}...`);
                    turn++;
                }
            }

            if (lastResponseAnalysis.isComplete) {
                console.log('\n' + '='.repeat(60));
                console.log('  QUESTIONNAIRE TERMINE!');
                console.log('='.repeat(60));
                break;
            }

            // Petit delai entre les requetes pour eviter le rate limit
            await new Promise(r => setTimeout(r, 1500));

        } catch (err) {
            console.error(`  ERROR: ${err.message}`);
            // Remove the user message we just added since it failed
            messages.pop();
            // Still increment to avoid infinite loop
            answerIndex++;
        }
    }

    console.log(`\nQuestionnaire termine en ${turn} tours, ${answerIndex} reponses envoyees.`);
    return messages;
}

async function generatePackFiles() {
    console.log('\n' + '='.repeat(60));
    console.log('  GENERATION DES FICHIERS PACK PRO');
    console.log('='.repeat(60));

    const url = `${DEBUG_URL}?url=ai-visionary.com&email=hello@ai-visionary.com&secret=${ADMIN_SECRET}`;
    console.log(`\nAppel: ${DEBUG_URL}?url=ai-visionary.com&email=...&secret=***`);

    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            const txt = await resp.text();
            console.error(`Erreur ${resp.status}: ${txt.substring(0, 500)}`);

            // Essayer avec www
            console.log('\nRetry avec www.ai-visionary.com...');
            const url2 = `${DEBUG_URL}?url=www.ai-visionary.com&email=hello@ai-visionary.com&secret=${ADMIN_SECRET}`;
            const resp2 = await fetch(url2);
            if (!resp2.ok) {
                const txt2 = await resp2.text();
                console.error(`Erreur ${resp2.status}: ${txt2.substring(0, 500)}`);

                // Essayer avec https://
                console.log('\nRetry avec https://www.ai-visionary.com/...');
                const url3 = `${DEBUG_URL}?url=https://www.ai-visionary.com/&email=hello@ai-visionary.com&secret=${ADMIN_SECRET}`;
                const resp3 = await fetch(url3);
                if (!resp3.ok) {
                    const txt3 = await resp3.text();
                    throw new Error(`Toutes les tentatives ont echoue. Derniere erreur ${resp3.status}: ${txt3.substring(0, 500)}`);
                }
                return await resp3.json();
            }
            return await resp2.json();
        }
        return await resp.json();
    } catch (err) {
        console.error(`Erreur generation: ${err.message}`);
        throw err;
    }
}

async function saveFiles(data) {
    console.log('\n' + '='.repeat(60));
    console.log('  SAUVEGARDE DES FICHIERS');
    console.log('='.repeat(60));

    if (!data.files) {
        console.error('Pas de fichiers dans la reponse!');
        console.log('Reponse:', JSON.stringify(data, null, 2).substring(0, 1000));
        return;
    }

    // Create output dir
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Save metadata
    if (data._meta) {
        console.log(`\nMetadonnees:`);
        console.log(`  Entity: ${data._meta.entity}`);
        console.log(`  URL: ${data._meta.url}`);
        console.log(`  Score: ${data._meta.score}/100`);
        console.log(`  Generated: ${data._meta.generated_at}`);
    }

    // Save each file
    const fileNames = Object.keys(data.files);
    console.log(`\n${fileNames.length} fichiers a sauvegarder:`);

    for (const [filename, content] of Object.entries(data.files)) {
        const filepath = path.join(OUTPUT_DIR, filename);
        const json = JSON.stringify(content, null, 2);
        fs.writeFileSync(filepath, json, 'utf-8');
        console.log(`  ✅ ${filename} (${json.length} bytes) -> ${filepath}`);
    }

    console.log(`\nTous les fichiers sont dans: ${OUTPUT_DIR}`);
}

async function main() {
    const startTime = Date.now();

    try {
        // Step 1: Run questionnaire
        await runQuestionnaire();

        // Step 2: Wait a bit for DB writes to complete
        console.log('\nAttente 3s pour la persistence Firestore...');
        await new Promise(r => setTimeout(r, 3000));

        // Step 3: Generate pack files
        const packData = await generatePackFiles();

        // Step 4: Save files
        await saveFiles(packData);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  TERMINE en ${elapsed}s`);
        console.log('='.repeat(60));

    } catch (err) {
        console.error(`\nERREUR FATALE: ${err.message}`);
        console.error(err.stack);
        process.exit(1);
    }
}

main();
