import Link from 'next/link';
import Footer from '../components/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Politique de confidentialit\u00e9 | AI Visionary',
    description:
        'Politique de confidentialit\u00e9 d\'AI Visionary. Protection des donn\u00e9es, droits des utilisateurs (LPD suisse + RGPD), sous-traitants, cookies, dur\u00e9e de conservation.',
    openGraph: {
        title: 'Politique de confidentialit\u00e9 | AI Visionary',
        description:
            'D\u00e9couvrez comment AI Visionary prot\u00e8ge vos donn\u00e9es personnelles. Conforme \u00e0 la LPD suisse et au RGPD europ\u00e9en.',
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
                    &larr; Retour &agrave; l&apos;accueil
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">Politique de Confidentialit&eacute;</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                            AI Visionary s&apos;engage &agrave; prot&eacute;ger la vie priv&eacute;e de ses utilisateurs.
                            La pr&eacute;sente politique d&eacute;crit les donn&eacute;es personnelles que nous collectons,
                            comment nous les utilisons et les droits dont vous disposez.
                        </p>

                        {/* 1. Responsable du traitement */}
                        <h2 style={{ ...h2Style, marginTop: '10px' }}>1. Responsable du traitement</h2>
                        <p>
                            <strong>AI Visionary</strong><br />
                            Fond&eacute;e et dirig&eacute;e par Cyril Leger<br />
                            Gen&egrave;ve, Suisse<br />
                            Email : <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a><br />
                            Site : <a href="https://ai-visionary.com" style={{ color: 'var(--primary-color)' }}>ai-visionary.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            AI Visionary agit en qualit&eacute; de responsable du traitement au sens de la Loi f&eacute;d&eacute;rale
                            suisse sur la protection des donn&eacute;es (nLPD, entr&eacute;e en vigueur le 1er septembre 2023) et,
                            pour les utilisateurs r&eacute;sidant dans l&apos;Espace &eacute;conomique europ&eacute;en, au sens du
                            R&egrave;glement g&eacute;n&eacute;ral sur la protection des donn&eacute;es (RGPD &mdash; R&egrave;glement UE 2016/679).
                        </p>

                        {/* 2. Donn&eacute;es collect&eacute;es */}
                        <h2 style={h2Style}>2. Donn&eacute;es personnelles collect&eacute;es</h2>
                        <p>Dans le cadre de nos services, nous collectons les cat&eacute;gories de donn&eacute;es suivantes :</p>

                        <h3 style={h3Style}>2.1 Diagnostic AYO (chatbot IA)</h3>
                        <ul style={ulStyle}>
                            <li><strong>URL du site analys&eacute;</strong> : adresse web fournie par l&apos;utilisateur pour le diagnostic.</li>
                            <li><strong>R&eacute;ponses au questionnaire</strong> : informations d&eacute;claratives sur l&apos;entreprise (services, certifications, public cible, indicateurs, etc.).</li>
                            <li><strong>Donn&eacute;es extraites du site</strong> : contenu publiquement accessible (titre, m&eacute;ta-description, JSON-LD, sitemap).</li>
                            <li><strong>Score AIO calcul&eacute;</strong> : r&eacute;sultat du diagnostic de lisibilit&eacute; IA (score de 0 &agrave; 100).</li>
                        </ul>

                        <h3 style={h3Style}>2.2 Identification et contact</h3>
                        <ul style={ulStyle}>
                            <li><strong>Adresse email</strong> : utilis&eacute;e pour l&apos;envoi des r&eacute;sultats, l&apos;authentification (OTP) et les communications li&eacute;es au service.</li>
                            <li><strong>Nom de l&apos;entreprise</strong> : tel que d&eacute;clar&eacute; par l&apos;utilisateur ou d&eacute;tect&eacute; automatiquement sur le site analys&eacute;.</li>
                        </ul>

                        <h3 style={h3Style}>2.3 Paiement</h3>
                        <ul style={ulStyle}>
                            <li><strong>Informations de transaction</strong> : trait&eacute;es exclusivement par <strong>Stripe</strong> (certifi&eacute; PCI-DSS niveau 1). Nous ne stockons <strong>aucune donn&eacute;e de carte bancaire</strong>.</li>
                            <li>Seuls l&apos;identifiant client Stripe, le montant, la devise et le statut de la transaction sont conserv&eacute;s de notre c&ocirc;t&eacute;.</li>
                        </ul>

                        <h3 style={h3Style}>2.4 Registre AYA</h3>
                        <ul style={ulStyle}>
                            <li>Nom de l&apos;entreprise, secteur d&apos;activit&eacute;, pays, URL, score AIO, fichiers ASR g&eacute;n&eacute;r&eacute;s, mots-cl&eacute;s.</li>
                            <li>Ces donn&eacute;es sont <strong>publiquement accessibles</strong> dans le registre AYA, ce qui constitue la finalit&eacute; m&ecirc;me du service.</li>
                        </ul>

                        <h3 style={h3Style}>2.5 Donn&eacute;es techniques</h3>
                        <ul style={ulStyle}>
                            <li><strong>Adresse IP</strong> : utilis&eacute;e temporairement pour la s&eacute;curit&eacute; (rate limiting, pr&eacute;vention des abus). Non conserv&eacute;e au-del&agrave; de la session.</li>
                            <li><strong>Logs serveur</strong> : g&eacute;r&eacute;s par Vercel, conserv&eacute;s 30 jours maximum.</li>
                        </ul>

                        {/* 3. Bases l&eacute;gales */}
                        <h2 style={h2Style}>3. Bases l&eacute;gales du traitement</h2>
                        <p>Nous traitons vos donn&eacute;es sur les bases l&eacute;gales suivantes :</p>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Finalit&eacute;</th>
                                    <th style={thStyle}>Base l&eacute;gale</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={tdStyle}>R&eacute;alisation du diagnostic AIO</td>
                                    <td style={tdStyle}>Ex&eacute;cution du contrat (art. 6.1.b RGPD / art. 31 nLPD)</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Inscription au Registre AYA</td>
                                    <td style={tdStyle}>Ex&eacute;cution du contrat</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>G&eacute;n&eacute;ration et envoi des fichiers ASR</td>
                                    <td style={tdStyle}>Ex&eacute;cution du contrat</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Traitement du paiement</td>
                                    <td style={tdStyle}>Ex&eacute;cution du contrat / Obligation l&eacute;gale</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>S&eacute;curit&eacute; du service (rate limiting, logs)</td>
                                    <td style={tdStyle}>Int&eacute;r&ecirc;t l&eacute;gitime (art. 6.1.f RGPD)</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Am&eacute;lioration du service</td>
                                    <td style={tdStyle}>Int&eacute;r&ecirc;t l&eacute;gitime</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Indexation automatique dans le registre AYA (Bot AYA)</td>
                                    <td style={tdStyle}>Int&eacute;r&ecirc;t l&eacute;gitime (donn&eacute;es publiquement accessibles sur internet)</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 4. Sous-traitants */}
                        <h2 style={h2Style}>4. Sous-traitants et transferts de donn&eacute;es</h2>
                        <p>Nous faisons appel aux sous-traitants suivants pour fournir nos services :</p>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>Sous-traitant</th>
                                        <th style={thStyle}>Finalit&eacute;</th>
                                        <th style={thStyle}>Localisation</th>
                                        <th style={thStyle}>Garanties</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={tdStyle}><strong>Supabase Inc.</strong></td>
                                        <td style={tdStyle}>Base de donn&eacute;es PostgreSQL (analyses, registre AYA, sessions)</td>
                                        <td style={tdStyle}>&Eacute;tats-Unis</td>
                                        <td style={tdStyle}>DPA, SOC 2 Type II, chiffrement au repos et en transit</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Stripe Inc.</strong></td>
                                        <td style={tdStyle}>Traitement des paiements par carte bancaire</td>
                                        <td style={tdStyle}>&Eacute;tats-Unis / Irlande</td>
                                        <td style={tdStyle}>PCI-DSS niveau 1, clauses contractuelles types (CCT)</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Resend Inc.</strong></td>
                                        <td style={tdStyle}>Envoi d&apos;emails transactionnels (r&eacute;sultats, confirmations, OTP)</td>
                                        <td style={tdStyle}>&Eacute;tats-Unis</td>
                                        <td style={tdStyle}>DPA, chiffrement TLS</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Vercel Inc.</strong></td>
                                        <td style={tdStyle}>H&eacute;bergement du site web et des fonctions API serverless</td>
                                        <td style={tdStyle}>&Eacute;tats-Unis (CDN mondial)</td>
                                        <td style={tdStyle}>DPA, SOC 2 Type II, chiffrement HTTPS</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>Google LLC (Gemini)</strong></td>
                                        <td style={tdStyle}>G&eacute;n&eacute;ration de contenu s&eacute;mantique (FAQ, glossaire, descriptions enrichies via IA)</td>
                                        <td style={tdStyle}>&Eacute;tats-Unis</td>
                                        <td style={tdStyle}>DPA Google Cloud, donn&eacute;es anonymis&eacute;es avant transmission</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: '15px' }}>
                            Certains sous-traitants sont situ&eacute;s en dehors de la Suisse et de l&apos;Espace &eacute;conomique europ&eacute;en (EEE).
                            Les transferts de donn&eacute;es sont encadr&eacute;s par des clauses contractuelles types (CCT) approuv&eacute;es
                            par la Commission europ&eacute;enne et/ou des d&eacute;cisions d&apos;ad&eacute;quation, conform&eacute;ment
                            aux articles 16-17 de la nLPD et au chapitre V du RGPD.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Vos donn&eacute;es ne sont <strong>jamais revendues &agrave; des tiers</strong>. Elles ne sont transmises
                            aux sous-traitants que dans la mesure strictement n&eacute;cessaire &agrave; la fourniture du service.
                        </p>

                        {/* 5. Cookies */}
                        <h2 style={h2Style}>5. Cookies et technologies de suivi</h2>
                        <p>AI Visionary adopte une approche <strong>minimaliste</strong> en mati&egrave;re de cookies :</p>
                        <ul style={ulStyle}>
                            <li><strong>Cookies strictement n&eacute;cessaires</strong> : cookies techniques d&eacute;pos&eacute;s par Vercel
                                pour le fonctionnement de l&apos;application (routage, session). Ils ne n&eacute;cessitent pas de consentement
                                conform&eacute;ment &agrave; l&apos;art. 45c al. 2 LTC et &agrave; l&apos;art. 5(3) de la directive ePrivacy.</li>
                            <li><strong>Cookies de paiement</strong> : Stripe peut d&eacute;poser des cookies techniques lors du processus
                                de paiement pour la pr&eacute;vention de la fraude.</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            Nous n&apos;utilisons <strong>aucun cookie de tra&ccedil;age, publicitaire ou analytique</strong>.
                            Aucun Google Analytics, Facebook Pixel, ni traceur tiers n&apos;est pr&eacute;sent sur ce site.
                        </p>

                        {/* 6. Dur&eacute;e de conservation */}
                        <h2 style={h2Style}>6. Dur&eacute;e de conservation des donn&eacute;es</h2>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Type de donn&eacute;es</th>
                                    <th style={thStyle}>Dur&eacute;e de conservation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={tdStyle}>Analyses et diagnostics AYO</td>
                                    <td style={tdStyle}>2 ans apr&egrave;s la derni&egrave;re interaction</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Registre AYA (Pack Plateforme &mdash; abonnement)</td>
                                    <td style={tdStyle}>Dur&eacute;e de l&apos;abonnement actif + 30 jours apr&egrave;s r&eacute;siliation</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Registre AYA (Pack PRO)</td>
                                    <td style={tdStyle}>3 ans + 30 jours apr&egrave;s expiration</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Registre AYA (entit&eacute;s index&eacute;es par le bot)</td>
                                    <td style={tdStyle}>Ind&eacute;finie (donn&eacute;es publiques). Suppression sur demande sous 72h.</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Logs syst&egrave;me et s&eacute;curit&eacute;</td>
                                    <td style={tdStyle}>90 jours</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Codes OTP (authentification)</td>
                                    <td style={tdStyle}>10 minutes (expiration automatique)</td>
                                </tr>
                                <tr>
                                    <td style={tdStyle}>Donn&eacute;es de facturation</td>
                                    <td style={tdStyle}>10 ans (obligations l&eacute;gales comptables suisses)</td>
                                </tr>
                            </tbody>
                        </table>
                        <p style={{ marginTop: '10px' }}>
                            &Agrave; l&apos;expiration de ces d&eacute;lais, les donn&eacute;es sont supprim&eacute;es ou anonymis&eacute;es de mani&egrave;re irr&eacute;versible.
                        </p>

                        {/* 7. S&eacute;curit&eacute; */}
                        <h2 style={h2Style}>7. S&eacute;curit&eacute; des donn&eacute;es</h2>
                        <p>Nous mettons en oeuvre les mesures techniques et organisationnelles suivantes :</p>
                        <ul style={ulStyle}>
                            <li>Chiffrement HTTPS (TLS 1.3) pour toutes les communications.</li>
                            <li>Chiffrement au repos des donn&eacute;es en base de donn&eacute;es (Supabase / PostgreSQL).</li>
                            <li>Signature cryptographique Ed25519 des fichiers ASR pour garantir leur authenticit&eacute; et leur int&eacute;grit&eacute;.</li>
                            <li>Authentification par code &agrave; usage unique (OTP) envoy&eacute; par email.</li>
                            <li>Protection contre les attaques SSRF, les injections et la force brute (rate limiting).</li>
                            <li>Acc&egrave;s aux donn&eacute;es limit&eacute; au strict n&eacute;cessaire (principe du moindre privil&egrave;ge).</li>
                            <li>Aucun stockage de mots de passe (authentification sans mot de passe par OTP).</li>
                        </ul>

                        {/* 8. Vos droits */}
                        <h2 style={h2Style}>8. Vos droits</h2>
                        <p>
                            Conform&eacute;ment &agrave; la nLPD suisse et au RGPD (pour les r&eacute;sidents de l&apos;EEE),
                            vous disposez des droits suivants :
                        </p>
                        <ul style={ulStyle}>
                            <li><strong>Droit d&apos;acc&egrave;s</strong> (art. 25 nLPD / art. 15 RGPD) : obtenir une copie de vos donn&eacute;es personnelles et des informations sur leur traitement.</li>
                            <li><strong>Droit de rectification</strong> (art. 32 nLPD / art. 16 RGPD) : faire corriger des donn&eacute;es inexactes ou incompl&egrave;tes.</li>
                            <li><strong>Droit &agrave; l&apos;effacement</strong> (art. 17 RGPD) : demander la suppression de vos donn&eacute;es lorsqu&apos;elles ne sont plus n&eacute;cessaires au traitement.</li>
                            <li><strong>Droit &agrave; la portabilit&eacute;</strong> (art. 28 nLPD / art. 20 RGPD) : recevoir vos donn&eacute;es dans un format structur&eacute; et lisible par machine (JSON).</li>
                            <li><strong>Droit d&apos;opposition</strong> (art. 21 RGPD) : vous opposer au traitement fond&eacute; sur l&apos;int&eacute;r&ecirc;t l&eacute;gitime.</li>
                            <li><strong>Droit &agrave; la limitation du traitement</strong> (art. 18 RGPD) : demander la restriction du traitement dans certaines circonstances.</li>
                            <li><strong>Droit au retrait du consentement</strong> : retirer votre consentement &agrave; tout moment, sans affecter la lic&eacute;it&eacute; du traitement ant&eacute;rieur.</li>
                        </ul>

                        <h3 style={h3Style}>Comment exercer vos droits</h3>
                        <p>
                            Adressez votre demande par email &agrave; <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a> en
                            pr&eacute;cisant votre identit&eacute; et la nature de votre demande. Nous r&eacute;pondrons dans un d&eacute;lai
                            de <strong>30 jours</strong> (extensible &agrave; 60 jours en cas de demande complexe, avec notification pr&eacute;alable).
                        </p>

                        <h3 style={h3Style}>R&eacute;clamation aupr&egrave;s d&apos;une autorit&eacute; de surveillance</h3>
                        <p>Si vous estimez que vos droits ne sont pas respect&eacute;s, vous pouvez introduire une r&eacute;clamation aupr&egrave;s de :</p>
                        <ul style={ulStyle}>
                            <li><strong>Suisse</strong> : Pr&eacute;pos&eacute; f&eacute;d&eacute;ral &agrave; la protection des donn&eacute;es et &agrave; la transparence (PFPDT) &mdash; <a href="https://www.edoeb.admin.ch" style={{ color: 'var(--primary-color)' }} target="_blank" rel="noopener noreferrer">edoeb.admin.ch</a></li>
                            <li><strong>Union europ&eacute;enne / EEE</strong> : l&apos;autorit&eacute; de contr&ocirc;le comp&eacute;tente de votre pays de r&eacute;sidence.</li>
                        </ul>

                        {/* 9. Bot AYA */}
                        <h2 style={h2Style}>9. Indexation automatique (Bot AYA)</h2>
                        <p>
                            Le registre AYA peut indexer automatiquement des entreprises &agrave; partir de donn&eacute;es
                            <strong> publiquement accessibles</strong> sur internet (contenu de sites web, donn&eacute;es JSON-LD,
                            sitemaps). Ce traitement est fond&eacute; sur notre int&eacute;r&ecirc;t l&eacute;gitime &agrave;
                            constituer un registre de r&eacute;f&eacute;rence pour les agents IA (art. 6.1.f RGPD).
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Si votre entreprise est index&eacute;e dans le registre AYA et que vous souhaitez la retirer,
                            envoyez un email &agrave; <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a> en
                            indiquant l&apos;URL concern&eacute;e. La suppression sera effectu&eacute;e sous <strong>72 heures</strong>.
                        </p>

                        {/* 10. Mineurs */}
                        <h2 style={h2Style}>10. Protection des mineurs</h2>
                        <p>
                            Nos services s&apos;adressent exclusivement aux professionnels et entreprises. Nous ne collectons
                            pas sciemment de donn&eacute;es concernant des personnes de moins de 16 ans. Si vous constatez qu&apos;un
                            mineur a fourni des donn&eacute;es personnelles, contactez-nous pour leur suppression imm&eacute;diate.
                        </p>

                        {/* 11. Modifications */}
                        <h2 style={h2Style}>11. Modifications de cette politique</h2>
                        <p>
                            Nous nous r&eacute;servons le droit de modifier cette politique de confidentialit&eacute; &agrave; tout moment.
                            Les modifications entrent en vigueur d&egrave;s leur publication sur cette page.
                            En cas de modification substantielle, nous en informerons les utilisateurs concern&eacute;s par email.
                        </p>

                        {/* 12. Droit applicable */}
                        <h2 style={h2Style}>12. Droit applicable et for juridique</h2>
                        <p>
                            La pr&eacute;sente politique de confidentialit&eacute; est soumise au <strong>droit suisse</strong>,
                            en particulier &agrave; la Loi f&eacute;d&eacute;rale sur la protection des donn&eacute;es (nLPD).
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Pour les utilisateurs r&eacute;sidant dans l&apos;Union europ&eacute;enne ou l&apos;Espace &eacute;conomique
                            europ&eacute;en, les dispositions du RGPD s&apos;appliquent en compl&eacute;ment.
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            Tout litige relatif &agrave; la protection des donn&eacute;es sera soumis aux tribunaux comp&eacute;tents
                            du <strong>canton de Gen&egrave;ve, Suisse</strong>, sous r&eacute;serve des r&egrave;gles imp&eacute;ratives
                            de comp&eacute;tence applicables aux consommateurs r&eacute;sidant dans l&apos;UE/EEE.
                        </p>

                        {/* 13. Contact */}
                        <h2 style={h2Style}>13. Contact</h2>
                        <p>
                            Pour toute question relative &agrave; la protection de vos donn&eacute;es personnelles ou pour exercer vos droits :
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>AI Visionary &mdash; Protection des donn&eacute;es</strong><br />
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
