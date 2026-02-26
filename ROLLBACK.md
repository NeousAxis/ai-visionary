# 🛡️ JOURNAL DES VERSIONS & PROCÉDURE DE ROLLBACK

Ce fichier unique liste toutes les versions déployées de votre application.
Il sert de référence pour revenir en arrière en cas de problème.

## 🚨 RÈGLE D'OR : COMMENT REVENIR EN ARRIÈRE ?

Si la version actuelle est cassée, choisissez un **TAG** dans la liste ci-dessous et lancez cette commande dans le terminal :

```bash
./restore.sh LE_NOM_DU_TAG
```

*Exemple : `./restore.sh deploy-202601251430`*

---

## 📜 HISTORIQUE DES DÉPLOIEMENTS

| TAG (Version) | DATE | MESSAGE / DESCRIPTION |
| :--- | :--- | :--- |
| `deploy-202601251433` | 25/01/2026 14:33 | Initialisation Rollback System + Fix Kbis & Questions |
| `deploy-202601260927` | 26/01/2026 09:27 | Nettoyage Markdown Merdique (Demande Utilisateur) |
| `deploy-202601281549` | 28/01/2026 15:49 | Fix Interaction + Email ZIP |
| `deploy-202601281613` | 28/01/2026 16:13 | Fix Markdown Formatting & Duplicate Autre |
| `deploy-202601281618` | 28/01/2026 16:18 | Fix Progress Bar Stuck at Step 3 |
| `deploy-202601281643` | 28/01/2026 16:43 | Fix Stepper stuck & Markdown Styles |
| `deploy-202602130820` | 13/02/2026 08:20 | Infrastructure AYA V1: Registre dynamique, Sitemap, Profils Entités & Webhook Stripe |
| `deploy-202602262020` | 26/02/2026 20:20 | HOTFIX: Fix certificate link /certificate/ → /aya/e/ + Fix email scores mismatch (save email to analysis DB) |
| `deploy-202602262036` | 26/02/2026 20:36 | MAJOR FIX: Enrich ASR with methodology/certifications/KPIs + Dynamic FAQ + Fix permissions defaulting to false + Fix Autre UI bug erasing multi-selections |
| `deploy-202602262048` | 26/02/2026 20:48 | CRITICAL FIX: Questionnaire now validates ALL low-confidence items (methodology, legal form, certifications, contact). Threshold raised from 50 to 85. |
