# PLAN D’IMPLÉMENTATION AYA — REGISTRE AI-NATIVE

## 📜 VISION
**AYA (AYO Authenticated Registry)** est un registre de "recommandabilité" natif pour les IA.
- **But :** Permettre aux agents conversationnels (bots) de trouver des entités structurées et validées sans scraping complexe.
- **Alimentation :** Automatique via AYO (Diagnostic & Structuration).
- **Règle d'Or :** Les données anciennes (>36 mois) sont toujours visibles mais leur "priorité de recommandation" est réduite mécaniquement.

---

## 🧱 PHASE 0 : FONDATIONS & SCHÉMA DE DONNÉES
**Objectif :** Définir la structure immuable de l'entité AYA. C'est le contrat technique.

- [ ] **0.1. Créer le Schéma Zod (`lib/aya/schema.ts`)**
    - [ ] Définir l'interface `AyaEntity` (champs canoniques, temporalité, origine).
    - [ ] Définir l'interface `RecommendationsMetadata` (fraîcheur, priorité, score).
    - [ ] Valider les règles de typage strict des champs "Bot-Readable".

- [ ] **0.2. Définir la Structure Firestore**
    - [ ] Collection `aya_registry` (indexée par `entity_id` ou `slug`).
    - [ ] Règles de sécurité Firestore (lecture publique, écriture admin seulement).

---

## ⚙️ PHASE 1 : LOGIQUE CŒUR & RECOMMANDABILITÉ
**Objectif :** Coder les "Lois Naturelles" du registre (Fraîcheur, Priorité).

- [ ] **1.1. Moteur de Calcul de Fraîcheur (`lib/aya/freshness.ts`)**
    - [ ] Fonction `calculateFreshness(lastUpdate: Date): FreshnessStatus`.
    - [ ] Logique des 3 statuts : `fresh` (<24 mois), `aging` (24-36 mois), `stale` (>36 mois).
    - [ ] Calcul du score de priorité machine (1.0 -> 0.5 -> 0.1).

- [ ] **1.2. Moteur d'Ingestion (Pipeline AYO → AYA)**
    - [ ] Créer une fonction `registerEntityInAya(asrData, origin)` qui :
        - [ ] Génère un UUID unique.
        - [ ] Met à jour `created_at` (si nouveau) et `last_update` (toujours).
        - [ ] Calcule `valid_until` selon le plan (36 mois achat ou +1 mois abo).
        - [ ] Stocke l'ASR complet et sa signature crypto.

---

## 🔌 PHASE 2 : API POUR LES BOTS (INTERFACES MACHINE)
**Objectif :** Exposer les données proprement pour que les IA puissent les consommer.

- [ ] **2.1. Route d'Accès Entité (`/api/aya/v1/entities/[id]`)**
    - [ ] Retour JSON pur (sans HTML).
    - [ ] Headers optimisés (Cache-Control, ETag).
    - [ ] Réponse standardisée pour les erreurs (404 si introuvable, jamais de 500).

- [ ] **2.2. Route de Search/Index (`/api/aya/v1/search`)**
    - [ ] Paramètres : `sector`, `country`, `freshness_min`.
    - [ ] Pagination efficace.
    - [ ] *Optionnel :* Sitemap global des entités (`/aya-sitemap.xml`) pour Google.

---

## 👻 PHASE 3 : FRONTEND "GHOST" (PAGE PUBLIQUE HUMAIN/BOT)
**Objectif :** Une page unique par entité, minimaliste pour l'humain, riche pour le bot.

- [ ] **3.1. Page Dynamique (`app/aya/registry/[id]/page.tsx`)**
    - [ ] **Vue Humain :**
        - [ ] Logo AYA + Nom Entité + Statut (Validé / Ancien).
        - [ ] Lien vers le site officiel de l'entité.
        - [ ] Explication courte : "Cette entité est certifiée pour les IA".
    - [ ] **Vue Bot (Head & Metadata) :**
        - [ ] Injection balises `meta` spécifiques IA.
        - [ ] Injection `JSON-LD` complet pointant vers l'API AYA.
        - [ ] *No-Marketing Zone* : Pas de texte superflu.

---

## ⏱️ PHASE 4 : AUTOMATISATION & MAINTENANCE (CRON)
**Objectif :** Faire vivre la règle de dégradation sans intervention humaine.

- [ ] **4.1. Tâche Planifiée "Daily Decay" (`api/cron/aya-decay`)**
    - [ ] Script qui tourne tous les 24h.
    - [ ] Scanne les entités actives.
    - [ ] Vérifie `valid_until`.
    - [ ] Met à jour le statut (`fresh` -> `aging` -> `stale`) et la priorité.
    - [ ] *Optionnel :* Envoie un email de rappel au propriétaire ("Vos données vieillissent").

---

## ✅ PHASE 5 : INTÉGRATION & TEST
**Objectif :** Connecter AYA au reste de l'écosystème existant (Stripe, AYO Diagnostic).

- [ ] **5.1. Webhook Stripe (`checkout-success`)**
    - [ ] Modifier le webhook existant pour déclencher `registerEntityInAya` après paiement réussi.
    - [ ] Gérer le cas "Abonnement" (mise à jour mensuelle de la validité ? ou annuelle ?).

- [ ] **5.2. Test "Dogfooding"**
    - [ ] Enregistrer "AI-Visionary" elle-même dans AYA.
    - [ ] Vérifier que l'API bot retourne bien les données.
    - [ ] Vérifier que la page publique s'affiche correctement.
