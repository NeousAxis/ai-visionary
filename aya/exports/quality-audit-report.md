# AYA Registry — Quality Audit Report

**Date**: 2026-03-25 08:56
**Total entities**: 3340
**Clean entities** (no issues): 609 (18%)
**Entities with issues**: 2731
**Gemini enriched**: 1761/3340 (52%)
**Not enriched**: 1579

## Issue Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 30 |
| MEDIUM | 1612 |
| LOW | 2771 |

## Issue Types

| Type | Count | Description |
|------|-------|-------------|
| NO_GEMINI_DESC | 1579 | Has services but no Gemini enrichment yet |
| UNKNOWN_COUNTRY | 1456 | Country code is XX (unknown) |
| DOMAIN_AS_NAME | 1157 | Name is just the domain capitalized |
| DUPLICATE_NAME | 93 | Same name as another entity |
| DUPLICATE_DOMAIN | 63 | Same domain as another entity |
| PORT_IN_URL | 35 | URL contains :443 |
| SLOGAN_AS_NAME | 28 | Name looks like a marketing slogan |
| NSFW_CONTENT | 2 | NSFW/adult content detected |
| GENERIC_NAME | 2 | Name is generic (Homepage, Welcome, etc.) |

## CRITICAL Issues (must fix)

- **casino.fr**: NSFW keyword detected: 'casino'
- **gorillas.io**: NSFW keyword detected: 'casino'

## HIGH Issues (top 50 of 30)

- **hannover-re.com**: Name looks like slogan: 'One of the World's Leading Reinsurers'
- **getyourguide.com**: Name looks like slogan: 'GetYourGuide'
- **soylent.com**: Name looks like slogan: 'Soylent Let us take a few things off your plate.'
- **humana.com**: Name looks like slogan: 'Live your best life with a Humana Medicare plan'
- **acorns.com**: Name looks like slogan: 'Easy Investing App For Saving & Growing Your Money'
- **peacocktv.com**: Name looks like slogan: 'Unavailable In Your Region'
- **lockheedmartin.com**: Name looks like slogan: 'Leading Aerospace and Defense'
- **wordpress.com**: Name looks like slogan: 'Everything You Need to Build Your Website'
- **mrgreen.com**: Name looks like slogan: 'Mr Green Services Unavailable in Your Location'
- **lockheedmartin.com**: Name looks like slogan: 'Leading Aerospace and Defense'
- **worldline.com**: Name looks like slogan: 'Payments to grow your world'
- **group.jumia.com**: Name looks like slogan: 'Jumia Expand Your Horizons'
- **grubhub.com**: Name looks like slogan: 'Prepare your taste buds'
- **putzmeister.com**: Name looks like slogan: 'Welcome at Putzmeister'
- **enel.com**: Generic name: 'About'
- **epiroc.com**: Name looks like slogan: 'Epiroc in your region'
- **beekeeper.io**: Name looks like slogan: 'Your Frontline Success Platform'
- **bern.com**: Name looks like slogan: 'Bern Welcome'
- **geico.com**: Name looks like slogan: 'An Insurance Company For Your Car And More'
- **jura.ch**: Name looks like slogan: 'Bienvenue dans le Canton du Jura'
- **selma.com**: Name looks like slogan: 'Make your money work for you'
- **mayoclinic.org**: Name looks like slogan: 'The world's best hospital'
- **mbda-systems.com**: Name looks like slogan: 'MBDA, Excellence at your side'
- **global.fujitsu**: Name looks like slogan: 'Your Sustainability Transformation Partner'
- **outbrain.com**: Name looks like slogan: 'Outbrain Direct Response to Maximize Your ROI'
- **railway.com**: Generic name: 'Loading'
- **tierpoint.com**: Name looks like slogan: 'Power Your Digital Breakaway with TierPoint'
- **copy.ai**: Name looks like slogan: 'Future proof your business with GTM AI'
- **blackbaud.com**: Name looks like slogan: 'Leading Software for Nonprofits and Education'
- **bystronic.com**: Name looks like slogan: 'Your best choice'

## Duplicate Domains (29)

- adecco.com (x2)
- aircanada.com (x2)
- atlassian.com (x3)
- bdbiosciences.com (x2)
- bfh.ch (x2)
- chargepoint.com (x2)
- consent.google.com (x5)
- deloitte.com (x2)
- dormakaba.com (x3)
- dsv.com (x2)
- ebay.com (x2)
- firstsolar.com (x2)
- hugedomains.com (x2)
- ibm.com (x2)
- jeronimomartins.com (x2)
- jll.com (x2)
- kpmg.com (x2)
- lightspeedhq.com (x2)
- lockheedmartin.com (x2)
- lvmh.com (x2)
- mondelezinternational.com (x2)
- ottos.ch (x2)
- raisin.com (x2)
- sig.biz (x2)
- splunk.com (x2)
- twilio.com (x2)
- unity.com (x2)
- unsplash.com (x2)
- yuh.com (x2)

## Country Distribution (top 20)

| Country | Count |
|---------|-------|
| XX | 1456 |
| US | 400 |
| CH | 399 |
| FR | 176 |
| DE | 154 |
| GB | 119 |
| BE | 69 |
| CA | 59 |
| BR | 42 |
| IN | 35 |
| CN | 35 |
| ES | 33 |
| IT | 31 |
| AU | 30 |
| NL | 22 |
| JP | 22 |
| AE | 19 |
| SE | 18 |
| AT | 17 |
| ZA | 15 |

## Sector Distribution

| Sector | Count |
|--------|-------|
| Technologie & SaaS | 871 |
| Média & Communication | 847 |
| E-commerce & Retail | 410 |
| Finance & Banque | 294 |
| Tourisme & Transport | 213 |
| Éducation & Formation | 204 |
| Industrie & Manufacturing | 180 |
| Santé & Pharma | 104 |
| Conseil & Services Pro | 59 |
| Restauration & Alimentation | 53 |
| Luxe & Mode | 40 |
| Immobilier | 26 |
| Non détecté | 20 |
| Administration & Public | 16 |
| Optimisation de la visibilité des entreprises pour les IA (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...) | 1 |
| Mobile application development (B2B and B2C) | 1 |
| Bureau Conseil en Imagination Collective et Prospective Sociale & Environnementale | 1 |