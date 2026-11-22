// lib/aya/ask/geo.ts
//
// Situe une ville sur la carte. Suisse : géocodeur fédéral swisstopo
// (données ouvertes, hébergé en Suisse). Ailleurs : Nominatim (OpenStreetMap).
// Seuls des noms de villes sont envoyés, jamais une donnée personnelle.
// Résultats gardés en mémoire 7 jours pour ne pas solliciter ces services.

export type GeoPoint = { lat: number; lon: number; label: string };

const UA = 'AI-Visionary-AYA/1.0 (+https://ai-visionary.xyz)';
const TTL_MS = 7 * 24 * 3600 * 1000;
const cache = new Map<string, { v: GeoPoint | null; exp: number }>();

async function fetchJson(url: string, timeoutMs = 3_500): Promise<any> {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`geo ${res.status}`);
    return res.json();
}

async function swisstopo(city: string): Promise<GeoPoint | null> {
    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?type=locations&origins=gg25,zipcode&limit=1&searchText=${encodeURIComponent(city)}`;
    const j = await fetchJson(url);
    const a = j?.results?.[0]?.attrs;
    if (!a || typeof a.lat !== 'number' || typeof a.lon !== 'number') return null;
    const label = String(a.label || city).replace(/<[^>]+>/g, '').trim();
    return { lat: a.lat, lon: a.lon, label };
}

// Nominatim demande au plus une requête par seconde : les appels passent en file.
let nominatimChain: Promise<unknown> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>): Promise<T> {
    const run = nominatimChain.then(() => new Promise((r) => setTimeout(r, 1100))).then(fn);
    nominatimChain = run.catch(() => undefined);
    return run;
}

/** Vrai si la ville est déjà située (aucun appel réseau nécessaire). */
export function isGeocoded(city: string | null | undefined, country: string | null | undefined): boolean {
    const c = (city || '').trim();
    const hit = cache.get(`${c.toLowerCase()}|${(country || '').toUpperCase()}`);
    return !!hit && hit.exp > Date.now();
}

async function nominatim(city: string, country: string | null): Promise<GeoPoint | null> {
    return throttled(() => nominatimRaw(city, country));
}

async function nominatimRaw(city: string, country: string | null): Promise<GeoPoint | null> {
    const cc = country && /^[A-Z]{2}$/.test(country) ? `&countrycodes=${country.toLowerCase()}` : '';
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}${cc}`;
    const j = await fetchJson(url);
    const r = Array.isArray(j) ? j[0] : null;
    if (!r) return null;
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, label: city };
}

export async function geocodeCity(city: string | null | undefined, country: string | null | undefined): Promise<GeoPoint | null> {
    const c = (city || '').trim();
    if (c.length < 2 || c.length > 80) return null;
    const cc = (country || '').toUpperCase();
    const key = `${c.toLowerCase()}|${cc}`;
    const hit = cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.v;
    let v: GeoPoint | null = null;
    try {
        v = cc === 'CH' || cc === '' ? await swisstopo(c) : null;
        // Le lieu trouvé doit porter le nom demandé ("Stockholm" ne doit pas
        // devenir un hameau suisse, "Suisse romande" pas "Romont").
        const first = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
        if (v && first(v.label) !== first(c)) v = null;
        if (!v && cc !== 'CH') v = await nominatim(c, cc || null);
    } catch (err) {
        console.warn('[aya/ask] geocode failed:', c, (err as Error)?.message);
        return null; // échec réseau : pas mis en cache, on réessaiera
    }
    cache.set(key, { v, exp: Date.now() + TTL_MS });
    return v;
}

/** Distance à vol d'oiseau, en kilomètres. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}
