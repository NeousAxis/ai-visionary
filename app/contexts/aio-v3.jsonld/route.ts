// Contexte JSON-LD de l'ASR 3.0, servi a https://ai-visionary.xyz/contexts/aio-v3.jsonld
//
// Adresse declaree par les fichiers ASR generes. Elle renvoyait 404 jusqu'au 9 aout 2026.
// Le contexte est ce qui transforme des cles JSON en termes globalement identifies : sans
// lui, un ASR est un objet JSON quelconque et deux implementations n'ont aucune garantie
// de parler de la meme chose.
//
// Regle de compatibilite : on ajoute des termes, on n'en redefinit jamais. Un fichier
// signe conserve son sens, sinon la signature ne prouve plus rien d'utile.

import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const CONTEXT = {
    '@context': {
        '@version': 1.1,
        '@protected': true,

        ayo: 'https://ai-visionary.xyz/ns/ayo#',
        schema: 'https://schema.org/',
        xsd: 'http://www.w3.org/2001/XMLSchema#',

        // Coeur schema.org. Un ASR est une Organization avant d'etre quoi que ce soit
        // d'autre, pour etre lisible par tout ce qui comprend deja schema.org.
        id: '@id',
        type: '@type',
        Organization: 'schema:Organization',
        name: 'schema:name',
        legalName: 'schema:legalName',
        url: { '@id': 'schema:url', '@type': '@id' },
        description: 'schema:description',
        address: 'schema:address',
        areaServed: 'schema:areaServed',
        contactPoint: 'schema:contactPoint',
        identifier: 'schema:identifier',

        // Extension AYO.
        sector: 'ayo:sector',
        offer: 'ayo:offer',
        deliverables: { '@id': 'ayo:deliverables', '@container': '@set' },
        process: 'ayo:process',
        scope: 'ayo:scope',
        audience: { '@id': 'ayo:audience', '@container': '@set' },
        geography: 'ayo:geography',
        technicalReadiness: 'ayo:technicalReadiness',
        limitsAndUnknowns: 'ayo:limitsAndUnknowns',
        aioEvaluation: 'ayo:aioEvaluation',

        // Sceau.
        seal: 'ayo:seal',
        level: 'ayo:level',
        issuer: 'ayo:issuer',
        issuedAt: { '@id': 'ayo:issuedAt', '@type': 'xsd:dateTime' },
        payloadHash: 'ayo:payloadHash',
        signature: 'ayo:signature',
        keyId: 'ayo:keyId',
        algorithm: 'ayo:algorithm',
        value: 'ayo:value',
    },
};

export async function GET() {
    return NextResponse.json(CONTEXT, {
        headers: {
            'Content-Type': 'application/ld+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
