// Test URL regex
const urlRegex = /(https?:\/\/[^\s]+)/g;

const testUrls = [
    "https://globalworkflow.xyz",
    "http://globalworkflow.xyz",
    "globalworkflow.xyz",
    "www.globalworkflow.xyz",
    "https://example.com",
];

testUrls.forEach(url => {
    const match = url.match(urlRegex);
    console.log(`URL: "${url}" => Match: ${match ? match[0] : 'NO MATCH'}`);
});
