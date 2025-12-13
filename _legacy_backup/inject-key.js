const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_KEY_API;
const templateFile = path.join(__dirname, 'ayo-settings.template.js');
const targetFile = path.join(__dirname, 'ayo-settings.js');

console.log('Starting Build (In-Place Injection) - Anti-Cache Strategy...');

if (!apiKey) {
    console.error('ERROR: GEMINI_KEY_API environment variable is NOT set. Build failed.');
    process.exit(1);
}

try {
    if (!fs.existsSync(templateFile)) {
        console.error(`ERROR: Template file not found at ${templateFile}`);
        throw new Error('Template file ayo-settings.template.js not found');
    }

    let content = fs.readFileSync(templateFile, 'utf8');

    // Check if we have the placeholder
    if (!content.includes('KEY_HOLDER_XYZ')) {
        console.warn('WARNING: Placeholder KEY_HOLDER_XYZ not found in template.');
    }

    // Replace
    // We clean the key aggressively (trim + remove potential surrounding quotes copied by mistake)
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    // Regex to match "KEY_HOLDER_XYZ" or 'KEY_HOLDER_XYZ'
    const newContent = content.replace(/["']KEY_HOLDER_XYZ["']/g, `"${cleanKey}"`);

    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log(`SUCCESS: Generated ayo-settings.js. Key injected.`);

} catch (err) {
    console.error('Error injecting key:', err);
    process.exit(1);
}
