// Test exact URL
const urlRegex = /(https?:\/\/[^\s]+)/g;
const userInput = "https://globalworkflow.xyz/";

const match = userInput.match(urlRegex);
console.log(`Input: "${userInput}"`);
console.log(`Match:`, match);
console.log(`Match exists:`, !!match);
