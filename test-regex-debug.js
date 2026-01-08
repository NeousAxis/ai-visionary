const urlRegex = /((?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gi;

const inputs = [
    "globalworkflow.xyz",
    "https://globalworkflow.xyz",
    "moi@gmail.com",
    "test"
];

inputs.forEach(input => {
    const match = input.match(urlRegex);
    console.log(`Input: "${input}" -> Match: ${match ? match[0] : 'NO'}`);
});
