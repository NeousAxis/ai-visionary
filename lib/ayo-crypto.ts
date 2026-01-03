import nacl from 'tweetnacl';

// Keys (Ideally, Secret Key should be in ENV, but for this step we need to use the one generated to ensure matching Pair)
const SECRET_KEY_BASE64 = "WkEwqzDRclqFhMEAwISCId28zIqAaUUTRugtU37SGIg/fEaY1dwbbcWeKzUF1UFjbuptXT87oSZh3/bw90fU7Q==";
const KEY_ID = "ayo-root-2026";

/**
 * Canonizes a JSON object (Stable stringify) to ensure reproducible hash.
 * - Sorts keys alphabetically.
 * - Removes whitespace.
 */
function canonicalize(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    return '{' + keys.map(key => {
        // Recursively canonicalize value
        const val = canonicalize(obj[key]);
        return JSON.stringify(key) + ':' + val;
    }).join(',') + '}';
}

/**
 * Signs an ASR Object using Ed25519.
 * 1. Removes existing seal.
 * 2. Canonicalizes the object.
 * 3. Hashes (SHA-256) the canonical string.
 * 4. Signs the Hash.
 * 5. Returns the complete sealed object.
 */
export async function signAsrContent(asrObject: any) {
    // 1. Prepare Content (Clone and Remove Seal)
    const contentToSign = { ...asrObject };
    delete contentToSign['ayo:seal'];

    // 2. Canonicalize
    const canonicalString = canonicalize(contentToSign);

    // 3. Hash (SHA-256) - Using Web Crypto API (available in Node 18+ and Vercel Edge)
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 4. Sign (Ed25519 on the Hash bytes)
    // Decode Secret Key
    const secretKeyBytes = Buffer.from(SECRET_KEY_BASE64, 'base64');
    const signatureBytes = nacl.sign.detached(new Uint8Array(hashBuffer), new Uint8Array(secretKeyBytes));
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

    // 5. Construct Seal
    const seal = {
        level: "ESSENTIAL", // or ESSENTIAL_PRO based on content
        issuer: "AYO Trusted Authority",
        issuedAt: new Date().toISOString(),
        keyId: KEY_ID,
        payloadHash: {
            algorithm: "sha256",
            value: hashHex
        },
        signature: {
            algorithm: "ed25519",
            value: signatureBase64
        }
    };

    return {
        ...contentToSign,
        "ayo:seal": seal
    };
}
