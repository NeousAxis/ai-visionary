# 🚀 Procédure de Déploiement AI-VISIONARY

Ce projet est configuré pour un **déploiement continu** (CD) via GitHub.

## 🔄 Méthode de Déploiement

Le déploiement vers la production (Firebase Hosting) est déclenché automatiquement lors d'un **push sur la branche `main`**.

### 📝 Étapes à suivre

1.  **Effectuer vos modifications** dans le code.
2.  **Préparer les fichiers** :
    ```bash
    git add .
    ```
3.  **Valider les changements** (Message clair obligatoire) :
    ```bash
    git commit -m "TYPE: Description courte des changements"
    ```
    *Exemple: `git commit -m "FIX: Correction du design des checkboxes"`*

4.  **Envoyer vers GitHub (Déclenche le déploiement)** :
    ```bash
    git push origin main
    ```

## ⏳ Après le push

Une fois la commande `git push` réussie :
1.  GitHub récupère le code.
2.  Une **GitHub Action** (ou Webhook) se déclenche.
3.  Elle construit le projet (Build).
4.  Elle déploie automatiquement sur **Firebase Hosting**.

⚠️ **Note** : Le déploiement peut prendre quelques minutes (Build + Propagation).

## 🛠 En cas d'erreur de push

Si le push est rejeté (ex: fichiers trop gros, conflit) :
1.  Vérifiez les messages d'erreur dans le terminal.
2.  Si un fichier est trop volumineux (ex: `.firebase/`), assurez-vous qu'il est dans `.gitignore`.
3.  Faites un `git pull` si nécessaire pour récupérer les changements distants avant de repousser.
