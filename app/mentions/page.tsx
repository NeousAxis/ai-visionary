import Link from 'next/link';
import Footer from '../components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Mentions l\u00e9gales | AI Visionary',
    description:
        'Mentions l\u00e9gales du site ai-visionary.com. \u00c9diteur : AI Visionary (Cyril Leger), Gen\u00e8ve, Suisse. H\u00e9bergement : Vercel Inc. Propri\u00e9t\u00e9 intellectuelle et droit applicable.',
    openGraph: {
        title: 'Mentions l\u00e9gales | AI Visionary',
        description:
            'Informations l\u00e9gales d\'AI Visionary : \u00e9diteur, h\u00e9bergeur, propri\u00e9t\u00e9 intellectuelle et droit applicable suisse.',
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
                    &larr; Retour &agrave; l&apos;accueil
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">Mentions L&eacute;gales</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        {/* 1. &Eacute;diteur */}
                        <h2 style={{ ...h2Style, marginTop: '0' }}>1. &Eacute;diteur du site</h2>
                        <p>
                            <strong>AI Visionary</strong><br />
                            Entreprise individuelle fond&eacute;e et dirig&eacute;e par <strong>Cyril Leger</strong><br />
                            Sp&eacute;cialit&eacute; : structuration de donn&eacute;es pour la lisibilit&eacute; IA (AI-readability Intelligence Optimization)<br />
                            Si&egrave;ge : Gen&egrave;ve, Suisse<br />
                            Email : <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a><br />
                            Site internet : <a href="https://ai-visionary.com" style={{ color: 'var(--primary-color)' }}>ai-visionary.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Directeur de la publication : <strong>Cyril Leger</strong>
                        </p>

                        {/* 2. H&eacute;bergement */}
                        <h2 style={h2Style}>2. H&eacute;bergement</h2>
                        <p>
                            Le site <strong>ai-visionary.com</strong> est h&eacute;berg&eacute; par :
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>Vercel Inc.</strong><br />
                            440 N Barranca Ave #4133<br />
                            Covina, CA 91723<br />
                            &Eacute;tats-Unis<br />
                            Site : <a href="https://vercel.com" style={{ color: 'var(--primary-color)' }} target="_blank" rel="noopener noreferrer">vercel.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Les donn&eacute;es applicatives sont stock&eacute;es via <strong>Supabase Inc.</strong> (base de donn&eacute;es PostgreSQL h&eacute;berg&eacute;e aux &Eacute;tats-Unis).
                        </p>

                        {/* 3. Propri&eacute;t&eacute; intellectuelle */}
                        <h2 style={h2Style}>3. Propri&eacute;t&eacute; intellectuelle</h2>
                        <p>
                            L&apos;ensemble du contenu du site ai-visionary.com &mdash; textes, images, graphismes, logos,
                            ic&ocirc;nes, code source, algorithmes de scoring, protocoles de structuration &mdash; est prot&eacute;g&eacute;
                            par le droit d&apos;auteur et rel&egrave;ve de la l&eacute;gislation suisse et internationale sur
                            la propri&eacute;t&eacute; intellectuelle.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Les d&eacute;nominations suivantes sont des marques et/ou noms commerciaux d&apos;AI Visionary :
                        </p>
                        <ul style={ulStyle}>
                            <li><strong>AYO</strong> : agent IA de diagnostic de lisibilit&eacute; IA</li>
                            <li><strong>AYA</strong> : registre public d&apos;entit&eacute;s index&eacute;es et certifi&eacute;es</li>
                            <li><strong>AIO</strong> (AI-readability Intelligence Optimization) : score de lisibilit&eacute; IA de 0 &agrave; 100</li>
                            <li><strong>ASR</strong> (AI Singular Record) : fichier d&apos;identit&eacute; num&eacute;rique sign&eacute; cryptographiquement</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            Toute reproduction, repr&eacute;sentation, modification, publication ou adaptation de tout ou partie
                            des &eacute;l&eacute;ments du site, quel que soit le moyen ou le proc&eacute;d&eacute;, est interdite
                            sans l&apos;autorisation &eacute;crite pr&eacute;alable d&apos;AI Visionary.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Toute exploitation non autoris&eacute;e du site ou de ses contenus sera consid&eacute;r&eacute;e comme
                            constitutive d&apos;une contrefa&ccedil;on et poursuivie conform&eacute;ment aux dispositions des
                            articles 61 et suivants de la Loi f&eacute;d&eacute;rale sur le droit d&apos;auteur (LDA).
                        </p>

                        {/* 4. Donn&eacute;es du Registre AYA */}
                        <h2 style={h2Style}>4. Donn&eacute;es du Registre AYA</h2>
                        <p>
                            Le registre AYA contient des donn&eacute;es d&apos;entreprises collect&eacute;es &agrave; partir de sources
                            publiquement accessibles sur internet. Ces donn&eacute;es sont mises &agrave; disposition via une API ouverte
                            sous licence <strong>CC-BY-4.0</strong> (Creative Commons Attribution).
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Les scores AIO sont calcul&eacute;s automatiquement et ne constituent pas une &eacute;valuation commerciale,
                            financi&egrave;re ou qualitative de l&apos;entreprise concern&eacute;e. Ils mesurent exclusivement
                            le degr&eacute; de lisibilit&eacute; du site web par les syst&egrave;mes d&apos;intelligence artificielle.
                        </p>

                        {/* 5. Limitation de responsabilit&eacute; */}
                        <h2 style={h2Style}>5. Limitation de responsabilit&eacute;</h2>
                        <p>
                            AI Visionary s&apos;efforce de fournir des informations exactes et &agrave; jour sur le site
                            ai-visionary.com. Toutefois, AI Visionary ne peut garantir l&apos;exactitude, la compl&eacute;tude
                            ou l&apos;actualit&eacute; des informations diffus&eacute;es.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            En cons&eacute;quence, AI Visionary d&eacute;cline toute responsabilit&eacute; :
                        </p>
                        <ul style={ulStyle}>
                            <li>Pour toute impr&eacute;cision, inexactitude ou omission portant sur les informations du site.</li>
                            <li>Pour tout dommage direct ou indirect r&eacute;sultant de l&apos;utilisation du site ou de l&apos;impossibilit&eacute; d&apos;y acc&eacute;der.</li>
                            <li>Pour tout dommage r&eacute;sultant de l&apos;utilisation du score AIO &agrave; des fins commerciales, contractuelles ou juridiques.</li>
                            <li>Pour le contenu des sites tiers vers lesquels des liens hypertextes peuvent renvoyer depuis le site.</li>
                            <li>Pour toute interruption du service, qu&apos;elle soit volontaire (maintenance) ou involontaire (panne, force majeure).</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            Le diagnostic AIO et les fichiers ASR sont fournis &agrave; titre informatif et de structuration technique.
                            Ils ne constituent en aucun cas un conseil juridique, financier ou commercial.
                        </p>

                        {/* 6. Liens hypertextes */}
                        <h2 style={h2Style}>6. Liens hypertextes</h2>
                        <p>
                            Le site ai-visionary.com peut contenir des liens vers des sites tiers. AI Visionary n&apos;exerce
                            aucun contr&ocirc;le sur le contenu de ces sites et n&apos;assume aucune responsabilit&eacute; quant
                            &agrave; leur contenu ou leurs pratiques en mati&egrave;re de protection des donn&eacute;es.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            La cr&eacute;ation de liens hypertextes vers le site ai-visionary.com est libre, sous r&eacute;serve
                            de ne pas utiliser la technique du &laquo; framing &raquo; ou toute autre technique portant atteinte
                            &agrave; l&apos;image d&apos;AI Visionary.
                        </p>

                        {/* 7. Disponibilit&eacute; du service */}
                        <h2 style={h2Style}>7. Disponibilit&eacute; du service</h2>
                        <p>
                            AI Visionary s&apos;efforce d&apos;assurer la disponibilit&eacute; du site 24h/24 et 7j/7.
                            Cependant, l&apos;acc&egrave;s au site peut &ecirc;tre interrompu &agrave; tout moment, sans pr&eacute;avis,
                            pour des raisons de maintenance, de mise &agrave; jour ou pour toute autre raison technique.
                            AI Visionary ne saurait &ecirc;tre tenue responsable de ces interruptions.
                        </p>

                        {/* 8. Droit applicable */}
                        <h2 style={h2Style}>8. Droit applicable et juridiction comp&eacute;tente</h2>
                        <p>
                            Les pr&eacute;sentes mentions l&eacute;gales sont r&eacute;gies par le <strong>droit suisse</strong>.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Tout litige relatif &agrave; l&apos;interpr&eacute;tation ou &agrave; l&apos;ex&eacute;cution des pr&eacute;sentes
                            sera soumis &agrave; la comp&eacute;tence exclusive des <strong>tribunaux du canton de Gen&egrave;ve, Suisse</strong>,
                            sous r&eacute;serve des dispositions imp&eacute;ratives applicables aux consommateurs r&eacute;sidant dans
                            l&apos;Union europ&eacute;enne.
                        </p>

                        {/* 9. Cr&eacute;dits */}
                        <h2 style={h2Style}>9. Cr&eacute;dits</h2>
                        <ul style={ulStyle}>
                            <li>Conception et d&eacute;veloppement : <strong>AI Visionary</strong> (Cyril Leger), Gen&egrave;ve</li>
                            <li>H&eacute;bergement : <strong>Vercel Inc.</strong></li>
                            <li>Intelligence artificielle : <strong>Google Gemini</strong> (g&eacute;n&eacute;ration de contenu s&eacute;mantique)</li>
                            <li>Paiements : <strong>Stripe Inc.</strong></li>
                        </ul>

                        {/* 10. Contact */}
                        <h2 style={h2Style}>10. Contact</h2>
                        <p>
                            Pour toute question concernant les pr&eacute;sentes mentions l&eacute;gales :
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>AI Visionary</strong><br />
                            Cyril Leger<br />
                            Gen&egrave;ve, Suisse<br />
                            Email : <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a>
                        </p>

                        <p style={{ marginTop: '30px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Derni&egrave;re mise &agrave; jour : 25 mars 2026
                        </p>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
