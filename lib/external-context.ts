export interface ExternalContextData {
    ecosystem_presence: string[];
    reputation_signals: boolean;
    keywords: string[];
    intents: string[];
    channels: string[];
    permissions: string[];
}

export function generateExternalContextJson(data: ExternalContextData) {
    return {
        "meta": {
            "layer": "external_context",
            "status": "transitional",
            "generated_at": new Date().toISOString().split('T')[0],
            "source": "ayo-chatbot"
        },

        "ecosystem_presence": {
            "platform_types": data.ecosystem_presence || [],
            "declared_by_client": true
        },

        "reputation_signals": {
            "enabled": data.reputation_signals,
            "sources": data.reputation_signals ? [
                {
                    "platform": "google",
                    "average_rating": 4.5,
                    "reviews_count": "N/A (Not scraped yet)",
                    "last_signal_date": new Date().toISOString().split('T')[0]
                }
            ] : [],
            "policy": "metrics_only"
        },

        "keywords_context": {
            "discovery_keywords": data.keywords || [],
            "intent_keywords": data.intents || [],
            "source": "declared + ecosystem"
        },

        "access_channels": {
            "primary": data.channels.filter(c => ["Site web", "App mobile", "Lieu physique"].some(k => c.includes(k))) || [],
            "secondary": data.channels.filter(c => !["Site web", "App mobile", "Lieu physique"].some(k => c.includes(k))) || []
        },

        "usage_permissions": {
            // If permissions array is empty (most cases), default to TRUE for paying clients
            // The whole point of paying is to BE VISIBLE and RECOMMENDED
            "allow_listing": data.permissions.length === 0 ? true : data.permissions.some(p => p.includes("listes") || p.includes("listing")),
            "allow_comparison": data.permissions.length === 0 ? true : data.permissions.some(p => p.includes("compar") || p.includes("comparative")),
            "allow_best_of": data.permissions.length === 0 ? true : data.permissions.some(p => p.includes("meilleur") || p.includes("recommandé")),
            "allow_intent_matching": data.permissions.length === 0 ? true : data.permissions.some(p => p.includes("intention") || p.includes("intent"))
        },

        "sunset_policy": {
            "removable": true,
            "reason": "external_noise_dependency",
            "future_state": "ignored"
        }
    };
}
