#!/bin/bash

# Script de Restauration (Rollback)
# Usage: ./restore.sh nom-du-tag

TAG=$1

if [ -z "$TAG" ]; then
    echo "❌ Erreur : Vous devez fournir le nom du Tag."
    echo "Usage : ./restore.sh deploy-YYYYMMDD..."
    echo "Voir ROLLBACK.md pour la liste."
    exit 1
fi

echo "🔄 Restauration de la version : $TAG..."

# Vérifier si le tag existe
if git rev-parse "$TAG" >/dev/null 2>&1; then
    git checkout "$TAG"
    echo "✅ SUCCÈS : Le code est revenu à la version $TAG."
    echo "⚠️  Attention : Vous êtes en mode 'détaché'. Pour refaire des modifs, créez une branche ou revenez au présent."
    echo "Pour revenir au présent (dernière version) : git checkout main"
else
    echo "❌ Erreur : Le Tag '$TAG' n'existe pas."
fi
