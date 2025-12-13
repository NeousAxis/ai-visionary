const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_KEY_API;
const templateFile = path.join(__dirname, 'ayo-env.template.js');
const targetFile = path.join(__dirname, 'ayo-env.js');

console.log('Starting Build (In-Place Injection)...');

if (!apiKey) {
    console.error('ERROR: GEMINI_KEY_API environment variable is NOT set. Build failed.');
    process.exit(1);
}

try {
    if (!fs.existsSync(templateFile)) {
        throw new Error('Template file ayo-env.template.js not found');
    }

    let content = fs.readFileSync(templateFile, 'utf8');

    // Check if we have the placeholder
    if (!content.includes('KEY_HOLDER_XYZ')) {
        console.warn('WARNING: Placeholder KEY_HOLDER_XYZ not found in template.');
    }

    // Replace
    const newContent = content.replace(/"KEY_HOLDER_XYZ"/g, `"${apiKey.trim()}"`);

    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log(`SUCCESS: Generated ayo-env.js from template. Key length: ${apiKey.trim().length}`);

} catch (err) {
    console.error('Error injecting key:', err);
    process.exit(1);
}
