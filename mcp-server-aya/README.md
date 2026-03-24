# MCP Server AYA

Serveur MCP (Model Context Protocol) pour le **Registre AYA** d'AI Visionary.

Permet a Claude Desktop et tout client MCP d'interroger le registre AYA : recherche d'entreprises, details par domaine, statistiques globales.

## Installation

```bash
cd mcp-server-aya
npm install
npm run build
```

## Configuration Claude Desktop

Ajouter dans `~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "aya-registry": {
      "command": "node",
      "args": ["/Users/cyrilleger/AI VISIONARY/mcp-server-aya/dist/index.js"]
    }
  }
}
```

Redemarrer Claude Desktop apres modification.

## Tools disponibles

### search_companies

Recherche dans le registre AYA par nom, domaine, secteur ou pays.

| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| query | string | oui | Terme de recherche (nom, domaine, secteur, code pays ISO) |
| limit | number | non | Nombre max de resultats (defaut 10, max 200) |

Exemple : `search_companies({ query: "finance", limit: 5 })`

### get_company_details

Details complets d'une entreprise : score AIO, ASR, secteur, services, certifications.

| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| domain | string | oui | Domaine de l'entreprise (ex: "nestle.com") |

Exemple : `get_company_details({ domain: "nestle.com" })`

### get_registry_stats

Statistiques globales du registre AYA : total entreprises, distribution scores, secteurs, pays.

Aucun parametre requis.

Exemple : `get_registry_stats()`

## API AYA

Base URL : `https://ai-visionary.com/api/aya`

Le MCP server appelle l'API publique AYA hebergee sur Vercel. Aucune cle API requise. Rate limit : 30 req/min par IP.

## Developpement

```bash
npm run build   # Compile TypeScript
npm start       # Lance le serveur (stdio)
```
