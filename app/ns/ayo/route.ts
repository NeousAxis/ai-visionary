// Vocabulaire AYO, servi a https://ai-visionary.xyz/ns/ayo
//
// Les fichiers ASR publies declarent des proprietes prefixees `ayo:` resolues contre
// cette adresse. Elle renvoyait 404 jusqu'au 9 aout 2026, ce qui rendait tout fichier
// ASR non developpable par un processeur JSON-LD : un vocabulaire qui n'existe pas ne
// definit rien. Un terme doit etre dereferencable, c'est la regle de base d'un espace
// de noms sur le web, et c'est le premier point qu'une enceinte normative verifie.
//
// Ce document est la definition de reference des termes. Toute evolution passe par un
// ajout, jamais par une redefinition : un fichier signe il y a un an doit garder le
// meme sens aujourd'hui.

import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const NS = 'https://ai-visionary.xyz/ns/ayo#';

/** Un terme du vocabulaire, decrit en RDF Schema. */
function term(id: string, label: string, comment: string, range?: string) {
    return {
        '@id': `ayo:${id}`,
        '@type': 'rdf:Property',
        'rdfs:label': label,
        'rdfs:comment': comment,
        'rdfs:isDefinedBy': 'https://ai-visionary.xyz/ns/ayo',
        ...(range ? { 'rdfs:range': range } : {}),
    };
}

const VOCABULARY = {
    '@context': {
        ayo: NS,
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        owl: 'http://www.w3.org/2002/07/owl#',
        schema: 'https://schema.org/',
        dcterms: 'http://purl.org/dc/terms/',
    },
    '@id': 'https://ai-visionary.xyz/ns/ayo',
    '@type': 'owl:Ontology',
    'rdfs:label': 'AYO vocabulary for the AI Singular Record (ASR)',
    'rdfs:comment':
        'Terms used by the AI Singular Record, a signed, self published description of an ' +
        'organisation intended to be read by AI systems. ASR extends schema.org rather than ' +
        'replacing it: an ASR document is a schema.org Organization carrying additional ayo: ' +
        'properties, so any consumer that already understands schema.org reads the core of it ' +
        'without any knowledge of this vocabulary.',
    'dcterms:publisher': 'AI Visionary, Geneva, Switzerland',
    'dcterms:license': 'https://creativecommons.org/licenses/by/4.0/',
    'owl:versionInfo': '3.0',

    'rdfs:seeAlso': [
        'https://ai-visionary.xyz/contexts/aio-v3.jsonld',
        'https://ai-visionary.xyz/api/aya/docs',
    ],

    defines: [
        term('sector', 'sector', 'Activity sector of the organisation, as a primary label and optional secondary labels.'),
        term('offer', 'offer', 'What the organisation actually sells or delivers: services, products, use cases.'),
        term('deliverables', 'deliverables', 'Concrete artefacts a client receives, each with a name, a format and a description.'),
        term('process', 'process', 'Ordered steps describing how the organisation delivers its offer.'),
        term('scope', 'scope', 'What the organisation does and, just as importantly, what it explicitly does not do.'),
        term('audience', 'audience', 'Who the offer is intended for.'),
        term('geography', 'geography', 'Regions served and languages supported.'),
        term('technicalReadiness', 'technicalReadiness', 'Machine readability signals of the organisation website: JSON-LD, sitemap, ASR endpoint.'),
        term('limitsAndUnknowns', 'limitsAndUnknowns',
            'Declared absence of information, split into not measured, unknown and not provided. ' +
            'A stated absence is a fact and is treated as such: it is what separates an honest ' +
            'record from a marketing page.'),
        term('aioEvaluation', 'aioEvaluation', 'AIO readability score, its scale, the method, the version and a per block breakdown.'),
        term('seal', 'seal',
            'Cryptographic seal binding this document to its issuer. Carries the hash of the ' +
            'canonical payload and a detached Ed25519 signature over that hash. A record without ' +
            'a verifiable seal is a claim, not a record.'),
        term('level', 'level', 'Assurance level of the seal.'),
        term('issuer', 'issuer', 'Party that produced and signed the record.'),
        term('issuedAt', 'issuedAt', 'Instant the seal was produced, ISO 8601 UTC.', 'schema:DateTime'),
        term('payloadHash', 'payloadHash', 'Hash of the canonical payload: an algorithm identifier and a hexadecimal value.'),
        term('signature', 'signature', 'Detached signature over the payload hash: an algorithm identifier, a base64 value and a key identifier.'),
        term('keyId', 'keyId', 'Identifier of the public key needed to verify the signature.'),
    ],
};

export async function GET() {
    return NextResponse.json(VOCABULARY, {
        headers: {
            'Content-Type': 'application/ld+json; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
