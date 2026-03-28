
import React from 'react';
import Link from 'next/link';

import FAQ from '../components/FAQ';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'AI and Your Business — How AI Systems Understand Your Organization',
    description:
        'Discover how artificial intelligence (ChatGPT, Gemini, Claude) interprets information about your business and why structuring your data changes their behavior.',
    openGraph: {
        title: 'AI and Your Business | AI Visionary',
        description:
            'How AI systems understand your business and why structuring your data is essential to being recommended.',
        url: 'https://ai-visionary.com/ai-et-votre-entreprise',
        siteName: 'AI Visionary',
        type: 'website',
    },
};

export default function ComprendrePage() {
    return (
        <main>
            {/* Header / Nav */}
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Back to home
                </Link>
            </nav>

            {/* Hero Section */}
            <section className="section" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                <div className="container hero-content">
                    <h1 className="headline" style={{ fontSize: '3rem' }}>
                        How AI Systems Understand Your Business
                    </h1>
                    <div className="subheadline">
                        <p className="highlight">
                            More and more people ask their questions directly to artificial intelligence.
                        </p>
                        <p>
                            This page explains what AI can understand about your business, and why structuring your information changes their behavior — without SEO, without advertising, without rankings.
                        </p>
                    </div>
                </div>
            </section>

            {/* 1. Before ASR */}
            <section className="section">
                <div className="container">
                    <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <h2 style={{ marginBottom: '1rem', color: '#ef4444' }}>1. Before a Structured Declaration: What AI Perceives</h2>
                        <p style={{ marginBottom: '1rem' }}>
                            Without an explicit framework, an AI reads your website like a human: narrative text, values, intentions, and sometimes ambiguous phrasing.
                        </p>
                        <p style={{ marginBottom: '1rem' }}><strong>For an AI, this implies:</strong></p>
                        <ul className="clean-list" style={{ marginBottom: '1rem' }}>
                            <li>A risk of misinterpretation,</li>
                            <li>A fear of inventing a role, a skill, or a status,</li>
                            <li>Cautious, vague responses, or a complete absence of citation.</li>
                        </ul>
                        <p className="highlight" style={{ color: '#ef4444' }}>👉 Out of caution, the AI avoids naming you… or hallucinates with restraint.</p>
                    </div>
                </div>
            </section>

            {/* 2. After ASR */}
            <section className="section">
                <div className="container">
                    <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
                        <h2 style={{ marginBottom: '1rem', color: '#10b981' }}>2. After a Structured and Sealed Declaration: What Changes</h2>
                        <p style={{ marginBottom: '1rem' }}>
                            With an explicit declaration (ASR – AI Singular Record), your business becomes for the AI:
                        </p>
                        <ul className="clean-list" style={{ marginBottom: '1rem' }}>
                            <li>A clearly bounded entity,</li>
                            <li>A declared scope of activity,</li>
                            <li>A stable, unambiguous source.</li>
                        </ul>
                        <p className="highlight" style={{ color: '#10b981' }}>👉 The AI can then dare to name, dare to cite, dare to mention your business without inventing, without extrapolating, without making promises.</p>
                    </div>
                </div>
            </section>

            {/* 3. Concrete cases */}
            <section className="section">
                <div className="container">
                    <h2 className="section-title">Concrete Cases Where an AI Can Cite You</h2>

                    <div className="process-steps">
                        {/* Case 1 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>Case 1</span>
                            <h4>Factual / Exploratory Question</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>&ldquo;What companies or organizations work on [your field] in [your region]?&rdquo;</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li style={{ color: '#ef4444' }}><strong>Without a framework:</strong> generic response, actors not named.</li>
                                <li style={{ color: '#10b981' }}><strong>With ASR:</strong> the AI can mention your business as a declared actor, without judgment.</li>
                            </ul>
                        </div>

                        {/* Case 2 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>Case 2</span>
                            <h4>Guidance Question (Without Recommendation)</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>&ldquo;Are there organizations that offer [type of service]?&rdquo;</p>
                            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>AI systems avoid recommendations (&ldquo;the best&rdquo;). But they can:</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li>Describe types of actors,</li>
                                <li>Cite declared examples.</li>
                            </ul>
                            <p className="highlight" style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#10b981' }}>👉 Your business becomes mentionable, because its scope is clear.</p>
                        </div>

                        {/* Case 3 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>Case 3</span>
                            <h4>Professional or Institutional Question</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>&ldquo;How can organizations approach [a specific challenge]?&rdquo;</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li style={{ color: '#ef4444' }}><strong>Without a declaration:</strong> generic methods.</li>
                                <li style={{ color: '#10b981' }}><strong>With a declaration:</strong> the AI can point to actors that declare involvement in this topic, including your business.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Why AI no longer hallucinates */}
            <section className="section">
                <div className="container">
                    <div className="grid-2">
                        <div className="card">
                            <h3>4. Why AI No Longer Hallucinates When Everything Is Declared</h3>
                            <p style={{ marginTop: '1rem' }}>Because a structured declaration:</p>
                            <ul className="clean-list">
                                <li>States what you are,</li>
                                <li>States what you do,</li>
                                <li>Also states what you do not declare.</li>
                            </ul>
                            <p style={{ marginTop: '1rem' }}><strong>The AI no longer needs to:</strong></p>
                            <ul className="clean-list">
                                <li>Fill in the gaps,</li>
                                <li>Interpret your messaging,</li>
                                <li>Project implicit competencies.</li>
                            </ul>
                            <p className="highlight" style={{ marginTop: '1rem' }}>👉 Less interpretive freedom = more possible citations.</p>
                        </div>

                        <div className="card">
                            <h3>5. What Actually Triggers an AI Mention</h3>
                            <p style={{ marginTop: '1rem', color: '#ef4444', textDecoration: 'line-through' }}>Not SEO. Not popularity. Not a marketing score.</p>
                            <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>But:</p>
                            <ul className="clean-list">
                                <li><strong>Clear semantic match:</strong> The question asked corresponds exactly to what you declare.</li>
                                <li><strong>Low risk of error:</strong> The AI can answer without extrapolating.</li>
                                <li><strong>Neutral context:</strong> AI systems prefer to describe, mention, and illustrate rather than recommend.</li>
                            </ul>
                            <p className="highlight" style={{ marginTop: '1rem' }}>👉 Being mentionable is the prerequisite for any AI visibility.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Conclusion */}
            <section className="section cta-final-section">
                <div className="container">
                    <h2 className="section-title">Key Takeaway</h2>
                    <p className="final-phrase" style={{ fontSize: '1.5rem', fontStyle: 'italic', maxWidth: '800px', margin: '0 auto' }}>
                        &quot;AI systems don&apos;t cite what is most visible.<br />
                        They cite what they can understand without making mistakes.&quot;
                    </p>
                    <p style={{ marginTop: '2rem', color: 'var(--text-muted)' }}>
                        That is exactly the role of a structured and sealed declaration.
                    </p>
                    <div style={{ marginTop: '3rem' }}>
                        <Link href="/" className="btn btn-primary">
                            Understand how AYO can help you
                        </Link>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <FAQ />

        </main>
    );
}
