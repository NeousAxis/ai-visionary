import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
        return NextResponse.json({ error: 'RESEND_API_KEY manquante dans les Env Vars' }, { status: 500 });
    }

    const resend = new Resend(resendKey);

    try {
        console.log("🚀 Lancement du test email manuel...");
        const data = await resend.emails.send({
            from: 'AYO <hello@ai-visionary.com>',
            to: ['cyrilleger@gmail.com'], // Hardcoded pour le test
            subject: 'TEST DE DIAGNOSTIC AYO VERCEL',
            html: '<h1>Ceci est un email de test direct.</h1><p>Si vous lisez ceci, Resend fonctionne parfaitement sur Vercel.</p>'
        });

        console.log("✅ Email envoyé:", data);
        return NextResponse.json({ success: true, data: data, message: "Email envoyé, vérifiez votre boîte." });
    } catch (error: any) {
        console.error("❌ Erreur d'envoi:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
