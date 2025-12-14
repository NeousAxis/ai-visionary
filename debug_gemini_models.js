const https = require('https');

const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!key) {
    console.error('ERROR: No API Key found in environment variables.');
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.error) {
                console.error('API ERROR:', json.error.message);
            } else if (json.models) {
                console.log('--- AVAILABLE MODELS FOR THIS KEY ---');
                json.models.forEach(m => {
                    if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                        console.log(m.name);
                    }
                });
                console.log('-----------------------------------');
            } else {
                console.log('UNEXPECTED RESPONSE:', json);
            }
        } catch (e) {
            console.error('PARSE ERROR:', e.message);
            console.log('RAW DATA:', data);
        }
    });

}).on('error', (e) => {
    console.error('NETWORK ERROR:', e.message);
});
