# POLLEN AGENTS — BROADCAST KIT (posts prêts à publier)

> TODO 44c (c) — faire connaître le connecteur MCP aux **communautés de builders d'agents**.
> Tous les textes ci-dessous sont prêts. **CLIC CYRIL = publier depuis ses comptes.**
> Angle directeur : AYA = **standard ouvert** (MCP côté agents, ASR côté entreprises) +
> **cashback non-distordant** comme incitation à se brancher. Ne jamais survendre, ne jamais
> présenter comme un walled garden ([[strategy_asr_is_the_standard]]).

Liens à réutiliser :
- Connecteur MCP : `https://ai-visionary.xyz/agents/mcp`
- Page builders : `https://ai-visionary.xyz/for-agents`
- Repo : `https://github.com/NeousAxis/ai-visionary`
- **Preuve sociale** : fiche registre officiel `io.github.NeousAxis/aya-registry` (publiée, status active) → renforce le « ce n'est pas du vaporware ».

> **Statut posting (25 juin)** : textes prêts. Le posting reste manuel et délibéré — raisons concrètes, PAS un blocage technique :
> - **X** : le compte connecté dans le Chrome est **@WeatherAgentApp** (mauvaise marque pour AYA). Poster depuis le bon compte (ou en créer un AI Visionary) — décision Cyril.
> - **Reddit / Show HN / Product Hunt** : lancements one-shot, gatekeepés (karma/automod) et sensibles au timing ; il faut être présent pour répondre aux commentaires. À tirer délibérément, pas à l'aveugle.
> - **Discord MCP** : OK à poster quand connecté au serveur.

---

## 1. PR `awesome-mcp-servers` (punkpeye/awesome-mcp-servers)

Ligne à ajouter (catégorie *Search* ou *Commerce/Finance*) :

```markdown
- [AYA Registry & Pollen Agents](https://ai-visionary.xyz/for-agents) 🏎️ ☁️ - Search 367k+ verified businesses worldwide (AIO readability score + signed ASR records) and earn cashback when your agent routes a real purchase. Remote MCP, no auth.
```
*(🏎️ = remote/hosted, ☁️ = cloud — vérifier la légende en tête du README au moment de la PR.)*

---

## 2. Reddit — r/AI_Agents (et r/mcp)

**Titre :** I built a remote MCP server that lets any agent earn cashback on real purchases (open registry, no auth)

**Corps :**
> I've been building AYA — an open registry of 367k+ verified businesses worldwide, each with an "AI-readability" score and a signed JSON-LD identity (ASR). The idea: agents shouldn't hallucinate which business to recommend; they should query a registry that's grounded and verifiable.
>
> Two things I'd love feedback on:
>
> **1. Zero-code connection.** It's a remote MCP server (Streamable HTTP). You paste one URL into your client — `https://ai-visionary.xyz/agents/mcp` — and get 5 tools (search, company details, stats, + cashback). No install, no key.
>
> **2. The cashback loop for operators.** `get_cashback_offer(domain)` returns a signed attribution token. If your agent routes a real purchase to that business, the end user gets cashback and *you* (the operator) get a flat commission — funded by the business for a customer it acquired. It's a flat amount, identical across offers, so it never distorts what the agent recommends. Integrity, not pay-to-rank.
>
> It's free. The registry is an open standard (ASR for businesses, MCP for agents) — not a walled garden. Builder guide + copy-paste configs: https://ai-visionary.xyz/for-agents
>
> Curious what operators here think of the non-distorting commission model. Would you wire it in?

---

## 3. X / Twitter — thread

1/ Most "AI shopping agents" guess which business to recommend. I built the opposite: an open registry agents *query*.

AYA = 367k+ verified businesses, each with an AI-readability score + a signed identity. Remote MCP, zero code. 🧵

2/ Connect any agent in one line — paste this URL into your MCP client:
`https://ai-visionary.xyz/agents/mcp`
5 tools: search, details, stats, + cashback. No install, no API key, no auth.

3/ The part I care about: operators earn.
`get_cashback_offer(domain)` → signed attribution token.
Agent routes a real purchase → user gets cashback, operator gets a flat commission.
Funded by the business. Flat. So it never distorts the recommendation.

4/ It's an open standard both ways: MCP for agents, ASR (signed JSON-LD identity) for businesses. Free for now. Not a walled garden.

Builder guide → https://ai-visionary.xyz/for-agents
Wire your agent in and tell me what breaks.

---

## 4. Show HN

**Titre :** Show HN: AYA – a remote MCP server to ground agent recommendations (and earn cashback)

**Corps :**
> AYA is an open registry of 367k+ businesses, each rated for "AI-readability" (a 0–100 score over 7 weighted blocks) and exposed as a signed JSON-LD identity (we call it an ASR — AI Singular Record). The goal is grounding: an agent should look up a verified record instead of guessing.
>
> It's reachable as a remote MCP server (Streamable HTTP) — paste `https://ai-visionary.xyz/agents/mcp` into any MCP client and you get search/details/stats tools, no auth.
>
> The experimental part is Pollen Agents: `get_cashback_offer(domain)` returns a signed Ed25519 attribution token; after a real purchase, `claim_cashback(token)` records the outcome (signature + expiry + anti-replay checked). The user gets cashback, the operator gets a flat commission funded by the business. It's flat and identical across offers on purpose — so the incentive can't reorder recommendations.
>
> Free, CC-BY-4.0 data, no auth. Built solo, hosted in Switzerland. Builder guide: https://ai-visionary.xyz/for-agents
>
> Happy to discuss the trust model — signing proves integrity of a declaration, not its truth, so we make the declaration *accountable* rather than claiming we verified it.

---

## 5. Product Hunt

**Tagline :** The open registry where AI agents find verified businesses — and earn cashback.
**Description :**
> AYA lets any AI agent connect via remote MCP (one URL, no code) to search 367k+ verified businesses worldwide. Through Pollen Agents, an agent that routes a real purchase earns the user cashback and the operator a flat, non-distorting commission. Open standard, free, Swiss-hosted.
**First comment (maker) :** voir le corps Show HN (§4) — réutiliser.

---

## 6. Discord MCP (modelcontextprotocol) / serveurs builders — #showcase

> Just shipped a remote MCP server you can connect with zero code:
> `https://ai-visionary.xyz/agents/mcp` (Streamable HTTP, no auth).
> It's AYA — an open registry of 367k+ verified businesses (AI-readability score + signed ASR identity). Tools: search_companies, get_company_details, get_registry_stats, plus a cashback loop (get_cashback_offer / claim_cashback) where operators earn a flat commission on real purchases. Free. Guide + configs: https://ai-visionary.xyz/for-agents — feedback very welcome 🙏

---

## 7. Garde-fous

- **Ne jamais** présenter le cashback comme du pay-to-rank : commission **fixe**, identique d'une offre à l'autre, financée par l'entreprise → n'affecte pas le classement.
- **Toujours** rappeler que c'est un **standard ouvert** (ASR + MCP), gratuit pour l'instant.
- **Ne pas** promettre un volume d'offres > pilote (5 offres live). Dire « pilot offers » / « offres pilotes ».
- L'outreach « faites votre ASR » reste la motion d'adoption fondatrice — ce broadcast est COMPLÉMENTAIRE, il ne la remplace pas.
