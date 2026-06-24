# Runbook — Moteur d'outreach AI Visionary (cold B2B)

> Canal = **SMTP individuel throttlé depuis une identité dédiée**, JAMAIS la Newsletter Infomaniak
> (CGU opt-in) et JAMAIS `hello@` (déliverabilité OTP/Stripe/Pack PRO). Réf : [[project_outreach_engine]].
> Tout est **armé mais INERTE par défaut** : aucun email réel ne part tant que les 3 conditions
> d'armement ne sont pas réunies (voir §3).

---

## 1. Architecture (ce qui a été construit)

| Brique | Fichier |
|---|---|
| Tables (recipients / suppression / events) | `migrations/2026-06-24_outreach_engine.sql` |
| Helpers DB (import, batch, mark, suppression, stats, preview) | `lib/db-local-pg.ts` (section OUTREACH ENGINE) |
| Templates bilingues FR/EN (angle standard ouvert) | `lib/outreach/templates.ts` |
| Choix de langue par pays | `lib/outreach/lang.ts` |
| Sender SMTP dédié throttlé (+ List-Unsubscribe one-click) | `lib/outreach/sender.ts` |
| Orchestrateur d'envoi (cap + throttle + dry-run) | `lib/outreach/run.ts` |
| Admin (preview/import/send/test/suppress/verify) | `app/api/admin/outreach/route.ts` |
| Désinscription (lien + one-click RFC 8058) | `app/api/outreach/unsubscribe/route.ts` |
| Cron warmup quotidien (gated) | `app/api/cron/outreach/route.ts` |

Flux : `import` (registre → file) → `preview`/`test` → `send` (warmup quotidien) → désinscriptions &
bounces alimentent la suppression globale.

---

## 2. Variables d'environnement (sur le VPS, `.env.local`)

```
# Identité d'envoi DÉDIÉE (à créer chez Infomaniak — ne PAS réutiliser hello@)
OUTREACH_SMTP_USER=outreach@ai-visionary.xyz
OUTREACH_SMTP_PASSWORD=...
OUTREACH_SMTP_HOST=mail.infomaniak.com      # optionnel (défaut = SMTP_HOST)
OUTREACH_SMTP_PORT=587                       # optionnel
OUTREACH_FROM_NAME=Cyril Léger · AI Visionary
OUTREACH_REPLY_TO=hello@ai-visionary.xyz     # optionnel

# Garde-fous d'envoi
OUTREACH_ENABLED=false                        # ⚠️ tant que != "true" → dry-run forcé (rien ne part)
OUTREACH_DAILY_CAP=80                          # plafond par exécution (warmup : démarrer à ~30-50)
OUTREACH_GAP_MS=1500                           # délai entre 2 envois
OUTREACH_RATE_PER_SEC=1                         # throttle pool nodemailer
OUTREACH_CAMPAIGN=default
```

---

## 3. Armement (3 conditions — sinon dry-run forcé)

1. **Boîte dédiée créée** chez Infomaniak (`outreach@` ou `registry@`) + SPF/DKIM/DMARC OK sur le domaine.
2. **`OUTREACH_SMTP_USER` + `OUTREACH_SMTP_PASSWORD`** définis dans `.env.local` du VPS.
3. **`OUTREACH_ENABLED=true`**.

Tant que l'une manque, `runOutreachBatch` force `dryRun` → **aucun email réel**. C'est volontaire :
l'envoi cold de masse est une porte one-way (déliverabilité + légal). **GO explicite de Cyril requis**
avant de passer `OUTREACH_ENABLED=true`.

---

## 4. Procédure d'exploitation

Appliquer la migration (une fois) sur le VPS :
```bash
psql "$VPS_PG_DSN" -f migrations/2026-06-24_outreach_engine.sql
```

Aperçu de la cible (lecture seule, n'écrit rien) :
```bash
curl -X POST "https://ai-visionary.xyz/api/admin/outreach?secret=$ADMIN_SECRET" \
  -H 'Content-Type: application/json' -d '{"action":"preview","limit":50}'
```

Importer la file (verticale digital/SaaS/crypto/fintech, exclut DE par défaut) :
```bash
curl -X POST "https://ai-visionary.xyz/api/admin/outreach?secret=$ADMIN_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"action":"import","campaign":"default","limit":2000}'
```

Vérifier la connexion SMTP de l'identité dédiée :
```bash
curl -X POST ".../api/admin/outreach?secret=$ADMIN_SECRET" -H 'Content-Type: application/json' -d '{"action":"verify"}'
```

**Test réel** (un email à une adresse de contrôle — prouve le pipeline AVANT le ramp) :
```bash
curl -X POST ".../api/admin/outreach?secret=$ADMIN_SECRET" -H 'Content-Type: application/json' \
  -d '{"action":"test","to":"neousaxis@gmail.com","lang":"fr"}'
```

Envoi d'une fournée (dry-run tant que non armé ; sinon respecte le cap) :
```bash
curl -X POST ".../api/admin/outreach?secret=$ADMIN_SECRET" -H 'Content-Type: application/json' \
  -d '{"action":"send","max":30}'
```

État de la file :
```bash
curl ".../api/admin/outreach?secret=$ADMIN_SECRET"
```

Warmup automatique (cron quotidien) — déjà gated. Brancher dans le cron VPS :
```
0 9 * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://ai-visionary.xyz/api/cron/outreach
```

---

## 5. Garde-fous légaux & déliverabilité (NON négociables)

- **Warmup obligatoire** : démarrer à ~30-50/jour, monter progressivement. Jamais de blast.
- **Exclusion pays** : `DE` exclu par défaut (UWG interdit le cold B2B). Vérifier au cas par cas avant
  d'inclure d'autres pays stricts.
- **Désinscription** : lien en clair + en-tête List-Unsubscribe one-click sur **chaque** email. Toute
  désinscription/bounce → suppression globale (plus jamais contacté).
- **Identité postale** dans le pied de chaque email (AI Visionary · Genève · Suisse).
- **Test avec contenu réel final** avant tout volume ([[feedback_newsletter_test_real_content]]).
- **GO explicite de Cyril** avant `OUTREACH_ENABLED=true`.

---

## 6. Déploiement (rappel)

`rsync` **chirurgical** des fichiers outreach uniquement vers `/home/ubuntu/app/`, **exclure `.env.local`**
([[feedback_rsync_env_local]]), `npm run build`, `pm2 restart ai-visionary`. Ne jamais pousser toute la
branche. Méthode identique au déploiement cashback ([[project_cashback_engine_mvp]]).
