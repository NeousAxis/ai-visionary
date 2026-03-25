"use client";

import { useRouter } from 'next/navigation';

export default function BackButton() {
    const router = useRouter();

    return (
        <button
            onClick={() => {
                // If there's history, go back; otherwise navigate to /aya
                if (window.history.length > 1) {
                    router.back();
                } else {
                    router.push('/aya');
                }
            }}
            style={{
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
                fontWeight: '600',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
            }}
        >
            &#x2715; FERMER
        </button>
    );
}
