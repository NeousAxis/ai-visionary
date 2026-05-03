import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const alt = 'AYO Diagnostic — AI Readability Analysis';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TEAL = '#4A919E';
const NAVY = '#212E53';

export default async function Image() {
    // Load logo from filesystem (nodejs runtime — no fetch needed)
    const logoPath = path.join(process.cwd(), 'public', 'logo-v2.png');
    const logoBuffer = await readFile(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: `linear-gradient(135deg, ${TEAL} 0%, ${NAVY} 100%)`,
                    fontFamily: 'sans-serif',
                    position: 'relative',
                }}
            >
                {/* Main content row */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        flex: 1,
                        padding: '60px 80px 40px 80px',
                    }}
                >
                    {/* Left column — logo in white circular badge (40%) */}
                    <div
                        style={{
                            width: '40%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <div
                            style={{
                                width: 380,
                                height: 380,
                                borderRadius: '50%',
                                background: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={logoBase64}
                                alt="AI Visionary logo"
                                style={{
                                    width: 300,
                                    height: 300,
                                    objectFit: 'contain',
                                }}
                            />
                        </div>
                    </div>

                    {/* Right column — text (60%) */}
                    <div
                        style={{
                            width: '60%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            paddingLeft: 48,
                        }}
                    >
                        {/* Main title */}
                        <div
                            style={{
                                fontSize: 84,
                                fontWeight: 700,
                                color: '#FFFFFF',
                                letterSpacing: '-0.03em',
                                lineHeight: 1.05,
                                marginBottom: 20,
                                display: 'flex',
                            }}
                        >
                            AYO Diagnostic
                        </div>

                        {/* Subtitle */}
                        <div
                            style={{
                                fontSize: 36,
                                fontWeight: 400,
                                color: 'rgba(255,255,255,0.85)',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.2,
                                marginBottom: 36,
                                display: 'flex',
                            }}
                        >
                            AI Readability Analysis
                        </div>

                        {/* Tagline bullets */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                            }}
                        >
                            {[
                                '✓ 8 specialized agents',
                                '✓ AIO Score',
                                '✓ ASR Files',
                            ].map((line) => (
                                <div
                                    key={line}
                                    style={{
                                        fontSize: 28,
                                        color: 'rgba(255,255,255,0.70)',
                                        display: 'flex',
                                    }}
                                >
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        paddingBottom: 36,
                        fontSize: 24,
                        color: 'rgba(255,255,255,0.50)',
                        letterSpacing: '0.04em',
                    }}
                >
                    ai-visionary.xyz
                </div>
            </div>
        ),
        { ...size }
    );
}
