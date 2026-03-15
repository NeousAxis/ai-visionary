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
            "status": "active",
            "generated_at": new Date().toISOString().split('T')[0],
            "source": "ayo-chatbot"
        },

        "ecosystem_presence": {
            "platform_types": data.ecosystem_presence || [],
            "declared_by_client": true
        },

        "reputation_signals": {
            "enabled": data.reputation_signals,
            // M5 fix: No fake ratings — only declare capability, not fake data
            "sources": data.reputation_signals ? [
                {
                    "platform": "google",
                    "status": "declared_not_verified",
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
            "primary": (data.channels || []).filter(c =>
                ["Site web", "App mobile", "Lieu physique"].some(k => c.includes(k))
            ),
            "secondary": (data.channels || []).filter(c =>
                !["Site web", "App mobile", "Lieu physique"].some(k => c.includes(k))
            )
        },

        "usage_permissions": {
            "allow_listing": (data.permissions || []).some(p => p.toLowerCase().includes("listing") || p.toLowerCase().includes("all")),
            "allow_comparison": (data.permissions || []).some(p => p.toLowerCase().includes("compar") || p.toLowerCase().includes("all")),
            "allow_best_of": (data.permissions || []).some(p => p.toLowerCase().includes("best") || p.toLowerCase().includes("classement") || p.toLowerCase().includes("all")),
            "allow_intent_matching": (data.permissions || []).some(p => p.toLowerCase().includes("intent") || p.toLowerCase().includes("recommand") || p.toLowerCase().includes("all")),
            "raw_declared": data.permissions || []
        },

        "sunset_policy": {
            "removable": true,
            "reason": "external_noise_dependency",
            "future_state": "ignored"
        }
    };
}
