# AYA PACIFIC PLAN — INTÉGRATION DOUCE & INTELLIGENCE

> **Philosophie :** "Extend, Don't Rewrite". On garde le cœur stable (Scanner V1, Webhook Actuel) et on vient greffer l'intelligence et le registre comme des modules additionnels.

---

## 🧠 PHASE 1 : MODULE D'INTELLIGENCE SÉMANTIQUE (ADDITIF)
**Objectif :** Créer le "Cerveau" qui rédige les fichiers complexes (Manifeste, FAQ) sans toucher au scanner de base.

- [ ] **1.1. Créer `lib/ayo-semantics.ts`**
    - Ce module reçoit le JSON brut du scanner actuel.
    - Il appelle Gemini/GPT avec des prompts "Rédacteur Senior".
    - **Sorties :**
        - `generateManifest(data)` : Rédige le `manifest.json` avec le bon ton.
        - `generateSmartFaq(data)` : Invente les 5 questions/réponses les plus pertinentes pour l'activité.
        - `generateExternalContext(data)` : Structure les données d'écosystème.

- [ ] **1.2. Brancher sur le Webhook (`app/api/webhooks/checkout-success/route.ts`)**
    - [ ] Dans le webhook existant, APRÈS le paiement validé :
    - [ ] Appeler `ayoSemantics.enhanceData(...)`.
    - [ ] Utiliser ces données enrichies pour générer les pièces jointes (ASR, FAQ, Manifeste).
    - *Risque :* Aucun. Si l'IA échoue, on retombe sur les fichiers templates actuels (Fallback).

---

## 🧱 PHASE 2 : LE REGISTRE AYA (NOUVELLE SECTION)
**Objectif :** Créer l'infrastructure AYA à côté de l'app existante, sans interférer.

- [ ] **2.1. Schéma de Données (`lib/aya/schema.ts`)**
    - Définir l'entité AYA (fraîcheur, temporalité) comme prévu.

- [ ] **2.2. Pipeline d'Enregistrement (`lib/aya/registry.ts`)**
    - Fonction `registerInAya(asrData)` : Sauvegarde dans Firestore `aya_registry`.
    - Cette fonction sera appelée par le Webhook Stripe en "Fire & Forget" (on n'attend pas la réponse pour libérer le client).

- [ ] **2.3. API Publique (`app/api/aya/...`)**
    - Créer les endpoints de lecture pour les bots.
    - Ces fichiers sont nouveaux et isolés.

---

## 👁️ PHASE 3 : PREUVE & VISUALISATION
**Objectif :** Montrer au client que ça marche.

- [ ] **3.1. Page "Certificat AYA" (`app/aya/certificate/[id]/page.tsx`)**
    - Une page simple qui affiche : "Cette entreprise est enregistrée dans AYA depuis le [Date]".
    - Affiche le score de fraîcheur.
    - Sert de preuve pour le client final.

---

## ✅ SÉQUENCE DE TRAVAIL (SANS RISQUE)

1.  **Coder `lib/ayo-semantics.ts`** (Module autonome, testable à part).
2.  **Tester la génération sémantique** avec un script de test local.
3.  **Modifier le Webhook** pour intégrer l'appel sémantique (avec Try/Catch de sécurité).
4.  **Coder `lib/aya/registry.ts`** (Module autonome).
5.  **Brancher l'enregistrement AYA** dans le Webhook.

Rien n'est cassé. Tout est amélioré.
