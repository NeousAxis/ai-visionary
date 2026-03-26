'use client';

import { useState } from 'react';

interface UpdateFormClientProps {
    currentValues: {
        entityId: string;
        legalName: string;
        sector: string;
        services: string;
        targetAudience: string;
        country: string;
        contactEmail: string;
    };
    sectorOptions: string[];
    countryOptions: { code: string; label: string }[];
}

export default function UpdateFormClient({ currentValues, sectorOptions, countryOptions }: UpdateFormClientProps) {
    const [formData, setFormData] = useState(currentValues);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            const res = await fetch('/api/update-entity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
                throw new Error(data.error || `Erreur ${res.status}`);
            }

            setStatus('success');
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err.message || 'Une erreur est survenue.');
        }
    };

    if (status === 'success') {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#10003;</div>
                <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Donnees mises a jour</h2>
                <p style={{ color: 'var(--text-body)', marginBottom: '1.5rem' }}>
                    Vos informations ont ete enregistrees avec succes. Votre certificat AYA sera mis a jour sous peu.
                </p>
                <a
                    href={`/aya/e/${currentValues.entityId}`}
                    style={{
                        display: 'inline-block',
                        background: 'var(--primary-color)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: 'var(--radius-sm)',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                    }}
                >
                    Voir mon certificat AYA
                </a>
            </div>
        );
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-light)',
        fontSize: '0.95rem',
        color: 'var(--text-main)',
        background: 'var(--bg-main)',
        outline: 'none',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '0.85rem',
        fontWeight: '600',
        color: 'var(--text-muted)',
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    };

    const fieldStyle: React.CSSProperties = {
        marginBottom: '1.25rem',
    };

    return (
        <div className="card">
            <h3 style={{
                fontSize: '1.2rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--border-light)',
                paddingBottom: '1rem',
            }}>
                Mettre a jour vos donnees
            </h3>

            <form onSubmit={handleSubmit}>
                <div style={fieldStyle}>
                    <label htmlFor="legalName" style={labelStyle}>Nom legal</label>
                    <input
                        type="text"
                        id="legalName"
                        name="legalName"
                        value={formData.legalName}
                        onChange={handleChange}
                        required
                        style={inputStyle}
                        placeholder="Nom officiel de l'entite"
                    />
                </div>

                <div style={fieldStyle}>
                    <label htmlFor="sector" style={labelStyle}>Secteur d&apos;activite</label>
                    <select
                        id="sector"
                        name="sector"
                        value={formData.sector}
                        onChange={handleChange}
                        style={inputStyle}
                    >
                        {sectorOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                <div style={fieldStyle}>
                    <label htmlFor="services" style={labelStyle}>Services principaux</label>
                    <textarea
                        id="services"
                        name="services"
                        value={formData.services}
                        onChange={handleChange}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        placeholder="Ex: Consulting, Developpement web, Formation IA (separes par des virgules)"
                    />
                </div>

                <div style={fieldStyle}>
                    <label htmlFor="targetAudience" style={labelStyle}>Public cible</label>
                    <textarea
                        id="targetAudience"
                        name="targetAudience"
                        value={formData.targetAudience}
                        onChange={handleChange}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        placeholder="Ex: PME, startups, grands comptes"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                        <label htmlFor="country" style={labelStyle}>Pays</label>
                        <select
                            id="country"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            style={inputStyle}
                        >
                            <option value="">-- Selectionner --</option>
                            {countryOptions.map(c => (
                                <option key={c.code} value={c.code}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="contactEmail" style={labelStyle}>Email de contact</label>
                        <input
                            type="email"
                            id="contactEmail"
                            name="contactEmail"
                            value={formData.contactEmail}
                            onChange={handleChange}
                            style={inputStyle}
                            placeholder="contact@exemple.com"
                        />
                    </div>
                </div>

                {status === 'error' && (
                    <div style={{
                        background: '#FEE2E2',
                        border: '1px solid #FECACA',
                        color: '#991B1B',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '1rem',
                        fontSize: '0.9rem',
                    }}>
                        {errorMessage}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={status === 'loading'}
                    style={{
                        width: '100%',
                        padding: '14px',
                        background: status === 'loading' ? 'var(--text-muted)' : 'var(--primary-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: status === 'loading' ? 'wait' : 'pointer',
                        transition: 'background 0.2s',
                    }}
                >
                    {status === 'loading' ? 'Enregistrement...' : 'Mettre a jour mes donnees'}
                </button>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center', fontStyle: 'italic' }}>
                    Vos donnees seront mises a jour dans le registre AYA et votre score AIO sera recalcule.
                </p>
            </form>
        </div>
    );
}
