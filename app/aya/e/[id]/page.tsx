import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { buildPlainTextDescription } from '@/lib/aya/llm-format';
import Link from 'next/link';
import BackButton from '@/app/components/BackButton';
import type { Metadata } from 'next';

// Force dynamic
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const entity = await db.getAyaEntityById(id);

    if (!entity) {
        return {
            title: 'Certificat non trouve',
            description: 'Ce certificat AYA n\'existe pas ou a ete supprime.',
        };
    }

    const genericNames = ["Unknown", "Entity", "Unknown Entity", "Entreprise Inconnue"];
    const rawName = entity.display_name || entity.legal_name;
    const name = (rawName && !genericNames.includes(rawName))
        ? rawName
        : (entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : 'Entite');

    const score = (entity.asr_score !== undefined && entity.asr_score !== null) ? entity.asr_score : null;
    const scoreText = score !== null ? ` — Score AIO ${score}/100` : '';
    const isCertified = entity.payment_completed === true;
    const statusText = isCertified ? 'Certifie ASR' : 'Indexe';

    const enrichment = entity.asr_payload?.enrichment || {};
    const descriptionText = enrichment.gemini_description_fr || enrichment.gemini_description || '';
    const metaDescription = descriptionText
        ? `${name}${scoreText}. ${descriptionText}`
        : `${name}${scoreText}. ${statusText} dans le registre AYA — lisibilite IA verifiee par AI Visionary.`;

    return {
        title: `${name}${scoreText} — Certificat AYA`,
        description: metaDescription.slice(0, 160),
        openGraph: {
            title: `${name} — Certificat AYA | AI Visionary`,
            description: metaDescription.slice(0, 200),
            url: `https://ai-visionary.com/aya/e/${entity.entity_id || id}`,
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const entity = await db.getAyaEntityById(id);

    if (!entity) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center max-w-md mx-auto p-8">
                    <h1 className="text-2xl font-bold text-[#212E53] mb-4">Certificat non trouvé</h1>
                    <p className="text-slate-600 mb-6">Ce certificat AYA n&apos;existe pas ou a été supprimé.</p>
                    <Link href="/aya" className="inline-block px-6 py-3 bg-[#4A919E] text-white rounded-lg hover:bg-[#3a7a85] transition-colors">
                        Voir le Registre AYA
                    </Link>
                </div>
            </div>
        );
    }

    // Bug 1 fix: differentiate certified vs bot-indexed entities
    const isCertified = entity.payment_completed === true;
    const hasValidDate = entity.valid_until && new Date(entity.valid_until).getFullYear() >= 2020;
    const isValid = hasValidDate ? new Date(entity.valid_until) > new Date() : false;

    const creationDate = new Date(entity.created_at).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' });

    // Bug 2 fix: protect against aberrant dates (epoch 1970, null, etc.)
    const validUntilRaw = entity.valid_until ? new Date(entity.valid_until) : null;
    const validUntilDate = (validUntilRaw && validUntilRaw.getFullYear() >= 2020)
        ? validUntilRaw.toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })
        : '\u2014';

    // Fix: Respect 0 score, show "—" if undefined (no fake 100)
    const score = (entity.asr_score !== undefined && entity.asr_score !== null) ? entity.asr_score : null;
    const packType = entity.pack_type || (entity.stripe_product_id?.includes('PRO') ? 'PRO' : 'PLATEFORME');

    // DATA EXTRACTION — asrData is the extract fields object (e.g. { identite: { name: { value, q, evidence } }, offre: {...}, ... })
    const asrData = entity.asr_payload?.data || {};

    // 🎨 ROBUST FALLBACKS — skip generic names
    const genericNames = ["Unknown", "Entity", "Unknown Entity", "Entreprise Inconnue"];
    const rawDisplayName = entity.display_name || entity.legal_name;
    const displayName = (rawDisplayName && !genericNames.includes(rawDisplayName))
        ? rawDisplayName
        : (entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : "Identité Web Certifiée");

    // Build description — Gemini enrichment takes priority over raw scraper data
    const enrichment = entity.asr_payload?.enrichment || {};
    const geminiFr: string = enrichment.gemini_description_fr || '';
    const geminiEn: string = enrichment.gemini_description || '';
    const services = Array.isArray(asrData.offre?.services?.value) ? asrData.offre.services.value : [];
    const businessType = asrData.identite?.business_type?.value || entity.sector_macro || "";
    const audience = asrData.offre?.target_audience?.value || "";
    const description = (geminiFr || geminiEn)
        ? (geminiFr || geminiEn)
        : (services.length > 0
            ? `${businessType ? `${businessType} — ` : ""}${services.slice(0, 3).join(", ")}${audience ? `. S'adresse à ${audience}.` : "."}`
            : (businessType
                ? `${businessType}. Entité certifiée avec présence sémantique active auprès du consensus AYO.`
                : "Certification de présence sémantique active. Cette entité a validé son existence et ses champs d'expertise auprès du consensus AYO."));

    // Keywords — Gemini keywords take priority (accurate), fallback to scraper data
    const geminiKeywords: string[] = Array.isArray(enrichment.gemini_keywords) ? enrichment.gemini_keywords : [];
    let keywords: string[];
    if (geminiKeywords.length > 0) {
        keywords = geminiKeywords.slice(0, 10);
    } else {
        const serviceKeywords = Array.isArray(asrData.offre?.services?.value) ? asrData.offre.services.value : [];
        const useCaseKeywords = Array.isArray(asrData.offre?.use_cases?.value) ? asrData.offre.use_cases.value : [];
        const declaredKeywords = Array.isArray(asrData.external_context?.keywords?.value) ? asrData.external_context.keywords.value : [];
        const blockOffreKw = Array.isArray(asrData.aio_blocks?.offre?.fields?.keywords_detected) ? asrData.aio_blocks.offre.fields.keywords_detected : [];
        const sectorEvidence = Array.isArray(asrData.sector?.evidence) ? asrData.sector.evidence : [];
        const sectorFallback = entity.sector_macro && entity.sector_macro !== 'General' ? [entity.sector_macro] : [];
        keywords = [...new Set([
            ...declaredKeywords, ...serviceKeywords, ...useCaseKeywords,
            ...blockOffreKw, ...sectorEvidence, ...sectorFallback
        ])].filter((k: any) => typeof k === 'string' && k.length > 2).slice(0, 10);
    }

    // JSON-LD Organization structured data for AI bots and search engines
    const entityTypeMap: Record<string, string> = {
        company: 'Corporation',
        association: 'NGO',
        individual: 'Person',
        public_body: 'GovernmentOrganization',
    };
    const schemaType = entityTypeMap[entity.entity_type] || 'Organization';
    const certificateUrl = `https://ai-visionary.com/aya/e/${entity.entity_id || id}`;

    const jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        name: displayName,
        ...(entity.website ? { url: entity.website } : {}),
        ...(description ? { description } : {}),
        ...(entity.country_legal ? {
            address: {
                '@type': 'PostalAddress',
                addressCountry: entity.country_legal,
            },
        } : {}),
        sameAs: [certificateUrl],
        ...(entity.entity_type ? { additionalType: entity.entity_type } : {}),
        ...(keywords.length > 0 ? { keywords: keywords.join(', ') } : {}),
        ...(score !== null ? {
            'aio:score': score,
            'aio:scoredBy': {
                '@type': 'Organization',
                name: 'AI Visionary',
                url: 'https://ai-visionary.com',
            },
        } : {}),
    };

    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>

            {/* JSON-LD Organization structured data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* COMPACT NAV (Like Home) */}
            <div className="container" style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--text-main)', color: 'white', padding: '5px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>AV</div>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>AI VISIONARY</span>
                </Link>
                <BackButton />
            </div>

            {/* HERO SECTION - REUSING 'hero-section' STYLES BUT COMPACT */}
            <section className="section" style={{ paddingTop: '2rem', paddingBottom: '4rem', textAlign: 'center' }}>
                <div className="container">
                    <p style={{ color: 'var(--primary-color)', fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        Registre Officiel AYA
                    </p>

                    <h1 className="headline" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: '1rem' }}>
                        {displayName}
                    </h1>

                    <div className="subheadline" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <span>📍 {({'CH':'Suisse','FR':'France','BE':'Belgique','DE':'Allemagne','IT':'Italie','ES':'Espagne','LU':'Luxembourg','CA':'Canada','US':'États-Unis','GB':'Royaume-Uni','MA':'Maroc'} as Record<string,string>)[entity.country_legal] || entity.country_legal}</span>
                        <span>🏢 {({'company':'Entreprise','association':'Association','individual':'Indépendant','public_body':'Organisme Public'} as Record<string,string>)[entity.entity_type] || entity.entity_type}</span>
                        {entity.website && (
                            <a href={entity.website} target="_blank" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>
                                🔗 {entity.website.replace(/^https?:\/\//, '')}
                            </a>
                        )}
                    </div>
                </div>
            </section>

            {/* PLAIN TEXT DESCRIPTION — visible to humans & LLM crawlers */}
            <section style={{ maxWidth: '700px', margin: '0 auto', padding: '0 20px 2rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-body)' }}>
                    {buildPlainTextDescription(entity)}
                </p>
            </section>

            {/* MAIN CONTENT - REUSING GRID & CARDS */}
            <section className="section" style={{ paddingTop: '0' }}>
                <div className="container">

                    <div className="grid-2" style={{ alignItems: 'start' }}>

                        {/* LEFT: IDENTITY CARD */}
                        <div className="card">
                            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                                Identification
                            </h3>

                            <div style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>Statut Actuel</span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.85rem',
                                            fontWeight: 'bold',
                                            background: isCertified && isValid ? 'var(--bg-accent)' : isCertified ? '#FEE2E2' : '#F1F5F9',
                                            color: isCertified && isValid ? 'var(--primary-color)' : isCertified ? '#EF4444' : '#64748B'
                                        }}>
                                            {isCertified && isValid ? '● CERTIFIÉ ACTIF' : isCertified ? '● EXPIRÉ' : '● INDEXÉ'}
                                        </span>
                                        {isCertified && (
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                background: packType === 'PRO' ? '#FEF3C7' : 'var(--bg-accent)',
                                                color: packType === 'PRO' ? '#D97706' : 'var(--primary-color)'
                                            }}>
                                                {packType === 'PRO' ? '👑 PRO' : '📋 PLATEFORME'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Score AIO (Lisibilité IA)</span>
                                    </div>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                        {score !== null ? score : '—'}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/100</span>
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px', fontStyle: 'italic', lineHeight: '1.3', borderLeft: '2px solid var(--border-light)', paddingLeft: '8px' }}>
                                    * Ce score mesure la lisibilité de l'entreprise par les IA (ChatGPT, Gemini, Claude...). Plus le score est élevé, plus l'entreprise est visible et recommandable.
                                </p>
                            </div>

                            <div style={{ background: 'var(--bg-main)', padding: '15px', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px', letterSpacing: '0.05em' }}>
                                    Clé Publique (AYA ID)
                                </p>
                                <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', color: 'var(--text-main)' }}>
                                    {entity.aya_entity_id}
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>Date d'émission</p>
                                    <p style={{ fontWeight: '600' }}>{creationDate}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '5px' }}>Validité</p>
                                    <p style={{ fontWeight: '600', color: isCertified && isValid ? 'var(--primary-color)' : 'inherit' }}>{validUntilDate}</p>
                                </div>
                            </div>

                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Dernière modification le : {new Date(entity.last_update).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
                                {isCertified && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Link
                                            href={`/update/${entity.entity_id}`}
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                color: 'var(--primary-color)',
                                                textDecoration: 'none',
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--primary-color)',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Mettre a jour
                                        </Link>
                                        <Link
                                            href={`/renew/${entity.entity_id}`}
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                color: '#CE6A6B',
                                                textDecoration: 'none',
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #CE6A6B',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            Renouveler
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: SEMANTIC DATA CARD */}
                        <div className="card">
                            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
                                <span style={{ width: '10px', height: '10px', background: 'var(--primary-color)', borderRadius: '50%' }}></span>
                                Données Sémantiques (IA)
                            </h3>

                            <div style={{ marginBottom: '2rem' }}>
                                <p style={{ fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text-body)', lineHeight: '1.8' }}>
                                    "{description}"
                                </p>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '0.05em' }}>
                                    Mots-Clés Indexés
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                    {keywords.length > 0 ? keywords.map((kw: string, i: number) => (
                                        <span key={i} style={{
                                            background: 'var(--bg-main)',
                                            padding: '6px 14px',
                                            borderRadius: '50px',
                                            fontSize: '0.9rem',
                                            color: 'var(--text-main)',
                                            fontWeight: '500',
                                            border: '1px solid var(--border-light)'
                                        }}>
                                            #{kw}
                                        </span>
                                    )) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucun mot-clé défini.</span>}
                                </div>
                            </div>

                            <div>
                                <p style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '10px', letterSpacing: '0.05em' }}>
                                    Protocoles Supportés
                                </p>
                                <ul style={{ fontSize: '0.95rem', color: 'var(--text-body)' }}>
                                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                        <span style={{ color: 'var(--primary-color)' }}>✓</span> JSON-LD Structure
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                        <span style={{ color: 'var(--primary-color)' }}>✓</span> ASR v3.0 Standard
                                    </li>
                                </ul>
                            </div>
                        </div>

                    </div>

                    {/* FOOTER BADGE */}
                    <div style={{ marginTop: '3rem', textAlign: 'center', opacity: 0.6 }}>
                        <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Secured by AYO Consensus • Swiss Hosting
                        </p>
                    </div>

                </div>
            </section>
        </main>
    );
}
