
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

// Fetch real data from Firestore
async function getEntityData(id: string) {
    try {
        const dbInstance = (db as any).getDb ? (db as any).getDb() : null;
        if (!dbInstance) return null;

        const doc = await dbInstance.collection('aya_registry').doc(id).get();
        if (!doc.exists) {
            // Fallback for Demo Entities (hardcoded for testing)
            if (id === '7f8a9d12-3b4c-4d5e-9f0a-1b2c3d4e5f6a') {
                return { id: '7f8a9d12-3b4c-4d5e-9f0a-1b2c3d4e5f6a', name: "Horlogerie du Léman SA", type: "Luxe", sector: "Industrie", country: "CH", status: "verified", asr_score: 99, description: "Manufacture horlogère de précision à Genève.", city: "Genève", website: "https://horlogerie-leman.ch" };
            }
            return null;
        }

        const data = doc.data();
        return {
            id: data.aya_entity_id,
            name: data.display_name || data.legal_name,
            type: data.entity_type,
            sector: data.sector_macro,
            country: data.country_legal,
            asr_score: Math.round((data.recommendability?.freshness_score || 0.99) * 100),
            description: data.asr_payload?.data?.offre?.services?.value?.[0] || data.legal_name + " - Entité certifiée ASR.",
            city: data.asr_payload?.data?.identite?.city?.value || "Non spécifié",
            website: data.asr_payload?.data?.identite?.url?.value || "#"
        };
    } catch (err) {
        console.error("Error fetching entity data:", err);
        return null;
    }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    const entity = await getEntityData(params.id);
    if (!entity) return { title: 'Entité non trouvée' };

    return {
        title: `${entity.name} | Registre Officiel AYA`,
        description: `Profil certifié ASR pour ${entity.name}. Identité sémantique vérifiée pour les Agents IA.`,
    };
}

export default async function EntityProfilePage({ params }: { params: { id: string } }) {
    const entity = await getEntityData(params.id);

    if (!entity) {
        notFound();
    }

    // STRUCTURE JSON-LD POUR LES BOTS (Schema.org + ASR Extension)
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": entity.name,
        "description": entity.description,
        "address": {
            "@type": "PostalAddress",
            "addressCountry": entity.country,
            "addressLocality": entity.city
        },
        "url": entity.website,
        "identifier": `aya:v1:${entity.id}`,
        // Extension ASR Propriétaire pour AI Visionary
        "asr_verified": true,
        "asr_score": entity.asr_score,
        "asr_version": "1.0"
    };

    return (
        <div style={{ background: 'var(--bg-main)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <header style={{ background: 'white', borderBottom: '1px solid var(--border-light)', padding: '15px 0' }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/aya" style={{ textDecoration: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        ← Retour au Registre
                    </Link>
                    <Link href="/">
                        <img src="/logo-v2.png" alt="AI Visionary" style={{ height: '30px', cursor: 'pointer' }} />
                    </Link>
                </div>
            </header>

            <main className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <div className="card" style={{ padding: '40px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                            <div>
                                <span style={{ background: 'var(--bg-accent)', color: 'var(--primary-color)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                    PROFIL VÉRIFIÉ PAR IA VISIONARY
                                </span>
                                <h1 style={{ fontSize: '2.5rem', marginTop: '15px', color: 'var(--text-main)' }}>{entity.name}</h1>
                            </div>
                            <div style={{ textAlign: 'center', background: 'var(--bg-main)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{entity.asr_score}%</div>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Trust Score</div>
                            </div>
                        </div>

                        <div className="grid-2" style={{ marginBottom: '40px' }}>
                            <div>
                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Secteur</h3>
                                <p style={{ fontSize: '1.2rem', fontWeight: '500' }}>{entity.sector}</p>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Localisation</h3>
                                <p style={{ fontSize: '1.2rem', fontWeight: '500' }}>{entity.city}, {entity.country}</p>
                            </div>
                        </div>

                        <div style={{ background: 'var(--bg-accent)', padding: '25px', borderRadius: '12px', marginBottom: '40px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Description Sémantique (ASR)</h3>
                            <p style={{ lineHeight: '1.6', fontSize: '1.1rem' }}>{entity.description}</p>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '30px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '20px' }}>Identifiants d'Infrastructure</h3>
                            <code style={{ display: 'block', background: '#f1f5f9', padding: '15px', borderRadius: '8px', fontSize: '0.85rem', color: '#475569', overflowX: 'auto' }}>
                                ID: aya:{entity.country.toLowerCase()}:{entity.id}
                            </code>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: '40px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Cette page est Machine-Readable. Les Agents IA utilisent ce point de terminaison pour valider l'identité de cette entreprise.
                        </p>
                    </div>
                </div>
            </main>

            <footer className="footer" style={{ background: 'var(--text-main)', color: 'white', padding: '40px 0', textAlign: 'center' }}>
                <div className="container">
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>Registre AYA v1.0 • Powered by AI Visionary</p>
                </div>
            </footer>
        </div>
    );
}
