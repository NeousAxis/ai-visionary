const fs = require('fs');
const path = require('path');

const apiKey = process.env.OPENAI_KEY_API || process.env.OPENAI_API_KEY;

console.log('Starting Build (Distribution Strategy)...');

if (!apiKey) {
    console.error('ERROR: OPENAI_KEY_API is missing from environment!');
    process.exit(1);
}

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
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

// Read Root Directory
const rootDir = __dirname;
const items = fs.readdirSync(rootDir);

// Ignore List
const ignoreList = ['.git', '.github', 'node_modules', 'dist', 'api', '.env', '.gitignore', 'package.json', 'package-lock.json', 'vercel.json', 'build.js', 'inject-key.js'];

items.forEach(item => {
    if (!ignoreList.includes(item)) {
        const src = path.join(rootDir, item);
        const dest = path.join(distDir, item);
        copyRecursiveSync(src, dest);
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
