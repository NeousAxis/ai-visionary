-- Migration 16 septembre 2026 : garde-fou ISO 3166-1 alpha-2 sur aya_registry.country_legal
-- A appliquer sur le Postgres VPS aya_local uniquement.
--
-- Pourquoi : les scripts d'ingestion ont écrit « 日本 », « 台灣 », « РФ », « FL »... dans
-- country_legal (raccourci Python `len(s) == 2 and s.isalpha()`). Le code est corrigé
-- (aya/country_iso.py, lib/aya/country-iso.ts) ; ce trigger garantit qu'aucun écrivain,
-- présent ou futur, ne peut plus y stocker autre chose qu'un code valide.
--
-- Règle : espaces retirés, NFKC, majuscules ; UK devient GB, EL devient GR ; une valeur
-- vide devient NULL ; tout ce qui n'est ni un code ISO, ni XK (Kosovo), ni XX (pays
-- inconnu, convention de l'app) devient NULL avec un WARNING. Jamais de rejet : aucun
-- écrivain ne casse. Même liste que aya/country_iso.py et lib/aya/country-iso.ts
-- (cohérence vérifiée par aya/test_country_iso.py).
--
-- Pas de BEGIN/COMMIT ici : le fichier est inclus dans la transaction de
-- migrations/2026-09-16_country_iso_fix/apply.sql.

CREATE OR REPLACE FUNCTION aya_is_valid_country_code(code text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT code = ANY (ARRAY[
        'XK', 'XX',
        -- codes:start
        'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
        'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
        'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
        'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
        'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
        'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
        'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
        'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
        'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
        'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
        'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
        'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
        'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
        'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
        'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
        'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
        -- codes:end
    ])
$$;

CREATE OR REPLACE FUNCTION aya_normalize_country_legal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    code text;
BEGIN
    IF NEW.country_legal IS NULL THEN
        RETURN NEW;
    END IF;
    code := upper(normalize(btrim(NEW.country_legal, E' \t\r\n'), NFKC));
    code := CASE code WHEN 'UK' THEN 'GB' WHEN 'EL' THEN 'GR' ELSE code END;
    IF code = '' THEN
        NEW.country_legal := NULL;
    ELSIF aya_is_valid_country_code(code) THEN
        NEW.country_legal := code;
    ELSE
        RAISE WARNING 'aya_registry.country_legal : valeur non ISO « % » remplacée par NULL (entity_id %)',
            NEW.country_legal, NEW.entity_id;
        NEW.country_legal := NULL;
    END IF;
    RETURN NEW;
END;
$$;

-- CREATE OR REPLACE (et non DROP + CREATE) : DROP TRIGGER verrouillerait la table en
-- ACCESS EXCLUSIVE et bloquerait les lectures du site le temps de la transaction.
CREATE OR REPLACE TRIGGER trg_aya_normalize_country
    BEFORE INSERT OR UPDATE OF country_legal ON aya_registry
    FOR EACH ROW EXECUTE FUNCTION aya_normalize_country_legal();
