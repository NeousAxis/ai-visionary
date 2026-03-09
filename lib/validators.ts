import { z } from 'zod';

// ============================================================
// Input Validation Schemas (Zod)
// Used across all API routes for input sanitization
// ============================================================

/** Validate and normalize a URL */
export const urlSchema = z
    .string()
    .min(3, 'URL trop courte')
    .max(2048, 'URL trop longue')
    .transform((val) => {
        let url = val.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        return url;
    })
    .refine((val) => {
        try {
            new URL(val);
            return true;
        } catch {
            return false;
        }
    }, 'URL invalide');

/** Validate email format */
export const emailSchema = z
    .string()
    .email('Format email invalide')
    .max(320, 'Email trop long')
    .transform((val) => val.trim().toLowerCase());

/** Validate OTP code (6 digits) */
export const otpCodeSchema = z
    .string()
    .regex(/^\d{4,6}$/, 'Code OTP invalide (4-6 chiffres)');

/** Check if a URL is safe (not SSRF) */
export function isAllowedUrl(urlString: string): { allowed: boolean; reason?: string } {
    try {
        const url = new URL(urlString);

        // Block non-HTTP protocols
        if (!['http:', 'https:'].includes(url.protocol)) {
            return { allowed: false, reason: `Protocole interdit: ${url.protocol}` };
        }

        const hostname = url.hostname.toLowerCase();

        // Block localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') {
            return { allowed: false, reason: 'Localhost interdit' };
        }

        // Block private IP ranges
        const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
        if (ipMatch) {
            const [, a, b] = ipMatch.map(Number);
            if (a === 10) return { allowed: false, reason: 'IP privee (10.x)' };
            if (a === 172 && b >= 16 && b <= 31) return { allowed: false, reason: 'IP privee (172.16-31.x)' };
            if (a === 192 && b === 168) return { allowed: false, reason: 'IP privee (192.168.x)' };
            if (a === 169 && b === 254) return { allowed: false, reason: 'Metadata endpoint (169.254.x)' };
            if (a === 0) return { allowed: false, reason: 'IP reservee (0.x)' };
        }

        // Block cloud metadata endpoints
        if (hostname === 'metadata.google.internal' || hostname === 'metadata.google.com') {
            return { allowed: false, reason: 'Cloud metadata interdit' };
        }

        return { allowed: true };
    } catch {
        return { allowed: false, reason: 'URL malformee' };
    }
}

/** Validate chat request body */
export const chatRequestSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(10000),
    })).min(1).max(100),
    targetUrl: z.string().optional(),
    targetEmail: z.string().optional(),
    analysisId: z.string().optional(),
});
