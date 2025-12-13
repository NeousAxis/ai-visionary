const fs = require('fs');
const path = require('path');

const apiKey = process.env.GEMINI_KEY_API;
const distDir = path.join(__dirname, 'dist');

console.log('Starting Build Process...');

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
    // Replace the literal string "GEMINI_KEY_API" with the actual value of the env var
    const newContent = content.replace(/GEMINI_KEY_API/g, apiKey);
    fs.writeFileSync(targetFile, newContent, 'utf8');
    console.log(`SUCCESS: API Key injected into dist/ayo-env.js (Length: ${apiKey.length})`);
} catch (err) {
    console.error('Error injecting key:', err);
    process.exit(1);
}
console.log('Build Complete.');
