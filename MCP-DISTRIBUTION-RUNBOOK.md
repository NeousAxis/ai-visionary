# MCP DISTRIBUTION RUNBOOK — faire TROUVER le connecteur AYA par les agents du monde

> TODO 44c — **PRIORITÉ N°1**. Le serveur MCP distant est LIVE :
> **`https://ai-visionary.xyz/agents/mcp`** (Streamable HTTP, zéro code, 5 outils).
> Ce runbook = tout ce qu'il faut pour le faire DÉCOUVRIR. Chaque section dit
> ce qui est **AUTONOME (déjà fait)** et ce qui demande un **CLIC CYRIL**.

## 0. Ce qui est déjà en place (autonome, déployé)

Surfaces auto-descriptives crawlables par les agents et les LLMs :

| Surface | URL | Rôle |
|---------|-----|------|
| `llms.txt` | `https://ai-visionary.xyz/llms.txt` | Le fichier que les LLMs lisent pour comprendre le site. Headline = MCP + cashback. |
| Page agents | `https://ai-visionary.xyz/for-agents` | Porte d'entrée builders : config copier-coller, 5 outils, économie cashback. Bilingue. |
| MCP discovery | `https://ai-visionary.xyz/.well-known/mcp.json` | Manifeste de découverte du serveur MCP. |
| AI plugin | `https://ai-visionary.xyz/.well-known/ai-plugin.json` | Mentionne désormais le MCP (`x_mcp`). |
| OpenAPI | `https://ai-visionary.xyz/.well-known/openapi.json` | Spéc REST (fallback non-MCP). |
| `server.json` | racine du repo | Manifeste **registre MCP officiel** (remote streamable-http). |
| `smithery.yaml` | racine du repo | Métadonnées listing Smithery (remote server). |

**Vérif rapide après déploiement :**
```bash
curl -s https://ai-visionary.xyz/llms.txt | head -5
curl -s https://ai-visionary.xyz/.well-known/mcp.json | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}\n" https://ai-visionary.xyz/for-agents
# MCP vivant :
curl -s -X POST https://ai-visionary.xyz/agents/mcp \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | head -c 300
```

---

## 1. Registres MCP — où soumettre

Tous pointent vers le **même endpoint distant**. Aucun build, aucun hébergement de leur côté.
Identité de soumission recommandée : compte GitHub **NeousAxis** + email **hello@ai-visionary.xyz**.

### 1A. Registre officiel MCP (registry.modelcontextprotocol.io) — `server.json`
**Le plus important** : c'est la source que la plupart des autres agrègent.
- Manifeste prêt : `server.json` (racine du repo). Namespace reverse-DNS = `xyz.ai-visionary/aya-registry`.
- **CLIC CYRIL** (≈10 min, une fois) :
  1. Installer le publisher : `brew install mcp-publisher` *(ou télécharger la release `modelcontextprotocol/registry`)*.
  2. Vérifier la propriété du domaine (namespace `xyz.ai-visionary`) → ajouter un **enregistrement DNS TXT** que le CLI affiche, sur `ai-visionary.xyz` (registrar Infomaniak, domain ID `2128919`, API DNS dispo — voir [[project_infomaniak_dns_api]]).
     - *Alternative sans DNS* : `mcp-publisher login github` (OAuth NeousAxis) → namespace `io.github.neousaxis/aya-registry`. Changer le `name` dans `server.json` en conséquence.
  3. `mcp-publisher publish` depuis la racine du repo (lit `server.json`).
- Si le `$schema`/format a évolué : `mcp-publisher init` régénère un squelette valide → y recopier `description`, `remotes[].url`, `websiteUrl`, `repository`.

### 1B. Smithery (smithery.ai)
- Type : **Remote Server** (serveur déjà hébergé, rien à builder).
- Métadonnées prêtes : `smithery.yaml`.
- **CLIC CYRIL** : se connecter sur https://smithery.ai (GitHub), "Add Server" → "Connect a remote/hosted server" → URL `https://ai-visionary.xyz/agents/mcp`, transport `streamable-http`, auth `none`. Copier description + tags depuis `smithery.yaml`. Homepage = `/for-agents`.

### 1C. mcp.so
- Annuaire communautaire. Soumission via formulaire "Submit" sur https://mcp.so/submit (ou PR sur leur repo selon la période).
- **CLIC CYRIL** : remplir le formulaire — nom `AYA Registry & Pollen Agents`, URL serveur `https://ai-visionary.xyz/agents/mcp`, repo `github.com/NeousAxis/ai-visionary`, description (voir §3), tags (registry, business-data, cashback, search, rag).

### 1D. Glama (glama.ai/mcp/servers)
- Glama **crawle automatiquement** les serveurs depuis GitHub + le registre officiel. Publier sur le registre officiel (1A) suffit souvent à y apparaître.
- **CLIC CYRIL** (accélérer) : sur https://glama.ai, se connecter (GitHub) → "Add server" → coller l'URL distante + repo.

### 1E. PulseMCP (pulsemcp.com)
- Agrège depuis le registre officiel + soumissions manuelles.
- **CLIC CYRIL** : https://www.pulsemcp.com/submit → URL serveur + repo + description.

### 1F. awesome-mcp-servers (GitHub, punkpeye/awesome-mcp-servers)
- **AUTONOME possible** : c'est une PR GitHub. Entrée prête (voir `BROADCAST` ci-dessous, bloc "awesome-mcp"). Fork → ajouter la ligne sous la catégorie *Search* / *Commerce* → PR depuis le compte NeousAxis.
- **CLIC CYRIL** : valider/ouvrir la PR depuis son compte GitHub.

---

## 2. Ordre d'exécution conseillé (≈30 min total côté Cyril)

1. **Déployer** les surfaces (front VPS — voir §4). ← prérequis, autonome.
2. **Registre officiel (1A)** — débloque Glama/PulseMCP en cascade.
3. **Smithery (1B)** — plus gros trafic builders.
4. **awesome-mcp PR (1F)** — gratuit, durable, SEO.
5. **mcp.so (1C)** + **PulseMCP (1E)** — formulaires rapides.
6. **Broadcast** (voir `POLLEN-AGENTS-BROADCAST.md`).

---

## 3. Texte canonique réutilisable (copier-coller partout)

**Nom :** `AYA Registry & Pollen Agents`
**Une ligne :** Search 367,000+ verified businesses worldwide and earn cashback when your agent routes a real purchase. The open registry AI agents query to ground recommendations.
**Endpoint :** `https://ai-visionary.xyz/agents/mcp` (Streamable HTTP, no auth)
**Repo :** `https://github.com/NeousAxis/ai-visionary`
**Homepage :** `https://ai-visionary.xyz/for-agents`
**Tags :** registry, business-data, search, cashback, affiliate, grounding, rag, commerce
**Tools :** search_companies, get_company_details, get_registry_stats, get_cashback_offer, claim_cashback

---

## 4. Déploiement front VPS (rappel — incident Turbopack)

Voir [[incident_vps_deploy_turbopack_stale]]. **Build complet obligatoire** :
```bash
cd "/Users/cyrilleger/AI VISIONARY"
rm -rf .next && npm run build            # local, vérifier 0 erreur
# rsync vers VPS (SANS --delete → supprimer manuellement les fichiers retirés)
rsync -az -e "ssh -i ~/.ssh/aya-bot" .next/ ubuntu@83.228.229.212:/home/ubuntu/app/.next/
rsync -az -e "ssh -i ~/.ssh/aya-bot" public/ app/ messages/ ubuntu@83.228.229.212:/home/ubuntu/app/{public,app,messages}/  # voir note paths -R
ssh -i ~/.ssh/aya-bot ubuntu@83.228.229.212 'cd /home/ubuntu/app && pm2 restart ai-visionary'
```
SSH port 22 parfois bloqué par le WiFi de Cyril → **hotspot iPhone** ([[feedback_vps_ssh_port22_wifi]]).

---

## 5. État

- [x] Surfaces auto-descriptives créées (`llms.txt`, `/for-agents`, `.well-known/mcp.json`, `ai-plugin` MAJ).
- [x] Manifestes registres prêts (`server.json`, `smithery.yaml`).
- [x] Runbook + broadcast rédigés.
- [ ] Déploiement front VPS.
- [ ] Soumissions registres (CLIC CYRIL — §1).
- [ ] Broadcast communautés (CLIC CYRIL — fichier dédié).
