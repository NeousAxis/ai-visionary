---
description: Architecture complète du scoring AYO et bugs résolus (Février 2025) - LIRE EN PREMIER avant toute modification de route.ts
---

# 🧠 AYO SCORING & QUESTIONNAIRE - Architecture Complète

## 📁 Fichiers Critiques
- `app/api/chat/route.ts` — Le cerveau du chatbot AYO (~2175 lignes)
- `lib/aio-score-engine.ts` — Le moteur de scoring déterministe (computeAioScore)
- `lib/aio-scanner.ts` — Le scanner de site web (scanUrlForAioSignals)
- `lib/aya/registry.ts` — Le registre AYA (registerOrUpdateEntity) — ⚠️ SEUL le webhook Stripe peut écrire dedans
- `lib/db.ts` — Accès Firestore (analyses, entités, OTP)
- `app/components/AyoChat.tsx` — Le composant frontend du chat

---

## 🔄 FLUX COMPLET DU CHATBOT (État Machine)

```
1. USER envoie URL → triggerMode = "SCAN_AND_QUESTION"
2. Système scanne le site → extractedAnswers (18 réponses indexées 1-18)
3. Système construit scan_state avec blockKeys[0..17] mappés par INDEX
4. Ownership question → step 1
5. Warning pédagogique (vérité) → step 2 (truth_confirmation)
6. Questions séquentielles via combinedQueue → steps 3+
7. Quand combinedQueue épuisée (nextBlockName === "FINALISATION") → FINAL_ANALYSIS
8. Score déterministe calculé → Résultat affiché
```

## 🔑 LES 18 BLOCS CRITIQUES (blockKeys)

```typescript
const blockKeys = [
    "identite.name",                     // 1. Nom
    "identite.juridical_country",        // 2. Pays
    "identite.legal_form",               // 3. Statut juridique
    "identite.sector",                   // 4. Secteur
    "offre.audience",                    // 5. Public cible
    "offre.offer_summary",               // 6. Offre
    "offre.business_model",              // 7. Modèle économique
    "identite.team",                     // 8. Équipe
    "offre.value_proposition",           // 9. Mission
    "structure_technique.technologies",  // 10. Technologies
    "structure_technique.ai_usage",      // 11. IA
    "external_context.presence",         // 12. Réseau
    "engagements_conformite.certifications", // 13. Certifications
    "external_context.keywords",         // 14. Mots-clés
    "external_context.intents",          // 15. Intentions
    "external_context.contact",          // 16. Contact
    "processus_methodes.process_steps",  // 17. Méthodologie ← CRITIQUE
    "indicateurs.key_indicators"         // 18. Indicateurs  ← CRITIQUE
];
```

**⚠️ IMPORTANT : `allBlockNames` (dans le CONTINUE_QUESTIONING) DOIT être identique à `blockKeys`. Ils sont définis à DEUX endroits dans route.ts. Si l'un change, l'autre DOIT changer aussi.**

## 📊 Calcul du stepsCompleted

```
stepsCompleted = nombre de messages USER après l'URL 
                 MOINS les "requêtes pédagogiques" (Pourquoi? Comment?)
```

Le `queueIndex` est calculé comme : `stepsCompleted - 2` (car steps 1 et 2 sont ownership + warning)

## ⚙️ La combinedQueue

```
combinedQueue = [items low confidence à VALIDER] + [items unknown à DEMANDER]
```
Priorise `identite.juridical_country` en premier.

Le déterminisme repose sur : `nextBlockName = combinedQueue[queueIndex] || "FINALISATION"`
- Si `"FINALISATION"` → triggerMode passe à `"FINAL_ANALYSIS"`

---

## 🐛 BUGS RÉSOLUS (25 Février 2025)

### BUG 1 : Inscription fantôme dans aya_registry (CORRIGÉ)
**Symptôme** : Un prospect qui fait un diagnostic gratuit se retrouve inscrit comme "client existant" dans la base AYA.
**Cause** : Un appel à `registerOrUpdateEntity()` dans le bloc `FINAL_ANALYSIS` de route.ts (après le calcul du score) inscrivait TOUT le monde dans le registre.
**Fix** : Suppression complète de ce bloc. SEUL le webhook Stripe (`checkout-success/route.ts`) peut créer des entités dans `aya_registry`.
**Fichier** : `app/api/chat/route.ts`, ~ligne 1815 (supprimé)

### BUG 2 : Le LLM coupe le questionnaire prématurément (CORRIGÉ)
**Symptôme** : Le chatbot ne pose que 5-7 questions au lieu de parcourir les 18 blocs, puis affiche directement le score final avec 0/20 pour Indicateurs.
**Cause** : Deux détections textuelles dans le code (lignes ~1437 et ~1487) vérifiaient si la réponse du LLM contenait "analyse en cours" ou "FINAL_ANALYSIS". Le LLM hallucinait parfois ces termes dans ses réponses, déclenchant une fin prématurée.
**Fix** : Désactivation complète (`if (false)`) de ces deux blocs. Le seul chemin vers `FINAL_ANALYSIS` est maintenant le passage déterministe via `nextBlockName === "FINALISATION"` (= la file est vide).
**Fichier** : `app/api/chat/route.ts`, ~lignes 1437-1443 et 1487-1490

### BUG 3 : Le handler pédagogique (vérité/mensonge) se déclenche en plein questionnaire (CORRIGÉ)
**Symptôme** : En milieu de questionnaire, le chatbot affiche le bloc "Si vous mentez..." au lieu de poser la question suivante, puis le bouton "Bien compris" envoie `main_menu|URL` qui casse le flux.
**Cause** : Le regex `/(men[st]|mentir|fausse|fake|triche|vérité|honnête)/` sur `lowText` pouvait matcher des mots dans les réponses utilisateur. De plus, le LLM régurgitait le texte pédagogique depuis l'historique.
**Fix** : Ajout d'un guard `!hasScanInHistory` — le handler pédagogique ne se déclenche PLUS quand un questionnaire est en cours.
**Fichier** : `app/api/chat/route.ts`, ~ligne 839

### BUG 4 : `main_menu|` route vers EXISTING_CLIENT pendant le questionnaire (CORRIGÉ)
**Symptôme** : Si le bouton `main_menu|URL` est cliqué pendant le questionnaire (via un handler intercepteur), le système bascule en mode "client existant" et coupe le questionnaire.
**Cause** : La Priority 2.5 forçait `triggerMode = "EXISTING_CLIENT"` sans vérifier si un questionnaire était en cours.
**Fix** : Si `hasScanInHistory && !hasFinalScore`, on route vers `CONTINUE_QUESTIONING` au lieu de `EXISTING_CLIENT`.
**Fichier** : `app/api/chat/route.ts`, ~ligne 560

### BUG 5 : Mapping extractedAnswers par `.key` (CORRIGÉ)
**Symptôme** : Toutes les réponses du scan étaient classées en "unknown" car le code cherchait `answer.key` qui n'existe pas.
**Cause** : Le LLM retourne `{question_id, answer, confidence}` indexé 1-18, PAS de propriété `.key`. Le mapping doit être fait par INDEX (`blockKeys[index]`).
**Fix** : Retour au `blockKeys.forEach((key, index) => { const answer = extractedAnswers[index]; ... })`.
**Fichier** : `app/api/chat/route.ts`, ~ligne 1046

---

## 🚨 RÈGLES ABSOLUES (NE JAMAIS VIOLER)

1. **JAMAIS** écrire dans `aya_registry` depuis le chatbot. Seul le webhook Stripe le fait.
2. **JAMAIS** laisser le LLM décider de la fin du questionnaire. Seule la file déterministe (`combinedQueue`) le fait.
3. **TOUJOURS** vérifier que `blockKeys` et `allBlockNames` sont identiques et contiennent 18 éléments.
4. **TOUJOURS** mapper les `extractedAnswers` par INDEX, pas par propriété `.key`.
5. Le handler pédagogique (vérité) ne doit se déclencher que quand `!hasScanInHistory`.
6. **TOUJOURS** utiliser le score DB (chatbot) dans le webhook, JAMAIS recalculer à froid.
7. Le lien certificat dans l'email est `/aya/e/{id}`, PAS `/certificate/{id}`.
8. **TOUJOURS** passer `entity_type` dans l'entityDraft du webhook (déduction par `legal_form`/`business_type`).

---

## 🐛 BUGS RÉSOLUS (25 Février 2025, après-midi)

### BUG 6 : Score webhook ≠ Score chatbot (CORRIGÉ)
**Symptôme** : Le chatbot affiche 39.1/100 mais l'email de confirmation affiche 23.8/100.
**Cause** : Le webhook `checkout-success/route.ts` recalculait le score à froid via `performFullAnalysis()` sans les réponses du questionnaire, au lieu d'utiliser le score déjà sauvé en DB.
**Fix** : Le webhook utilise maintenant `db.getLatestAnalysisByEmail()` qui retourne le score du chatbot. Si la DB a le score, on l'utilise directement.
**Fichier** : `app/api/webhooks/checkout-success/route.ts`, ~ligne 384-472

### BUG 7 : Pas de bonus ASR après enregistrement (CORRIGÉ)
**Symptôme** : Le score AYA reste identique au score du diagnostic gratuit.
**Cause** : Le moteur de score a un `isAyaRegistered` bonus (ligne 170 de `aio-score-engine.ts`) mais il n'était jamais activé car `is_aya_registered` n'était pas injecté dans l'extract.
**Fix** : Ajout d'un bonus ASR de +10 points (cappé à 100) directement dans le webhook lors de l'inscription. Variable `asrBonusScore`.
**Fichier** : `app/api/webhooks/checkout-success/route.ts`, ~ligne 495

### BUG 8 : Lien certificat FAUX dans l'email (CORRIGÉ)
**Symptôme** : Le bouton "Voir mon Certificat" dans l'email pointe vers `/certificate/{id}` (qui n'existe pas correctement).
**Cause** : URL hardcodée incorrecte dans le template HTML de l'email.
**Fix** : Changé en `https://www.ai-visionary.xyz/aya/e/{id}`.
**Fichier** : `app/api/webhooks/checkout-success/route.ts`, ~ligne 571

### BUG 9 : entity_type non transmis → défaut "company" (CORRIGÉ)
**Symptôme** : Association Éclore affiche "company" dans AYA. Des entités tech affichent "association".
**Cause** : Le webhook ne passait pas `entity_type` dans l'entityDraft. Le registry.ts utilisait le défaut `'company'`.
**Fix** : Détection automatique du `entity_type` à partir de `legal_form`/`business_type` de l'analyse. Mapping: association/ong/fondation → 'association', SARL/SA/SAS/GmbH/Inc → 'company', etc.
**Fichier** : `app/api/webhooks/checkout-success/route.ts`, ~ligne 492

### BUG 10 : Affichage "Suisse · company" en anglais sur la page AYA (CORRIGÉ)
**Symptôme** : Le badge affiche le pays en texte brut et le type en anglais.
**Cause** : `entity.country_legal` et `entity.entity_type` étaient affichés tels quels sans traduction.
**Fix** : Affichage du code pays en majuscules (2 chars) + traduction `entity_type` : company→Entreprise, association→Association, public_body→Organisme Public, individual→Indépendant.
**Fichier** : `app/aya/page.tsx`, ~ligne 133

---

## 📦 Déploiement
Voir `/deploy_vercel` workflow.
```bash
npm run build && npx vercel --prod
```

## 🗑️ Nettoyage DB d'urgence
Route temporaire disponible : `GET /api/debug/clean?secret=ayo1234`
Supprime les entrées fantômes dans `aya_registry` pour eclore-asso.org.
**À SUPPRIMER après stabilisation.**

