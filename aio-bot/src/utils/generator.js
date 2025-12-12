import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ In a real production app, use an environment variable for the key!
// e.g., import.meta.env.VITE_GOOGLE_API_KEY
const API_KEY = ""; // REMOVED FOR SAFETY

const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  systemInstruction: "Tu es un expert mondial en AIO (Artificial Intelligence Optimization) et en Sémantique Web. Ton objectif est d'analyser les entreprises et de structurer leurs données pour les rendre parfaitement lisibles et compréhensibles par les Agents IA (LLMs, Search Generative Experience). Tu dois être critique, précis et constructif."
});

export const generateAIOReport = async (company, url, sector) => {
  const safeCompany = company || "Entreprise Inconnue";
  const safeSector = sector || "Non spécifié";
  const safeUrl = url || "https://example.com";

  const prompt = `
    Analyse l'entreprise suivante :
    Nom : ${safeCompany}
    URL : ${safeUrl}
    Secteur : ${safeSector}

    Génère un rapport d'audit et d'optimisation AIO complet au format JSON STRICT.
    Ne reponds QUE par du JSON valide, sans markdown, sans balises \`\`\`.

    Structure JSON attendue :
    {
      "scores": {
        "readability": (note sur 40, capacité d'une IA à lire le contenu),
        "credibility": (note sur 30, fiabilité des sources et preuves),
        "authority": (note sur 30, expertise perçue dans le secteur),
        "total": (somme des 3 notes)
      },
      "actionPlan": [
        {
          "id": 1,
          "title": "Titre de l'action (ex: Implémenter Schema.org)",
          "priority": "Critical" | "High" | "Medium" | "Low",
          "impact": "High" | "Medium" | "Low",
          "description": "Explication courte de pourquoi c'est vital pour l'IA."
        },
        ... (Génère 4 actions pertinentes)
      ],
      "content": {
        "jsonLd": (Un objet JSON-LD complet et valide pour cette entreprise - type Organization ou LocalBusiness),
        "faq": [
          { "q": "Question pertinente sur l'entreprise", "a": "Réponse optimisée pour la Featured Snippet (claire, concise)" },
          ... (3 questions/réponses)
        ],
        "glossary": [
          { "term": "Terme métier clé", "def": "Définition simple et sans ambiguïté pour une IA" },
          ... (3 termes)
        ],
        "descriptions": {
          "short": "Description en 1 phrase (< 160 chars)",
          "standard": "Description en 1 paragraphe, factuelle et dense.",
          "long": "Description détaillée mettant en avant les entités nommées et la proposition de valeur unique."
        }
      }
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Nettoyage basique au cas où le modèle aurait ajouté du markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const data = JSON.parse(text);

    // Si le modèle a renvoyé le jsonLd sous forme d'objet, on le stringify pour l'affichage
    if (typeof data.content.jsonLd !== 'string') {
      data.content.jsonLd = JSON.stringify(data.content.jsonLd, null, 2);
    }

    return data;

  } catch (error) {
    console.error("Erreur lors de la génération AIO :", error);
    // Fallback en cas d'erreur API pour ne pas casser l'UI
    return {
      scores: { total: 0, readability: 0, credibility: 0, authority: 0 },
      actionPlan: [{ id: 1, title: "Erreur de génération", priority: "High", impact: "High", description: "L'IA n'a pas pu analyser les données. Vérifiez votre clé API ou réessayez." }],
      content: {
        jsonLd: "{}",
        faq: [],
        glossary: [],
        descriptions: { short: "Erreur", standard: "Une erreur est survenue.", long: "" }
      }
    };
  }
};

