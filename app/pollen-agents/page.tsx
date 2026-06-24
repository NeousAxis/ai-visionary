'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Footer from '@/app/components/Footer';

interface SearchResult {
  name: string;
  domain: string;
  country?: string;
  sector?: string;
  score: number;
  certified: boolean;
  entity_id: string;
  url: string;
  cashback?: { type: string; value: number; currency: string };
}

interface Stats {
  total: number;
  countries: number;
}

type Copy = {
  badge: string;
  kicker: string;
  title: string;
  tagline: string;
  sub: string;
  statIndexed: string;
  statSources: string;
  statCountries: string;
  demoTitle: string;
  demoHint: string;
  placeholder: string;
  searchBtn: string;
  searching: string;
  agentLabel: string;
  poweredBy: string;
  thinking: string;
  noResults: string;
  certified: string;
  cashbackBadge: string;
  pilot: string;
  scoreLabel: string;
  whyTitle: string;
  why: { t: string; d: string }[];
  devTitle: string;
  devSub: string;
  devOpen: string;
  howTitle: string;
  howSteps: { t: string; d: string }[];
  howFlywheel: string;
};

const COPY: Record<string, Copy> = {
  en: {
    badge: 'Pollen Agents · powered by AI Visionary',
    kicker: 'Nobody searches anymore. They ask the AI.',
    title: 'Your agent makes money for you!',
    tagline:
      'The first sovereign marketplace where AI agents find the best answer!',
    sub: "Millions already ask an AI what to buy, and from whom. If you're not in Pollen, the AI doesn't even know you exist. Here, agents find you, recommend you and bring you paying customers — you pay only on a real sale, and the buyer walks away with cashback. Random ads are over.",
    statIndexed: 'indexed companies',
    statSources: 'data sources',
    statCountries: 'countries',
    demoTitle: 'Query the registry — as an agent would',
    demoHint: 'Type a need: a sector, a service, a country.',
    placeholder: 'e.g. cybersecurity, Geneva, fiduciary…',
    searchBtn: 'Ask',
    searching: '…',
    agentLabel: 'The agent answers',
    poweredBy: 'Infomaniak AI · Ministral (Switzerland)',
    thinking: 'The agent is querying the registry and writing its recommendation…',
    noResults: 'No verified entity found for this query.',
    certified: 'ASR-certified',
    cashbackBadge: 'cashback',
    pilot: 'Pilot · early access — cashback is rolling out vertical by vertical.',
    scoreLabel: 'AIO',
    whyTitle: 'Why an agent calls Pollen rather than a web search',
    why: [
      {
        t: 'Verified identity',
        d: 'Entities anchored to legal registries — not anonymous web text.',
      },
      {
        t: 'Structured & comparable',
        d: 'Normalized records an agent can compare directly, field by field.',
      },
      {
        t: 'Signed & auditable',
        d: 'ASR signatures (Ed25519) — a choice an agent can stand behind.',
      },
      {
        t: 'Sovereign',
        d: 'European, no ad-ranking, no training on your data.',
      },
    ],
    devTitle: 'Connect your agent',
    devSub: 'The same registry, agent-ready. REST + JSON, cached at the edge.',
    devOpen: 'Discovery is open and permissionless — query freely.',
    howTitle: 'How it works',
    howSteps: [
      {
        t: '1 · Your business is indexed in AYA',
        d: 'AI agents read it — structured, signed, sovereign. Not buried under marketing copy.',
      },
      {
        t: '2 · An agent finds you',
        d: 'When a user asks their AI for a service, the agent queries Pollen and picks a verified business — not a random web result.',
      },
      {
        t: '3 · A purchase triggers cashback',
        d: 'On a confirmed purchase, a cashback is paid — funded by the business, because it gained a customer. That reward is what brings the agents.',
      },
    ],
    howFlywheel:
      'The more real customers agents bring, the more they earn. The flywheel runs on real purchases — no fake traffic, no burn.',
  },
  fr: {
    badge: 'Pollen Agents · propulsé par AI Visionary',
    kicker: "On ne cherche plus. On demande à l'IA.",
    title: "Votre agent gagne de l'argent pour vous !",
    tagline:
      'La première place de marché souveraine où les agents IA trouvent la meilleure réponse !',
    sub: "Des millions de gens demandent déjà à une IA quoi acheter, et à qui. Si vous n'êtes pas dans Pollen, l'IA ignore jusqu'à votre existence. Ici, les agents vous trouvent, vous recommandent et vous amènent des clients qui paient — vous ne payez que sur une vente réelle, et l'acheteur repart avec du cashback. La pub au hasard, c'est fini.",
    statIndexed: 'entreprises indexées',
    statSources: 'sources de données',
    statCountries: 'pays',
    demoTitle: 'Interroge le registre — comme le ferait un agent',
    demoHint: 'Tape un besoin : un secteur, un service, un pays.',
    placeholder: 'ex. cybersécurité, Genève, fiduciaire…',
    searchBtn: 'Demander',
    searching: '…',
    agentLabel: "L'agent répond",
    poweredBy: 'Infomaniak AI · Ministral (Suisse)',
    thinking: "L'agent interroge le registre et rédige sa recommandation…",
    noResults: 'Aucune entité vérifiée trouvée pour cette requête.',
    certified: 'certifiée ASR',
    cashbackBadge: 'cashback',
    pilot: 'Pilote · accès anticipé — le cashback se déploie verticale par verticale.',
    scoreLabel: 'AIO',
    whyTitle: "Pourquoi un agent appelle Pollen plutôt que son moteur de recherche",
    why: [
      {
        t: 'Identité vérifiée',
        d: 'Entités ancrées aux registres légaux — pas du texte web anonyme.',
      },
      {
        t: 'Structuré & comparable',
        d: "Des fiches normalisées qu'un agent compare directement, champ par champ.",
      },
      {
        t: 'Signé & auditable',
        d: "Signatures ASR (Ed25519) — un choix dont l'agent peut répondre.",
      },
      {
        t: 'Souverain',
        d: 'Européen, sans classement publicitaire, sans entraînement sur tes données.',
      },
    ],
    devTitle: 'Branche ton agent',
    devSub: 'Le même registre, prêt pour les agents. REST + JSON, caché à la périphérie.',
    devOpen: 'La découverte est ouverte et sans permission — interroge librement.',
    howTitle: 'Comment ça marche',
    howSteps: [
      {
        t: '1 · Ton entreprise est indexée dans AYA',
        d: 'Les agents IA la lisent — structurée, signée, souveraine. Pas noyée sous le marketing.',
      },
      {
        t: '2 · Un agent te trouve',
        d: "Quand un utilisateur demande un service à son IA, l'agent interroge Pollen et choisit une entreprise vérifiée — pas un résultat web au hasard.",
      },
      {
        t: "3 · L'achat déclenche un cashback",
        d: "À l'achat confirmé, un cashback est versé — financé par l'entreprise, car elle a gagné un client. C'est cette récompense qui fait venir les agents.",
      },
    ],
    howFlywheel:
      "Plus les agents amènent de vrais clients, plus ils gagnent. Le flywheel tourne sur de vrais achats — pas de faux trafic, pas de cash brûlé.",
  },
};

function formatBig(n: number): string {
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    const hundreds = Math.floor((n % 1000) / 100) * 100;
    return `${thousands}'${hundreds.toString().padStart(3, '0').slice(0, -2)}00+`;
  }
  return `${n}+`;
}

export default function PollenAgentsPage() {
  const locale = useLocale();
  const c = COPY[locale] ?? COPY.en;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/pollen-stats')
      .then((r) => r.json())
      .then((d) => {
        if (
          typeof d.total_entities === 'number' &&
          typeof d.countries_count === 'number'
        ) {
          setStats({ total: d.total_entities, countries: d.countries_count });
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/pollen-agents/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, locale }),
      });
      const data = await res.json();
      setResults(Array.isArray(data.picks) ? data.picks : []);
      setAnswer(typeof data.answer === 'string' ? data.answer : null);
    } catch {
      setResults([]);
      setAnswer(null);
    }
    setLoading(false);
  };

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh' }}>
      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '56px 20px 24px',
        }}
      >
        {/* Hero */}
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--primary-color)',
            background: 'var(--bg-accent)',
            border: '1px solid var(--border-light)',
            borderRadius: '999px',
            padding: '6px 14px',
            marginBottom: '22px',
          }}
        >
          🐝 {c.badge}
        </span>

        <p
          style={{
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            margin: '0 0 18px',
          }}
        >
          {c.pilot}
        </p>

        <p
          style={{
            fontSize: 'clamp(1rem, 2.2vw, 1.3rem)',
            fontWeight: 600,
            color: 'var(--text-muted)',
            margin: '0 0 10px',
          }}
        >
          {c.kicker}
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-outfit), sans-serif',
            fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
            lineHeight: 1.05,
            color: 'var(--text-main)',
            margin: '0 0 16px',
          }}
        >
          {c.title}
        </h1>
        <p
          style={{
            fontSize: 'clamp(1.1rem, 2.2vw, 1.45rem)',
            fontWeight: 600,
            color: 'var(--text-body)',
            maxWidth: '760px',
            margin: '0 0 14px',
          }}
        >
          {c.tagline}
        </p>
        <p
          style={{
            fontSize: '1.02rem',
            color: 'var(--text-muted)',
            maxWidth: '720px',
            margin: '0 0 32px',
            lineHeight: 1.6,
          }}
        >
          {c.sub}
        </p>

        {/* Stats — compteur RÉEL du registre (VPS via /api/pollen-stats), zéro Supabase */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '48px',
          }}
        >
          {[
            { v: stats ? formatBig(stats.total) : '…', label: c.statIndexed },
            { v: '4', label: c.statSources },
            { v: stats ? `${stats.countries}+` : '…', label: c.statCountries },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md, 14px)',
                padding: '16px 22px',
                minWidth: '140px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-outfit), sans-serif',
                  fontSize: '1.7rem',
                  fontWeight: 700,
                  color: 'var(--primary-color)',
                }}
              >
                {s.v}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Concept — comment ça marche */}
        <section style={{ marginBottom: '56px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-outfit), sans-serif',
              fontSize: '1.6rem',
              color: 'var(--text-main)',
              margin: '0 0 22px',
            }}
          >
            {c.howTitle}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
            }}
          >
            {c.howSteps.map((s, i) => (
              <div
                key={i}
                style={{
                  background: 'white',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md, 14px)',
                  padding: '22px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-outfit), sans-serif',
                    fontWeight: 700,
                    color: 'var(--primary-color)',
                    marginBottom: '8px',
                  }}
                >
                  {s.t}
                </div>
                <div
                  style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-body)',
                    lineHeight: 1.6,
                  }}
                >
                  {s.d}
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              marginTop: '18px',
              marginBottom: 0,
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              background: 'var(--bg-accent)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md, 14px)',
              padding: '18px 22px',
            }}
          >
            🐝 {c.howFlywheel}
          </p>
        </section>

        {/* Live demo */}
        <section style={{ marginBottom: '56px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-outfit), sans-serif',
              fontSize: '1.6rem',
              color: 'var(--text-main)',
              margin: '0 0 6px',
            }}
          >
            {c.demoTitle}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 18px' }}>
            {c.demoHint}
          </p>

          <form
            onSubmit={handleSearch}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={c.placeholder}
              style={{
                flex: '1 1 320px',
                padding: '14px 18px',
                fontSize: '1rem',
                fontFamily: 'var(--font-inter), sans-serif',
                color: 'var(--text-main)',
                border: '2px solid var(--border-light)',
                borderRadius: 'var(--radius-sm, 10px)',
                outline: 'none',
                background: 'white',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px 28px',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-sm, 10px)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? c.searching : `${c.searchBtn} →`}
            </button>
          </form>

          {/* Agent answer — Infomaniak AI */}
          {(loading || answer) && (
            <div
              style={{
                marginTop: '24px',
                padding: '20px 22px',
                background: 'var(--bg-accent)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md, 14px)',
              }}
            >
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--primary-color)',
                  marginBottom: '10px',
                }}
              >
                🐝 {c.agentLabel} · {c.poweredBy}
              </div>
              <div
                style={{
                  fontSize: '1.02rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  fontStyle: loading ? 'italic' : 'normal',
                  opacity: loading ? 0.75 : 1,
                }}
              >
                {loading ? c.thinking : answer}
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px',
                marginTop: '26px',
              }}
            >
              {results.map((r) => (
                <a
                  key={r.entity_id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '18px',
                    background: 'white',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md, 14px)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      '0 8px 24px rgba(33,46,83,0.10)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      marginBottom: '3px',
                    }}
                  >
                    {r.name || r.domain}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-muted)',
                      marginBottom: '12px',
                    }}
                  >
                    {r.domain}
                    {r.sector ? ` · ${r.sector}` : ''}
                    {r.country ? ` · ${r.country}` : ''}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-outfit), sans-serif',
                        fontWeight: 700,
                        color: 'var(--primary-color)',
                      }}
                    >
                      {r.score}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          marginLeft: '3px',
                        }}
                      >
                        /100 {c.scoreLabel}
                      </span>
                    </span>
                    {r.certified && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--accent-color)',
                          background: 'var(--bg-accent)',
                          borderRadius: '999px',
                          padding: '3px 10px',
                        }}
                      >
                        ✓ {c.certified}
                      </span>
                    )}
                    {r.cashback && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'white',
                          background: 'var(--primary-color)',
                          borderRadius: '999px',
                          padding: '3px 10px',
                        }}
                      >
                        🍯{' '}
                        {r.cashback.type === 'percent'
                          ? `${r.cashback.value}%`
                          : `${r.cashback.value} ${r.cashback.currency}`}{' '}
                        {c.cashbackBadge}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <p
              style={{
                color: 'var(--text-muted)',
                marginTop: '24px',
              }}
            >
              {c.noResults}
            </p>
          )}
        </section>

        {/* Why */}
        <section style={{ marginBottom: '56px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-outfit), sans-serif',
              fontSize: '1.6rem',
              color: 'var(--text-main)',
              margin: '0 0 22px',
            }}
          >
            {c.whyTitle}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '14px',
            }}
          >
            {c.why.map((w, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-accent)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md, 14px)',
                  padding: '20px',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: '6px',
                  }}
                >
                  {w.t}
                </div>
                <div
                  style={{
                    fontSize: '0.92rem',
                    color: 'var(--text-body)',
                    lineHeight: 1.55,
                  }}
                >
                  {w.d}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Developers */}
        <section style={{ marginBottom: '40px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-outfit), sans-serif',
              fontSize: '1.6rem',
              color: 'var(--text-main)',
              margin: '0 0 6px',
            }}
          >
            {c.devTitle}
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 6px' }}>
            {c.devSub}
          </p>
          <p
            style={{
              color: 'var(--text-body)',
              fontSize: '0.92rem',
              margin: '0 0 18px',
            }}
          >
            {c.devOpen}
          </p>
          <pre
            style={{
              background: 'var(--text-main)',
              color: '#E2EFE9',
              padding: '20px',
              borderRadius: 'var(--radius-md, 14px)',
              overflowX: 'auto',
              fontSize: '0.85rem',
              lineHeight: 1.7,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            }}
          >
            <code>
              {`# Search verified entities (open, permissionless)
curl "https://ai-visionary.xyz/api/aya/search?q=cybersecurity&limit=10"

# Get one entity, LLM-optimized + signed key id
curl "https://ai-visionary.xyz/api/aya/llm/anthropic.com"`}
            </code>
          </pre>
        </section>
      </div>

      <Footer />
    </div>
  );
}
