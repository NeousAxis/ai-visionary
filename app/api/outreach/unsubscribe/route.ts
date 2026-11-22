import { NextRequest, NextResponse } from 'next/server';
import { localPgGetOutreachByToken, localPgUnsubscribeOutreach } from '@/lib/db-local-pg';

// Desinscription outreach. Public (le jeton fait foi).
//   GET  ?token=...  -> page de confirmation bilingue + desinscription effective.
//   POST ?token=...  -> one-click RFC 8058 (List-Unsubscribe-Post), repond 200.
export const dynamic = 'force-dynamic';

function page(lang: 'fr' | 'en', ok: boolean): string {
    const t = lang === 'fr'
        ? {
            title: ok ? 'Désinscription confirmée' : 'Lien invalide',
            body: ok
                ? 'Vous ne recevrez plus de message de notre part. Merci.'
                : 'Ce lien de désinscription est invalide ou a déjà été utilisé.',
            home: 'Retour à ai-visionary.xyz',
        }
        : {
            title: ok ? 'Unsubscribe confirmed' : 'Invalid link',
            body: ok
                ? 'You will no longer receive messages from us. Thank you.'
                : 'This unsubscribe link is invalid or has already been used.',
            home: 'Back to ai-visionary.xyz',
        };
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t.title} — AI Visionary</title></head>
<body style="margin:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:80px auto;padding:32px;background:#fff;border-radius:14px;text-align:center;color:#1a1a1a">
<h1 style="font-size:20px;margin:0 0 12px">${t.title}</h1>
<p style="color:#444;font-size:15px;line-height:1.55;margin:0 0 24px">${t.body}</p>
<a href="https://ai-visionary.xyz" style="color:#5b5bd6;font-size:14px;text-decoration:none">${t.home}</a>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
    const token = new URL(req.url).searchParams.get('token') || '';
    const rec = token ? await localPgGetOutreachByToken(token) : null;
    const lang: 'fr' | 'en' = rec?.lang === 'fr' ? 'fr' : 'en';

    let ok = false;
    if (rec) {
        const res = await localPgUnsubscribeOutreach(token, 'link');
        ok = res.ok;
    }
    return new NextResponse(page(lang, ok), {
        status: ok ? 200 : 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

// One-click (Gmail/Yahoo) : POST sans corps, on desinscrit et on repond 200.
export async function POST(req: NextRequest) {
    const token = new URL(req.url).searchParams.get('token') || '';
    if (token) await localPgUnsubscribeOutreach(token, 'one-click');
    return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
