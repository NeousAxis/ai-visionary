# Deploiement du correctif scan-timeout sur le VPS aya-bot

> **DEPLOYE ET VERIFIE le 21 aout 2026 a 07:35.** Ce document reste comme trace de la
> recette et du rollback. Rien a rejouer.

> Commit : `35120fa2` sur `claude/ai-visionary-scan-timeout-f5ceb0`.
> Sauvegarde des 7 sources prod deja prise :
> `/home/ubuntu/backups/app-src-pre-scan-timeout-20260821.tgz`

`/home/ubuntu/app` n'est pas un depot git et porte des hotfix non commites
(heartbeat SSE, auto index AYA, sondes de pages legales). **Aucun fichier ne doit
etre ecrase en bloc**, sauf les deux qui sont identiques au depot.

## 1. Les 2 fichiers identiques depot/prod : copie directe

Verifie d'abord que les md5 correspondent toujours a ce qui a ete constate
(`34c9071...` pour llm-provider, `d0519c2...` pour llm-agent) :

```bash
ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'cd /home/ubuntu/app && md5sum lib/llm-provider.ts lib/micro-agents/llm-agent.ts'
```

```bash
cd "/Users/cyrilleger/AI VISIONARY/.claude/worktrees/ai-visionary-scan-timeout-f5ceb0" && scp -i ~/.ssh/aya-bot lib/llm-provider.ts lib/micro-agents/llm-agent.ts ubuntu@83.228.229.212:/tmp/ && ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'mv /tmp/llm-provider.ts /home/ubuntu/app/lib/llm-provider.ts && mv /tmp/llm-agent.ts /home/ubuntu/app/lib/micro-agents/llm-agent.ts'
```

## 2. Les 5 fichiers qui divergent : patch en place

Le depot et la prod different sur ces fichiers, donc on pose des ancres exactes
plutot que de copier. Enregistre ce bloc dans `/tmp/apply.py` sur le VPS puis
lance `python3 /tmp/apply.py`. Le script est idempotent et s'arrete net si une
ancre a bouge.

Les 5 changements a poser :

| Fichier | Changement |
|---|---|
| `lib/micro-agents/orchestrator.ts` | `process/indicators` et `industry keywords` lances via `Promise.all`, `{ retries: 0 }` sur les deux |
| `app/api/diagnostic/scan/route.ts` | constante `SCAN_DEADLINE_MS`, watchdog `setTimeout` apres le heartbeat, `clearTimeout(deadline)` dans le `finally` |
| `app/diagnostic/page.tsx` | `ev.message === 'scan_timeout' ? t('scanTimeout') : ...` |
| `messages/en.json` | cle `scanTimeout` juste apres `scanFailed` |
| `messages/fr.json` | idem, version FR |

Le contenu exact de chaque hunk est dans le commit `35120fa2` :

```bash
cd "/Users/cyrilleger/AI VISIONARY/.claude/worktrees/ai-visionary-scan-timeout-f5ceb0" && git show 35120fa2 -- lib/micro-agents/orchestrator.ts app/api/diagnostic/scan/route.ts app/diagnostic/page.tsx messages/en.json messages/fr.json
```

Deux hunks different de la version du depot, parce que la prod a le heartbeat SSE
que `main` n'a pas :

- le watchdog s'insere **apres** `}, 10000);` (fin du `setInterval` heartbeat), et
  ajoute `clearInterval(heartbeat);` avant de fermer le flux ;
- le `finally` de la prod contient deja `clearInterval(heartbeat); closed = true;`,
  il suffit d'y glisser `clearTimeout(deadline);` entre les deux.

## 3. Build propre et redemarrage

Le filet de rollback `cp -al` est obligatoire, et le build doit etre propre,
sinon le cache Turbopack ressert une compilation perimee.

```bash
ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'cd /home/ubuntu/app && rm -rf .next.pre-scan-timeout && cp -al .next .next.pre-scan-timeout && rm -rf .next && npm run build && pm2 restart ai-visionary'
```

## 4. Verification

```bash
ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'cd /home/ubuntu/aya-report && node scan-probe.mjs --dry-run'
```

Attendu : `complete` avec un score, autour de 14 s (contre 18 s avant, la mise en
parallele des deux derniers appels LLM economise environ 4 s sur un jour calme).

Puis confirmer dans le log que les deux appels partent bien ensemble : les lignes
`Extract business methodology` et `You are a business classifier` doivent porter
**le meme horodatage**, alors qu'elles etaient separees de 60 s le 21 aout.

```bash
ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'pm2 logs ai-visionary --lines 60 --nostream | grep -E "llm-agent. Calling|agent. .*completed|Industry keywords|scan. Analysis saved"'
```

## Rollback

```bash
ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'cd /home/ubuntu/app && tar xzf /home/ubuntu/backups/app-src-pre-scan-timeout-20260821.tgz && rm -rf .next && mv .next.pre-scan-timeout .next && pm2 restart ai-visionary'
```
