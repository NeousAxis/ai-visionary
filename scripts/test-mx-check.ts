/**
 * test-mx-check.ts — Verifie le garde-fou DNS des adresses email contre de vrais domaines.
 *
 * Usage : npx tsx scripts/test-mx-check.ts
 *
 * Le test tape le DNS reel (pas de mock) : c'est le comportement qui compte, et une
 * resolution qui echoue doit laisser passer l'envoi plutot que bloquer un client.
 */

import { checkMailDomain, emailDomain, __clearMailDomainCache } from '../lib/mx-check';

interface Case {
    email: string;
    expectOk: boolean;
    expectReason?: string;
    label: string;
}

const CASES: Case[] = [
    // Le cas qui a declenche tout ca : aucun MX, A derriere Cloudflare, port 25 en timeout.
    { email: 'support@animedekho.cam', expectOk: false, expectReason: 'no_mx', label: 'incident 7 aout 2026' },
    // Domaines qui recoivent reellement du courrier.
    { email: 'hello@ai-visionary.xyz', expectOk: true, expectReason: 'ok', label: 'notre propre domaine' },
    { email: 'neousaxis@gmail.com', expectOk: true, expectReason: 'ok', label: 'gmail' },
    { email: 'someone@infomaniak.com', expectOk: true, expectReason: 'ok', label: 'infomaniak' },
    // Domaine inexistant.
    { email: 'x@ce-domaine-nexiste-vraiment-pas-42424242.xyz', expectOk: false, expectReason: 'unknown_domain', label: 'NXDOMAIN' },
    // Adresses malformees.
    { email: 'pas-une-adresse', expectOk: false, expectReason: 'invalid', label: 'sans @' },
    { email: 'a@localhost', expectOk: false, expectReason: 'invalid', label: 'domaine sans point' },
    { email: '', expectOk: false, expectReason: 'invalid', label: 'vide' },
];

async function main() {
    // emailDomain : extraction robuste
    const extraction: [string, string][] = [
        ['Support@AnimeDekho.CAM', 'animedekho.cam'],
        ['  a.b+tag@Example.CO.UK ', 'example.co.uk'],
        ['weird@@double.com', 'double.com'],
        ['no-at-sign.com', ''],
        ['@nolocal.com', ''],
    ];
    let failures = 0;
    for (const [input, expected] of extraction) {
        const got = emailDomain(input);
        const pass = got === expected;
        if (!pass) failures++;
        console.log(`${pass ? 'OK  ' : 'FAIL'} emailDomain(${JSON.stringify(input)}) = ${JSON.stringify(got)} (attendu ${JSON.stringify(expected)})`);
    }

    console.log('');
    for (const c of CASES) {
        const started = Date.now();
        const r = await checkMailDomain(c.email);
        const ms = Date.now() - started;
        // 'dns_error' est un resultat acceptable partout : c'est le fail-open assume.
        const pass = r.reason === 'dns_error'
            ? r.ok === true
            : r.ok === c.expectOk && (!c.expectReason || r.reason === c.expectReason);
        if (!pass) failures++;
        console.log(`${pass ? 'OK  ' : 'FAIL'} ${c.email.padEnd(48)} ok=${String(r.ok).padEnd(5)} reason=${r.reason.padEnd(15)} ${ms}ms   [${c.label}]`);
    }

    // Le cache doit servir : le 2e appel sur le meme domaine est quasi instantane.
    console.log('');
    const cold = Date.now(); await checkMailDomain('a@ai-visionary.xyz'); const coldMs = Date.now() - cold;
    const warm = Date.now(); await checkMailDomain('b@ai-visionary.xyz'); const warmMs = Date.now() - warm;
    const cachePass = warmMs <= Math.max(coldMs, 5);
    if (!cachePass) failures++;
    console.log(`${cachePass ? 'OK  ' : 'FAIL'} cache : 1er appel ${coldMs}ms, 2e appel ${warmMs}ms`);
    __clearMailDomainCache();

    console.log('');
    console.log(failures === 0 ? '✅ Tous les cas passent.' : `❌ ${failures} cas en echec.`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
