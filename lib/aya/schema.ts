
export type AyaEntityStatus = 'fresh' | 'aging' | 'stale';

export interface AyaEntity {
    // Identité Canonique
    aya_entity_id: string; // UUID
    legal_name: string;
    display_name: string; // Peut être différent du légal (ex: Marque commerciale)
    entity_type: 'company' | 'association' | 'individual' | 'public_body';
    country_legal: string; // ISO Code (CH, FR...)
    sector_macro: string; // Ex: "Construction", "Santé"
    website?: string;      // URL associée (AIO Signal principal)
    asr_score?: number;    // Score de qualité de l'information (0-100)
    payment_completed?: boolean; // Entité visible sur AYA uniquement après paiement
    pack_type?: string;           // 'PRO' | 'AYA_SUB' — pack acheté
    contact_email?: string;       // Email du client (pour OTP gate + notifications)

    // Temporalité (CRUCIAL POUR LES BOTS)
    created_at: string;      // ISO Date - Ne bouge jamais
    last_update: string;     // ISO Date - Reset à chaque modif/paiement
    valid_until: string;     // ISO Date - Fin de droit de priorité

    // Origine
    data_origin: 'AYO';

    // Payload ASR (Le trésor)
    asr_payload: {
        version: string; // "1.0"
        data: any;       // Le contenu complet du fichier ASR
        signature: {     // Preuve cryptographique
            hash: string;
            public_key: string;
        }
    };

    // Moteur de Recommandabilité (Computed)
    recommendability: {
        machine_readable: true;
        status: AyaEntityStatus; // Calculé selon (now - last_update)
        freshness_score: number; // 0.0 à 1.0
        priority_level: 'normal' | 'reduced' | 'boosted';
        source_url: string; // ex: https://aya.ai-visionary.com/e/UUID
    };
}
