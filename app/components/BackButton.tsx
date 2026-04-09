"use client";

import { useTranslations } from 'next-intl';

export default function BackButton() {
    const t = useTranslations('nav');

    return (
        <button
            onClick={() => {
                window.location.href = '/aya';
            }}
            style={{
                fontSize: '0.9rem',
                color: 'var(--text-muted)',
                fontWeight: '600',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 12px',
            }}
        >
            &#x2715; {t('close')}
        </button>
    );
}
