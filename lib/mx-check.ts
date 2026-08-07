/**
 * mx-check.ts — Verifie en DNS qu'un domaine peut reellement recevoir du courrier.
 *
 * Contexte (incident du 7 aout 2026) : un visiteur a lance un diagnostic sur animedekho.cam
 * puis saisi support@animedekho.cam pour recevoir son code OTP. Le domaine n'a AUCUN
 * enregistrement MX. Postfix est donc retombe sur l'adresse A implicite (une IP Cloudflare
 * qui n'ecoute pas sur le port 25), le message est reste 5 jours en file d'attente, et la
 * seule trace cote AI Visionary a ete un "Delayed Mail" recu 4 h plus tard sur hello@.
 * Cote visiteur : un code qui n'arrive jamais, sans aucune explication.
 *
 * On ne teste QUE le DNS. Le port 25 sortant est bloque sur le VPS, une verification SMTP
 * de la boite elle-meme est donc impossible. L'absence de MX reste un signal definitif :
 * un domaine qui veut recevoir du courrier publie un MX.
 *
 * Politique volontairement prudente (sendEmail a 11 appelants directs, dont les webhooks
 * Stripe et les crons de rappel) :
 *   - on ne refuse que sur une reponse DNS DEFINITIVE (domaine inexistant, aucun MX,
 *     ou "null MX" RFC 7505) ;
 *   - toute panne de resolution (timeout, SERVFAIL, EAI_AGAIN) laisse passer l'envoi.
 * Autrement dit : on ne casse jamais un envoi legitime a cause d'un resolveur capricieux.
 */

import { promises as dns } from 'node:dns';

export type MailDomainReason =
    | 'ok'            // MX valide publie
    | 'invalid'       // adresse mal formee
    | 'unknown_domain'// NXDOMAIN, le domaine n'existe pas
    | 'no_mx'         // le domaine existe mais ne publie aucun MX exploitable
    | 'null_mx'       // MX "." (RFC 7505) : le domaine refuse explicitement le courrier
    | 'dns_error';    // resolution impossible, on laisse passer

export interface MailDomainCheck {
    /** true = on peut tenter l'envoi (inclut les cas de panne DNS, ou l'on laisse passer). */
    ok: boolean;
    reason: MailDomainReason;
    domain: string;
}

/** Delai max accorde a la resolution DNS. Au-dela on laisse passer. */
const DNS_TIMEOUT_MS = 3000;

/** Cache memoire : evite de re-resoudre le meme domaine a chaque envoi. */
const TTL_OK_MS = 24 * 60 * 60 * 1000;   // un domaine qui recoit le courrier change rarement
const TTL_FAIL_MS = 60 * 60 * 1000;      // un domaine casse peut etre repare, on re-teste plus souvent
const cache = new Map<string, { value: MailDomainCheck; expiresAt: number }>();

/** Extrait le domaine d'une adresse email, ou '' si l'adresse est inexploitable. */
export function emailDomain(email: string): string {
    const at = String(email || '').trim().toLowerCase().lastIndexOf('@');
    if (at < 1) return '';
    const domain = String(email).trim().toLowerCase().slice(at + 1).replace(/\.$/, '');
    // Un domaine recevable a au moins un point et aucun caractere exotique.
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) return '';
    return domain;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('DNS timeout'), { code: 'ETIMEOUT' })), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

/**
 * Verifie qu'un domaine d'email accepte le courrier.
 * Ne leve jamais : en cas de doute, renvoie ok=true.
 */
export async function checkMailDomain(email: string): Promise<MailDomainCheck> {
    const domain = emailDomain(email);
    if (!domain) return { ok: false, reason: 'invalid', domain: '' };

    const cached = cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let result: MailDomainCheck;
    try {
        const records = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
        // RFC 7505 : un MX unique dont l'echange vaut "." signifie "ce domaine ne recoit pas de mail".
        const isNullMx = records.length === 1 && (records[0].exchange || '').trim().replace(/\.$/, '') === '';
        const usable = records.filter(r => {
            const host = (r.exchange || '').trim().replace(/\.$/, '');
            return host.length > 0 && host.includes('.');
        });
        if (isNullMx) result = { ok: false, reason: 'null_mx', domain };
        else if (usable.length === 0) result = { ok: false, reason: 'no_mx', domain };
        else result = { ok: true, reason: 'ok', domain };
    } catch (e: unknown) {
        const code = (e as NodeJS.ErrnoException)?.code || '';
        if (code === 'ENOTFOUND') {
            // Le domaine lui-meme n'existe pas.
            result = { ok: false, reason: 'unknown_domain', domain };
        } else if (code === 'ENODATA') {
            // Le domaine existe mais ne publie aucun MX. C'est exactement le cas animedekho.cam :
            // l'adresse A implicite est derriere un proxy web qui n'accepte pas le SMTP.
            result = { ok: false, reason: 'no_mx', domain };
        } else {
            // Timeout, SERVFAIL, resolveur indisponible : on ne bloque pas un envoi legitime.
            result = { ok: true, reason: 'dns_error', domain };
        }
    }

    cache.set(domain, { value: result, expiresAt: Date.now() + (result.ok ? TTL_OK_MS : TTL_FAIL_MS) });
    return result;
}

/** Message affichable a l'utilisateur, bilingue FR/EN. */
export function mailDomainErrorMessage(check: MailDomainCheck, locale: 'fr' | 'en'): string {
    const en = locale === 'en';
    switch (check.reason) {
        case 'invalid':
            return en ? 'Invalid email address.' : 'Adresse email invalide.';
        case 'unknown_domain':
            return en
                ? `The domain ${check.domain} does not exist. Please check the address.`
                : `Le domaine ${check.domain} n'existe pas. Verifiez l'adresse saisie.`;
        case 'null_mx':
        case 'no_mx':
            return en
                ? `The domain ${check.domain} has no mail server, so it cannot receive email. Please use a working address.`
                : `Le domaine ${check.domain} n'a aucun serveur mail, il ne peut donc pas recevoir d'email. Utilisez une adresse fonctionnelle.`;
        default:
            return en ? 'Unable to verify this email address.' : "Impossible de verifier cette adresse email.";
    }
}

/** Vide le cache. Reserve aux tests. */
export function __clearMailDomainCache(): void {
    cache.clear();
}
