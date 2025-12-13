const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'ayo-env.js');
const apiKey = process.env.GEMINI_KEY_API;

console.log('Starting build-time API key injection...');
if (apiKey) console.log(`Build env var found. Length: ${apiKey.length}`);

if (!apiKey) {
    console.error('ERROR: GEMINI_KEY_API environment variable is NOT set. Build failed.');
    process.exit(1);
} else {
    console.log('GEMINI_KEY_API is present. Injecting into ayo-core.js...');
}

try {
    let content = fs.readFileSync(targetFile, 'utf8');

    // Check if placeholder exists
    if (!content.includes('API_KEY_TOKEN_REPLACE_ME')) {
        console.warn('WARNING: Placeholder "API_KEY_TOKEN_REPLACE_ME" not found in ayo-env.js. Is it already replaced?');
    }

    // Replace
    // We use a safe replacement that doesn't suffer from sed delimiter collisions
    const newContent = content.replace(/API_KEY_TOKEN_REPLACE_ME/g, apiKey || 'API_KEY_MISSING_IN_BUILD');

    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log('Successfully injected API key into ayo-env.js');

} catch (err) {
    console.error('Error during API key injection:', err);
    process.exit(1);
}
