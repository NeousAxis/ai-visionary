import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
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
    const packType = entity.pack_type || (entity.stripe_product_id?.includes('PRO') ? 'PRO' : 'PLATEFORME');

    // Expiry date
    const validUntilRaw = entity.valid_until ? new Date(entity.valid_until) : null;
    const hasValidDate = validUntilRaw && validUntilRaw.getFullYear() >= 2020;
    const isExpired = hasValidDate ? validUntilRaw > new Date() === false : false;
    const expiryDisplay = hasValidDate
        ? validUntilRaw.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
        : '\u2014';

    // Build checkout URLs with entity info
    const email = entity.contact_email || '';
    const url = entity.website || '';
    const checkoutBase = `/api/create-checkout`;
    const proCheckoutUrl = `${checkoutBase}?email=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}&packType=PRO&aid=${entityId}`;
    const ayaCheckoutUrl = `${checkoutBase}?email=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}&packType=AYA_SUB&aid=${entityId}`;

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
                                    {isCertified ? (packType === 'PRO' ? 'PRO' : 'PLATEFORME') : 'INDEXE'}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                        {/* PRO Card */}
                        <div className="card" style={{ position: 'relative', border: '2px solid #D97706' }}>
                            <div style={{
                                position: 'absolute',
                                top: '-12px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: '#D97706',
                                color: 'white',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap',
                            }}>
                                RECOMMANDE
                            </div>
                            <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.2rem' }}>Pack PRO</h4>
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#D97706', marginBottom: '0.25rem' }}>499 CHF</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>paiement unique</p>

                                <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-body)', listStyle: 'none', padding: '0', marginBottom: '1.5rem' }}>
                                    <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        5 fichiers ASR complets
                                    </li>
                                    <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        3 ans de registre AYA inclus
                                    </li>
                                    <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        Propriete totale des fichiers
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        Score AIO recalcule
                                    </li>
                                </ul>

                                <a
                                    href={proCheckoutUrl}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '12px',
                                        background: '#D97706',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.95rem',
                                        fontWeight: 'bold',
                                        textDecoration: 'none',
                                        textAlign: 'center',
                                    }}
                                >
                                    Renouveler Pack PRO
                                </a>
                            </div>
                        </div>

                        {/* AYA Sub Card */}
                        <div className="card" style={{ border: '2px solid var(--primary-color)' }}>
                            <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.2rem' }}>Abonnement AYA</h4>
                                <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '0.25rem' }}>19 CHF</p>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>par mois</p>

                                <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-body)', listStyle: 'none', padding: '0', marginBottom: '1.5rem' }}>
                                    <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        Registre AYA actif
                                    </li>
                                    <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        ASR heberge par AI Visionary
                                    </li>
                                    <li style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        Mises a jour incluses
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
                                        <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                        Priorite IA
                                    </li>
                                </ul>

                                <a
                                    href={ayaCheckoutUrl}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '12px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '0.95rem',
                                        fontWeight: 'bold',
                                        textDecoration: 'none',
                                        textAlign: 'center',
                                    }}
                                >
                                    S&apos;abonner a AYA
                                </a>
                            </div>
                        </div>
                    </div>

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
