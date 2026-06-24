# Pollen Agents — Kit Deal (BD)

> One-pager à envoyer/présenter à un service candidat (digital / SaaS / crypto / fintech / e-commerce)
> pour signer un **deal cashback** (CPA agent-native). Pollen Agents = une **route de
> ai-visionary.xyz/pollen-agents**, propulsée par le registre AYA. Pas un produit séparé.
>
> Verticale pilote : **digital / SaaS / crypto / fintech / e-commerce** (commerce agent-natif,
> conversion en ligne attribuable, marges pour financer le CPA). Réf : VISION-POLLEN-AGENTS.md §8/§8bis.

---

## 🇫🇷 Pitch (FR)

**Le constat.** Les gens ne cherchent plus eux-mêmes sur Internet — ils demandent à un agent IA
(ChatGPT, Claude, Gemini…) de le faire. Bientôt, ces agents *achèteront* pour leurs utilisateurs.
La couche qui décide quels services les agents voient et choisissent est en train de se définir.

**La proposition.** AYA est le registre suisse, ouvert, où les agents IA interrogent et comparent
des services vérifiés. **Pollen** ajoute par-dessus une économie simple : un agent amène un client réel
chez vous → vous payez une commission **uniquement sur la transaction consommée** (CPA). Aucun budget
d'avance, aucun coût tant qu'aucun client réel n'arrive.

**Pourquoi c'est différent de la pub.**
- **Vous ne payez que sur l'outcome** (vente réelle, pas un clic). Zéro risque.
- **Commission à plat, non-distordante** : Pollen ne touche jamais plus d'un partenaire que d'un autre,
  donc l'agent reste **neutre** (il ne recommande pas le plus offrant). Votre place se gagne sur la
  qualité de vos données, pas sur l'enchère.
- **Anti-fraude par identité des deux côtés** : le cashback ne coule que vers un agent identifié, sous
  mandat vérifié, pour un utilisateur réel, sur une transaction prouvée.

**Ce que vous gagnez.**
1. Un **nouveau canal de distribution** : les agents IA comme apporteurs d'affaires.
2. Un **crochet consommateur** : le client final touche un **cashback** (financé par votre CPA) — il a une
   raison concrète de passer par un agent qui vous propose.
3. Une **présence vérifiée** dans le registre que les IA consultent — gratuite pour l'instant.

**Comment ça marche, concrètement.**
1. Vous fixez avec nous une commission CPA (ex. 10 % de la valeur d'un nouveau client).
2. Un agent interroge AYA, reçoit votre fiche **+ un jeton d'attribution signé**.
3. L'utilisateur achète chez vous.
4. L'agent réclame le cashback → on valide la **transaction consommée** → cashback à l'utilisateur,
   commission à l'opérateur de l'agent, le reste à Pollen.

**Engagement de départ : zéro.** On signe un deal, on l'active dans le registre, et l'argent ne bouge
**que** quand vous gagnez un client.

---

## 🇬🇧 Pitch (EN)

**The shift.** People no longer search the web themselves — they ask an AI agent (ChatGPT, Claude,
Gemini…) to do it. Soon these agents will *buy* on behalf of their users. The layer deciding which
services agents see and pick is being defined right now.

**The offer.** AYA is the Swiss, open registry where AI agents query and compare verified services.
**Pollen** adds a simple economy on top: an agent brings you a real customer → you pay a commission
**only on the consumed transaction** (CPA). No upfront budget, no cost until a real customer shows up.

**Why it's not advertising.**
- **You pay only on outcome** (a real sale, not a click). Zero risk.
- **Flat, non-distorting commission**: Pollen never earns more from one partner than another, so the
  agent stays **neutral** (it doesn't recommend the highest bidder). You win on data quality, not bidding.
- **Two-sided identity anti-fraud**: cashback only flows to an identified agent, under a verified mandate,
  for a real user, on a proven transaction.

**What you get.**
1. A **new distribution channel**: AI agents as lead-bringers.
2. A **consumer hook**: the end user receives **cashback** (funded by your CPA) — a concrete reason to go
   through an agent that proposes you.
3. A **verified presence** in the registry AIs consult — free for now.

**How it works.**
1. You set a CPA commission with us (e.g. 10% of a new customer's value).
2. An agent queries AYA, gets your listing **+ a signed attribution token**.
3. The user buys from you.
4. The agent claims cashback → we validate the **consumed transaction** → cashback to the user,
   commission to the agent operator, the rest to Pollen.

**Upfront commitment: zero.** We sign a deal, activate it in the registry, and money only moves **when
you win a customer.**

---

## Onboarding technique d'un partenaire (interne)

Une fois le deal verbalement accepté, créer l'offre dans le registre (Postgres VPS) :

```bash
curl -X POST "https://ai-visionary.xyz/api/admin/cashback?secret=$ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_domain": "exemple.com",
    "service_name": "Exemple SaaS",
    "cashback_type": "percent",          // flat | percent
    "cashback_value": 10,                 // 10% (percent) OU montant à plat (flat)
    "currency": "CHF",
    "cpa_total": 300,                     // commission totale (interne, masquée côté agent)
    "honey_value": 100,                   // part opérateur d'agent (interne)
    "vertical": "saas-digital"
  }'
```

L'offre apparaît immédiatement sur `/pollen-agents` (badge cashback) et via la surface agent
(`/api/pollen-agents/cashback-offer`). Validation des claims = **manuelle** (outcome-only) via
`PATCH /api/admin/cashback` (`action: validate | pay | reject`).

## Liste cible (candidats premiers deals)

Les meilleurs candidats = entités **digital/SaaS/crypto/fintech/e-commerce** avec email + bon signal.
Aperçu (lecture seule, n'écrit rien) :

```bash
curl -X POST "https://ai-visionary.xyz/api/admin/outreach?secret=$ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"preview","limit":100}'
# secteurs par défaut : Technologie & SaaS, Finance & Banque, E-commerce & Retail
```

> Règle d'or rappel : Pollen ne sort **jamais** d'argent de sa poche. Le cashback/miel est toujours une
> tranche d'un revenu *entrant* payé par le service pour un client réel. Zéro burn.
