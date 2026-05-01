# MIGRATION VERCEL → VPS INFOMANIAK

> **Strategie 100 % suisse decidee 28 avril 2026.** AI Visionary doit etre 100% suisse. Aucun service US (Cloudflare interdit, AWS interdit, Vercel a sortir). Migration en cours.
> Extrait de CLAUDE.md le 1er mai 2026 pour désengorger le contexte. CLAUDE.md référence ce fichier en section 6.5.

---

## Etat infra cible

```
INTERNET
   |
   v
DNS Infomaniak
   |
   v
[Anti-DDoS Infomaniak — inclus avec Public Cloud]
   |
   v
VPS aya-bot (83.228.229.212, 4C/8G)
   |
   |--- ufw (22/80/443 only)
   |--- fail2ban (ban abus auto)
   |--- nginx (TLS Let's Encrypt + rate limit + cache + gzip/brotli)
   |--- PM2 -> Next.js prod
   |       |--- lit Postgres VPS local (25 860 entites)
   |       |--- lit Supabase via SDK (4 438 entites legacy, READ ONLY)
   |--- Postgres 16 self-hosted (localhost:5432)
   |--- crontab : pg_dump + cron jobs Next.js
```

---

## Ce qui reste pour basculer (~6-7h de travail)

| # | Etape | Duree |
|---|-------|-------|
| MV.1 | Code a jour sur le VPS : rsync + npm install (`pg` + `@types/pg`) + `npm run build` + `pm2 restart` | 30-45 min |
| MV.2 | Verifier `.env.local` du VPS contient TOUTES les vars (Supabase URL/KEY, Stripe, Gemini, SMTP, Admin/Session/AYO keys, HF_TOKEN, Newsletter) | 30 min |
| MV.3 | Refactorer `getAyaEntitiesAggregated` pour lire Postgres VPS en local (sans HTTP fetch) + brancher dans `/api/aya/{search,live,entity,stats}` | 1 h |
| MV.4 | TLS Let's Encrypt sur `ai-visionary.xyz` + `www.ai-visionary.xyz` (certbot) | 30 min |
| MV.5 | nginx config server block + reverse proxy `:3000` + `gzip`/`brotli` + `proxy_cache` + `limit_req_zone` | 1 h |
| MV.6 | ufw firewall (22/80/443 only) + fail2ban (regles nginx + ssh) | 30 min |
| MV.7 | Cron jobs Linux : `expire-entities` (1h), `expiry-reminders` (9h), `review-reminders` (9h) via `curl localhost:3000/api/cron/...` | 30 min |
| MV.8 | Tests E2E sur `beta.ai-visionary.xyz` : pages publiques + diagnostic V2 + Stripe checkout + webhook + email Pack PRO + OTP + API AYA fusionnee + sitemap 30k+ URLs | 2 h |
| MV.9 | Reduire TTL DNS `ai-visionary.xyz` a 300s (preparation switch) | 5 min |
| MV.10 | Switch DNS : `A ai-visionary.xyz 83.228.229.212` + `CNAME www → @`, garder Vercel actif 48h | 5 min + propagation |
| MV.11 | Surveillance 48h (logs, monitoring uptime suisse) | continu |
| MV.12 | Desactiver Vercel + retirer auto-deploy GitHub | 5 min |
| MV.13 | Supprimer record DNS `beta.ai-visionary.xyz` | 5 min |

---

## Notes importantes

**Stripe webhook** : URL ne change pas (`ai-visionary.xyz/api/webhooks/checkout-success` suit le DNS). Aucune action cote dashboard Stripe.

**Post-bascule** : `/api/aya-local/*` deviennent redondantes (l'app sur le VPS lit Postgres en local) — a fusionner dans `/api/aya/*` ou supprimer.

**Règle critique rsync** : TOUJOURS exclure `.env.local` du rsync vers le VPS (incident 28 avril : `--delete` a ecrase les vars `VPS_PG_*` locales).
