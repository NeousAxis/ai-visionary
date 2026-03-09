// ============================================================
// Content Sanitization for LLM Prompts
// Prevents prompt injection via scraped web content
// ============================================================

/** Remove HTML tags, scripts, and control characters from text before LLM injection */
export function sanitizeForPrompt(text: string, maxLength: number = 5000): string {
    if (!text) return '';

    let clean = text;

    // Remove script tags and their content
    clean = clean.replace(/<script[\s\S]*?<\/script>/gi, '');

    // Remove style tags and their content
    clean = clean.replace(/<style[\s\S]*?<\/style>/gi, '');

    // Remove HTML comments
    clean = clean.replace(/<!--[\s\S]*?-->/g, '');

    // Remove all HTML tags
    clean = clean.replace(/<[^>]+>/g, ' ');

    // Remove common prompt injection patterns
    clean = clean.replace(/\b(ignore previous|disregard|forget|new instructions|system prompt|you are now)\b/gi, '[FILTERED]');

    // Decode HTML entities
    clean = clean.replace(/&amp;/g, '&');
    clean = clean.replace(/&lt;/g, '<');
    clean = clean.replace(/&gt;/g, '>');
    clean = clean.replace(/&quot;/g, '"');
    clean = clean.replace(/&#39;/g, "'");
    clean = clean.replace(/&nbsp;/g, ' ');

    // Remove control characters (except newlines and tabs)
    clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Collapse multiple whitespace
    clean = clean.replace(/\s+/g, ' ');

    // Trim and limit length
    clean = clean.trim();
    if (clean.length > maxLength) {
        clean = clean.substring(0, maxLength) + '... [TRONQUÉ]';
    }

    return clean;
}

/** Sanitize email for safe display/logging (no full exposure) */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    const masked = local.substring(0, 2) + '***';
    return `${masked}@${domain}`;
}
