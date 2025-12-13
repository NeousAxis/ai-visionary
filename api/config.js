module.exports = (req, res) => {
    const apiKey = process.env.OPENAI_KEY_API;

    if (!apiKey) {
        return res.status(500).json({ error: 'Server Config Error: API Key missing' });
    }

    res.status(200).json({
        apiKey: apiKey
    });
};
