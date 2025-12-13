# Procédure de Sauvegarde et Release

Ce document décrit la procédure standard à suivre pour sauvegarder l'état actuel du projet, publier une release officielle sur GitHub et effectuer le nettoyage nécessaire.

## 1. Sauvegarde du Code (Git)

Cette étape synchronise votre code local avec le dépôt distant GitHub.

1.  **Vérifier l'état des fichiers** :
    ```bash
    git status
    ```
2.  **Ajouter les modifications** :
    ```bash
    git add .
    ```
3.  **Commettre les changements** (soyez explicite dans le message) :
    ```bash
    git commit -m "Description des changements effectués"
    ```
4.  **Envoyer vers GitHub** :
    ```bash
    git push origin main
    ```

---

## 2. Création d'une Release Officielle (GitHub CLI)

Une fois le code envoyé, cette étape crée une version figée (tag) et une "Release" visible dans l'interface GitHub.

1.  **Choisir un numéro de version** (ex: `v1.0.1`, `v1.1.0` - suivre [SemVer](https://semver.org/)).
2.  **Créer la release** :
    ```bash
    gh release create v1.0.X --title "v1.0.X - Titre de la version" --notes "Liste des changements majeurs ici."
    ```
    *Optionnel : Si vous n'avez pas installé `gh` CLI, vous pouvez le faire manuellement sur le site GitHub > Releases > Draft a new release.*

---

## 3. Nettoyage (Cleanup)

Cette étape assure que le projet reste propre en supprimant les fichiers temporaires ou obsolètes.

1.  **Supprimer les dossiers de backup (si présents)** :
    ```bash
    rm -rf _legacy_backup
    ```
2.  **Vérifier les fichiers inutiles** :
    S'assurer qu'aucun fichier sensible (`.env` local) ou dossier de build (`.next`, `node_modules`) n'a été commité par erreur (vérifier `.gitignore`).

---

## Résumé en une ligne de commande

Pour aller vite, vous pouvez enchaîner les commandes (en remplaçant le message et la version) :

```bash
git add . && git commit -m "Update" && git push && gh release create v1.0.X --title "v1.0.X" --notes "Update"
```
