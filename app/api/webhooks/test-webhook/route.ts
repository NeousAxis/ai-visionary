import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 🧪 TEST MANUEL DU WEBHOOK STRIPE
 * 
 * Usage: 
 * https://ai-visionary.com/api/webhooks/test-webhook?email=test@example.com
 * 
 * Simule le comportement du webhook pour diagnostiquer où ça bloque.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const testEmail = url.searchParams.get('email') || 'test@ai-visionary.com';

    console.log(`🧪 TEST WEBHOOK SIMULATION for email: ${testEmail}`);

    const report: any = {
        email: testEmail,
        steps: []
    };

    try {
        // 1. Extract domain from email
        const emailDomain = testEmail.split('@')[1]?.toLowerCase();
        report.steps.push({ step: 1, name: 'Extract Domain', status: 'OK', domain: emailDomain });

        if (!emailDomain) {
            return NextResponse.json({ error: 'Invalid email format', report }, { status: 400 });
        }

        // 2. Construct URL
        const constructedUrl = `https://${emailDomain}`;
        report.steps.push({ step: 2, name: 'Construct URL', status: 'OK', url: constructedUrl });

        // 3. Try to fetch from Firebase (with https://)
        console.log(`🔍 Searching Firebase for: ${constructedUrl}`);
        let dbAnalysis = null;
        try {
            dbAnalysis = await db.getLatestAnalysisByUrl(constructedUrl);
            if (dbAnalysis) {
                report.steps.push({
                    step: 3,
                    name: 'Firebase Lookup (https://)',
                    status: 'FOUND ✅',
                    data: {
                        id: dbAnalysis.id,
                        url: dbAnalysis.url,
                        score: dbAnalysis.score,
                        email: dbAnalysis.email,
                        hasData: !!dbAnalysis.data
                    }
                });
            } else {
                report.steps.push({ step: 3, name: 'Firebase Lookup (https://)', status: 'NOT FOUND ⚠️' });
            }
        } catch (dbErr: any) {
            report.steps.push({ step: 3, name: 'Firebase Lookup (https://)', status: 'ERROR ❌', error: dbErr.message });
        }

        // 4. Fallback: Try without https:// (just domain)
        if (!dbAnalysis) {
            console.log(`🔍 Fallback: Searching Firebase for: ${emailDomain}`);
            try {
                dbAnalysis = await db.getLatestAnalysisByUrl(emailDomain);
                if (dbAnalysis) {
                    report.steps.push({
                        step: 4,
                        name: 'Firebase Lookup (domain only)',
                        status: 'FOUND ✅',
                        data: {
                            id: dbAnalysis.id,
                            url: dbAnalysis.url,
                            score: dbAnalysis.score,
                            email: dbAnalysis.email,
                            hasData: !!dbAnalysis.data
                        }
                    });
                } else {
                    report.steps.push({ step: 4, name: 'Firebase Lookup (domain only)', status: 'NOT FOUND ⚠️' });
                }
            } catch (dbErr: any) {
                report.steps.push({ step: 4, name: 'Firebase Lookup (domain only)', status: 'ERROR ❌', error: dbErr.message });
            }
        }

        // 5. Email Domain Validation
        if (dbAnalysis) {
            const urlObj = new URL(dbAnalysis.url.startsWith('http') ? dbAnalysis.url : `https://${dbAnalysis.url}`);
            const analyzedDomain = urlObj.hostname.replace(/^www\./, '');
            const emailDomainClean = emailDomain;

            const isValid = emailDomainClean === analyzedDomain;
            report.steps.push({
                step: 5,
                name: 'Email Domain Validation',
                status: isValid ? 'VALID ✅' : 'MISMATCH ❌',
                comparison: {
                    emailDomain: emailDomainClean,
                    analyzedDomain: analyzedDomain,
                    match: isValid
                }
            });

            if (!isValid) {
                report.warning = `Email domain (${emailDomainClean}) doesn't match analyzed domain (${analyzedDomain}). Email would be rejected.`;
            }
        }

        // 6. Check Firebase Credentials
        const firebaseConfigured = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
        report.steps.push({
            step: 6,
            name: 'Firebase Credentials',
            status: firebaseConfigured ? 'CONFIGURED ✅' : 'MISSING ❌'
        });

        // 7. Check Resend
        const resendConfigured = !!process.env.RESEND_API_KEY;
        report.steps.push({
            step: 7,
            name: 'Resend Credentials',
            status: resendConfigured ? 'CONFIGURED ✅' : 'MISSING ❌'
        });

        // FINAL VERDICT
        if (!dbAnalysis) {
            report.verdict = '❌ BLOCAGE: Aucune analyse trouvée dans Firebase pour ce domaine';
            report.recommendation = 'Vérifier que l\'URL a bien été analysée via le chatbot AYO et que les données sont enregistrées.';
        } else if (report.warning) {
            report.verdict = '⚠️ BLOCAGE: Validation domaine échouera';
            report.recommendation = 'Utiliser un email du domaine analysé, ou désactiver temporairement la validation (VALIDATION_DISABLED = true)';
        } else {
            report.verdict = '✅ SUCCÈS: Le webhook devrait fonctionner correctement';
            report.recommendation = 'Si l\'email n\'est toujours pas envoyé, vérifier les logs Vercel du webhook.';
        }

        return NextResponse.json(report);

    } catch (error: any) {
        console.error('❌ Test Webhook Error:', error);
        return NextResponse.json({
            error: error.message,
            stack: error.stack,
            report
        }, { status: 500 });
    }
}
