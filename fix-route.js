const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app/api/chat/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. REMPLACER LE BLOC REGEX (Lignes 424-436)
// On cherche une signature large
const oldRegexBlock = /const urlRegex = \/\(\(?:https\?.*?\)\)\/gi;[\s\S]*?if \(lastMessage\.role === 'user' && userUrlMatch && !isTriggerEmail\) \{/m;

// Si le oldRegexBlock ne matche pas exactement à cause des changements précédents, on essaie une approche plus ciblée
// On va remplacer tout le bloc entre "IMPROVED REGEX" et "1. SCANNING"

const startMarker = "// IMPROVED REGEX: Supports https://, http://, www., or bare domains ending in .com/.xyz/etc";
const endMarker = "console.log(\"🚀 TRIGGERING DETERMINISTIC AIO ENGINE...\");";

const newBlock = `// FIXED REGEX: Robust URL detection
        const urlRegex = /(?:https?:\\/\\/)?(?:www\\.)?[-a-zA-Z0-9]{1,256}\\.[a-zA-Z]{2,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&//=]*)/gi;
        
        const rawUrlMatch = lastMessage.content.match(urlRegex);
        
        // CHECK IF IT IS AN EMAIL (Priority: If Email -> It's NOT a URL for analysis)
        const triggerEmailRegex = /^[^\s@]+@[^\s@]+\\.[^\s@]+$/;
        const isTriggerEmail = lastMessage.content.trim().match(triggerEmailRegex);

        const userUrlMatch = isTriggerEmail ? null : rawUrlMatch;

        let finalResponseText = "";
        let isAnalysisRun = false;

        // IF USER GIVES A URL -> TRIGGER DETERMINISTIC ANALYSIS ENGINE
        if (lastMessage.role === 'user' && userUrlMatch) {`;

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    console.log("Found Regex Block! Replacing...");
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    content = before + newBlock + "\n            " + after;
} else {
    console.error("Could not find regex block markers!");
    // Fallback force search
}

// 2. SUPPRIMER LE BLOC DUPLIQUÉ (Lignes 648-656)
const duplicateBlockStart = `                // Find the user message that contained the URL
                const historyUrlMatchMsg = messages.find((m: any) => m.role === 'user' && m.content.match(historyUrlRegex));`;

const duplicateBlockEnd = `                    if (analyzedUrl && !analyzedUrl.startsWith('http')) analyzedUrl = 'https://' + analyzedUrl;
                }`;

const dupStartIndex = content.lastIndexOf(duplicateBlockStart); // lastIndexOf car c'est le 2ème bloc (le dupliqué)
const dupEndIndex = content.lastIndexOf(duplicateBlockEnd);

if (dupStartIndex !== -1 && dupEndIndex !== -1) {
    console.log("Found Duplicate Block! Removing...");
    // On vérifie que ce n'est pas le PREMIER bloc (qui est légitime)
    // Le premier bloc est autour de la ligne 630. Le deuxième vers 650.
    // lastIndexOf devrait prendre le deuxième.

    // On supprime du début du bloc + longueur du bloc de fin
    const finalDupEndIndex = dupEndIndex + duplicateBlockEnd.length;

    const beforeDup = content.substring(0, dupStartIndex);
    const afterDup = content.substring(finalDupEndIndex);

    content = beforeDup + afterDup;
} else {
    console.warn("Could not find duplicate block (maybe already removed?)");
}

// 3. CLEAN UP DUPLICATED COMMENTS (Optional)
content = content.replace(`        // 🔍 DETECT IF WE ARE IN ANALYSIS PHASE (State 1 -> 2)
        // Check if the User provided an URL in the last message or if we are prompting for it
        // 🔍 DETECT IF WE ARE IN ANALYSIS PHASE (State 1 -> 2)
        // Check if the User provided an URL in the last message or if we are prompting for it`,
    `        // 🔍 DETECT IF WE ARE IN ANALYSIS PHASE (State 1 -> 2)
        // Check if the User provided an URL in the last message or if we are prompting for it`);


fs.writeFileSync(filePath, content, 'utf8');
console.log("File updated successfully!");
