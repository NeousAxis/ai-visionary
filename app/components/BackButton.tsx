"use client";

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function BackButton() {
    const router = useRouter();
    const t = useTranslations('nav');

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
            &#x2715; {t('close')}
        </button>
    );
}
