-- Retour arrière de apply.sql : retire le garde-fou puis remet country_legal et updated_at
-- depuis le CSV de sauvegarde (sans le trigger, qui renormaliserait les anciennes valeurs).
--
--   psql -h localhost -U aya_app -d aya_local -X -v commit=1 -f rollback.sql \
--        < /home/ubuntu/backups/aya_registry_country_fix_<horodatage>.csv
-- Avec -v commit=0, tout est vérifié puis annulé.

\set ON_ERROR_STOP on
\if :{?commit}
\else
    \echo 'Variable commit manquante : -v commit=0 pour vérifier, -v commit=1 pour restaurer.'
    \quit
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER IF EXISTS trg_aya_normalize_country ON aya_registry;
DROP FUNCTION IF EXISTS aya_normalize_country_legal();
DROP FUNCTION IF EXISTS aya_is_valid_country_code(text);

CREATE TEMP TABLE country_fix_backup (LIKE aya_registry) ON COMMIT DROP;
\copy country_fix_backup FROM pstdin WITH (FORMAT csv, HEADER true)

UPDATE aya_registry r
SET country_legal = b.country_legal, updated_at = b.updated_at
FROM country_fix_backup b
WHERE r.entity_id = b.entity_id;

SELECT count(*) AS lignes_sauvegardees FROM country_fix_backup;
SELECT b.country_legal AS valeur_restauree, count(*) AS n
FROM country_fix_backup b GROUP BY 1 ORDER BY 2 DESC;

\if :commit
    COMMIT;
    \echo 'COMMIT : valeurs d''origine restaurées, garde-fou retiré.'
\else
    ROLLBACK;
    \echo 'ROLLBACK : vérification seulement, rien n''a été écrit.'
\endif
