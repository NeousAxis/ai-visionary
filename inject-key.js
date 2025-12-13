const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_KEY_API;
const distDir = path.join(__dirname, 'dist');

console.log('Starting Build Process...');

const keyPreview = apiKey ? apiKey.substring(0, 4) + '...' : 'UNDEFINED';
console.log(`DEBUG: Env Var 'GEMINI_KEY_API' found. Length: ${apiKey ? apiKey.length : 0}. Preview: ${keyPreview}`);

if (!apiKey) {
    console.error('ERROR: GEMINI_KEY_API environment variable is NOT set. Build failed.');
    process.exit(1);
}

// 1. Create Clean Dist Folder
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

// 2. Helper to Copy Files/Dirs
function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

// 3. Copy Site Assets
const excludes = ['.git', '.github', '.gitignore', 'node_modules', 'dist', 'inject-key.js', 'vercel.json', 'README.md'];
fs.readdirSync(__dirname).forEach(item => {
    if (excludes.includes(item)) return;
    if (item.startsWith('.')) return; // skip hidden files

    copyRecursive(path.join(__dirname, item), path.join(distDir, item));
    console.log(`Copied: ${item}`);
});

// 4. Inject API Key into dist/ayo-env.js
const targetFile = path.join(distDir, 'ayo-env.js');
try {
    let content = fs.readFileSync(targetFile, 'utf8');
    // We look for the unique token
    const newContent = content.replace(/"KEY_HOLDER_XYZ"/g, `"${apiKey}"`);
    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log(`SUCCESS: Injected key into dist/ayo-env.js (Token KEY_HOLDER_XYZ replaced)`);
} catch (err) {
    console.error('Error injecting key:', err);
    process.exit(1);
}
console.log('Build Complete.');
