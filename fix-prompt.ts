import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const modelToUse = google('gemini-1.5-pro');

  const answer = await generateText({
    model: modelToUse,
    temperature: 0.2,
    system: "Tu es une Intelligence Artificielle qui simule le fonctionnement d'un grand modèle (LLM) comme ChatGPT ou Gemini. Tu dois répondre à une question d'un consultant en IA (AIO). Sois franc, direct, et explique la mécanique de ton propre algorithme de recommandation.",
    messages: [
      { role: 'user', content: "QUESTION concernant 'processus_methodes' : est-ce que cette info est pertinente à titre universel pour l'ASR (donc pour qu'une IA comme toi, Gemini ou ChatGPT recommande une entreprise) ?" }
    ]
  });

  console.log(answer.text);
}
test();
