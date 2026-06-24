-- Migration 24 juin 2026 (c) : dédup par MARQUE des partenaires.
-- Le détecteur trouve chaque ccTLD séparément (24mx.co.uk, 24mx.fi, 24mx.pl…) = 1 seule
-- marque. On ne veut écrire qu'UNE fois par marque. brand = 1er label du domaine.
-- Additif, réversible.

ALTER TABLE outreach_recipients ADD COLUMN IF NOT EXISTS brand TEXT;

-- Backfill des partenaires déjà en file.
UPDATE outreach_recipients
   SET brand = split_part(regexp_replace(lower(domain), '^www\.', ''), '.', 1)
 WHERE kind = 'partner' AND domain IS NOT NULL AND brand IS NULL;

-- Supprime les doublons de marque existants (garde une ligne par brand+campagne).
DELETE FROM outreach_recipients a
 USING outreach_recipients b
 WHERE a.kind = 'partner' AND b.kind = 'partner'
   AND a.campaign = b.campaign AND a.brand = b.brand
   AND a.ctid > b.ctid;

-- Une seule cible partenaire par marque et par campagne.
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_partner_brand
  ON outreach_recipients (brand, campaign)
  WHERE kind = 'partner' AND brand IS NOT NULL;

-- Rollback :
-- DROP INDEX IF EXISTS uq_outreach_partner_brand;
-- ALTER TABLE outreach_recipients DROP COLUMN IF EXISTS brand;
