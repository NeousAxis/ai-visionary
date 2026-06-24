# VISION — Pollen Agents × AYA

> Document de vision stratégique (brouillon). **Additif, non commité, ne modifie aucun code existant.**
> Issu de la session du 31 mai 2026. Sert de source pour graphify (knowledge graph).
> Statut : conceptuel. Rien de tout ceci n'est encore implémenté.

---

## 0. Résumé en une phrase

> **Un côté on REMPLIT** (scraping de données publiques → registre AYA de fleurs vérifiées, gratuit an 1).
> **L'autre côté on ATTIRE** (agents IA rémunérés pour venir consulter AYA via **Pollen Agents**).
> Au milieu : une **couche d'identité + confiance** qui rend le tout honnête et auto-financé.

---

## 1. La thèse macro

Le web bascule : les gens ne vont plus chercher eux-mêmes des services sur Internet — ils **demandent à un agent IA** de le faire. La couche qui décide *quelles entités les agents voient, citent et choisissent* est en train de se définir, et elle est captée par des **standards US fermés**. Il y a une place pour une **alternative ouverte, européenne et souveraine.**

---

## 2. La stack souveraine européenne (3 étages complémentaires)

| Étage | Acteur | Rôle | Métaphore |
|---|---|---|---|
| Modèles | **Mistral** | le cerveau (LLM) | — |
| Moteur / infra | **Infomaniak** (AI Tools, API REST/JSON, hébergement CH) | ce que l'agent *utilise pour exécuter* | le moteur |
| Carte + confiance | **AYA** | ce que l'agent *interroge pour décider* | la carte |

> Message unique pour les pitchs : **la stack souveraine des agents = Mistral (modèles) + Infomaniak (moteur) + AYA (carte/confiance).** AYA n'est PAS concurrent d'Infomaniak/Mistral : c'est la brique manquante au-dessus.

---

## 3. Repositionnement d'AYA : de « être lisible » à « être interrogé »

| Posture A — aujourd'hui | Posture B — cible |
|---|---|
| **Être lisible** : quand un agent connaît déjà l'entreprise, il la comprend bien | **Être la source que l'agent interroge** : l'agent arrive avec un *besoin* et reçoit une liste classée et fiable |
| SEO-pour-IA (passif) | Marché / annuaire actif pour agents |
| Payé par l'entreprise (Pack PRO) | Monétisé sur l'*outcome* (transaction) |

**AYA ne cherche PAS à remplacer le moteur de recherche.** Il vise la **récupération redevable** (*accountable retrieval*) : les décisions à conséquence, dans des verticales sensibles.

### Pourquoi un agent appellerait AYA plutôt que son search intégré
Pour 80-90 % des requêtes : il ne le fera pas (et ne doit pas). AYA gagne UNIQUEMENT là où le search est **structurellement incapable** :
1. **Vérifier** — le search rend du texte invérifiable ; AYA ancre l'identité.
2. **Comparer** — fiches normalisées vs 10 pages hétérogènes.
3. **Auditer** — base signée + horodatée, opposable, reproductible.
4. **Garantir la complétude** — couverture d'un périmètre vs ranking SEO.
5. **Ne pas fuiter / ne pas biaiser** — souverain, sans pub, sans entraînement sur la donnée.

> Cas-cible type : *« Agent, trouve un prestataire RGPD-conforme pour héberger les données de santé de ma clinique. »* — aucun agent sérieux ne devrait se fier au search brut ici.

---

## 4. Le modèle de confiance (le plus important — corrigé pour être honnête)

### Intégrité ≠ Véracité
- **Intégrité / provenance** : « cette donnée vient de telle source, non altérée ». → une signature le prouve.
- **Véracité** : « ce qui est affirmé est vrai ». → une signature ne le prouve PAS.

> **On ne sait pas vérifier que les claims d'un site sont vrais. Personne ne le sait.** Donc on ne *prétend pas* que c'est vrai — on rend la déclaration **redevable**.

### Gradation épistémique (déjà dans le V4 Data Reliability Layer)
| Niveau | Exemple | Vérifiable ? |
|---|---|---|
| `verifiable` | certifs, policies (avec URL) | partiellement |
| `self_declared` | KPIs, clients, uptime | non — déclaration |
| `interpretive` | « leader », « premium » | non — marketing |

Le produit = *« voici ce qui est vérifié, ce qui est déclaré, ce qui est marketing — signé, horodaté. »*

### Feuille de route de vérification (par faisabilité)
1. **Existence + identité légale** → cross-check **Zefix / Sirene / Companies House** (vraie vérification).
2. **Contrôle du domaine** → preuve DNS / `.well-known`.
3. **Certifications** → cross-check émetteur (B Corp, IAF CertSearch…).
4. **Attestation redevable** → l'entité signe sa donnée avec sa clé, ancrée à son identité légale (opposable).

> Principe directeur : **rendre redevable > prétendre vrai.** Passer de « texte web anonyme invérifiable » à « déclaration signée, graduée, ancrée à une identité légale » est déjà un saut de confiance énorme.

---

## 5. La couche d'identité des deux côtés

### Symétrie
| | OFFRE (le shop) | DEMANDE (le client) |
|---|---|---|
| Objet d'identité | **ASR** ✅ existe | **Mandat d'agent** 🆕 net-new |
| Qui signe | l'entité | l'opérateur de l'agent |
| Ancré à | registres légaux + domaine | opérateur + délégation du principal |
| Affirme | identité + offre graduée | identité + périmètre d'autorité |
| Rend redevable | les claims sont opposables | les actions sont traçables au principal |

### L'agent doit prouver deux choses distinctes
- **Identité d'agent** : qui est ce logiciel, opéré par qui (clé publique).
- **Mandat** : au nom de qui il agit + autorisé à quoi (découverte ? devis ? transiger jusqu'à X ? partager quelles données ?), **signé par le principal**.

### Le handshake (porte ouverte / comptoir consenti)
1. **Découverte** = porte ouverte, anonyme possible (browse libre).
2. **Acte à conséquence** = échange bidirectionnel : l'agent lit l'ASR gradué ; le service lit l'identité + mandat. Décision *informée*, pas un blocage.
3. **Trace** signée + horodatée des deux côtés.

> AYA = la **fabrique** (format + ancrage + gradation + preuve). AYA ≠ péage : standard ouvert + implémentation de référence, interopérable avec les standards émergents (W3C Verifiable Credentials, auth MCP, agent-commerce).

---

## 6. Le modèle d'ouverture (« comme un shop »)
- **La porte est ouverte** (permissionless) : n'importe quel agent entre et interroge.
- **L'identité est visible**, pas une barrière — une étiquette, pas un videur.
- **La redevabilité remplace le gatekeeping** : on ne *bloque* pas les mauvais acteurs, on les rend *traçables* (caméras + reçus, pas de videur).

---

## 7. Pollen Agents (l'extension)

**Pollen Agents** = une **route du site existant : `ai-visionary.xyz/pollen-agents`**, **propulsée par le registre AYA**. Pas un site ni un domaine séparé. AYA reste intouché ; Pollen est le marché des abeilles posé dessus.

### Métaphore de pollinisation (structure tout le modèle)
| Modèle | Monde Pollen |
|---|---|
| Agents (demande) | **pollinisateurs** (abeilles) |
| Services (offre) | **fleurs** vérifiées (ASR) |
| Transaction matchée | **pollinisation** |
| Récompense (non-distordante) | le **miel** |
| Identité des 2 côtés | vraies abeilles ↔ vraies fleurs = anti-fraude |
| Flywheel | + d'abeilles → + de fleurs → + de nectar → + d'abeilles |

> Nom retenu : **Pollen Agents**. TODO : vérifier dispo marque/domaine + collisions connues (Pollen.co en faillite, Pollinations.ai, et « Pollens World » projet antérieur de Cyril — famille de marques voulue ?).

---

## 8. Le modèle économique : flywheel auto-financé (CPA / affiliation agent-native)

### Le modèle, en clair (analogie affilié Amazon)
Un blogueur met un lien Amazon ; quelqu'un achète ; Amazon lui verse une commission. Il n'a rien vendu — il a **amené l'acheteur**. **Pollen = pareil, mais l'acheteur est amené par un agent.** L'agent est le **nouveau canal de distribution**, et un canal se rémunère.

### Flux d'argent (cœur)
```
Le service gagne un nouveau client  →  paie une commission (ex. 300 CHF)
                                         │
                  ┌──────────────────────┴──────────────────────┐
                  ▼                                              ▼
       ~100 CHF → l'AGENT (le miel)              ~200 CHF → POLLEN (la ruche)
       à plat, non-distordant                    match + identité + anti-fraude
```
**Personne ne paie d'avance. L'argent ne bouge QUE sur transaction réelle.** → c'est pourquoi AYA peut être gratuit.

### Exemple chiffré (HYPOTHÈSES, vertical fiduciaire Genève)
| | Montant |
|---|---|
| Valeur client an 1 | ~3 000 CHF |
| CPA accepté par le service (≈10 %) | **300 CHF** |
| Miel agent (à plat) | **100 CHF** |
| Pour Pollen | **200 CHF** |

### Échelle (revenu Pollen ≈ 200 CHF / pollinisation)
| Pollinisations/mois | Revenu Pollen/mois |
|---|---|
| 50 | 10 000 CHF |
| 250 | 50 000 CHF (~8/jour) |
| 1 000 | 200 000 CHF |

### Règle d'or
> **Pollen ne sort jamais d'argent de sa poche.** Le miel est toujours une tranche d'un revenu *entrant* payé par un service pour un client réel. **Zéro burn.**

### Les 2 règles non négociables (sinon le moat meurt)
1. **Récompense sur l'OUTCOME** (transaction réelle), jamais sur requête/clic (fakeable à l'infini).
2. **Récompense NON-DISTORDANTE** : à plat, identique quel que soit le service, **divulguée** → l'agent reste neutre (ne recommande pas le plus offrant). Sinon = pay-for-placement = mort de la neutralité, seul avantage sur les labs.

### Anti-fraude = la couche d'identité
Payer le côté demande est normalement suicidaire (agents = logiciels → sybil farming infini). **L'identité-des-deux-côtés est l'anti-fraude** : le miel ne coule que vers un **agent identifié**, sous **mandat vérifié**, pour un **principal réel**, sur une **transaction consommée**, avec un **service vérifié**. La confiance n'est pas de la déco — elle *rend l'économie possible*.

### Première verticale
Haute valeur + confiance critique (fiduciaire, juridique, hébergement de données, assurance, B2B). Le vrai goulot n'est pas le % — c'est **activer les premiers agents**. La récompense est le levier.

---

## 8bis. Le cashback utilisateur — la fonctionnalité qui OBLIGE les agents à passer par AYA

> Ajout du 4 juin 2026. C'est le **moteur de demande** : ce qui *fait venir* les agents, pas seulement ce qui les rémunère.

### Le crochet (deux récompenses distinctes, même CPA)
Le **miel** (§8) rémunère l'**opérateur de l'agent**. Le **cashback** rémunère l'**utilisateur final** (le principal). Les deux sortent du même CPA payé par le service **sur transaction réelle** :

```
Service gagne un client → paie CPA (ex. 300 CHF) sur transaction consommée
        │
        ├──► cashback → UTILISATEUR de l'agent   (le crochet consommateur)
        ├──► miel     → OPÉRATEUR de l'agent      (le canal de distribution)
        └──► reste    → POLLEN                     (la ruche : match + identité + anti-fraude)
```

### Pourquoi c'est une OBLIGATION, pas une option
Le cashback **n'existe que dans AYA**. AYA seul détient : les accords commerciaux avec les services qui financent le CPA, la couche d'attribution + anti-fraude qui prouve la transaction consommée (identité des 2 côtés, §8), et l'émission du cashback réclamable. **Il n'y a aucune autre route pour l'obtenir.** Donc :
- Un agent qui veut offrir du cashback à ses utilisateurs **doit** intégrer AYA (zéro alternative).
- L'utilisateur **réclame** le cashback à son agent (« récupère-moi du cash sur mes achats ») → tire l'agent vers AYA.
- Demande-pull : l'utilisateur oblige l'agent, l'agent ne peut servir que via AYA.

### La fonctionnalité à construire (net-new)
Capacité exposée aux agents (surface MCP `aya-registry` / SDK Pollen) :
1. `cashback_offer(entity)` — l'agent interroge AYA, reçoit l'entité **+** l'offre de cashback active **+** un **jeton d'attribution** signé. *(Réponse en ms, servie depuis le registre pré-généré — jamais calculée en direct.)*
2. **Transaction** — l'agent/utilisateur achète le service ou le produit.
3. `claim_cashback(token, proof)` — AYA valide la **transaction consommée** (outcome-only, anti-fraude par identité), puis débloque : cashback → utilisateur, miel → opérateur.

> Le jeton d'attribution + la validation outcome-only rendent la fraude impossible et le cashback finançable. Hors de la couche d'identité d'AYA, le cashback ne peut pas exister → **c'est le moat**.

### Séquencement stratégique (règle de Cyril, 4 juin)
| Phase | Périmètre du cashback | But |
|---|---|---|
| **Phase 1 — AUJOURD'HUI** | **Aussi large que possible** : sur le **maximum d'entités**, ASR simples/scrapés inclus, **aucune certification exigée** | Faire venir les agents et éviter le « miss » (une entité absente = cashback raté = agent qui décroche). La couverture large est **existentielle** au démarrage. |
| **Phase 2 — QUAND LE VOLUME EST LÀ** | AYA **pose ses conditions** : cashback maintenu **uniquement** pour les entités à **ASR PRO certifié par AYO** | Retourner le levier : la demande agents devient une **pression de certification** → conversion payante. |

> Ordre verrouillé : **largeur d'abord (gratuit, land-grab) → certification ensuite (monétisation).** On n'exige la certification que lorsque les agents font déjà la queue.

> ⚠️ Ne pas confondre avec la neutralité (§8, règle n°2). L'exigence ASR PRO est une **condition d'éligibilité uniforme** (même barre pour toutes les entités : *qui* peut participer), **pas** une distorsion du taux à plat (*combien* on touche selon le service choisi). AYA n'est jamais plus rémunéré par un partenaire qu'un autre — ça reste vrai en Phase 1 comme en Phase 2. Un standard d'admission ne corrompt pas la neutralité ; il **renforce** le positionnement intégrité.

---

## 9. AYA gratuit la première année

- **« 0 client » depuis le lancement** = pas un échec produit, un **problème de timing de valeur** : aucun agent ne fait encore ses courses → être lisible n'a aucun ROI ressenti → personne ne paie (rationnel).
- **Pollen crée la demande agent → crée la valeur ressentie → crée les acheteurs.**
- **Gratuit an 1 = bon séquencement** : land-grab de la supply, on monétise plus tard sur l'**outcome** (Pollen), pas sur l'**accès** (listing).
- Gardes-fous : AYO génère les fichiers (friction ≈ 0) ; garder l'infra Stripe/PRO sous le capot ; définir le payant futur (outcome + vérif premium) ; gratuit ≠ distribution (la distribution = flywheel Pollen + partenaires) ; ⚠️ cohérence partenaires (passer le live en gratuit modifie l'existant — décider : maintenant ou annoncé à venir).

---

## 10. La machine à deux côtés (le moteur quotidien de Cyril)

```
   CÔTÉ OFFRE (remplir)                    CÔTÉ DEMANDE (attirer)
   scraping données publiques     ──►   agents rémunérés viennent
   → AYO structure/signe                 consulter AYA via Pollen
   → AYA registre (gratuit an 1)         → pollinisation → miel
            │                                      │
            └──────────── identité + confiance ────┘
                         (anti-fraude, redevabilité)
```

---

## 11. Questions dures / risques ouverts
- Cold-start (offre ET demande) → profondeur sur 1 verticale avant largeur.
- « Pourquoi l'agent appelle AYA » → réponse = signé + souverain + longue traîne européenne.
- Racine de confiance du mandat → s'aligner sur standards émergents, ne pas inventer fermé.
- Vie privée du mandat → divulgation sélective (périmètre, pas identité du principal).
- Sybil/abus → identité bon marché mais signifiante + réputation.
- Révocation (mandats, certifs) → mécanisme de fraîcheur.
- Pari standards → miser sur l'interop.
- Piège neutralité → récompense non-distordante obligatoire.

---

## 12. Existant vs net-new
| Brique | État |
|---|---|
| Identité offre (ASR) | ✅ existe |
| Génération offre (AYO) | ✅ existe |
| Registre AYA (~30k entités) | ✅ existe |
| Surface de requête (MCP `aya-registry`) | ✅ existe (= la porte) |
| Ancrage légal (Zefix/Sirene/CH) | 🟡 roadmap bot |
| Identité demande (agent + mandat) | 🆕 net-new |
| Handshake symétrique signé | 🆕 net-new |
| Économie Pollen (flywheel) | 🆕 net-new |
| Fonctionnalité cashback (offer/claim + jeton d'attribution) | 🆕 net-new |

---

## 13. Entités & relations (pour le knowledge graph)

**Entités** : AI Visionary, AYA, AYO, AIO, ASR, Pollen Agents, Mistral, Infomaniak, Agent IA, Service/Fleur, Principal, Mandat, Miel, **Cashback**, **Jeton d'attribution**, Pollinisation, Flywheel, Registre légal (Zefix/Sirene/Companies House), MCP aya-registry.

**Relations clés** :
- AI Visionary —possède→ AYA, AYO, AIO, ASR, Pollen Agents
- AYO —génère→ ASR (et fichiers PRO)
- ASR —indexé dans→ AYA
- Pollen Agents —route de→ ai-visionary.xyz/pollen-agents ; —propulsé par→ AYA
- Agent IA —porte→ Mandat ; —signé par→ Principal
- Service —a→ ASR ; —ancré à→ Registre légal
- Pollinisation —relie→ Agent IA ↔ Service ; —produit→ Miel
- Service —paie→ CPA ; —réparti en→ Miel (agent) + revenu Pollen
- Identité 2 côtés —garantit→ anti-fraude → rend possible→ économie Pollen
- AYA —tourne sur→ Infomaniak ; —utilise→ Mistral (modèles)
- Stack souveraine = Mistral + Infomaniak + AYA
- Cashback —financé par→ CPA ; —versé au→ Principal (utilisateur de l'agent)
- AYA —émet→ Cashback + Jeton d'attribution ; —seule route pour→ Cashback (= l'obligation)
- Agent IA —doit intégrer→ AYA pour offrir le Cashback ; Principal —réclame→ Cashback → tire→ Agent IA vers AYA
- Cashback —phase 1→ toutes entités (ASR simple inclus) ; —phase 2→ gated sur ASR PRO certifié

---

## 14. Prochaines étapes proposées
1. Vérifier dispo marque/domaine **Pollen Agents**.
2. Choisir LA première verticale + chiffrer le flywheel réel (valeur client, %, fleurs déjà dans AYA).
3. Décider : AYA gratuit *maintenant* ou *annoncé à venir* (cohérence partenaires).
4. Cadrer techniquement le **mandat d'agent** + le handshake (en s'alignant sur standards ouverts).
5. Construire la **fonctionnalité cashback** (`cashback_offer` / `claim_cashback` + jeton d'attribution) qui **oblige** les agents à passer par AYA — phase 1 large (ASR simples inclus), phase 2 gated sur ASR PRO certifié (§8bis).
