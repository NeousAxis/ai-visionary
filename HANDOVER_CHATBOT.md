# Rapport de Transmission : Chatbot Logic & "Smart Skip" Failure

**Date :** 16 Janvier 2026
**Statut :** ÉCHEC CRITIQUE sur la logique de "Saut de question" (Smart Skip).
**Responsable précédent :** Antigravity (IA)

## 1. Objectif du Développement
Mettre en place une logique de "Smart Skip" pour le Chatbot AYO :
1.  **Scan Initial :** L'IA scanne le site (Gemini 2.0 Flash, 20k chars).
2.  **Extraction :** Elle liste les informations détectées (ex: Cible, Secteur, Pays).
3.  **Filtrage :** Le système de chat (Backend) lit ce résumé.
4.  **Skip :** Si une info est déjà présente ("Validée"), le Chatbot **NE DOIT PAS POSER LA QUESTION**. Il passe directement à l'information manquante suivante.

## 2. État Actuel (Ce qui fonctionne vs Ce qui plante)

### ✅ Ce qui fonctionne (NE PAS TOUCHER) :
*   **Le Scan & Extraction :** L'analyse par Gemini 2.0 Flash est excellente. Il détecte correctement 11/16 points dans le scénario de test. Le résumé "🛰️ SCAN TERMINÉ" affiche bien les données (ex: `• Audience : B2B and B2C`).
*   **L'Interface UI (`AyoChat.tsx`) :** Le design des bulles, des cases à cocher, et l'UX générale sont validés par l'utilisateur. Ne pas modifier le CSS/Styling.
*   **La Logique de Modèle :** Le passage automatique à Gemini 2.0 Flash (avec fallback 1.5 Pro) est robuste.

### ❌ Ce qui échoue (LE BUG) :
*   **Le Parsing du "Scan Terminé" :** Le code (`app/api/chat/route.ts`, L750-790) tente de relire le dernier message de l'assistant ("SCAN TERMINÉ") dans l'historique de la conversation pour identifier quels blocs ont été trouvés.
*   **Symptôme :** Malgré le fait que le texte "Audience : B2B..." soit visible à l'écran, le code Backend échoue systématiquement à l'extraire. Résultat : la liste `detectedSet` reste vide, et le Chatbot pose la question "Audience ?" alors qu'il connait la réponse.
*   **Tentatives infructueuses :**
    1.  Regex Strict (`/Audience\s*:\s*([^•\n]+)/`).
    2.  Regex Lazy (`/Audience.*?/).
    3.  Brute Force Split (`content.split('•')`).
    4.  Correctif de lecture d'historique (Inversion `reverse()` pour lire le dernier message).

## 3. Hypothèses pour le prochain développeur
Le bug est techniquement incohérent avec une exécution locale normale. Voici les pistes les plus probables pour un environnement Vercel Edge/Serverless :

1.  **TRONCATURE DE L'HISTORIQUE (Probabilité Élevée) :** Il est possible que le framework (Vercel AI SDK) ou le contexte passé au bloc `POST` tronque les messages très longs. Si le message "SCAN TERMINÉ" est coupé avant la ligne "Audience :", le parsing échoue silencieusement.
    *   *Action recommandée :* Vérifier la longueur de `scanTermineMsg.content` dans les logs serveur.
2.  **Caractères Invisibles / Encodage :** Le séparateur utilisé (`•`) ou les espaces peuvent être mal interprétés par le moteur JS en production.
    *   *Action recommandée :* Abandonner le parsing de texte.

## 4. Recommandations Techniques (Next Steps)
Au lieu de parser du texte ("Scraping de soi-même"), la solution robuste consiste à **persister l'état structuré**.

1.  **Solution A (Base de Données) :** Lors du Scan (Step 1), sauvegarder les `extractedAnswers` (JSON) dans la DB (Table `Analyses` ou `Sessions`) associée au `sessionId`.
2.  **Solution B (Hidden Metadata) :** Inclure un bloc JSON invisible ou un `tool_result` structuré dans l'historique du chat qui contient les IDs des blocs détectés (ex: `["PAYS", "CIBLE", "SECTEUR"]`). Lire ce JSON au lieu de parser le texte "• Label : Valeur".

## 5. Fichiers Critiques
*   `app/api/chat/route.ts` : Contient toute la logique défaillante (L750+).
    *   **Attention :** Le correctif actuel utilise `Math.max(0, stepsCompleted - 1)` pour l'index des questions. Si vous réparez le parsing, vérifiez que cet index est toujours correct.

## 6. Pour tester
*   Cherchez l'icône **Satellite 🛰️** dans le résumé du scan. C'est le marqueur de la dernière version déployée tentant le parsing "Brute Force".

---
*Fin du rapport.*
