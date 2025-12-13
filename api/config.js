export default function handler(request, response) {
    const apiKey = process.env.OPENAI_KEY_API || process.env.GEMINI_KEY_API;

    if (!apiKey) {
        return response.status(500).json({ error: 'API Key not configured on server' });
    }

    response.status(200).json({
        apiKey: apiKey
    });
}
