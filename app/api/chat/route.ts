import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages } = await req.json();

    // Use the environment variable securely (auto-detected by openai provider)
    const result = await streamText({
        model: openai('gpt-4o-mini'),
        system: "Tu es AYO, un assistant IA expert en structuration de données d'entreprise (AIO). Tu dois analyser les informations fournies par l'utilisateur pour l'aider à rendre son entreprise lisible par les IA.",
        messages,
    });

    return result.toTextStreamResponse();
}
