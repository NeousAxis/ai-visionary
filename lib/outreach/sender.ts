/**
 * lib/outreach/sender.ts
 *
 * Expediteur SMTP DEDIE pour l'outreach cold B2B, separe de lib/mailer.ts.
 *
 * Pourquoi un transporter separe ([[project_outreach_engine]]) :
 *  - Identite dediee (OUTREACH_SMTP_USER, ex. outreach@ / registry@) pour NE PAS
 *    cramer la deliverabilite de hello@ (OTP, Stripe, livraison Pack PRO).
 *  - Pool nodemailer throttle (maxConnections + rateLimit) -> envoi individuel lent,
 *    jamais un blast (CGU + filtres antispam).
 *  - En-tetes List-Unsubscribe + List-Unsubscribe-Post (RFC 8058, desinscription
 *    un clic exigee par Gmail/Yahoo pour les expediteurs en volume).
 *
 * Si OUTREACH_SMTP_USER/PASSWORD ne sont pas configures, le sender refuse d'envoyer
 * (retourne success:false) — on ne retombe JAMAIS silencieusement sur hello@.
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let _transport: Transporter | null = null;

function getTransport(): Transporter | null {
    const user = process.env.OUTREACH_SMTP_USER;
    const pass = process.env.OUTREACH_SMTP_PASSWORD;
    if (!user || !pass) return null;

    if (!_transport) {
        _transport = nodemailer.createTransport({
            host: process.env.OUTREACH_SMTP_HOST || process.env.SMTP_HOST || 'mail.infomaniak.com',
            port: Number(process.env.OUTREACH_SMTP_PORT || process.env.SMTP_PORT) || 587,
            secure: false, // STARTTLS sur 587
            auth: { user, pass },
            pool: true,
            maxConnections: 1,            // un seul canal -> envoi sequentiel
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: Number(process.env.OUTREACH_RATE_PER_SEC || '1'), // defaut: 1 msg/s max
        });
    }
    return _transport;
}

export function isOutreachSenderConfigured(): boolean {
    return !!(process.env.OUTREACH_SMTP_USER && process.env.OUTREACH_SMTP_PASSWORD);
}

/** Adresse d'expedition (From) — identite dediee, avec nom affiche. */
export function outreachFrom(): string {
    const user = process.env.OUTREACH_SMTP_USER || 'outreach@ai-visionary.xyz';
    const name = process.env.OUTREACH_FROM_NAME || 'Cyril Léger · AI Visionary';
    return `${name} <${user}>`;
}

export interface SendOutreachInput {
    to: string;
    subject: string;
    html: string;
    text: string;
    unsubscribeUrl: string;     // pour l'en-tete List-Unsubscribe
    unsubscribeMailto?: string; // optionnel : mailto de desinscription
}

export interface SendOutreachResult {
    success: boolean;
    messageId?: string;
    error?: string;
    skipped?: boolean; // true si non configure (pas une vraie erreur d'envoi)
}

export async function sendOutreachEmail(input: SendOutreachInput): Promise<SendOutreachResult> {
    const transport = getTransport();
    if (!transport) {
        return { success: false, skipped: true, error: 'OUTREACH_SMTP not configured' };
    }

    // List-Unsubscribe : URL https (one-click) + mailto optionnel.
    const luParts = [`<${input.unsubscribeUrl}>`];
    if (input.unsubscribeMailto) luParts.unshift(`<mailto:${input.unsubscribeMailto}>`);

    try {
        const info = await transport.sendMail({
            from: outreachFrom(),
            to: input.to,
            subject: input.subject,
            html: input.html,
            text: input.text,
            replyTo: process.env.OUTREACH_REPLY_TO || process.env.OUTREACH_SMTP_USER,
            headers: {
                'List-Unsubscribe': luParts.join(', '),
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                'Auto-Submitted': 'auto-generated',
                'X-Campaign': 'aya-outreach',
            },
        });
        return { success: true, messageId: info.messageId };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[outreach/sender] send error:', message);
        return { success: false, error: message };
    }
}

/** Verifie la connexion SMTP de l'identite dediee (utilise par l'admin avant ramp). */
export async function verifyOutreachTransport(): Promise<{ ok: boolean; error?: string }> {
    const transport = getTransport();
    if (!transport) return { ok: false, error: 'OUTREACH_SMTP not configured' };
    try {
        await transport.verify();
        return { ok: true };
    } catch (err: unknown) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
