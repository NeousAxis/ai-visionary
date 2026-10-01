"""Tests du normaliseur de pays. Lancer : python3 aya/test_country_iso.py"""
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import country_iso as ci  # noqa: E402

TS_HELPER = os.path.join(ROOT, "lib", "aya", "country-iso.ts")
SQL_GUARD = os.path.join(ROOT, "migrations", "2026-09-16_aya_registry_country_iso_guard.sql")
TZDATA = "/usr/share/zoneinfo/iso3166.tab"


def codes_between_markers(path):
    with open(path, encoding="utf-8") as f:
        block = f.read().split("codes:start", 1)[1].split("codes:end", 1)[0]
    return set(re.findall(r"\b[A-Z]{2}\b", block))


class CountryIsoTest(unittest.TestCase):
    def test_localized_values_found_in_registry(self):
        expected = {
            "日本": "JP", "台灣": "TW", "РФ": "RU", "香港": "HK", "澳門": "MO", "美國": "US",
            "美国": "US", "호주": "AU", "ＪＰ": "JP", "中国": "CN", "法國": "FR",
        }
        for value, code in expected.items():
            self.assertEqual(ci.to_iso_country(value), code, value)

    def test_ambiguous_values_are_never_guessed(self):
        for value in ["РБ", "КГ", "КЗ", "大阪", "Genève", "XX", "ZZ", "EU", "AC", "CS", "EN",
                      "JA", "FL", "NY", "WA", "TX", "SP", "", "   ", None]:
            self.assertIsNone(ci.to_iso_country(value), value)

    def test_codes(self):
        self.assertEqual(ci.to_iso_country("fr"), "FR")
        self.assertEqual(ci.to_iso_country(" ch "), "CH")
        self.assertEqual(ci.to_iso_country("UK"), "GB")
        self.assertEqual(ci.to_iso_country("EL"), "GR")
        self.assertEqual(ci.to_iso_country("XK"), "XK")
        self.assertEqual(ci.to_iso_country("GBR"), "GB")
        self.assertEqual(ci.to_iso_country("usa"), "US")

    def test_former_parser_names_still_resolve(self):
        former = {
            "united states": "US", "usa": "US", "us": "US", "u.s.": "US", "u.s.a.": "US",
            "america": "US", "united kingdom": "GB", "uk": "GB", "england": "GB",
            "great britain": "GB", "switzerland": "CH", "suisse": "CH", "schweiz": "CH",
            "svizzera": "CH", "france": "FR", "germany": "DE", "deutschland": "DE", "italy": "IT",
            "italia": "IT", "spain": "ES", "españa": "ES", "netherlands": "NL", "nederland": "NL",
            "holland": "NL", "belgium": "BE", "belgique": "BE", "austria": "AT", "österreich": "AT",
            "portugal": "PT", "sweden": "SE", "norway": "NO", "denmark": "DK", "finland": "FI",
            "poland": "PL", "czech republic": "CZ", "ireland": "IE", "luxembourg": "LU",
            "japan": "JP", "south korea": "KR", "china": "CN", "australia": "AU",
            "new zealand": "NZ", "canada": "CA", "brazil": "BR", "brasil": "BR", "mexico": "MX",
            "india": "IN", "russia": "RU", "south africa": "ZA", "singapore": "SG",
            "hong kong": "HK", "taiwan": "TW", "israel": "IL", "united arab emirates": "AE",
            "uae": "AE",
        }
        for value, code in former.items():
            self.assertEqual(ci.to_iso_country(value), code, value)

    def test_code_lists_stay_identical(self):
        self.assertEqual(len(ci.ISO_3166_ALPHA2), 249)
        self.assertEqual(codes_between_markers(TS_HELPER), set(ci.ISO_3166_ALPHA2))
        self.assertEqual(codes_between_markers(SQL_GUARD), set(ci.ISO_3166_ALPHA2))

    @unittest.skipUnless(os.path.exists(TZDATA), "tzdata absent")
    def test_list_matches_tzdata(self):
        with open(TZDATA, encoding="utf-8") as f:
            tz = {line.split("\t")[0] for line in f if line.strip() and not line.startswith("#")}
        self.assertEqual(tz, set(ci.ISO_3166_ALPHA2))


if __name__ == "__main__":
    unittest.main()
