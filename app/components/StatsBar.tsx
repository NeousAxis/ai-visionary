'use client';

import { useEffect, useState } from 'react';

export default function StatsBar() {
    const [stats, setStats] = useState<{ total: number; countries: number } | null>(null);

    useEffect(() => {
        fetch('/api/aya/stats')
            .then(r => r.json())
            .then(data => {
                setStats({
                    total: data.total_entities || 0,
                    countries: data.countries?.length || 0,
                });
            })
            .catch(() => {
                // Fallback values if API fails
                setStats({ total: 3300, countries: 70 });
            });
    }, []);

    // Format number with Swiss apostrophe (3'300+)
    const formatNumber = (n: number) => {
        if (n >= 1000) {
            const thousands = Math.floor(n / 1000);
            const hundreds = Math.floor((n % 1000) / 100) * 100;
            return `${thousands}'${hundreds.toString().padStart(3, '0').slice(0, -2)}00+`;
        }
        return `${n}+`;
    };

    const total = stats ? formatNumber(stats.total) : '...';
    const countries = stats ? `${stats.countries}+` : '...';

    return (
        <>
            <div>
                <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: '900', color: 'white', lineHeight: '1' }}>{total}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '8px' }}>Entreprises index&eacute;es</div>
            </div>
            <div>
                <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: '900', color: 'white', lineHeight: '1' }}>9</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '8px' }}>IA compatibles</div>
            </div>
            <div>
                <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: '900', color: 'white', lineHeight: '1' }}>{countries}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '8px' }}>Pays couverts</div>
            </div>
        </>
    );
}
