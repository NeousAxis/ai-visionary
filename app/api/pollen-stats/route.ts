import { NextResponse } from 'next/server';

// Compteur RÉEL du registre AYA (Postgres VPS), exposé à la page Pollen Agents.
// On lit l'API publique prod (qui lit le VPS) côté serveur — donc aucune dépendance
// à Supabase, et un vrai chiffre même en dev local (où le Postgres VPS est injoignable).
export const revalidate = 600; // cache 10 min

export async function GET() {
  try {
    const res = await fetch('https://ai-visionary.xyz/api/aya/stats', {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error('upstream ' + res.status);
    const d = await res.json();
    return NextResponse.json({
      total_entities:
        typeof d.total_entities === 'number' ? d.total_entities : null,
      countries_count: Array.isArray(d.countries) ? d.countries.length : null,
    });
  } catch {
    return NextResponse.json({ total_entities: null, countries_count: null });
  }
}
