# 🔍 Guide de Diagnostic Webhook Stripe

## Problème
**Les emails après paiement ne sont pas reçus.**

## Checklist de Vérification

### ✅ 1. Vérifier que le Webhook Stripe est enregistré
1. Aller sur [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Vérifier qu'il existe un endpoint pointant vers :
   ```
   https://ai-visionary.xyz/api/webhooks/checkout-success
   ```
3. Événement écouté : `checkout.session.completed`

### ❓ 2. Consulter les Logs Vercel
1. Aller sur [Vercel Dashboard > Logs](https://vercel.com/your-project/logs)
2. Filtrer par fonction : `api/webhooks/checkout-success`
3. Chercher après votre paiement test :
   - `🔔 STRIPE WEBHOOK EVENT RECEIVED`
   - `Processing Success for Session`
   - `✅ Email sent to...`
   - `❌` erreurs potentielles

### 🧪 3. Tester le Webhook Manuellement (Via Stripe CLI)

#### Option A : Installer Stripe CLI
```bash
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Écouter les événements et les rediriger vers localhost
stripe listen --forward-to https://ai-visionary.xyz/api/webhooks/checkout-success

# Dans un autre terminal, déclencher un événement test
stripe trigger checkout.session.completed
```

#### Option B : Simuler depuis Stripe Dashboard
1. Aller sur [Stripe Webhooks > Événements de test](https://dashboard.stripe.com/test/webhooks)
2. Cliquer sur votre endpoint
3. Envoyer un événement test `checkout.session.completed`
4. Copier le payload JSON et remplacer :
   ```json
   {
     "type": "checkout.session.completed",
     "data": {
       "object": {
         "id": "cs_test_xxxxx",
         "payment_status": "paid",
         "customer_details": {
           "email": "test@votre-domaine-test.com"
         },
         "amount_total": 9900
       }
     }
   }
   ```

### 🔎 4. Vérifier Firebase
Si le webhook est appelé mais que l'email n'est pas envoyé, c'est possiblement Firebase :

1. Aller sur [Firebase Console > Firestore](https://console.firebase.google.com/)
2. Collection : `analyses`
3. Chercher par `url` ou `email` votre test
4. Vérifier que les données existent

#### Si pas de données dans Firebase :
- Le problème est dans `app/api/chat/route.ts` (lignes 570-591)
- Vérifier que `db.saveAnalysis()` fonctionne
- Regarder les logs : `💾 ANALYSIS SAVED TO DB`

### 🚨 5. Points de Défaillance Courants

#### A. Email Domain Validation (lignes 679-705)
```typescript
if (emailDomain === analyzedDomain) {
    emailValidated = true;
} else {
    // EMAIL REJETÉ !
    console.warn(`❌ SECURITY REJECTION`);
}
```

**Solution** : Si vous testez avec un email différent du domaine analysé, la validation échoue.

#### B. Analyse Non Trouvée dans Firebase (lignes 286-333)
```typescript
const constructedUrl = `https://${emailDomain}`;
dbAnalysis = await db.getLatestAnalysisByUrl(constructedUrl);
if (!dbAnalysis) {
    console.warn(`⚠️ No analysis found in DB`);
}
```

**Solution** : L'URL reconstruite depuis l'email doit EXACTEMENT matcher celle stockée.

Exemple de problème :
- Stocké : `ai-visionary.xyz`
- Recherché : `https://ai-visionary.xyz`
→ PAS DE MATCH !

#### C. Resend Quotas / Blacklist
- Domaine `@gmail.com` peut être bloqué en mode test
- Vérifier sur [Resend Dashboard > Logs](https://resend.com/logs)

### 🎯 6. Solution Temporaire : Désactiver la Validation
Dans `/app/api/webhooks/checkout-success/route.ts` ligne 348 :

```typescript
// AVANT
const VALIDATION_DISABLED = false;

// APRÈS (temporaire pour test)
const VALIDATION_DISABLED = true;
```

Cela permet de tester si le problème vient de la validation domaine.

---

## 🛠️ Prochaines Actions Proposées
1. Tester `/api/debug-email` → Confirmer Resend OK
2. Consulter Logs Vercel après paiement test
3. Vérifier Firebase pour présence des données
4. Partager les logs trouvés pour diagnostic précis
