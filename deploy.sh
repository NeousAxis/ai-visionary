#!/bin/bash

# Script de Déploiement Sécurisé avec Journalisation
# Usage: ./deploy.sh "Message de commit"

MSG=${1:-"Update (Auto-deploy)"}
TIMESTAMP=$(date +"%Y%m%d%H%M")
PRETTY_DATE=$(date +"%d/%m/%Y %H:%M")
TAG_NAME="deploy-${TIMESTAMP}"
LOG_FILE="ROLLBACK.md"

echo "🚀 Démarrage de la procédure de déploiement sécurisé..."

# 1. Mettre à jour le Journal ROLLBACK.md
echo "| \`$TAG_NAME\` | $PRETTY_DATE | $MSG |" >> "$LOG_FILE"

# 2. Git Pipeline
echo "💾 Sauvegarde locale (Git Commit)..."
git add .
git commit -m "$MSG"

echo "🏷️  Création du Tag de version : $TAG_NAME"
git tag -a "$TAG_NAME" -m "$MSG"

# 3. Lancer Vercel
echo "☁️  Envoi vers Vercel Production..."
vercel --prod --yes

echo "✅ Succès ! Version $TAG_NAME déployée et documentée dans $LOG_FILE."
