
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        console.log("🛠️ STARTING DEBUG EMAIL SEQUENCE...");

        // 1. HARDCODED MOCK DATA (Simulation of a PRO Purchase)
        const email = "cyrileger@gmail.com"; // Your test email
        const packType = "PRO";
        const score = 88;
        const url = "globalworkflow.xyz";

        // 2. GENERATE HTML (Copy-paste from Webhook logic roughly)
        const emailHtml = `
            <div style="font-family: sans-serif; color: #333;">
                <h1>TEST DIAGNOSTIC AYO VERCEL</h1>
                <p>Ceci est un test manuel pour valider la chaîne d'envoi PRO.</p>
                <p>Pack: ${packType}</p>
                <p>Score: ${score}</p>
                <p>URL: ${url}</p>
                <div style="background: #e0f2fe; padding: 20px; border-radius: 8px;">
                    <strong>Si vous lisez ceci, c'est que :</strong>
                    <ul>
                        <li>Resend fonctionne ✅</li>
                        <li>Les DNS sont OK ✅</li>
                        <li>Le code serveur Vercel fonctionne ✅</li>
                    </ul>
                </div>
            </div>
        `;

        // 3. ATTEMPT SENDING
        console.log(`📤 Sending Debug Email to ${email} via hello@ai-visionary.com...`);

        const data = await resend.emails.send({
            from: 'AYO <hello@ai-visionary.com>',
            to: [email],
            subject: 'TEST DE DIAGNOSTIC AYO VERCEL',
            html: emailHtml
        });

        if (data.error) {
            throw new Error(data.error.message);
        }

        return new Response(`
            <html>
                <body style="background: #111; color: #4ade80; font-family: monospace; padding: 50px;">
                    <h1>✅ DIAGNOSTIC RÉUSSI</h1>
                    <p>Email envoyé avec succès.</p>
                    <p>ID Resend: ${data.data?.id}</p>
                    <p>Cible: ${email}</p>
                    <hr>
                    <p><strong>CONCLUSION :</strong></p>
                    <p>Si vous recevez cet email mais PAS celui de Stripe, cela signifie que <strong>Stripe n'appelle pas la bonne URL Webhook</strong> ou que <strong>Stripe échoue avant d'arriver au code</strong>.</p>
                </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });

    } catch (error: any) {
        console.error("❌ DEBUG ERROR:", error);
        return new Response(`
            <html>
                <body style="background: #450a0a; color: #fca5a5; font-family: monospace; padding: 50px;">
                    <h1>❌ ÉCHEC DIAGNOSTIC</h1>
                    <p>Erreur Technique :</p>
                    <pre style="background: rgba(0,0,0,0.3); padding: 20px;">${error.message || JSON.stringify(error)}</pre>
                </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }
}
