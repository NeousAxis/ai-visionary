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
