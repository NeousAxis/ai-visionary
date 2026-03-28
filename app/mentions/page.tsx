import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Legal Notice | AI Visionary',
    description:
        'Legal notice for ai-visionary.com. Publisher: AI Visionary (Cyril Leger), Geneva, Switzerland. Hosting: Vercel Inc. Intellectual property and applicable law.',
    openGraph: {
        title: 'Legal Notice | AI Visionary',
        description:
            'Legal information for AI Visionary: publisher, hosting provider, intellectual property, and applicable Swiss law.',
        url: 'https://ai-visionary.com/mentions',
        siteName: 'AI Visionary',
        type: 'website',
    },
};

const h2Style = { fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' };
const ulStyle = { paddingLeft: '20px', marginTop: '10px' };

export default function MentionsPage() {
    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    &larr; Back to home
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">Legal Notice</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        {/* 1. Publisher */}
                        <h2 style={{ ...h2Style, marginTop: '0' }}>1. Website Publisher</h2>
                        <p>
                            <strong>AI Visionary</strong><br />
                            Sole proprietorship founded and managed by <strong>Cyril Leger</strong><br />
                            Specialty: data structuring for AI readability (AI-readability Intelligence Optimization)<br />
                            Registered office: Geneva, Switzerland<br />
                            Email: <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a><br />
                            Website: <a href="https://ai-visionary.com" style={{ color: 'var(--primary-color)' }}>ai-visionary.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Publication director: <strong>Cyril Leger</strong>
                        </p>

                        {/* 2. Hosting */}
                        <h2 style={h2Style}>2. Hosting</h2>
                        <p>
                            The website <strong>ai-visionary.com</strong> is hosted by:
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>Vercel Inc.</strong><br />
                            440 N Barranca Ave #4133<br />
                            Covina, CA 91723<br />
                            United States<br />
                            Website: <a href="https://vercel.com" style={{ color: 'var(--primary-color)' }} target="_blank" rel="noopener noreferrer">vercel.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Application data is stored via <strong>Supabase Inc.</strong> (PostgreSQL database hosted in the United States).
                        </p>

                        {/* 3. Intellectual Property */}
                        <h2 style={h2Style}>3. Intellectual Property</h2>
                        <p>
                            All content on ai-visionary.com &mdash; texts, images, graphics, logos,
                            icons, source code, scoring algorithms, structuring protocols &mdash; is protected
                            by copyright and is subject to Swiss and international intellectual property law.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            The following names are trademarks and/or trade names of AI Visionary:
                        </p>
                        <ul style={ulStyle}>
                            <li><strong>AYO</strong>: AI diagnostic agent for AI readability</li>
                            <li><strong>AYA</strong>: public registry of indexed and certified entities</li>
                            <li><strong>AIO</strong> (AI-readability Intelligence Optimization): AI readability score from 0 to 100</li>
                            <li><strong>ASR</strong> (AI Singular Record): cryptographically signed digital identity file</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            Any reproduction, representation, modification, publication, or adaptation of all or part
                            of the site&apos;s content, by any means or process, is prohibited
                            without the prior written authorization of AI Visionary.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Any unauthorized use of the site or its content will be deemed an infringement
                            and prosecuted in accordance with Articles 61 et seq. of the Federal Act on Copyright (CopA).
                        </p>

                        {/* 4. AYA Registry Data */}
                        <h2 style={h2Style}>4. AYA Registry Data</h2>
                        <p>
                            The AYA registry contains business data collected from
                            publicly accessible sources on the internet. This data is made available via an open API
                            under the <strong>CC-BY-4.0</strong> (Creative Commons Attribution) license.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            AIO scores are calculated automatically and do not constitute a commercial,
                            financial, or qualitative assessment of the business concerned. They measure exclusively
                            the degree to which a website is readable by artificial intelligence systems.
                        </p>

                        {/* 5. Limitation of Liability */}
                        <h2 style={h2Style}>5. Limitation of Liability</h2>
                        <p>
                            AI Visionary endeavors to provide accurate and up-to-date information on
                            ai-visionary.com. However, AI Visionary cannot guarantee the accuracy, completeness,
                            or currency of the information published.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Accordingly, AI Visionary disclaims all liability:
                        </p>
                        <ul style={ulStyle}>
                            <li>For any inaccuracy, error, or omission in the information on the site.</li>
                            <li>For any direct or indirect damage resulting from use of the site or inability to access it.</li>
                            <li>For any damage resulting from use of the AIO score for commercial, contractual, or legal purposes.</li>
                            <li>For the content of third-party websites that may be linked from the site.</li>
                            <li>For any interruption of service, whether voluntary (maintenance) or involuntary (outage, force majeure).</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            The AIO diagnostic and ASR files are provided for informational and technical structuring purposes.
                            They do not constitute legal, financial, or commercial advice.
                        </p>

                        {/* 6. Hyperlinks */}
                        <h2 style={h2Style}>6. Hyperlinks</h2>
                        <p>
                            The site ai-visionary.com may contain links to third-party websites. AI Visionary
                            exercises no control over the content of these sites and assumes no liability regarding
                            their content or data protection practices.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Creating hyperlinks to ai-visionary.com is permitted, provided that the
                            &ldquo;framing&rdquo; technique or any other technique that damages
                            the image of AI Visionary is not used.
                        </p>

                        {/* 7. Service Availability */}
                        <h2 style={h2Style}>7. Service Availability</h2>
                        <p>
                            AI Visionary endeavors to ensure that the site is available 24/7.
                            However, access to the site may be interrupted at any time, without notice,
                            for maintenance, updates, or any other technical reason.
                            AI Visionary shall not be held liable for such interruptions.
                        </p>

                        {/* 8. Applicable Law */}
                        <h2 style={h2Style}>8. Applicable Law and Jurisdiction</h2>
                        <p>
                            This legal notice is governed by <strong>Swiss law</strong>.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Any dispute relating to the interpretation or execution of this notice
                            shall be submitted to the exclusive jurisdiction of the <strong>courts of the Canton of Geneva, Switzerland</strong>,
                            subject to mandatory provisions applicable to consumers residing in
                            the European Union.
                        </p>

                        {/* 9. Credits */}
                        <h2 style={h2Style}>9. Credits</h2>
                        <ul style={ulStyle}>
                            <li>Design and development: <strong>AI Visionary</strong> (Cyril Leger), Geneva</li>
                            <li>Hosting: <strong>Vercel Inc.</strong></li>
                            <li>Artificial intelligence: <strong>Google Gemini</strong> (semantic content generation)</li>
                            <li>Payments: <strong>Stripe Inc.</strong></li>
                        </ul>

                        {/* 10. Contact */}
                        <h2 style={h2Style}>10. Contact</h2>
                        <p>
                            For any questions regarding this legal notice:
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>AI Visionary</strong><br />
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
        </main>
    );
}
