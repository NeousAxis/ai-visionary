import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';

// Force dynamic
export const revalidate = 0;

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const entity = await db.getAyaEntityById(id);

    if (!entity) {
        return notFound();
    }

    const isValid = new Date(entity.valid_until) > new Date();
    const creationDate = new Date(entity.created_at).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' });
    const validUntilDate = new Date(entity.valid_until).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' });

    // Fix: Respect 0 score, fallback to 100 only if undefined (legacy/mock)
    const score = (entity.asr_score !== undefined && entity.asr_score !== null) ? entity.asr_score : 100;

    // DATA EXTRACTION
    const asrData = entity.asr_payload?.data || {};

    // 🎨 ROBUST FALLBACKS — skip generic names
    const genericNames = ["Unknown", "Entity", "Unknown Entity", "Entreprise Inconnue"];
    const rawDisplayName = entity.display_name || entity.legal_name || entity.name;
    const displayName = (rawDisplayName && !genericNames.includes(rawDisplayName))
        ? rawDisplayName
        : (entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : "Identité Web Certifiée");

    const description = asrData.description && asrData.description !== "null"
        ? asrData.description
        : (asrData.pitch && asrData.pitch !== "null"
            ? asrData.pitch
            : "Certification de présence sémantique active. Cette entité a validé son existence et ses champs d'expertise auprès du consensus AYO.");

    // Ensure keywords is always an array (services can be a string)
    const rawKeywords = asrData.keywords || asrData.services || asrData.tags || [];
    const keywords = Array.isArray(rawKeywords)
        ? rawKeywords
        : (typeof rawKeywords === 'string' ? rawKeywords.split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>

            {/* COMPACT NAV (Like Home) */}
            <div className="container" style={{ padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--text-main)', color: 'white', padding: '5px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem' }}>AV</div>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>AI VISIONARY</span>
                </Link>
                <Link href="/aya" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    ✕ FERMER
                </Link>
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
                        <span>📍 {entity.country_legal === 'CH' ? 'Suisse' : entity.country_legal}</span>
                        <span>🏢 {entity.entity_type}</span>
                        {entity.website && (
                            <a href={entity.website} target="_blank" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>
                                🔗 {entity.website.replace(/^https?:\/\//, '')}
                            </a>
                        )}
                    </div>
                </div>
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
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        background: isValid ? 'var(--bg-accent)' : '#FEE2E2',
                                        color: isValid ? 'var(--primary-color)' : '#EF4444'
                                    }}>
                                        {isValid ? '● CERTIFIÉ ACTIF' : '● EXPIRÉ'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>Qualité de l'Info (ASR)</span>
                                    </div>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
                                        {score}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/100</span>
                                    </span>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px', fontStyle: 'italic', lineHeight: '1.3', borderLeft: '2px solid var(--border-light)', paddingLeft: '8px' }}>
                                    * Un score bas n'affecte pas la confiance (Validité), mais indique une quantité d'information limitée transmise aux IA.
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
                                    <p style={{ fontWeight: '600', color: isValid ? 'var(--primary-color)' : 'inherit' }}>{validUntilDate}</p>
                                </div>
                            </div>

                            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px dashed var(--border-light)' }}>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right', fontStyle: 'italic' }}>
                                    Dernière modification le : {new Date(entity.last_update).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}
                                </p>
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
                                        <span style={{ color: 'var(--primary-color)' }}>✓</span> ASR v1.0 Standard
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
