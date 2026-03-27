import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import RenewButtons from './RenewButtons';
import type { Metadata } from 'next';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ entityId: string }> }): Promise<Metadata> {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);

    if (!entity) {
        return { title: 'Renouvellement — Non disponible' };
    }

    const name = entity.display_name || entity.legal_name || 'Entite';
    return {
        title: `Renouveler — ${name} | AYA`,
        description: `Renouvelez votre certification AYA pour ${name}.`,
    };
}

export default async function RenewPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);

    if (!entity) {
        return notFound();
    }

    const genericNames = ['Unknown', 'Entity', 'Unknown Entity', 'Entreprise Inconnue'];
    const rawName = entity.display_name || entity.legal_name;
    const name = (rawName && !genericNames.includes(rawName))
        ? rawName
        : (entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Entite');

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
    const packLabel = isCertified ? (isPro ? 'PRO' : 'PLATEFORME') : 'INDEXE';

    // Expiry date
    const validUntilRaw = entity.valid_until ? new Date(entity.valid_until) : null;
    const hasValidDate = validUntilRaw && validUntilRaw.getFullYear() >= 2020;
    const isExpired = hasValidDate ? validUntilRaw > new Date() === false : false;
    const expiryDisplay = hasValidDate
        ? validUntilRaw.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
        : '\u2014';

    const email = entity.contact_email || entity.email || '';
    const url = entity.website || '';
    const hasRequiredInfo = !!(email && url);

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
                        Renouvellement
                    </p>
                    <h1 className="headline" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', marginBottom: '0.5rem' }}>
                        {name}
                    </h1>
                    <p style={{ color: 'var(--text-body)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                        Renouvelez votre certification pour continuer a etre visible et recommande par les IA.
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
                            Votre situation actuelle
                        </h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Pack</p>
                                <p style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                    {packLabel}
                                </p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Score AIO</p>
                                <p style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                    {score !== null ? `${score}/100` : '\u2014'}
                                </p>
                            </div>
                            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px' }}>Expiration</p>
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
                                Votre certification a expire. Renouvelez pour maintenir votre visibilite aupres des IA.
                            </div>
                        )}
                    </div>

                    {/* Renewal options */}
                    <RenewButtons
                        email={email}
                        url={url}
                        entityId={entityId}
                        hasRequiredInfo={hasRequiredInfo}
                    />

                    {/* Footer help */}
                    <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Une question ? Contactez-nous a{' '}
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
