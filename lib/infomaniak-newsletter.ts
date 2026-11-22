/**
 * Infomaniak Newsletter API client.
 *
 * Wraps the Infomaniak Newsletter API (https://api.infomaniak.com/1/newsletters/{domain}/...)
 * for our outbound campaigns to AYA-bot indexed entities.
 *
 * Env vars required:
 *   INFOMANIAK_NEWSLETTER_TOKEN     — Bearer token (manager.infomaniak.com → API tokens)
 *   INFOMANIAK_NEWSLETTER_DOMAIN_ID — integer ID of the newsletter (e.g. 62227)
 */

const BASE_URL = 'https://api.infomaniak.com/1';

function getEnv() {
    const token = process.env.INFOMANIAK_NEWSLETTER_TOKEN;
    const domainId = process.env.INFOMANIAK_NEWSLETTER_DOMAIN_ID;
    if (!token) throw new Error('INFOMANIAK_NEWSLETTER_TOKEN env var missing');
    if (!domainId) throw new Error('INFOMANIAK_NEWSLETTER_DOMAIN_ID env var missing');
    return { token, domainId };
}

type ApiResult<T> = { result: 'success'; data: T } | { result: 'error'; error: { code: string; description: string } };

async function api<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const { token } = getEnv();
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    let json: ApiResult<T>;
    try {
        json = await res.json();
    } catch {
        throw new Error(`Infomaniak API non-JSON response (HTTP ${res.status})`);
    }

    if (!res.ok || json.result === 'error') {
        const errCode = json.result === 'error' ? json.error?.code : `HTTP_${res.status}`;
        const errDesc = json.result === 'error' ? json.error?.description : `Unexpected status ${res.status}`;
        throw new Error(`Infomaniak ${method} ${path}: ${errCode} - ${errDesc}`);
    }

    return json.data;
}

// ── Domain ──────────────────────────────────────────────────────────────────

export type NewsletterDomain = {
    id: number;
    name: string;
    credit_month: number;
    sender_type: string;
    status: string;
    can_use_other_domains: boolean;
};

export async function getDomain(): Promise<NewsletterDomain> {
    const { domainId } = getEnv();
    return api<NewsletterDomain>('GET', `/newsletters/${domainId}`);
}

// ── Subscribers ─────────────────────────────────────────────────────────────

export type Subscriber = {
    id: number;
    email: string;
    status: string;
    created_at: number;
};

/**
 * Create or update a subscriber. Non-destructive: omitted params don't affect existing data.
 *
 * @param email   Valid RFC 2821 email
 * @param fields  Custom field values (key must match a defined field in the newsletter)
 * @param groups  Array of group IDs (numbers) or group names (strings); names are auto-created
 */
export async function createSubscriber(
    email: string,
    fields?: Record<string, string | number>,
    groups?: (string | number)[],
): Promise<Subscriber> {
    const { domainId } = getEnv();
    const body: Record<string, unknown> = { email };
    if (fields && Object.keys(fields).length > 0) body.fields = fields;
    if (groups && groups.length > 0) body.groups = groups;
    return api<Subscriber>('POST', `/newsletters/${domainId}/subscribers`, body);
}

/**
 * Subscriber count grouped by status.
 */
export type SubscriberCount = {
    active: number;
    bounced: number;
    junk: number;
    unconfirmed: number;
    under_verification: number;
    unsubscribed: number;
};

export async function getSubscriberCount(): Promise<SubscriberCount> {
    const { domainId } = getEnv();
    return api<SubscriberCount>('GET', `/newsletters/${domainId}/subscribers/count_status`);
}

// ── Groups ──────────────────────────────────────────────────────────────────

export type NewsletterGroup = {
    id: number;
    name: string;
    subscribers_count?: number;
};

export async function listGroups(): Promise<NewsletterGroup[]> {
    const { domainId } = getEnv();
    return api<NewsletterGroup[]>('GET', `/newsletters/${domainId}/groups`);
}

export async function createGroup(name: string): Promise<NewsletterGroup> {
    const { domainId } = getEnv();
    return api<NewsletterGroup>('POST', `/newsletters/${domainId}/groups`, { name });
}

// ── Campaigns ───────────────────────────────────────────────────────────────

export type Campaign = {
    id: number;
    status: string;
    sending_batch?: string;
    lang: string;
    subject: string;
    preheader?: string;
    email_from_name: string;
    email_from_addr: string;
    tracking_link?: boolean;
    tracking_opening?: boolean;
    next_step?: string;
    started_at?: number;
    created_at: number;
};

export type CreateCampaignParams = {
    subject: string;
    contentHtml: string;
    fromAddr: string;
    fromName: string;
    lang: 'fr_FR' | 'en_GB' | 'de_DE' | 'es_ES' | 'it_IT';
    preheader?: string;
    /**
     * Recipients filter — restricts the campaign to specific groups.
     * Omit to send to all active subscribers.
     */
    recipients?: { groups?: number[] };
    trackingLink?: boolean;
    trackingOpening?: boolean;
};

export async function createCampaign(p: CreateCampaignParams): Promise<Campaign> {
    const { domainId } = getEnv();
    const body: Record<string, unknown> = {
        subject: p.subject,
        content_html: p.contentHtml,
        email_from_addr: p.fromAddr,
        email_from_name: p.fromName,
        lang: p.lang,
        tracking_link: p.trackingLink ?? true,
        tracking_opening: p.trackingOpening ?? true,
    };
    if (p.preheader) body.preheader = p.preheader;
    if (p.recipients) body.recipients = p.recipients;
    return api<Campaign>('POST', `/newsletters/${domainId}/campaigns`, body);
}

export async function getCampaign(campaignId: number): Promise<Campaign> {
    const { domainId } = getEnv();
    return api<Campaign>('GET', `/newsletters/${domainId}/campaigns/${campaignId}`);
}

/**
 * Send a test of the campaign to a single email (does NOT consume credits the same way as a real send).
 */
export async function testCampaign(campaignId: number, email: string): Promise<boolean> {
    const { domainId } = getEnv();
    return api<boolean>('POST', `/newsletters/${domainId}/campaigns/${campaignId}/test`, { email });
}

/**
 * Schedule the campaign for sending.
 * @param campaignId  Campaign ID
 * @param startedAt   Unix timestamp (seconds). Omit or pass current time to send immediately.
 */
export async function scheduleCampaign(campaignId: number, startedAt?: number): Promise<boolean> {
    const { domainId } = getEnv();
    const body: Record<string, unknown> = {};
    if (startedAt) body.started_at = startedAt;
    return api<boolean>('PUT', `/newsletters/${domainId}/campaigns/${campaignId}/schedule`, body);
}

export async function cancelCampaign(campaignId: number): Promise<boolean> {
    const { domainId } = getEnv();
    return api<boolean>('PUT', `/newsletters/${domainId}/campaigns/${campaignId}/cancel`);
}

export type CampaignTracking = {
    sent?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
    unsubscribed?: number;
    [k: string]: unknown;
};

export async function getCampaignTracking(campaignId: number): Promise<CampaignTracking> {
    const { domainId } = getEnv();
    return api<CampaignTracking>('GET', `/newsletters/${domainId}/campaigns/${campaignId}/tracking`);
}
