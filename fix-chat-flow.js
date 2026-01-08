const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app/api/chat/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Le bloc à remplacer commence à "SCENARIO 1 : User provides Email" 
// et finit AVANT "🛑 PERFORMANCE OPTIMIZATION"

const startMarker = "// SCENARIO 1 : User provides Email (Trigger Report)";
const endMarker = "// 🛑 PERFORMANCE OPTIMIZATION (CRITICAL FIX FOR 500 ERRORS)";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    console.log("Found Email Scenario Block. Replacing with STRICT FLOW logic...");

    const strictFlowBlock = `// SCENARIO 1 : User provides Email (Update DB & Offer Payment)
            if (lastMessage.role === 'user' && emailMatch) {
                const userEmail = emailMatch[0];
                console.log(\`📧 DETECTED EMAIL: \${userEmail}. Updating Analysis Record...\`);

                // 1. Find the URL created in previous steps from history
                const historyUrlRegex = /(?:https?:\\/\\/)?(?:www\\.)?[-a-zA-Z0-9]{1,256}\\.[a-zA-Z]{2,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/gi;
                
                // Find the user message that contained the URL (and was NOT an email)
                const historyUrlMatchMsg = messages.find((m: any) => {
                    const isMsgEmail = m.content.trim().match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9._-]+$/);
                    return m.role === 'user' && m.content.match(historyUrlRegex) && !isMsgEmail;
                });
                
                let detectedUrl = "";
                if (historyUrlMatchMsg) {
                     const match = historyUrlMatchMsg.content.match(historyUrlRegex);
                     if (match) detectedUrl = match[0];
                     if (detectedUrl && !detectedUrl.startsWith('http')) detectedUrl = 'https://' + detectedUrl;
                }

                let analysisFound = false;

                if (detectedUrl) {
                    console.log(\`🔍 Linking Email \${userEmail} to URL \${detectedUrl}...\`);
                    // 2. RETRIEVE ANALYSIS FROM DB (Stateless Link)
                    try {
                         const existingAnalysis = await db.getLatestAnalysisByUrl(detectedUrl);
                         
                         if (existingAnalysis) {
                             analysisFound = true;
                             // 3. UPDATE RECORD WITH EMAIL
                             await db.saveAnalysis(existingAnalysis.id, {
                                 email: userEmail
                             });
                             console.log(\`✅ DB UPDATED: \${userEmail} linked to Analysis \${existingAnalysis.id}\`);
                             
                             // Update context for Stripe generation later
                             // But we generate links manually below for clarity
                         } else {
                             console.warn(\`⚠️ No existing analysis found in DB for \${detectedUrl}\`);
                         }
                    } catch (dbErr) {
                        console.error("❌ Failed to link email to analysis:", dbErr);
                    }
                }

                // 4. GENERATE STRIPE LINKS (Using Payload)
                // We encode the URL and Email so Webhook can retrieve them regardless of DB state fallback
                let stripeSuffix = "";
                try {
                    const payload = { u: detectedUrl || "unknown", e: userEmail };
                    const jsonStr = JSON.stringify(payload);
                    const b64 = Buffer.from(jsonStr).toString('base64');
                    // Ensure < 255 chars
                    if (b64.length <= 250) {
                        stripeSuffix = \`?client_reference_id=\${b64}&prefilled_email=\${encodeURIComponent(userEmail)}\`;
                    }
                } catch (e) { console.error("Stripe Param Error", e); }


                // 5. RESPOND WITH PAYMENT OPTIONS (No Email Sent)
                finalResponseText = \`✅ **Email enregistré.**

Votre dossier est prêt et archivé.

Pour recevoir votre **Certification ASR** et les documents techniques, choisissez votre niveau d'activation :

1️⃣ **Essential (99 CHF)**
*Idéal pour sécuriser l'existant.*
👉 [Activer ASR Essential](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200\${stripeSuffix})
*(Envoi immédiat des fichiers certifiés après paiement)*

2️⃣ **Pack PRO (499 CHF)**
*Pour une autorité totale sur les IA.*
👉 [Activer Pack PRO](https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201\${stripeSuffix})
*(Inclut : Glossaire Sémantique, FAQ IA-Native + Correction complète)*

---
*Dès confirmation du règlement par Stripe, notre système générera et vous enverra automatiquement votre pack par email.*\`;

            }

            `;

    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);

    // Clean extra lines
    const cleanAfter = after.trimStart();

    content = before + strictFlowBlock + "\n\n        " + cleanAfter;

    fs.writeFileSync(filePath, content, 'utf8');
    console.log("File updated successfully with STRICT FLOW logic.");
} else {
    console.error("Could not find SCENARIO 1 block.");
}
