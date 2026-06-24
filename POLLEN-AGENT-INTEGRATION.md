# Pollen — Kit d'intégration agent

> Comment brancher un **vrai agent IA** sur AYA + le cashback Pollen. Deux surfaces au
> choix : **MCP** (le plus simple pour un agent) ou **REST**. Tu es l'**opérateur d'agent**
> (cf. VISION-POLLEN-AGENTS.md §8) : ton agent amène un client réel → cashback à l'utilisateur
> + commission à plat (miel) pour toi, sur transaction consommée. Zéro avance, zéro burn.

---

## La boucle (4 temps)

```
1. DÉCOUVRIR   l'agent interroge AYA (search/ask) → services VÉRIFIÉS classés
2. OFFRE       get_cashback_offer(domain) → { offer, token }   (jeton signé Ed25519)
3. TRANSACTION l'utilisateur achète le service (via l'agent)
4. RÉCLAMER    claim_cashback(token, proof) → claim enregistré (validation outcome-only)
```

Le **jeton d'attribution** lie l'offre à la transaction. La validation est **manuelle / outcome-only**
au MVP → aucun paiement auto, fraude impossible.

---

## Surface A — MCP (recommandé)

Serveur : `mcp-server-aya` (stdio). 5 outils :

| Outil | Rôle |
|---|---|
| `search_companies(query, limit?)` | trouver des entreprises vérifiées (nom/domaine/secteur/pays) |
| `get_company_details(domain)` | fiche complète + score AIO + ASR |
| `get_registry_stats()` | stats du registre |
| **`get_cashback_offer(domain, agent_id?)`** | offre cashback active **+ jeton signé** |
| **`claim_cashback(token, proof?, agent_id?, principal_ref?)`** | réclamer après transaction réelle |

Config (Claude Desktop / tout orchestrateur MCP) :
```json
{
  "mcpServers": {
    "aya-registry": {
      "command": "node",
      "args": ["/chemin/vers/mcp-server-aya/dist/index.js"]
    }
  }
}
```

Flux typique côté agent : `search_companies` → choisir → `get_cashback_offer` (garder le `token`)
→ transaction → `claim_cashback(token)`.

---

## Surface B — REST (`https://ai-visionary.xyz/api`)

**Découvrir** (NL → recommandation rédigée + cashback annoté) :
```bash
curl -X POST https://ai-visionary.xyz/api/pollen-agents/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"un hébergeur suisse RGPD pour données de santé","locale":"fr"}'
# → { answer, picks:[{name,domain,score,cashback?}], keyword }
```

**Offre + jeton** (avant de recommander/transiger) :
```bash
curl -X POST https://ai-visionary.xyz/api/pollen-agents/cashback-offer \
  -H 'Content-Type: application/json' \
  -d '{"domain":"exemple.com","agent_id":"mon-agent-001"}'
# → { offer:{service_name,cashback_type,cashback_value,currency}, token, exp }   (ou {offer:null,token:null})
```

**Réclamer** (après transaction réelle) :
```bash
curl -X POST https://ai-visionary.xyz/api/pollen-agents/claim-cashback \
  -H 'Content-Type: application/json' \
  -d '{"token":"<jeton>","proof":{"order_id":"...","amount":120},"agent_id":"mon-agent-001","principal_ref":"<ref opaque, PAS de PII>"}'
# → { status:"claimed", claim_id }   |   409 si déjà réclamé / rejeu
```

**Recherche / fiche brutes** (API AYA publique, cache CDN) :
```
GET /api/aya/search?q={query}&limit=8
GET /api/aya/entity/{domain}
GET /api/aya/llm/{domain}     # 6 champs optimisés LLM
```

---

## Règles (le moat)

- **Récompense sur l'OUTCOME** (transaction consommée), jamais sur le clic/requête.
- **Commission à plat, non-distordante** : identique quel que soit le service → l'agent reste **neutre**
  (ne recommande pas le plus offrant). C'est la condition de confiance.
- **Anti-fraude par identité** : le jeton est signé (Ed25519), à usage unique, expirable.
  `principal_ref` = référence opaque de l'utilisateur, **jamais de données personnelles**.

> Tu as déjà des agents ? Branche-les sur le MCP (5 outils) ou les 3 endpoints REST ci-dessus.
> Pour démarrer sans deal réel : le registre répond déjà ; les offres cashback apparaissent dès
> qu'un service est branché (deals directs ou réseaux Awin/Impact — voir POLLEN-DEAL-KIT.md).
