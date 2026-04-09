import nodemailer from 'nodemailer';

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
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        console.warn('SMTP credentials not set — email not sent');
        return { success: false, error: 'SMTP credentials missing' };
    }

    try {
        await transporter.sendMail({
            from: options.from,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
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
