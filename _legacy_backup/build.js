const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;

console.log('Starting Build (Distribution Strategy)...');

if (!apiKey) {
    console.error('ERROR: OPENAI_KEY_API is missing from environment!');
    process.exit(1);
}

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Helper to Copy Recursive
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

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
    const destPath = path.join(publicDir, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
});

// INJECT KEY INTO public/index.html
const indexPublic = path.join(publicDir, 'index.html');
let content = fs.readFileSync(indexPublic, 'utf8');

// Replace Placeholder
if (content.includes('PLACEHOLDER_INLINE')) {
    content = content.replace('PLACEHOLDER_INLINE', apiKey);
    console.log('SUCCESS: Injected API Key into public/index.html');

    // DEBUG: Print proof
    console.log('DEBUG CHECK: File Content Start ->', content.substring(300, 500));
} else {
    console.error('WARNING: Placeholder not found in index.html');
}

fs.writeFileSync(indexPublic, content, 'utf8');
console.log('Build Complete: Output in public/');
