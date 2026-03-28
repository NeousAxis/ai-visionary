/**
 * Email templates for client lifecycle management.
 *
 * Each function returns a fully styled HTML email string
 * matching the existing email style from checkout-success webhook.
 *
 * All functions accept a `locale` param ('fr' | 'en', default 'fr').
 * FR output is identical to the pre-i18n version.
 *
 * Palette: navy #212E53, teal #4A919E, sage #BED3C3, coral #CE6A6B, salmon #EBACA2
 */

const FOOTER_FR = `
    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #999; margin: 0;">
            AI Visionary &mdash; Gen&egrave;ve, Suisse<br>
            <a href="https://ai-visionary.com" style="color: #4A919E;">ai-visionary.com</a> &bull;
            <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>
        </p>
    </div>
</div>`;

const FOOTER_EN = `
    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #999; margin: 0;">
            AI Visionary &mdash; Geneva, Switzerland<br>
            <a href="https://ai-visionary.com" style="color: #4A919E;">ai-visionary.com</a> &bull;
            <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>
        </p>
    </div>
</div>`;

function wrapEmail(headerTitle: string, headerSubtitle: string, bodyHtml: string, locale: 'fr' | 'en' = 'fr'): string {
    const footer = locale === 'en' ? FOOTER_EN : FOOTER_FR;
    return `<!DOCTYPE html>
<html lang="${locale}">
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

    ${footer}
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
export function buildReviewReminderEmail(entityName: string, updateUrl: string, locale: 'fr' | 'en' = 'fr'): string {
    const en = locale === 'en';
    return wrapEmail(
        en ? '&#128197; Annual update' : '&#128197; Mise &agrave; jour annuelle',
        en ? 'Keep your data up to date to stay visible' : 'Gardez vos donn&eacute;es &agrave; jour pour rester visible',
        `
        <p>${en ? 'Hello,' : 'Bonjour,'}</p>
        <p>${en
            ? `The data for <strong>${entityName}</strong> in the AYA registry is over a year old.`
            : `Les donn&eacute;es de <strong>${entityName}</strong> dans le registre AYA ont plus d&rsquo;un an.`
        }</p>
        <p>${en
            ? 'To maintain your <strong>AIO score</strong> and your visibility to AI systems (ChatGPT, Claude, Gemini, Perplexity...), we recommend updating your information.'
            : 'Pour maintenir votre <strong>score AIO</strong> et votre visibilit&eacute; aupr&egrave;s des IA (ChatGPT, Claude, Gemini, Perplexity...), nous vous recommandons de mettre &agrave; jour vos informations.'
        }</p>

        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bfdbfe;">
            <p style="margin: 0; font-size: 14px; color: #1e40af;">
                <strong>${en ? 'Why update?' : 'Pourquoi mettre &agrave; jour ?'}</strong><br>
                ${en
                    ? 'AI systems prioritize recent data sources. Up-to-date information improves your recommendability.'
                    : 'Les IA privil&eacute;gient les sources de donn&eacute;es r&eacute;centes. Des informations &agrave; jour am&eacute;liorent votre recommandabilit&eacute;.'
                }
            </p>
        </div>

        ${ctaButton(en ? 'Update my data' : 'Mettre &agrave; jour mes donn&eacute;es', updateUrl)}

        <p style="font-size: 13px; color: #666;">${en
            ? 'This update takes less than 2 minutes. Your existing data is pre-filled.'
            : 'Cette mise &agrave; jour prend moins de 2 minutes. Vos donn&eacute;es existantes sont pr&eacute;-remplies.'
        }</p>
        `,
        locale
    );
}

/**
 * Expiry reminder email — sent before pack expiration.
 * Triggered at J-90, J-30, J-7 before aya_expiry_date.
 */
export function buildExpiryReminderEmail(entityName: string, daysLeft: number, renewUrl: string, locale: 'fr' | 'en' = 'fr'): string {
    const en = locale === 'en';
    const urgencyColor = daysLeft <= 7 ? '#991B1B' : daysLeft <= 30 ? '#D97706' : '#4A919E';
    const urgencyBg = daysLeft <= 7 ? '#FEE2E2' : daysLeft <= 30 ? '#FEF3C7' : '#F0F9FF';
    const urgencyBorder = daysLeft <= 7 ? '#FECACA' : daysLeft <= 30 ? '#FDE68A' : '#BAE6FD';
    const daysPlural = daysLeft > 1;

    return wrapEmail(
        en ? '&#9200; Your certification expires soon' : '&#9200; Votre certification expire bient&ocirc;t',
        en
            ? `${entityName} &mdash; ${daysLeft} day${daysPlural ? 's' : ''} remaining`
            : `${entityName} &mdash; ${daysLeft} jour${daysPlural ? 's' : ''} restant${daysPlural ? 's' : ''}`,
        `
        <p>${en ? 'Hello,' : 'Bonjour,'}</p>
        <p>${en
            ? `The AYA certification for <strong>${entityName}</strong> expires in <strong>${daysLeft} day${daysPlural ? 's' : ''}</strong>.`
            : `La certification AYA de <strong>${entityName}</strong> expire dans <strong>${daysLeft} jour${daysPlural ? 's' : ''}</strong>.`
        }</p>

        <div style="background: ${urgencyBg}; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid ${urgencyBorder};">
            <p style="margin: 0; font-size: 14px; color: ${urgencyColor}; font-weight: bold;">
                ${en
                    ? `Expires in ${daysLeft} day${daysPlural ? 's' : ''}`
                    : `Expiration dans ${daysLeft} jour${daysPlural ? 's' : ''}`
                }
            </p>
        </div>

        <p>${en
            ? `After expiration, your entity will change from <strong style="color: #166534;">CERTIFIED ACTIVE</strong> to <strong style="color: #991B1B;">EXPIRED</strong>. AI systems prioritize active certified entities.`
            : `Apr&egrave;s expiration, votre entit&eacute; passera du statut <strong style="color: #166534;">CERTIFI&Eacute; ACTIF</strong> &agrave; <strong style="color: #991B1B;">EXPIR&Eacute;</strong>. Les IA privil&eacute;gient les entit&eacute;s certifi&eacute;es actives.`
        }</p>

        ${ctaButton(en ? 'Renew my certification' : 'Renouveler ma certification', renewUrl, urgencyColor)}

        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 13px; color: #666;">
                <strong>${en ? 'Our plans:' : 'Nos offres :'}</strong><br>
                &#128081; Pack PRO &mdash; 499 CHF ${en ? '(3 years included)' : '(3 ans inclus)'}<br>
                &#128203; ${en ? 'AYA Subscription' : 'Abonnement AYA'} &mdash; 19 CHF/${en ? 'month' : 'mois'}
            </p>
        </div>
        `,
        locale
    );
}

/**
 * Cancellation email — sent when a subscription is cancelled.
 * Triggered by Stripe webhook customer.subscription.deleted.
 */
export function buildCancellationEmail(entityName: string, resubscribeUrl: string, locale: 'fr' | 'en' = 'fr'): string {
    const en = locale === 'en';
    return wrapEmail(
        en ? '&#128532; Subscription cancelled' : '&#128532; Abonnement annul&eacute;',
        en
            ? `${entityName} &mdash; Your AYA certification is deactivated`
            : `${entityName} &mdash; Votre certification AYA est d&eacute;sactiv&eacute;e`,
        `
        <p>${en ? 'Hello,' : 'Bonjour,'}</p>
        <p>${en
            ? `Your AYA subscription for <strong>${entityName}</strong> has been cancelled.`
            : `Votre abonnement AYA pour <strong>${entityName}</strong> a &eacute;t&eacute; annul&eacute;.`
        }</p>

        <div style="background: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #FECACA;">
            <p style="margin: 0; font-size: 14px; color: #991B1B;">
                <strong>${en ? 'Consequences:' : 'Cons&eacute;quences :'}</strong><br>
                ${en ? `
                &bull; Your AYA certificate status changes to <strong>EXPIRED</strong><br>
                &bull; Your hosted ASR is no longer active<br>
                &bull; AI systems will no longer see your entity as certified
                ` : `
                &bull; Votre certificat AYA passe en statut <strong>EXPIR&Eacute;</strong><br>
                &bull; Votre ASR h&eacute;berg&eacute; n&rsquo;est plus actif<br>
                &bull; Les IA ne verront plus votre entit&eacute; comme certifi&eacute;e
                `}
            </p>
        </div>

        <p>${en
            ? 'Your data is preserved. You can reactivate your certification at any time.'
            : 'Vos donn&eacute;es restent conserv&eacute;es. Vous pouvez r&eacute;activer votre certification &agrave; tout moment.'
        }</p>

        ${ctaButton(en ? 'Reactivate my certification' : 'R&eacute;activer ma certification', resubscribeUrl)}

        <p style="font-size: 13px; color: #666;">${en
            ? 'If you cancelled by mistake or have questions, contact us at <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>.'
            : 'Si vous avez annul&eacute; par erreur ou si vous avez des questions, contactez-nous &agrave; <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>.'
        }</p>
        `,
        locale
    );
}

/**
 * Payment failed email — sent when a subscription payment fails.
 * Triggered by Stripe webhook invoice.payment_failed.
 */
export function buildPaymentFailedEmail(entityName: string, retryUrl: string, locale: 'fr' | 'en' = 'fr'): string {
    const en = locale === 'en';
    return wrapEmail(
        en ? '&#9888;&#65039; Payment failed' : '&#9888;&#65039; &Eacute;chec de paiement',
        en
            ? `${entityName} &mdash; Action required`
            : `${entityName} &mdash; Action requise`,
        `
        <p>${en ? 'Hello,' : 'Bonjour,'}</p>
        <p>${en
            ? `The latest payment for the AYA subscription of <strong>${entityName}</strong> has failed.`
            : `Le dernier paiement pour l&rsquo;abonnement AYA de <strong>${entityName}</strong> a &eacute;chou&eacute;.`
        }</p>

        <div style="background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #FDE68A;">
            <p style="margin: 0; font-size: 14px; color: #854D0E;">
                ${en
                    ? '<strong>Your certification is still active</strong>, but if the payment is not resolved within 7 days, your subscription will be suspended.'
                    : '<strong>Votre certification est toujours active</strong>, mais si le paiement n&rsquo;est pas r&eacute;gularis&eacute; sous 7 jours, votre abonnement sera suspendu.'
                }
            </p>
        </div>

        <p>${en
            ? 'Please check your payment method or update your banking information via the Stripe portal.'
            : 'Veuillez v&eacute;rifier votre moyen de paiement ou mettre &agrave; jour vos informations bancaires via le portail Stripe.'
        }</p>

        ${ctaButton(en ? 'Update my payment' : 'Mettre &agrave; jour mon paiement', retryUrl, '#D97706')}

        <p style="font-size: 13px; color: #666;">${en
            ? 'If you believe this is an error, contact us at <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>.'
            : 'Si vous pensez qu&rsquo;il s&rsquo;agit d&rsquo;une erreur, contactez-nous &agrave; <a href="mailto:hello@ai-visionary.com" style="color: #4A919E;">hello@ai-visionary.com</a>.'
        }</p>
        `,
        locale
    );
}
