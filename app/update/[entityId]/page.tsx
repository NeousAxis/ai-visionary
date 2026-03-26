import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import type { Metadata } from 'next';
import UpdateFormClient from './UpdateFormClient';

export const revalidate = 0;

// Sector options for the dropdown (matching existing sector_macro values in the registry)
const SECTOR_OPTIONS = [
    'Technology & SaaS',
    'Finance & Banking',
    'Web3 & Blockchain',
    'AI & Machine Learning',
    'E-commerce & Retail',
    'Healthcare & Biotech',
    'Education & Training',
    'Media & Entertainment',
    'Travel & Hospitality',
    'Real Estate',
    'Energy & Environment',
    'Food & Agriculture',
    'Transport & Logistics',
    'Consulting & Services',
    'Government & Public',
    'Telecom & Networks',
    'Manufacturing & Industry',
    'Legal & Compliance',
    'Marketing & Advertising',
    'Nonprofit & NGO',
    'Sports & Fitness',
    'Fashion & Luxury',
    'Automotive',
    'Insurance',
    'General',
];

// Country options (ISO codes used in the registry)
const COUNTRY_OPTIONS = [
    { code: 'CH', label: 'Suisse' },
    { code: 'FR', label: 'France' },
    { code: 'DE', label: 'Allemagne' },
    { code: 'GB', label: 'Royaume-Uni' },
    { code: 'US', label: 'États-Unis' },
    { code: 'BE', label: 'Belgique' },
    { code: 'LU', label: 'Luxembourg' },
    { code: 'IT', label: 'Italie' },
    { code: 'ES', label: 'Espagne' },
    { code: 'CA', label: 'Canada' },
    { code: 'NL', label: 'Pays-Bas' },
    { code: 'AT', label: 'Autriche' },
    { code: 'JP', label: 'Japon' },
    { code: 'SG', label: 'Singapour' },
    { code: 'AE', label: 'Émirats Arabes Unis' },
    { code: 'AU', label: 'Australie' },
    { code: 'BR', label: 'Brésil' },
    { code: 'IN', label: 'Inde' },
    { code: 'CN', label: 'Chine' },
    { code: 'KR', label: 'Corée du Sud' },
    { code: 'MA', label: 'Maroc' },
    { code: 'SE', label: 'Suède' },
    { code: 'NO', label: 'Norvège' },
    { code: 'DK', label: 'Danemark' },
    { code: 'FI', label: 'Finlande' },
    { code: 'IE', label: 'Irlande' },
    { code: 'PT', label: 'Portugal' },
    { code: 'PL', label: 'Pologne' },
    { code: 'IL', label: 'Israël' },
];

export async function generateMetadata({ params }: { params: Promise<{ entityId: string }> }): Promise<Metadata> {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);

    if (!entity || !entity.payment_completed) {
        return { title: 'Mise a jour — Non disponible' };
    }

    const name = entity.display_name || entity.legal_name || 'Entite';
    return {
        title: `Mettre a jour — ${name} | AYA`,
        description: `Mettez a jour les donnees de ${name} dans le registre AYA.`,
    };
}

export default async function UpdatePage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);

    if (!entity || !entity.payment_completed) {
        return notFound();
    }

    const name = entity.display_name || entity.legal_name || 'Entite';
    const asrData = entity.asr_payload?.data || {};

    // Pre-fill form values from existing data
    const currentValues = {
        entityId: entity.entity_id,
        legalName: entity.legal_name || entity.display_name || '',
        sector: entity.sector_macro || 'General',
        services: Array.isArray(asrData.offre?.services?.value)
            ? asrData.offre.services.value.join(', ')
            : '',
        targetAudience: asrData.offre?.target_audience?.value || '',
        country: entity.country_legal || '',
        contactEmail: entity.contact_email || '',
    };

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
                        Mise a jour annuelle
                    </p>
                    <h1 className="headline" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', marginBottom: '0.5rem' }}>
                        {name}
                    </h1>
                    <p style={{ color: 'var(--text-body)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                        Mettez a jour vos donnees pour maintenir votre score AIO et votre visibilite aupres des IA.
                    </p>
                </div>
            </section>

            {/* FORM CARD */}
            <section className="section" style={{ paddingTop: '0', paddingBottom: '4rem' }}>
                <div className="container" style={{ maxWidth: '700px', margin: '0 auto' }}>
                    <UpdateFormClient
                        currentValues={currentValues}
                        sectorOptions={SECTOR_OPTIONS}
                        countryOptions={COUNTRY_OPTIONS}
                    />
                </div>
            </section>
        </main>
    );
}
