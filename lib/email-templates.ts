/**
 * Email templates for client lifecycle management.
 *
 * Each function returns a fully styled HTML email string
 * matching the existing email style from checkout-success webhook.
 *
 * Palette: navy #212E53, teal #4A919E, sage #BED3C3, coral #CE6A6B, salmon #EBACA2
 */

const FOOTER = `
    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #999; margin: 0;">
            AI Visionary &mdash; Gen&egrave;ve, Suisse<br>
            <a href="https://ai-visionary.com" style="color: #4A919E;">ai-visionary.com</a> &bull;
            <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>
        </p>
    </div>
</div>`;

function wrapEmail(headerTitle: string, headerSubtitle: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; background: #f4f4f4;">
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">

    <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">${headerTitle}</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">${headerSubtitle}</p>
    </div>

    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        ${bodyHtml}
    </div>

    ${FOOTER}
</body>
</html>`;
}

function ctaButton(label: string, url: string, color: string = '#4A919E'): string {
    return `<p style="text-align: center; margin: 20px 0;">
        <a href="${url}" style="background: ${color}; color: #fff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 15px;">${label}</a>
    </p>`;
}

/**
 * Review reminder email — sent when entity data is over 1 year old.
 * Triggered at J-30, J-7, J-0 before next_review_due.
 */
export function buildReviewReminderEmail(entityName: string, updateUrl: string): string {
    return wrapEmail(
        '&#128197; Mise &agrave; jour annuelle',
        'Gardez vos donn&eacute;es &agrave; jour pour rester visible',
        `
        <p>Bonjour,</p>
        <p>Les donn&eacute;es de <strong>${entityName}</strong> dans le registre AYA ont plus d&rsquo;un an.</p>
        <p>Pour maintenir votre <strong>score AIO</strong> et votre visibilit&eacute; aupr&egrave;s des IA (ChatGPT, Claude, Gemini, Perplexity...), nous vous recommandons de mettre &agrave; jour vos informations.</p>

        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
                <strong>Pourquoi mettre &agrave; jour ?</strong><br>
                Les IA privil&eacute;gient les sources de donn&eacute;es r&eacute;centes. Des informations &agrave; jour am&eacute;liorent votre recommandabilit&eacute;.
            </p>
        </div>

        ${ctaButton('Mettre &agrave; jour mes donn&eacute;es', updateUrl)}

        <p style="font-size: 13px; color: #666;">Cette mise &agrave; jour prend moins de 2 minutes. Vos donn&eacute;es existantes sont pr&eacute;-remplies.</p>
        `
    );
}

/**
 * Expiry reminder email — sent before pack expiration.
 * Triggered at J-90, J-30, J-7 before aya_expiry_date.
 */
export function buildExpiryReminderEmail(entityName: string, daysLeft: number, renewUrl: string): string {
    const urgencyColor = daysLeft <= 7 ? '#991B1B' : daysLeft <= 30 ? '#D97706' : '#4A919E';
    const urgencyBg = daysLeft <= 7 ? '#FEE2E2' : daysLeft <= 30 ? '#FEF3C7' : '#F0F9FF';
    const urgencyBorder = daysLeft <= 7 ? '#FECACA' : daysLeft <= 30 ? '#FDE68A' : '#BAE6FD';

    return wrapEmail(
        '&#9200; Votre certification expire bient&ocirc;t',
        `${entityName} &mdash; ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`,
        `
        <p>Bonjour,</p>
        <p>La certification AYA de <strong>${entityName}</strong> expire dans <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong>.</p>

        <div style="background: ${urgencyBg}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid ${urgencyBorder};">
            <p style="margin: 0; font-size: 14px; color: ${urgencyColor}; font-weight: bold;">
                Expiration dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}
            </p>
        </div>

        <p>Apr&egrave;s expiration, votre entit&eacute; passera du statut <strong style="color: #166534;">CERTIFI&Eacute; ACTIF</strong> &agrave; <strong style="color: #991B1B;">EXPIR&Eacute;</strong>. Les IA privil&eacute;gient les entit&eacute;s certifi&eacute;es actives.</p>

        ${ctaButton('Renouveler ma certification', renewUrl, urgencyColor)}

        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 13px; color: #666;">
                <strong>Nos offres :</strong><br>
                &#128081; Pack PRO &mdash; 499 CHF (3 ans inclus)<br>
                &#128203; Abonnement AYA &mdash; 19 CHF/mois
            </p>
        </div>
        `
    );
}

/**
 * Cancellation email — sent when a subscription is cancelled.
 * Triggered by Stripe webhook customer.subscription.deleted.
 */
export function buildCancellationEmail(entityName: string, resubscribeUrl: string): string {
    return wrapEmail(
        '&#128532; Abonnement annul&eacute;',
        `${entityName} &mdash; Votre certification AYA est d&eacute;sactiv&eacute;e`,
        `
        <p>Bonjour,</p>
        <p>Votre abonnement AYA pour <strong>${entityName}</strong> a &eacute;t&eacute; annul&eacute;.</p>

        <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #FECACA;">
            <p style="margin: 0; font-size: 14px; color: #991B1B;">
                <strong>Cons&eacute;quences :</strong><br>
                &bull; Votre certificat AYA passe en statut <strong>EXPIR&Eacute;</strong><br>
                &bull; Votre ASR h&eacute;berg&eacute; n&rsquo;est plus actif<br>
                &bull; Les IA ne verront plus votre entit&eacute; comme certifi&eacute;e
            </p>
        </div>

        <p>Vos donn&eacute;es restent conserv&eacute;es. Vous pouvez r&eacute;activer votre certification &agrave; tout moment.</p>

        ${ctaButton('R&eacute;activer ma certification', resubscribeUrl)}

        <p style="font-size: 13px; color: #666;">Si vous avez annul&eacute; par erreur ou si vous avez des questions, contactez-nous &agrave; <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>.</p>
        `
    );
}

/**
 * Payment failed email — sent when a subscription payment fails.
 * Triggered by Stripe webhook invoice.payment_failed.
 */
export function buildPaymentFailedEmail(entityName: string, retryUrl: string): string {
    return wrapEmail(
        '&#9888;&#65039; &Eacute;chec de paiement',
        `${entityName} &mdash; Action requise`,
        `
        <p>Bonjour,</p>
        <p>Le dernier paiement pour l&rsquo;abonnement AYA de <strong>${entityName}</strong> a &eacute;chou&eacute;.</p>

        <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #FDE68A;">
            <p style="margin: 0; font-size: 14px; color: #854D0E;">
                <strong>Votre certification est toujours active</strong>, mais si le paiement n&rsquo;est pas r&eacute;gularis&eacute; sous 7 jours, votre abonnement sera suspendu.
            </p>
        </div>

        <p>Veuillez v&eacute;rifier votre moyen de paiement ou mettre &agrave; jour vos informations bancaires via le portail Stripe.</p>

        ${ctaButton('Mettre &agrave; jour mon paiement', retryUrl, '#D97706')}

        <p style="font-size: 13px; color: #666;">Si vous pensez qu&rsquo;il s&rsquo;agit d&rsquo;une erreur, contactez-nous &agrave; <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>.</p>
        `
    );
}
