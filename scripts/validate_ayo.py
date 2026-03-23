import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

BASE_DIR = Path(".")

FILES = {
    "asr": "ASR-Protocol.json",
    "external": "external_context.json",
    "faq": "faq.json",
    "glossary": "glossary.json",
    "manifest": "manifest.json",
}

FORBIDDEN_PATTERNS = [
    r"\bEtc\.?\b",
    r"^Quelles .*\?\s*:",
    r"^Possédez-vous .*\?\s*:",
    r"\bprésumé\b",
    r"\bÀ vérifier\b",
]

EXPECTED_BOOL_FIELDS_ASR = [
    ("contenus_pedagogiques", "has_faq"),
    ("contenus_pedagogiques", "has_glossary"),
    ("contenus_pedagogiques", "has_documentation"),
]

EXPECTED_BOOL_FIELDS_EXTERNAL = [
    ("content_signals", "has_faq"),
    ("content_signals", "has_glossary"),
    ("content_signals", "has_documentation"),
]

MAX_SCORE_WITH_DECLARED_ONLY = 78
MAX_SCORE_WITHOUT_REAL_INDICATOR_VALUE = 75
MAX_SCORE_WITHOUT_EXTERNAL_PROOF = 78


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_nested(data: Dict[str, Any], path: Tuple[str, ...], default=None):
    cur = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return default
        cur = cur[key]
    return cur


def is_forbidden_text(text: str) -> List[str]:
    hits = []
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            hits.append(pattern)
    return hits


def scan_strings(obj: Any, path: str = "") -> List[Tuple[str, str, List[str]]]:
    results = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            child_path = f"{path}.{k}" if path else k
            results.extend(scan_strings(v, child_path))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            child_path = f"{path}[{i}]"
            results.extend(scan_strings(v, child_path))
    elif isinstance(obj, str):
        hits = is_forbidden_text(obj)
        if hits:
            results.append((path, obj, hits))
    return results


def check_file_exists(base_dir: Path) -> List[str]:
    issues = []
    for label, filename in FILES.items():
        if not (base_dir / filename).exists():
            issues.append(f"[ERROR] Fichier manquant: {filename}")
    return issues


def check_required_top_keys(asr: Dict[str, Any]) -> List[str]:
    issues = []
    required = [
        "meta",
        "identity",
        "offer",
        "processus_methodes",
        "engagements_conformite",
        "indicateurs",
        "contenus_pedagogiques",
        "compliance",
        "technical_signals",
        "interoperability",
    ]
    for key in required:
        if key not in asr:
            issues.append(f"[ERROR] ASR: clé obligatoire absente: {key}")
    return issues


def check_bool_fields(data: Dict[str, Any], paths: List[Tuple[str, str]], source_name: str) -> List[str]:
    issues = []
    for p1, p2 in paths:
        value = get_nested(data, (p1, p2))
        if not isinstance(value, bool):
            issues.append(f"[ERROR] {source_name}: {p1}.{p2} devrait être booléen, trouvé: {type(value).__name__}")
    return issues


def check_faq_consistency(asr: Dict[str, Any], external: Dict[str, Any], faq: Dict[str, Any]) -> List[str]:
    issues = []
    faq_exists = isinstance(faq.get("mainEntity"), list) and len(faq.get("mainEntity", [])) > 0
    asr_has_faq = get_nested(asr, ("contenus_pedagogiques", "has_faq"))
    ext_has_faq = get_nested(external, ("content_signals", "has_faq"))
    if faq_exists and asr_has_faq is False:
        issues.append("[ERROR] Incohérence: un fichier FAQ existe mais ASR.contenus_pedagogiques.has_faq = false")
    if faq_exists and ext_has_faq is False:
        issues.append("[ERROR] Incohérence: un fichier FAQ existe mais external.content_signals.has_faq = false")
    return issues


def check_manifest_consistency(asr: Dict[str, Any], manifest: Dict[str, Any]) -> List[str]:
    issues = []
    asr_name = get_nested(asr, ("identity", "name"))
    manifest_name = get_nested(manifest, ("entity", "name"))
    if asr_name != manifest_name:
        issues.append(f"[ERROR] Nom incohérent ASR/manifest: '{asr_name}' vs '{manifest_name}'")
    certs = get_nested(asr, ("engagements_conformite", "certifications"), [])
    cert_count = get_nested(manifest, ("authority", "certifications_count"))
    if isinstance(certs, list) and isinstance(cert_count, int):
        if len(certs) != cert_count:
            issues.append(
                f"[ERROR] certifications_count incohérent: manifest={cert_count}, ASR={len(certs)}"
            )
    return issues


def check_indicator_quality(asr: Dict[str, Any]) -> List[str]:
    issues = []
    indicators = get_nested(asr, ("indicateurs", "key_indicators"), [])
    if not isinstance(indicators, list):
        issues.append("[ERROR] ASR.indicateurs.key_indicators devrait être une liste")
        return issues
    for i, ind in enumerate(indicators):
        if not isinstance(ind, dict):
            issues.append(f"[ERROR] key_indicators[{i}] devrait être un objet")
            continue
        for key in ["name", "label"]:
            if not ind.get(key):
                issues.append(f"[ERROR] key_indicators[{i}] champ manquant: {key}")
        if "value" not in ind:
            issues.append(f"[ERROR] key_indicators[{i}] champ manquant: value")
        if ind.get("value") is None:
            issues.append(f"[WARN] key_indicators[{i}] a une valeur nulle: indicateur peu exploitable")
        if not ind.get("unit"):
            issues.append(f"[WARN] key_indicators[{i}] sans unité")
        if not ind.get("last_updated"):
            issues.append(f"[WARN] key_indicators[{i}] sans date de mise à jour")
    return issues


def check_score_rules(asr: Dict[str, Any]) -> List[str]:
    issues = []
    score = get_nested(asr, ("meta", "aio_score"))
    evidence_level = get_nested(asr, ("meta", "evidence_level"))
    indicators = get_nested(asr, ("indicateurs", "key_indicators"), [])
    technical_jsonld = get_nested(asr, ("technical_signals", "json_ld_present"))
    cap_applied = get_nested(asr, ("meta", "cap_applied"))
    cap_reason = get_nested(asr, ("meta", "cap_reason"))

    has_real_indicator_value = False
    if isinstance(indicators, list):
        for ind in indicators:
            if isinstance(ind, dict) and ind.get("value") not in (None, "", []):
                has_real_indicator_value = True
                break

    if isinstance(score, int):
        if evidence_level == "declared_signals_only" and score > MAX_SCORE_WITH_DECLARED_ONLY:
            issues.append(
                f"[WARN] Score élevé ({score}) alors que evidence_level=declared_signals_only"
            )
        if not has_real_indicator_value and score > MAX_SCORE_WITHOUT_REAL_INDICATOR_VALUE:
            issues.append(
                f"[WARN] Score élevé ({score}) sans indicateur chiffré public exploitable"
            )
    if technical_jsonld is False and not cap_applied:
        issues.append("[ERROR] json_ld_present=false mais cap_applied=false")
    if cap_applied and not cap_reason:
        issues.append("[ERROR] cap_applied=true mais cap_reason absent")
    return issues


def check_process_quality(asr: Dict[str, Any], glossary: Dict[str, Any]) -> List[str]:
    issues = []
    steps = get_nested(asr, ("processus_methodes", "process_steps"), [])
    if not isinstance(steps, list) or len(steps) == 0:
        issues.append("[WARN] process_steps vide")
        return issues
    for i, step in enumerate(steps):
        if not isinstance(step, str):
            issues.append(f"[ERROR] process_steps[{i}] devrait être une chaîne")
            continue
        if re.search(r"\bASR\.\s*\d+\.", step):
            issues.append(f"[WARN] process_steps[{i}] mélange plusieurs étapes dans une seule chaîne")
        if len(step.strip()) < 4:
            issues.append(f"[WARN] process_steps[{i}] trop court pour être interprétable")
        if re.search(r"\bfinal\b", step, flags=re.IGNORECASE):
            issues.append(f"[WARN] process_steps[{i}] contient peut-être une faute ou formulation non standard: '{step}'")
    terms = glossary.get("hasDefinedTerm", [])
    if isinstance(terms, list):
        for i, term in enumerate(terms):
            name = term.get("name", "") if isinstance(term, dict) else ""
            if re.search(r"^Quelles .*\?\s*:", name, flags=re.IGNORECASE):
                issues.append(f"[ERROR] Glossary term[{i}] contient une question brute de formulaire")
    return issues


def check_compliance_quality(asr: Dict[str, Any], faq: Dict[str, Any], glossary: Dict[str, Any]) -> List[str]:
    issues = []
    certs = get_nested(asr, ("engagements_conformite", "certifications"), [])
    sec = get_nested(asr, ("engagements_conformite", "security_measures"), [])
    for i, cert in enumerate(certs if isinstance(certs, list) else []):
        if re.search(r"^Possédez-vous", cert, flags=re.IGNORECASE):
            issues.append(f"[ERROR] Certification brute de formulaire dans ASR.certifications[{i}]")
        if "RGPD" in cert and "certification" in cert.lower():
            issues.append(f"[WARN] '{cert}' ressemble à une fausse certification RGPD")
    for i, s in enumerate(sec if isinstance(sec, list) else []):
        if re.search(r"\bprésumé\b", s, flags=re.IGNORECASE):
            issues.append(f"[ERROR] security_measures[{i}] contient un signal douteux: '{s}'")
        if re.search(r"\bà vérifier\b", s, flags=re.IGNORECASE):
            issues.append(f"[ERROR] security_measures[{i}] contient un doute non structuré: '{s}'")
    for q in faq.get("mainEntity", []):
        ans = get_nested(q, ("acceptedAnswer", "text"), "")
        if isinstance(ans, str) and re.search(r"^Politiques en vigueur: Quelles politiques", ans, flags=re.IGNORECASE):
            issues.append("[ERROR] FAQ contient une réponse de formulaire brute dans le bloc conformité")
    for term in glossary.get("hasDefinedTerm", []):
        name = term.get("name", "") if isinstance(term, dict) else ""
        if re.search(r"^Possédez-vous", name, flags=re.IGNORECASE):
            issues.append("[ERROR] Glossary contient une question brute de formulaire dans les termes")
    return issues


def summarize(issues: List[str]) -> str:
    errors = sum(1 for i in issues if i.startswith("[ERROR]"))
    warns = sum(1 for i in issues if i.startswith("[WARN]"))
    if errors == 0 and warns == 0:
        return "✅ Aucun problème détecté"
    return f"Résultat: {errors} erreur(s), {warns} avertissement(s)"


def main():
    missing = check_file_exists(BASE_DIR)
    if missing:
        for issue in missing:
            print(issue)
        return

    asr = load_json(BASE_DIR / FILES["asr"])
    external = load_json(BASE_DIR / FILES["external"])
    faq = load_json(BASE_DIR / FILES["faq"])
    glossary = load_json(BASE_DIR / FILES["glossary"])
    manifest = load_json(BASE_DIR / FILES["manifest"])

    issues: List[str] = []
    issues += check_required_top_keys(asr)
    issues += check_bool_fields(asr, EXPECTED_BOOL_FIELDS_ASR, "ASR")
    issues += check_bool_fields(external, EXPECTED_BOOL_FIELDS_EXTERNAL, "external_context")
    issues += check_faq_consistency(asr, external, faq)
    issues += check_manifest_consistency(asr, manifest)
    issues += check_indicator_quality(asr)
    issues += check_score_rules(asr)
    issues += check_process_quality(asr, glossary)
    issues += check_compliance_quality(asr, faq, glossary)

    for source_name, data in [
        ("ASR", asr),
        ("external_context", external),
        ("faq", faq),
        ("glossary", glossary),
        ("manifest", manifest),
    ]:
        for path, value, hits in scan_strings(data):
            issues.append(
                f"[WARN] {source_name}.{path} contient un motif interdit {hits}: {value}"
            )

    print("=" * 70)
    print("VALIDATEUR AYO — RAPPORT")
    print("=" * 70)
    print(summarize(issues))
    print()
    if issues:
        for issue in issues:
            print(issue)
    else:
        print("Tous les contrôles sont passés avec succès.")


if __name__ == "__main__":
    main()
