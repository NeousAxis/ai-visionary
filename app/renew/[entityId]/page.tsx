import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import RenewButtons from './RenewButtons';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ entityId: string }> }): Promise<Metadata> {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);
    const t = await getTranslations('renew');

    if (!entity) {
        return { title: t('metaTitle', { name: t('metaFallbackName') }) };
    }

    const name = entity.display_name || entity.legal_name || t('metaFallbackName');
    return {
        title: t('metaTitle', { name }),
        description: t('metaDescription', { name }),
    };
}

export default async function RenewPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);
    const t = await getTranslations('renew');
    const locale = await getLocale();

    if (!entity) {
        return notFound();
    }

    const genericNames = ['Unknown', 'Entity', 'Unknown Entity', 'Entreprise Inconnue'];
    const rawName = entity.display_name || entity.legal_name;
    const name = (rawName && !genericNames.includes(rawName))
        ? rawName
        : (entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : t('fallbackName'));

    const score = (entity.asr_score !== undefined && entity.asr_score !== null) ? entity.asr_score : null;
    const isCertified = entity.payment_completed === true;

    // Detect pack type: pack_type in DB is often null, so use valid_until as heuristic
    // PRO = 3 years (>13 months away), PLATEFORME = monthly (<2 months)
    const rawPackType = entity.pack_type || '';
    const isProByPackType = rawPackType && ['pro', 'pack pro', 'pack_pro'].includes(rawPackType.toLowerCase());
    const validUntilDate = entity.valid_until ? new Date(entity.valid_until) : null;
    const monthsUntilExpiry = validUntilDate ? (validUntilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30) : 0;
    const isProByDate = monthsUntilExpiry > 12; // PRO = 3 years = ~36 months
    const isPro = isProByPackType || isProByDate;
    const packLabel = isCertified ? (isPro ? t('packLabelPro') : t('packLabelPlatform')) : t('packLabelIndexed');

    // Expiry date + lifecycle
    const now = new Date();
    const validUntilRaw = entity.valid_until ? new Date(entity.valid_until) : null;
    const hasValidDate = validUntilRaw && validUntilRaw.getFullYear() >= 2020;
    const isExpired = hasValidDate ? validUntilRaw > now === false : false;
    const isActive = hasValidDate ? validUntilRaw > now : false;
    const expiresInDays = hasValidDate ? Math.ceil((validUntilRaw.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const expiresSoon = isActive && expiresInDays <= 30;
    const currentPackType = isPro ? 'PRO' : 'AYA_SUB';
    const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
    const expiryDisplay = hasValidDate
        ? validUntilRaw.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' })
        : '\u2014';

    const email = entity.contact_email || entity.email || '';
    const url = entity.website || '';
    const hasRequiredInfo = !!(email && url);

    // AYO model: pre-save entity data to `analyses` table before Stripe redirect
    // so the webhook can find it via aid=entityId -> db.getAnalysis(entityId)
    if (hasRequiredInfo && entity.asr_payload) {
        const payload = entity.asr_payload as any;
        const fields = payload?.data?.fields || payload?.fields || payload?.data || {};
        await db.saveAnalysis(entityId, {
            url,
            email,
            score: entity.asr_score || 0,
            data: { fields, blocks: payload?.blocks || {}, aya_entity_id: entityId },
        });
    }

    // Build Payment Link URLs server-side (no Stripe API call needed)
    // Stripe Payment Links accept ?prefilled_email=...&client_reference_id=...
    let proUrl = '';
    let ayaUrl = '';
    if (hasRequiredInfo) {
        const payload = Buffer.from(JSON.stringify({ u: url, e: email, aid: entityId })).toString('base64');
        const proLinkBase = process.env.STRIPE_LINK_PRO || '';
        const ayaLinkBase = process.env.STRIPE_LINK_AYA_SUB || process.env.STRIPE_LINK_AYA || '';
        if (proLinkBase) {
            proUrl = `${proLinkBase}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${encodeURIComponent(payload)}`;
        }
        if (ayaLinkBase) {
            ayaUrl = `${ayaLinkBase}?prefilled_email=${encodeURIComponent(email)}&client_reference_id=${encodeURIComponent(payload)}`;
        }
    }

    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
            {/* NAV */}
            <div className="container" style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--text-main)', color: 'white', padding: '5px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>AV</div>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>AI VISIONARY</span>
                </Link>
                <BackButton />
            </div>

            {/* HERO */}
            <section className="section" style={{ paddingTop: '2rem', paddingBottom: '2rem', textAlign: 'center' }}>
                <div className="container">
                    <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        {t('title')}
                    </p>
                    <h1 className="headline" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', marginBottom: '0.5rem' }}>
                        {name}
                    </h1>
                    <p style={{ color: 'var(--text-body)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                        {t('subtitle')}
                    </p>
                </div>
            </section>

            {/* CURRENT STATUS CARD */}
            <section className="section" style={{ paddingTop: '0', paddingBottom: '4rem' }}>
                <div className="container" style={{ maxWidth: '700px', margin: '0 auto' }}>

                    {/* Status summary */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{
                            fontSize: '1.2rem',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: '1.5rem',
                            borderBottom: '1px solid var(--border-light)',
                            paddingBottom: '1rem',
                        }}>
                            {t('currentSituation')}
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('packLabel')}</p>
                                <p style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                    {packLabel}
                                </p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('scoreLabel')}</p>
                                <p style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                    {score !== null ? `${score}/100` : '\u2014'}
                                </p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>{t('expirationLabel')}</p>
                                <p style={{
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    color: isExpired ? '#991B1B' : 'var(--primary-color)',
                                }}>
                                    {expiryDisplay}
                                </p>
                            </div>
                        </div>

                        {isExpired && (
                            <div style={{
                                background: '#FEE2E2',
                                border: '1px solid #FECACA',
                                color: '#991B1B',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.9rem',
                                textAlign: 'center',
                            }}>
                                {t('expiredMessage')}
                            </div>
                        )}
                    </div>

                    {/* Lifecycle messages */}
                    {isActive && !expiresSoon && (
                        <div style={{
                            background: '#D1FAE5',
                            border: '1px solid #6EE7B7',
                            color: '#065F46',
                            padding: '14px 18px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            marginBottom: '1.5rem',
                        }}>
                            {t('packActive', { pack: packLabel, date: expiryDisplay })}
                        </div>
                    )}
                    {expiresSoon && (
                        <div style={{
                            background: '#FEF3C7',
                            border: '1px solid #FCD34D',
                            color: '#92400E',
                            padding: '14px 18px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            marginBottom: '1.5rem',
                        }}>
                            {t('packExpiresSoon', { days: String(expiresInDays) })}
                        </div>
                    )}

                    {/* Renewal options */}
                    <RenewButtons
                        email={email}
                        url={url}
                        entityId={entityId}
                        hasRequiredInfo={hasRequiredInfo}
                        proUrl={proUrl}
                        ayaUrl={ayaUrl}
                        isActive={isActive}
                        expiresSoon={expiresSoon}
                        currentPackType={currentPackType}
                    />

                    {/* Footer help */}
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {t('contactQuestion')}{' '}
                            <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>
                                hello@ai-visionary.com
                            </a>
                        </p>
                    </div>

                </div>
            </section>
        </main>
    );
}
