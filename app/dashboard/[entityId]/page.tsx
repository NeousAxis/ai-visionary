import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import DashboardClient from './DashboardClient';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { generateUpdateToken } from '@/lib/update-token';

export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ entityId: string }> }): Promise<Metadata> {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);
    const t = await getTranslations('dashboard');

    if (!entity) {
        return { title: t('metaTitle', { name: 'Entity' }) };
    }

    const name = entity.display_name || entity.legal_name || 'Entity';
    return {
        title: t('metaTitle', { name }),
        description: t('metaDescription', { name }),
    };
}

export default async function DashboardPage({ params }: { params: Promise<{ entityId: string }> }) {
    const { entityId } = await params;
    const entity = await db.getAyaEntityById(entityId);
    const locale = await getLocale();

    if (!entity) {
        return notFound();
    }

    // Entity name
    const genericNames = ['Unknown', 'Entity', 'Unknown Entity', 'Entreprise Inconnue'];
    const rawName = entity.display_name || entity.legal_name;
    const name = (rawName && !genericNames.includes(rawName))
        ? rawName
        : (entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Entity');

    const totalScore = (entity.asr_score !== undefined && entity.asr_score !== null) ? entity.asr_score : null;
    const isCertified = entity.payment_completed === true;

    // Pack type detection
    const rawPackType = entity.pack_type || '';
    const isProByPackType = rawPackType && ['pro', 'pack pro', 'pack_pro'].includes(rawPackType.toLowerCase());
    const validUntilDate = entity.valid_until ? new Date(entity.valid_until) : null;
    const monthsUntilExpiry = validUntilDate ? (validUntilDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30) : 0;
    const isProByDate = monthsUntilExpiry > 12;
    const isPro = isProByPackType || isProByDate;

    const packLabels: Record<string, string> = {
        pro_fr: 'PRO', pro_en: 'PRO',
        platform_fr: 'PLATEFORME', platform_en: 'PLATFORM',
        indexed_fr: 'INDEXÉ', indexed_en: 'INDEXED',
    };
    const suffix = locale === 'fr' ? 'fr' : 'en';
    const packLabel = isCertified ? (isPro ? packLabels[`pro_${suffix}`] : packLabels[`platform_${suffix}`]) : packLabels[`indexed_${suffix}`];

    // Expiry
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

    const contactEmail = entity.contact_email || entity.email || '';
    const ownerEmail = entity.owner_email || contactEmail;
    const url = entity.website || '';
    const hasRequiredInfo = !!(contactEmail && url);

    // Fetch latest analysis with blocks data
    let blocks: { name: string; label: string; score: number; maxScore: number }[] = [];
    let lastScanDate: string | null = null;
    let history: { id: string; score: number; created_at: string }[] = [];
    let analysisEmail: string | null = null; // Email used during diagnostic = access key
    let detectedServices: string[] = []; // For competitor comparison
    let detectedCountry = '';

    if (url) {
        try {
            const latestAnalysis = await db.getLatestAnalysisByUrl(url);
            if (latestAnalysis?.data?.blocks) {
                const BLOCK_LABELS: Record<string, Record<string, [string, number]>> = {
                    en: {
                        identite: ['Identity & Presence', 10],
                        offre: ['Offer Clarity', 20],
                        processus_methodes: ['Process & Methods', 15],
                        engagements_conformite: ['Trust & Compliance', 15],
                        indicateurs: ['Key Indicators', 20],
                        contenus_pedagogiques: ['Educational Content', 10],
                        structure_technique: ['Technical Foundation', 10],
                    },
                    fr: {
                        identite: ['Identité & Ancrage', 10],
                        offre: ['Clarté de l\'Offre', 20],
                        processus_methodes: ['Processus & Méthodes', 15],
                        engagements_conformite: ['Confiance & Conformité', 15],
                        indicateurs: ['Indicateurs Clés', 20],
                        contenus_pedagogiques: ['Contenus Pédagogiques', 10],
                        structure_technique: ['Socle Technique', 10],
                    },
                };
                const labels = BLOCK_LABELS[locale] || BLOCK_LABELS.en;
                const blocksObj = latestAnalysis.data.blocks;
                blocks = Object.entries(blocksObj).map(([key, val]) => ({
                    name: key,
                    label: labels[key]?.[0] || key,
                    score: typeof val === 'number' ? val : 0,
                    maxScore: labels[key]?.[1] || 10,
                }));
            }
            if (latestAnalysis?.timestamp) {
                lastScanDate = latestAnalysis.timestamp;
            }
            // The email used during diagnostic = the ONLY key to access the dashboard
            if (latestAnalysis?.email) {
                analysisEmail = latestAnalysis.email;
            }
            // Extract services + country for competitor comparison
            const fields = latestAnalysis?.data?.fields;
            if (fields?.offre?.services?.value) {
                detectedServices = Array.isArray(fields.offre.services.value) ? fields.offre.services.value : [];
            }
            if (fields?.identite?.country?.value) {
                detectedCountry = fields.identite.country.value;
            }

            // Fetch scan history
            history = await db.getAnalysesHistoryByUrl(url, 5);
        } catch (err) {
            console.error('[dashboard] Failed to fetch analysis data:', err);
        }
    }

    // Pre-save entity data ONLY if no analysis with blocks exists yet
    // (avoid overwriting V2 scan results that contain real block scores)
    if (hasRequiredInfo && entity.asr_payload && blocks.length === 0) {
        try {
            const payload = entity.asr_payload as Record<string, unknown>;
            const fields = (payload as any)?.data?.fields || (payload as any)?.fields || (payload as any)?.data || {};
            await db.saveAnalysis(entityId, {
                url,
                email: contactEmail,
                score: entity.asr_score || 0,
                data: { fields, blocks: (payload as any)?.blocks || {}, aya_entity_id: entityId },
            });
        } catch { /* silent */ }
    }

    // Stripe Payment Links
    let proUrl = '';
    let ayaUrl = '';
    if (hasRequiredInfo) {
        const payload = Buffer.from(JSON.stringify({ u: url, e: contactEmail, aid: entityId })).toString('base64');
        const proLinkBase = process.env.STRIPE_LINK_PRO || '';
        const ayaLinkBase = process.env.STRIPE_LINK_AYA_SUB || process.env.STRIPE_LINK_AYA || '';
        if (proLinkBase) {
            proUrl = `${proLinkBase}?prefilled_email=${encodeURIComponent(contactEmail)}&client_reference_id=${encodeURIComponent(payload)}`;
        }
        if (ayaLinkBase) {
            ayaUrl = `${ayaLinkBase}?prefilled_email=${encodeURIComponent(contactEmail)}&client_reference_id=${encodeURIComponent(payload)}`;
        }
    }

    return (
        <main style={{ minHeight: '100vh', background: '#f8fafb' }}>
            {/* NAV */}
            <div className="container" style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                    <div style={{ background: '#212E53', color: 'white', padding: '5px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>AV</div>
                    <span style={{ fontWeight: 'bold', color: '#212E53', letterSpacing: '-0.02em' }}>AI VISIONARY</span>
                </Link>
                <BackButton />
            </div>

            {/* DASHBOARD */}
            <section style={{ paddingTop: '1rem', paddingBottom: '2rem' }}>
                <DashboardClient
                    entityId={entityId}
                    name={name}
                    analysisEmail={analysisEmail || contactEmail}
                    contactEmail={contactEmail}
                    url={url}
                    score={totalScore}
                    blocks={blocks}
                    packLabel={packLabel}
                    expiryDisplay={expiryDisplay}
                    isExpired={isExpired}
                    isActive={isActive}
                    expiresSoon={expiresSoon}
                    currentPackType={currentPackType as 'PRO' | 'AYA_SUB'}
                    isCertified={isCertified}
                    proUrl={proUrl}
                    ayaUrl={ayaUrl}
                    hasRequiredInfo={hasRequiredInfo}
                    history={history}
                    lastScanDate={lastScanDate}
                    detectedServices={detectedServices}
                    detectedCountry={detectedCountry}
                    updateToken={generateUpdateToken(entityId)}
                />
            </section>
        </main>
    );
}
