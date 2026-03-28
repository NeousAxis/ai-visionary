"use client";

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

const FaqItem = ({ question, children }: { question: string, children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="faq-item" style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '10px',
            overflow: 'hidden'
        }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '1.5rem 1rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontFamily: 'var(--font-heading)'
                }}
            >
                <span>{question}</span>
                <span style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    fontSize: '1.2rem',
                    color: 'var(--primary-color)'
                }}>
                    ↓
                </span>
            </button>
            <div style={{
                height: isOpen ? 'auto' : '0',
                padding: isOpen ? '0 1rem 1.5rem 1rem' : '0 1rem',
                opacity: isOpen ? 1 : 0,
                transition: 'all 0.3s ease',
                color: 'var(--text-muted)',
                lineHeight: '1.6'
            }}>
                {children}
            </div>
        </div>
    );
};

export default function FAQ() {
    const t = useTranslations('faq');

    return (
        <section id="faq" className="section faq-section" style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
            <div className="container" style={{ maxWidth: '800px' }}>
                <h2 className="section-title" style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    {t('title')}
                </h2>

                <FaqItem question={t('q1')}>
                    <p><strong>{t('a1p1')}</strong></p>
                    <ul style={{ margin: '1rem 0', paddingLeft: '1.5rem' }}>
                        <li>{t('a1l1')}</li>
                        <li>{t('a1l2')}</li>
                    </ul>
                    <p>{t('a1p2')}</p>
                    <p style={{ marginTop: '1rem', color: 'var(--text-main)', fontWeight: '600' }}>{t('a1p3')}</p>
                </FaqItem>

                <FaqItem question={t('q2')}>
                    <p><strong>{t('a2p1')}</strong></p>
                    <p style={{ marginTop: '0.5rem' }}>{t('a2p2')}</p>
                    <ul style={{ margin: '1rem 0', paddingLeft: '1.5rem' }}>
                        <li>{t('a2l1')}</li>
                        <li>{t('a2l2')}</li>
                        <li>{t('a2l3')}</li>
                    </ul>
                    <p>{t('a2p3')}</p>
                </FaqItem>

                <FaqItem question={t('q3')}>
                    <p><strong>{t('a3p1')}</strong></p>
                    <p style={{ marginTop: '0.5rem' }}>{t('a3p2')}</p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>{t('a3l1')}</li>
                        <li>{t('a3l2')}</li>
                        <li>{t('a3l3')}</li>
                    </ul>
                    <p style={{ marginTop: '1rem', color: 'var(--text-main)' }}>{t('a3p3')}</p>
                    <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>{t('a3p4')}</p>
                </FaqItem>

                <FaqItem question={t('q4')}>
                    <p><strong>{t('a4p1')}</strong></p>
                    <p style={{ color: 'var(--primary-color)', margin: '0.5rem 0' }}>{t('a4p2')}</p>

                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>{t('a4p3')}</p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>{t('a4l1')}</li>
                        <li>{t('a4l2')}</li>
                        <li>{t('a4l3')}</li>
                    </ul>

                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>{t('a4p4')}</p>
                    <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                        <li>{t('a4l4')}</li>
                        <li>{t('a4l5')}</li>
                        <li>{t('a4l6')}</li>
                    </ul>

                    <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>{t('a4p5')}</p>
                </FaqItem>

                <FaqItem question={t('q5')}>
                    <p><strong>{t('a5p1')}</strong></p>
                    <p>{t('a5p2')}</p>

                    <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>{t('a5p3')}</p>
                    <p>{t('a5p4')}</p>
                    <p style={{ marginTop: '0.5rem', color: 'var(--text-main)' }}>{t('a5p5')}</p>
                </FaqItem>

                <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '1.1rem', fontStyle: 'italic', fontWeight: '600' }}>
                        {t('closing')}
                    </p>
                </div>

            </div>
        </section>
    );
}
