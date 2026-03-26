/**
 * Lifecycle helpers for AYA entity management.
 *
 * - Review dates (annual review reminders)
 * - Expiry dates (PRO = 3 years, AYA_SUB = 1 month)
 * - Status checks (expired, days until expiry)
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calculate the next annual review date (fromDate + 365 days).
 * If no fromDate is provided, uses today.
 */
export function calculateNextReviewDate(fromDate?: Date): Date {
    const base = fromDate ?? new Date();
    return new Date(base.getTime() + 365 * MS_PER_DAY);
}

/**
 * Calculate the expiry date based on pack type.
 * - PRO: 3 years from now
 * - AYA_SUB: 1 month from now (subscription billing cycle)
 */
export function calculateExpiryDate(packType: 'PRO' | 'AYA_SUB'): Date {
    const now = new Date();
    if (packType === 'PRO') {
        // 3 years = 1095 days (approximate, ignoring leap years for simplicity)
        return new Date(now.getTime() + 3 * 365 * MS_PER_DAY);
    }
    // AYA_SUB: 1 month ahead
    const expiry = new Date(now);
    expiry.setMonth(expiry.getMonth() + 1);
    return expiry;
}

/**
 * Check if an entity is expired based on its valid_until field.
 * Returns true if valid_until exists and is in the past.
 */
export function isExpired(entity: { valid_until?: string | null }): boolean {
    if (!entity.valid_until) return false;
    const expiryDate = new Date(entity.valid_until);
    return expiryDate.getTime() < Date.now();
}

/**
 * Calculate how many days remain until the entity expires.
 * Returns Infinity if no valid_until is set.
 * Returns a negative number if already expired.
 */
export function daysUntilExpiry(entity: { valid_until?: string | null }): number {
    if (!entity.valid_until) return Infinity;
    const expiryDate = new Date(entity.valid_until);
    const diffMs = expiryDate.getTime() - Date.now();
    return Math.floor(diffMs / MS_PER_DAY);
}
