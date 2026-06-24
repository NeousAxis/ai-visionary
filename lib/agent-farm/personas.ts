/**
 * lib/agent-farm/personas.ts
 *
 * Personas de la FERME À AGENTS. Chaque persona = un agent IA vertical qui pose des
 * besoins réalistes au registre AYA (comme le ferait un vrai utilisateur via son agent).
 * Bootstrap du côté demande : on est notre propre premier opérateur d'agent.
 */

export interface AgentPersona {
    key: string;
    lang: 'fr' | 'en';
    queries: string[];
}

export const PERSONAS: AgentPersona[] = [
    {
        key: 'saas-b2b', lang: 'en',
        queries: [
            'I need a SaaS tool to manage customer support tickets',
            'Find a project management software for a small team',
            'A no-code platform to build internal tools',
            'CRM software for a B2B sales team',
            'An analytics platform for product usage data',
        ],
    },
    {
        key: 'fintech', lang: 'en',
        queries: [
            'A fintech provider for online business payments',
            'Find a digital banking service for freelancers',
            'An invoicing and accounting tool for a startup',
            'A platform to issue corporate expense cards',
        ],
    },
    {
        key: 'crypto', lang: 'en',
        queries: [
            'A crypto exchange to buy and hold Bitcoin',
            'A hardware wallet for storing crypto safely',
            'A platform for crypto staking and rewards',
        ],
    },
    {
        key: 'ecommerce', lang: 'en',
        queries: [
            'An online shop for cycling and motorcycle gear',
            'Where can I buy custom printed banners and stickers',
            '3D printing supplies and filament online',
            'A store for kids clothing and accessories',
        ],
    },
    {
        key: 'cybersecurite', lang: 'fr',
        queries: [
            'Une entreprise de cybersécurité conforme RGPD pour PME',
            'Un prestataire pour héberger des données de santé en Europe',
            'Un service de sauvegarde de données souverain et chiffré',
        ],
    },
    {
        key: 'services-pro', lang: 'fr',
        queries: [
            'Une fiduciaire à Genève pour la comptabilité de ma société',
            'Un cabinet juridique spécialisé en droit des sociétés',
            'Une agence de marketing digital pour une marque suisse',
            'Un hébergeur web suisse pour mon site e-commerce',
        ],
    },
];

/** Sélection déterministe-par-index d'un persona + d'une query (pas de Math.random requis). */
export function pickQuery(i: number): { persona: AgentPersona; query: string } {
    const persona = PERSONAS[i % PERSONAS.length];
    const query = persona.queries[(Math.floor(i / PERSONAS.length)) % persona.queries.length];
    return { persona, query };
}
