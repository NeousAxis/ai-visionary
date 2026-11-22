// lib/aya/log.ts
//
// Journal de la recherche et du contact AYA, via le journal commun du projet
// (lib/logger.ts, règle du dépôt). Ne jamais y écrire l'email d'un visiteur.

import { log, generateCorrelationId } from '@/lib/logger';

export function ayaLog(level: 'info' | 'warn' | 'error', step: string, message: string): void {
    log(generateCorrelationId(), level, 'aya', step, message);
}
