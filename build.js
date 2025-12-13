const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_KEY_API;
const templateFile = path.join(__dirname, 'ayo-settings.template.js');
const targetFile = path.join(__dirname, 'ayo-settings.js');

console.log('Starting Build (In-Place Injection) - Anti-Cache Strategy...');

if (!apiKey || apiKey.includes('REPLACE_ME') || apiKey.includes('KEY_HOLDER_XYZ')) {
    console.error('ERROR: GEMINI_KEY_API environment variable is NOT set correctly (it looks like a placeholder or is empty). Build failed.');
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

    // We clean the key aggressively (trim + remove potential surrounding quotes copied by mistake)
    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    // Regex to match "KEY_HOLDER_XYZ" or 'KEY_HOLDER_XYZ'
    const newContent = content.replace(/["']KEY_HOLDER_XYZ["']/g, `"${cleanKey}"`);

    // Write directly to ayo-settings.js (overwriting the dummy file we committed)
    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log(`SUCCESS: Overwrote ayo-settings.js with injected key.`);

    // 2. Update index.html with cache-buster timestamp
    const indexFile = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexFile)) {
        let indexContent = fs.readFileSync(indexFile, 'utf8');
        const timestamp = new Date().getTime();
        // Replace TIMESTAMP_NOW or any previous timestamp pattern
        indexContent = indexContent.replace(/v=TIMESTAMP_NOW/g, `v=${timestamp}`);
        fs.writeFileSync(indexFile, indexContent, 'utf8');
        console.log(`SUCCESS: Updated index.html with timestamp ${timestamp}`);
    } else {
        console.error("ERROR: index.html not found!");
        process.exit(1);
    }

} catch (err) {
    console.error('Error injecting key:', err);
    process.exit(1);
}
