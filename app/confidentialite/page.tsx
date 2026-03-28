import Link from 'next/link';
import Footer from '../components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy | AI Visionary',
    description:
        'Privacy Policy of AI Visionary. Data protection, user rights (Swiss nFADP + GDPR), sub-processors, cookies, data retention periods.',
    openGraph: {
        title: 'Privacy Policy | AI Visionary',
        description:
            'Learn how AI Visionary protects your personal data. Compliant with Swiss nFADP and European GDPR.',
        url: 'https://ai-visionary.com/confidentialite',
        siteName: 'AI Visionary',
        type: 'website',
    },
};

const h2Style = { fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' };
const h3Style = { fontSize: '1.05rem', marginTop: '20px', marginBottom: '8px', color: 'var(--text-main)' };
const ulStyle = { paddingLeft: '20px', marginTop: '10px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.95rem' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--primary-color)', color: 'var(--text-main)', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' };

export default function ConfidentialitePage() {
    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    &larr; Back to home
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">Privacy Policy</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                            AI Visionary is committed to protecting the privacy of its users.
                            This policy describes the personal data we collect,
                            how we use it, and the rights you have.
                        </p>

                        {/* 1. Data Controller */}
                        <h2 style={{ ...h2Style, marginTop: '10px' }}>1. Data Controller</h2>
                        <p>
                            <strong>AI Visionary</strong><br />
                            Founded and managed by Cyril Leger<br />
                            Geneva, Switzerland<br />
                            Email: <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a><br />
                            Website: <a href="https://ai-visionary.com" style={{ color: 'var(--primary-color)' }}>ai-visionary.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            AI Visionary acts as data controller within the meaning of the Swiss Federal Act
                            on Data Protection (nFADP, entered into force on 1 September 2023) and,
                            for users residing in the European Economic Area, within the meaning of the
                            General Data Protection Regulation (GDPR &mdash; EU Regulation 2016/679).
                        </p>

                        {/* 2. Data Collected */}
                        <h2 style={h2Style}>2. Personal Data Collected</h2>
                        <p>In the course of providing our services, we collect the following categories of data:</p>

                        <h3 style={h3Style}>2.1 AYO Diagnostic (AI Chatbot)</h3>
                        <ul style={ulStyle}>
                            <li><strong>Analyzed website URL</strong>: the web address provided by the user for the diagnostic.</li>
                            <li><strong>Questionnaire responses</strong>: declarative information about the business (services, certifications, target audience, indicators, etc.).</li>
                            <li><strong>Data extracted from the website</strong>: publicly accessible content (title, meta description, JSON-LD, sitemap).</li>
                            <li><strong>Calculated AIO score</strong>: result of the AI readability diagnostic (score from 0 to 100).</li>
                        </ul>

                        <h3 style={h3Style}>2.2 Identification and Contact</h3>
                        <ul style={ulStyle}>
                            <li><strong>Email address</strong>: used for sending results, authentication (OTP), and service-related communications.</li>
                            <li><strong>Business name</strong>: as declared by the user or automatically detected on the analyzed website.</li>
                        </ul>

                        <h3 style={h3Style}>2.3 Payment</h3>
                        <ul style={ulStyle}>
                            <li><strong>Transaction information</strong>: processed exclusively by <strong>Stripe</strong> (PCI-DSS Level 1 certified). We store <strong>no payment card data</strong>.</li>
                            <li>Only the Stripe customer ID, amount, currency, and transaction status are retained on our side.</li>
                        </ul>

                        <h3 style={h3Style}>2.4 AYA Registry</h3>
                        <ul style={ulStyle}>
                            <li>Business name, sector, country, URL, AIO score, generated ASR files, keywords.</li>
                            <li>This data is <strong>publicly accessible</strong> in the AYA registry, which is the very purpose of the service.</li>
                        </ul>

                        <h3 style={h3Style}>2.5 Technical Data</h3>
                        <ul style={ulStyle}>
                            <li><strong>IP address</strong>: used temporarily for security purposes (rate limiting, abuse prevention). Not retained beyond the session.</li>
                            <li><strong>Server logs</strong>: managed by Vercel, retained for a maximum of 30 days.</li>
                        </ul>

                        {/* 3. Legal Bases */}
                        <h2 style={h2Style}>3. Legal Bases for Processing</h2>
                        <p>We process your data on the following legal bases:</p>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Purpose</th>
                                    <th style={thStyle}>Legal Basis</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={tdStyle}>Performing the AIO diagnostic</td>
                                    <td style={tdStyle}>Performance of contract (Art. 6.1.b GDPR / Art. 31 nFADP)</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Registration in the AYA Registry</td>
                                    <td style={tdStyle}>Performance of contract</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Generation and delivery of ASR files</td>
                                    <td style={tdStyle}>Performance of contract</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Payment processing</td>
                                    <td style={tdStyle}>Performance of contract / Legal obligation</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Service security (rate limiting, logs)</td>
                                    <td style={tdStyle}>Legitimate interest (Art. 6.1.f GDPR)</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Service improvement</td>
                                    <td style={tdStyle}>Legitimate interest</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Automatic indexing in the AYA registry (AYA Bot)</td>
                                    <td style={tdStyle}>Legitimate interest (publicly accessible data on the internet)</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 4. Sub-processors */}
                        <h2 style={h2Style}>4. Sub-Processors and Data Transfers</h2>
                        <p>We engage the following sub-processors to provide our services:</p>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Sub-Processor</th>
                                        <th style={thStyle}>Purpose</th>
                                        <th style={thStyle}>Location</th>
                                        <th style={thStyle}>Safeguards</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={tdStyle}><strong>Supabase Inc.</strong></td>
                                        <td style={tdStyle}>PostgreSQL database (analyses, AYA registry, sessions)</td>
                                        <td style={tdStyle}>United States</td>
                                        <td style={tdStyle}>DPA, SOC 2 Type II, encryption at rest and in transit</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Stripe Inc.</strong></td>
                                        <td style={tdStyle}>Payment card processing</td>
                                        <td style={tdStyle}>United States / Ireland</td>
                                        <td style={tdStyle}>PCI-DSS Level 1, Standard Contractual Clauses (SCCs)</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Resend Inc.</strong></td>
                                        <td style={tdStyle}>Transactional email sending (results, confirmations, OTP)</td>
                                        <td style={tdStyle}>United States</td>
                                        <td style={tdStyle}>DPA, TLS encryption</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Vercel Inc.</strong></td>
                                        <td style={tdStyle}>Website hosting and serverless API functions</td>
                                        <td style={tdStyle}>United States (global CDN)</td>
                                        <td style={tdStyle}>DPA, SOC 2 Type II, HTTPS encryption</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Google LLC (Gemini)</strong></td>
                                        <td style={tdStyle}>Semantic content generation (FAQ, glossary, enriched descriptions via AI)</td>
                                        <td style={tdStyle}>United States</td>
                                        <td style={tdStyle}>Google Cloud DPA, data anonymized before transmission</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: '15px' }}>
                            Some sub-processors are located outside Switzerland and the European Economic Area (EEA).
                            Data transfers are governed by Standard Contractual Clauses (SCCs) approved
                            by the European Commission and/or adequacy decisions, in accordance with
                            Articles 16–17 of the nFADP and Chapter V of the GDPR.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Your data is <strong>never sold to third parties</strong>. It is shared with
                            sub-processors only to the extent strictly necessary to provide the service.
                        </p>

                        {/* 5. Cookies */}
                        <h2 style={h2Style}>5. Cookies and Tracking Technologies</h2>
                        <p>AI Visionary takes a <strong>minimalist</strong> approach to cookies:</p>
                        <ul style={ulStyle}>
                            <li><strong>Strictly necessary cookies</strong>: technical cookies set by Vercel
                                for application operation (routing, session). These do not require consent
                                in accordance with Art. 45c para. 2 TCA and Art. 5(3) of the ePrivacy Directive.</li>
                            <li><strong>Payment cookies</strong>: Stripe may set technical cookies during the
                                payment process for fraud prevention.</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            We use <strong>no tracking, advertising, or analytics cookies</strong>.
                            No Google Analytics, Facebook Pixel, or third-party trackers are present on this site.
                        </p>

                        {/* 6. Retention */}
                        <h2 style={h2Style}>6. Data Retention Periods</h2>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Data Type</th>
                                    <th style={thStyle}>Retention Period</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={tdStyle}>AYO analyses and diagnostics</td>
                                    <td style={tdStyle}>2 years after last interaction</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>AYA Registry (Platform Pack &mdash; subscription)</td>
                                    <td style={tdStyle}>Duration of active subscription + 30 days after cancellation</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>AYA Registry (PRO Pack)</td>
                                    <td style={tdStyle}>3 years + 30 days after expiration</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>AYA Registry (bot-indexed entities)</td>
                                    <td style={tdStyle}>Indefinite (public data). Deletion upon request within 72 hours.</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>System and security logs</td>
                                    <td style={tdStyle}>90 days</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>OTP codes (authentication)</td>
                                    <td style={tdStyle}>10 minutes (automatic expiration)</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Billing data</td>
                                    <td style={tdStyle}>10 years (Swiss statutory accounting obligations)</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style={{ marginTop: '10px' }}>
                            Upon expiration of these periods, data is deleted or irreversibly anonymized.
                        </p>

                        {/* 7. Security */}
                        <h2 style={h2Style}>7. Data Security</h2>
                        <p>We implement the following technical and organizational measures:</p>
                        <ul style={ulStyle}>
                            <li>HTTPS encryption (TLS 1.3) for all communications.</li>
                            <li>Encryption at rest for database data (Supabase / PostgreSQL).</li>
                            <li>Ed25519 cryptographic signing of ASR files to guarantee their authenticity and integrity.</li>
                            <li>One-time code (OTP) authentication sent by email.</li>
                            <li>Protection against SSRF attacks, injections, and brute force (rate limiting).</li>
                            <li>Data access limited to the strict minimum (principle of least privilege).</li>
                            <li>No password storage (passwordless authentication via OTP).</li>
                        </ul>

                        {/* 8. Your Rights */}
                        <h2 style={h2Style}>8. Your Rights</h2>
                        <p>
                            Under the Swiss nFADP and the GDPR (for EEA residents),
                            you have the following rights:
                        </p>
                        <ul style={ulStyle}>
                            <li><strong>Right of access</strong> (Art. 25 nFADP / Art. 15 GDPR): obtain a copy of your personal data and information about its processing.</li>
                            <li><strong>Right to rectification</strong> (Art. 32 nFADP / Art. 16 GDPR): have inaccurate or incomplete data corrected.</li>
                            <li><strong>Right to erasure</strong> (Art. 17 GDPR): request deletion of your data when it is no longer necessary for processing.</li>
                            <li><strong>Right to data portability</strong> (Art. 28 nFADP / Art. 20 GDPR): receive your data in a structured, machine-readable format (JSON).</li>
                            <li><strong>Right to object</strong> (Art. 21 GDPR): object to processing based on legitimate interest.</li>
                            <li><strong>Right to restriction of processing</strong> (Art. 18 GDPR): request restriction of processing in certain circumstances.</li>
                            <li><strong>Right to withdraw consent</strong>: withdraw your consent at any time, without affecting the lawfulness of prior processing.</li>
                        </ul>

                        <h3 style={h3Style}>How to Exercise Your Rights</h3>
                        <p>
                            Send your request by email to <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a> specifying
                            your identity and the nature of your request. We will respond within
                            <strong> 30 days</strong> (extendable to 60 days for complex requests, with prior notification).
                        </p>

                        <h3 style={h3Style}>Complaint to a Supervisory Authority</h3>
                        <p>If you believe your rights are not being respected, you may lodge a complaint with:</p>
                        <ul style={ulStyle}>
                            <li><strong>Switzerland</strong>: Federal Data Protection and Information Commissioner (FDPIC) &mdash; <a href="https://www.edoeb.admin.ch" style={{ color: 'var(--primary-color)' }} target="_blank" rel="noopener noreferrer">edoeb.admin.ch</a></li>
                            <li><strong>European Union / EEA</strong>: the competent supervisory authority in your country of residence.</li>
                        </ul>

                        {/* 9. AYA Bot */}
                        <h2 style={h2Style}>9. Automatic Indexing (AYA Bot)</h2>
                        <p>
                            The AYA registry may automatically index businesses from data
                            <strong> publicly accessible</strong> on the internet (website content, JSON-LD data,
                            sitemaps). This processing is based on our legitimate interest in
                            building a reference registry for AI agents (Art. 6.1.f GDPR).
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            If your business is indexed in the AYA registry and you wish to have it removed,
                            send an email to <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a> indicating
                            the relevant URL. Deletion will be completed within <strong>72 hours</strong>.
                        </p>

                        {/* 10. Minors */}
                        <h2 style={h2Style}>10. Protection of Minors</h2>
                        <p>
                            Our services are intended exclusively for professionals and businesses. We do not
                            knowingly collect data about persons under the age of 16. If you become aware that
                            a minor has provided personal data, please contact us for immediate deletion.
                        </p>

                        {/* 11. Changes */}
                        <h2 style={h2Style}>11. Changes to This Policy</h2>
                        <p>
                            We reserve the right to modify this privacy policy at any time.
                            Changes take effect upon publication on this page.
                            In the event of a material change, we will notify affected users by email.
                        </p>

                        {/* 12. Applicable Law */}
                        <h2 style={h2Style}>12. Applicable Law and Jurisdiction</h2>
                        <p>
                            This privacy policy is governed by <strong>Swiss law</strong>,
                            in particular the Federal Act on Data Protection (nFADP).
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            For users residing in the European Union or the European Economic Area,
                            the provisions of the GDPR apply in addition.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Any dispute relating to data protection shall be submitted to the competent courts
                            of the <strong>Canton of Geneva, Switzerland</strong>, subject to mandatory jurisdictional
                            rules applicable to consumers residing in the EU/EEA.
                        </p>

                        {/* 13. Contact */}
                        <h2 style={h2Style}>13. Contact</h2>
                        <p>
                            For any questions regarding the protection of your personal data or to exercise your rights:
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>AI Visionary &mdash; Data Protection</strong><br />
                            Cyril Leger<br />
                            Geneva, Switzerland<br />
                            Email: <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a>
                        </p>

                        <p style={{ marginTop: '30px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Last updated: March 25, 2026
                        </p>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
