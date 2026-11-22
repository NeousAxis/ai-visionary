import nodemailer from 'nodemailer';
import { checkMailDomain } from '@/lib/mx-check';

// Infomaniak SMTP configuration
// Docs: https://www.infomaniak.com/en/support/faq/2604/send-or-receive-emails-from-a-third-party-software
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.infomaniak.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // STARTTLS on port 587
    auth: {
        user: process.env.SMTP_USER,     // e.g. hello@ai-visionary.xyz
        pass: process.env.SMTP_PASSWORD,  // Infomaniak email password
    },
});

interface EmailAttachment {
    filename: string;
    content: Buffer | string;
}

interface SendEmailOptions {
    from: string;
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
    /** Court-circuite la verification DNS du domaine destinataire (diagnostic uniquement). */
    skipMxCheck?: boolean;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('SMTP credentials not set — email not sent');
        return { success: false, error: 'SMTP credentials missing' };
    }

    // Garde-fou DNS : un domaine sans MX ne recevra jamais le message, il resterait 5 jours
    // dans la file Infomaniak avant de bouncer (cf. lib/mx-check.ts, incident animedekho.cam).
    // On echoue tout de suite et bruyamment plutot que d'envoyer dans le vide.
    const recipients = (Array.isArray(options.to) ? options.to : [options.to]).filter(Boolean);
    let deliverable = recipients;
    if (!options.skipMxCheck && recipients.length > 0) {
        const checks = await Promise.all(recipients.map(async (to) => ({ to, check: await checkMailDomain(to) })));
        deliverable = checks.filter(c => c.check.ok).map(c => c.to);
        for (const c of checks) {
            if (!c.check.ok) console.warn(`[mx-check] REJECTED ${c.check.reason} domain=${c.check.domain || '?'} — email non envoye`);
        }
        if (deliverable.length === 0) {
            const reason = checks[0]?.check.reason || 'invalid';
            return { success: false, error: `undeliverable_domain (${reason})` };
        }
    }

    try {
        await transporter.sendMail({
            from: options.from,
            to: deliverable.join(', '),
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo,
            attachments: options.attachments,
        });
        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('SMTP send error:', message);
        return { success: false, error: message };
    }
}
