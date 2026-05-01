import { ImageResponse } from 'next/og';
import { getAyaEntityByIdAggregated } from '@/lib/db';

export const runtime = 'nodejs';
export const alt = 'AYA Registry — AI Visionary';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TEAL = '#4A919E';
const NAVY = '#212E53';
const SAGE = '#BED3C3';
const CORAL = '#CE6A6B';
const SLATE_50 = '#F8FAFC';
const SLATE_300 = '#CBD5E1';
const SLATE_500 = '#64748B';
const SLATE_700 = '#334155';

function entityName(entity: { display_name?: string | null; legal_name?: string | null; website?: string | null }): string {
    const generic = ['Unknown', 'Entity', 'Unknown Entity', 'Entreprise Inconnue'];
    const raw = entity.display_name || entity.legal_name;
    if (raw && !generic.includes(raw)) return raw;
    if (entity.website) return entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    return 'Entity';
}

function scoreColor(score: number | null): string {
    if (score === null) return SLATE_500;
    if (score >= 75) return '#15803D';
    if (score >= 50) return TEAL;
    if (score >= 30) return '#D97706';
    return CORAL;
}

export default async function OpengraphImage({ params }: { params: { id: string } }) {
    const entity = await getAyaEntityByIdAggregated(params.id).catch(() => null);

    if (!entity) {
        return new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        background: SLATE_50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 48,
                        color: NAVY,
                        fontFamily: 'sans-serif',
                    }}
                >
                    AYA Registry — Entity not found
                </div>
            ),
            { ...size }
        );
    }

    const name = entityName(entity);
    const rawScore = entity.asr_score;
    const score: number | null = (rawScore !== undefined && rawScore !== null) ? Number(rawScore) : null;
    const isCertified = entity.payment_completed === true;
    const sector = (entity.sector_macro || '').toString();
    const country = (entity.country_legal || '').toString().toUpperCase();
    const websiteHost = entity.website ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : '';

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(135deg, ${SLATE_50} 0%, #FFFFFF 100%)`,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '60px 80px',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                }}
            >
                {/* Top bar : brand + status pill */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                background: NAVY,
                                color: 'white',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 18,
                                fontWeight: 800,
                                letterSpacing: '-0.02em',
                            }}
                        >
                            AV
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: NAVY, letterSpacing: '-0.01em' }}>AI VISIONARY</span>
                            <span style={{ fontSize: 13, color: TEAL, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                                AYA Registry
                            </span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 18px',
                            borderRadius: 999,
                            background: isCertified ? SAGE : '#F1F5F9',
                            color: isCertified ? '#0F766E' : SLATE_700,
                            fontSize: 16,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                        }}
                    >
                        {isCertified ? 'Certified · ASR' : 'Indexed by AYA bot'}
                    </div>
                </div>

                {/* Entity name */}
                <div
                    style={{
                        fontSize: name.length > 30 ? 60 : 80,
                        fontWeight: 800,
                        color: NAVY,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.05,
                        marginBottom: 22,
                        display: 'flex',
                    }}
                >
                    {name.length > 50 ? name.slice(0, 47) + '…' : name}
                </div>

                {/* Meta line : country · sector · website */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 24, color: SLATE_500, marginBottom: 60 }}>
                    {country && <span>{country}</span>}
                    {country && sector && <span style={{ color: SLATE_300 }}>·</span>}
                    {sector && <span>{sector.length > 35 ? sector.slice(0, 32) + '…' : sector}</span>}
                    {(country || sector) && websiteHost && <span style={{ color: SLATE_300 }}>·</span>}
                    {websiteHost && <span>{websiteHost}</span>}
                </div>

                {/* Score block */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, marginTop: 'auto' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 18, color: SLATE_500, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
                            AIO Score
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 180, fontWeight: 800, color: scoreColor(score), letterSpacing: '-0.06em', lineHeight: 0.95 }}>
                                {score !== null ? score : '—'}
                            </span>
                            <span style={{ fontSize: 56, fontWeight: 600, color: SLATE_300, marginLeft: 12 }}>/100</span>
                        </div>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            paddingBottom: 20,
                            paddingLeft: 32,
                            borderLeft: `3px solid ${SAGE}`,
                            maxWidth: 480,
                        }}
                    >
                        <span style={{ fontSize: 22, fontWeight: 600, color: NAVY, lineHeight: 1.3, marginBottom: 8 }}>
                            {isCertified
                                ? 'Verified by AYO · ASR signed Ed25519'
                                : 'Public listing — claim it to add an ASR'}
                        </span>
                        <span style={{ fontSize: 18, color: SLATE_500, lineHeight: 1.3 }}>
                            ai-visionary.xyz/aya
                        </span>
                    </div>
                </div>
            </div>
        ),
        { ...size }
    );
}
