'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';

function useCountUp(target: number, duration = 1400) {
    const [value, setValue] = useState(0);
    const rafRef = useRef<number>(0);
    const fromRef = useRef<number>(0);

    useEffect(() => {
        if (target === 0) return;
        const startValue = fromRef.current;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (target - startValue) * eased);
            setValue(current);
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                fromRef.current = target;
            }
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [target, duration]);

    return value;
}

function formatNumber(n: number) {
    if (n >= 1000) {
        const thousands = Math.floor(n / 1000);
        const hundreds = Math.floor((n % 1000) / 100) * 100;
        return `${thousands}'${hundreds.toString().padStart(3, '0').slice(0, -2)}00+`;
    }
    return `${n}+`;
}

export default function StatsBar() {
    const t = useTranslations('stats');
    const [target, setTarget] = useState({ total: 26200, countries: 94 });

    useEffect(() => {
        // Compteur RÉEL du registre VPS (via le proxy serveur) — jamais le fallback Supabase local.
        fetch('/api/pollen-stats')
            .then(r => r.json())
            .then(data => {
                setTarget({
                    total: data.total_entities || 26200,
                    countries: data.countries_count || 94,
                });
            })
            .catch(() => {/* keep defaults */});
    }, []);

    const totalAnimated = useCountUp(target.total);
    const countriesAnimated = useCountUp(target.countries, 1200);

    const numStyle: React.CSSProperties = {
        fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
        fontWeight: '900',
        color: 'white',
        lineHeight: '1',
    };
    const labelStyle: React.CSSProperties = {
        fontSize: '0.85rem',
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
        marginTop: '8px',
    };

    return (
        <>
            <div>
                <div style={numStyle}>{formatNumber(totalAnimated)}</div>
                <div style={labelStyle}>{t('companies')}</div>
            </div>
            <div>
                <div style={numStyle}>4</div>
                <div style={labelStyle}>{t('dataSources')}</div>
            </div>
            <div>
                <div style={numStyle}>{countriesAnimated}+</div>
                <div style={labelStyle}>{t('countries')}</div>
            </div>
        </>
    );
}
