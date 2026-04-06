'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const email = params.get('email') || '';
  const pack = params.get('pack') || 'aya';
  const t = useTranslations('paymentSuccess');

  // Auto-redirect to AYA registry after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/aya');
    }, 4000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="dv2" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="dv2-header">
        <Link href="/" className="dv2-logo-link">
          <Image src="/logo-v2.png" alt="AI Visionary" width={28} height={28} />
          <span className="dv2-logo-text">AYO</span>
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div className="dv2-confirm-box" style={{ maxWidth: 500 }}>
          <div className="dv2-confirm-checkmark">
            <svg viewBox="0 0 52 52" className="dv2-confirm-svg">
              <circle cx="26" cy="26" r="24" fill="none" stroke="#4A919E" strokeWidth="3" />
              <path fill="none" stroke="#4A919E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16" className="dv2-confirm-check-path" />
            </svg>
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, color: '#212E53', marginBottom: '0.5rem' }}>
            {t('title')}
          </h2>
          <p style={{ color: '#4A919E', fontWeight: 600, fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            {t('packActivated', { pack: pack === 'pro' ? 'PRO' : 'AYA' })}
          </p>

          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div className="dv2-transition-spinner" style={{ width: 36, height: 36, margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {t('preparing')}
            </p>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '1.5rem', textAlign: 'center' }}>
            {t('spamReminder')}
          </p>
        </div>
      </div>

      <footer className="dv2-footer">
        <p>© 2026 AI Visionary • 🇨🇭 Based in Geneva</p>
      </footer>
    </div>
  );
}
