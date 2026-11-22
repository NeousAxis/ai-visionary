// lib/aya/contact.ts
//
// Contact via AYA : un visiteur (ou plus tard un agent) écrit à une entreprise
// certifiée sans voir son adresse, et sans que la sienne soit publiée.
//
// Deux étapes, sans table en base :
// 1. start   : AYA envoie un code à 6 chiffres à l'email du visiteur et renvoie
//              un jeton signé (HMAC) qui scelle entreprise, email, objet,
//              empreinte du message, empreinte du code et expiration (15 min).
// 2. confirm : le visiteur renvoie jeton + code + message ; si tout concorde,
//              le message part vers l'adresse vérifiée de l'entreprise, avec
//              l'email du visiteur en adresse de réponse.
//
// Garde-fous : seules les fiches certifiées avec une adresse sont joignables,
// limites par IP et par email, et AYA_CONTACT_TEST_RECIPIENT redirige TOUS les
// envois vers une adresse de test (développement et préproduction).

import crypto from 'crypto';
import { sendEmail } from '@/lib/mailer';
import { getAyaEntityByIdAggregated } from '@/lib/db';
import { allow } from '@/lib/aya/guard';

export const CONTACT_SUBJECTS = ['devis', 'question', 'commande'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

const SUBJECT_LABEL: Record<ContactSubject, string> = {
    devis: 'Demande de devis', question: 'Question', commande: 'Commande',
};

const TTL_MS = 15 * 60 * 1000;
const FROM = process.env.AYA_CONTACT_FROM || 'AI Visionary <hello@ai-visionary.xyz>';
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

function secret(): string {
    const s = process.env.SESSION_SECRET || '';
    if (s.length < 16) throw new Error('SESSION_SECRET missing');
    return s;
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (s: string) => crypto.createHmac('sha256', secret()).update(s).digest('base64url');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function testRecipient(): string | null {
    const t = (process.env.AYA_CONTACT_TEST_RECIPIENT || '').trim();
    return EMAIL_RE.test(t) ? t : null;
}
function dryRun(): boolean {
    return !process.env.SMTP_USER && process.env.NODE_ENV !== 'production';
}

// Limite par email visiteur : 3 codes par heure et 10 par jour. Empêche aussi
// d'utiliser AYA pour inonder de codes l'adresse de quelqu'un d'autre.
function emailAllowed(email: string): boolean {
    const k = email.toLowerCase();
    return allow(`contact:e:h:${k}`, 3, 3_600_000) && allow(`contact:e:d:${k}`, 10, 86_400_000);
}

// Un jeton ne sert qu'une fois, et 5 codes faux le rendent inutilisable.
const tokenState = new Map<string, { tries: number; used: boolean; exp: number }>();
function tokenEntry(sig: string, exp: number) {
    const now = Date.now();
    for (const [k, v] of tokenState) if (v.exp < now) tokenState.delete(k);
    let e = tokenState.get(sig);
    if (!e) { e = { tries: 0, used: false, exp }; tokenState.set(sig, e); }
    return e;
}

// Au plus 20 messages relayés par entreprise et par jour.
const perEntity = new Map<string, { n: number; reset: number }>();
function entityAllowed(id: string): boolean {
    const now = Date.now();
    const e = perEntity.get(id);
    if (!e || now > e.reset) { perEntity.set(id, { n: 0, reset: now + 86_400_000 }); return true; }
    return e.n < 20;
}
function entityCount(id: string) {
    const e = perEntity.get(id);
    if (e) e.n += 1;
}

export type ContactInput = { entityId: string; email: string; subject: string; message: string };
export type StartResult =
    | { ok: true; token: string; dev_code?: string }
    | { ok: false; error: 'invalid' | 'not_contactable' | 'rate' | 'send' };

function validate(i: ContactInput): { subject: ContactSubject; message: string; email: string } | null {
    const subject = CONTACT_SUBJECTS.find((s) => s === i.subject);
    const message = (i.message || '').trim();
    const email = (i.email || '').trim();
    if (!subject || !EMAIL_RE.test(email) || message.length < 20 || message.length > 3000) return null;
    if (!/^[0-9a-f-]{36}$/i.test(i.entityId || '')) return null;
    return { subject, message, email };
}

async function recipientOf(entityId: string): Promise<{ name: string; to: string } | null> {
    const e: any = await getAyaEntityByIdAggregated(entityId);
    if (!e || e.payment_completed !== true) return null;
    const to = (e.contact_email || '').trim();
    if (!EMAIL_RE.test(to)) return null;
    return { name: e.display_name || e.legal_name || 'Entreprise', to };
}

export async function startContact(i: ContactInput): Promise<StartResult> {
    const v = validate(i);
    if (!v) return { ok: false, error: 'invalid' };
    const rcpt = await recipientOf(i.entityId);
    if (!rcpt) return { ok: false, error: 'not_contactable' };
    if (!emailAllowed(v.email) || !entityAllowed(i.entityId)) return { ok: false, error: 'rate' };

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const payload = Buffer.from(JSON.stringify({
        e: i.entityId, m: v.email.toLowerCase(), s: v.subject, h: sha(v.message),
        c: sha(`${code}:${secret()}`), x: Date.now() + TTL_MS,
    })).toString('base64url');
    const token = `${payload}.${hmac(payload)}`;

    if (dryRun()) {
        console.log(`[aya/contact] DRY RUN code=${code} pour ${v.email} (entité ${rcpt.name})`);
        return { ok: true, token, dev_code: code };
    }
    const test = testRecipient();
    const sent = await sendEmail({
        from: FROM,
        to: test || v.email,
        subject: `${test ? `[TEST pour ${v.email}] ` : ''}Votre code AYA : ${code}`,
        html: `<p>Bonjour,</p><p>Voici votre code pour envoyer votre message à <strong>${esc(rcpt.name)}</strong> via le registre AYA :</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
<p>Il est valable 15 minutes. Si vous n'avez rien demandé, ignorez cet email.</p>
<p style="color:#64748B;font-size:13px">Your AYA verification code is ${code}. It is valid for 15 minutes.</p>`,
    });
    if (!sent.success) return { ok: false, error: 'send' };
    return { ok: true, token };
}

export type ConfirmInput = ContactInput & { token: string; code: string };
export type ConfirmResult = { ok: true; dry_run?: boolean } | { ok: false; error: 'invalid' | 'code' | 'not_contactable' | 'send' };

export async function confirmContact(i: ConfirmInput): Promise<ConfirmResult> {
    const v = validate(i);
    if (!v || typeof i.token !== 'string' || !/^\d{6}$/.test(i.code || '')) return { ok: false, error: 'invalid' };
    const [payload, sig] = i.token.split('.');
    if (!payload || !sig) return { ok: false, error: 'invalid' };
    const good = hmac(payload);
    if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return { ok: false, error: 'invalid' };
    let p: any;
    try { p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return { ok: false, error: 'invalid' }; }
    if (p.x < Date.now() || p.e !== i.entityId || p.m !== v.email.toLowerCase() || p.s !== v.subject || p.h !== sha(v.message)) {
        return { ok: false, error: 'code' };
    }
    const state = tokenEntry(sig, p.x);
    if (state.used || state.tries >= 5) return { ok: false, error: 'code' };
    if (p.c !== sha(`${i.code}:${secret()}`)) { state.tries += 1; return { ok: false, error: 'code' }; }
    state.used = true;

    const rcpt = await recipientOf(i.entityId);
    if (!rcpt) return { ok: false, error: 'not_contactable' };
    if (!entityAllowed(i.entityId)) return { ok: false, error: 'send' };
    entityCount(i.entityId);

    const label = SUBJECT_LABEL[v.subject];
    if (dryRun()) {
        console.log(`[aya/contact] DRY RUN relais vers ${rcpt.to} : ${label} de ${v.email}`);
        return { ok: true, dry_run: true };
    }
    const test = testRecipient();
    const sent = await sendEmail({
        from: FROM,
        to: test || rcpt.to,
        replyTo: v.email,
        subject: `${test ? `[TEST pour ${rcpt.to}] ` : ''}[AYA] ${label} : ${v.message.slice(0, 60).replace(/\s+/g, ' ')}`,
        html: `<p>Bonjour,</p><p>Vous recevez une <strong>${esc(label.toLowerCase())}</strong> via votre fiche certifiée sur le registre AYA.</p>
<blockquote style="border-left:3px solid #4A919E;margin:16px 0;padding:8px 16px;white-space:pre-wrap">${esc(v.message)}</blockquote>
<p>Expéditeur : <a href="mailto:${esc(v.email)}">${esc(v.email)}</a> (adresse vérifiée par AYA). Répondez directement à cet email.</p>
<p style="color:#64748B;font-size:13px">Message transmis par le registre AYA (ai-visionary.xyz), qui ne publie jamais votre adresse. Request relayed by the AYA registry; the sender's address was verified.</p>`,
    });
    if (!sent.success) return { ok: false, error: 'send' };
    console.log(`[aya/contact] relais envoyé : ${label} pour ${rcpt.name}`);
    return { ok: true };
}
