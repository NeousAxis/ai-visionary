const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_KEY_API;

console.log('Starting Build (Distribution Strategy)...');

if (!apiKey) {
    console.error('ERROR: OPENAI_KEY_API is missing from environment!');
    process.exit(1);
}

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Files to copy
const filesToCopy = [
    'index.html',
    'style.css',
    'ayo-core.js',
    'ayo-settings.js',
    'AYO_SECTORS_V1.json',
    'AYO_SINGULAR_RECORD_TEMPLATE.json'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
});

// INJECT KEY INTO dist/index.html
const indexDist = path.join(distDir, 'index.html');
let content = fs.readFileSync(indexDist, 'utf8');

// Replace Placeholder
if (content.includes('PLACEHOLDER_INLINE')) {
    content = content.replace('PLACEHOLDER_INLINE', apiKey);
    console.log('SUCCESS: Injected API Key into dist/index.html');
} else {
    console.error('WARNING: Placeholder not found in index.html');
}

fs.writeFileSync(indexDist, content, 'utf8');
console.log('Build Complete: Output in dist/');
