# Bible AYO–AYA : Spécifications Canoniques du Sceau Cryptographique ASR

Ce document regroupe les spécifications immuables régissant la création, la validation et l'émission des AYO Singular Records (ASR).
Toute implémentation technique doit se référer à cette "Bible" comme source de vérité absolue.

---

## 1. ASR — SCEAU CRYPTOGRAPHIQUE
**(Version canonique)**

### 1. Principe fondamental
Tout ASR doit être scellé. Un ASR sans sceau valide est invalide pour AYA.

### 2. Entrée unique
L'unique entrée est `ASR_CANONICAL_OBJECT`.

### 3. Canonicalisation (Obligatoire, Déterministe)
- Format: JSON
- Encodage: UTF-8
- Aucune indentation, espace, commentaire.
- Clés triées lexicographiquement.
- Sortie: `ASR_CANONICAL_BYTES`.

### 4. Empreinte Cryptographique (Hash)
- Algorithme: **SHA-256**
- `ASR_HASH = SHA256(ASR_CANONICAL_BYTES)`
- Format: Hexadécimal lowercase (64 chars).

### 5. Signature Cryptographique
- Clé d’autorité AYO (privée).
- Algorithme: **Ed25519**
- `ASR_SIGNATURE = Ed25519_Sign(AYO_PRIVATE_KEY, ASR_HASH)`

### 6. Structure du Sceau
```json
{
  "asr_seal": {
    "seal_version": "1.0",
    "issuer": "AYO",
    "asr_id": "AYO-ASR-XXXX",
    "asr_hash": "...",
    "signature": "...",
    "sealed_at": "ISO-8601"
  }
}
```

---

## 2. TEST DE CONFORMITÉ AUTOMATIQUE (Pré-émission)

Ce test est **obligatoire** avant tout scellement.
**Sortie**: PASS ou FAIL.

### A. Intégrité Structurelle
- A1: Schéma valide.
- A2: Unicité ID/Version.
- A3: Absence de champs interdits (runtime, debug).

### B. Canonicalisation
- B1: Vérification déterministe (`Canon(A) == Canon(A)`).

### C. Contrôles Cryptographiques
- C1: Hash conforme (SHA256).
- C2: Signature conforme (Ed25519).
- C3: Vérification immédiate (`Verify(Pub, Hash, Sig) == True`).
- C4: Clé publique accessible.

### D. Assemblage
- D1: Données du Sceau cohérentes avec l'Objet.
- D2: Le hash ne doit PAS inclure le sceau.

### E. Publication
- E1: Immuabilité garantie.
- E2: No Overwrite policy.
- E3: Revocation check.

---

## 3. MODE EMIT — ÉMISSION D’UN ASR SCELLÉ
(Pipeline Runtime Obligatoire - 10 Étapes)

1. **Validation Schéma**
2. **Interdiction Champs Techniques**
3. **Canonicalisation**
4. **Hash (SHA256)**
5. **Signature (Ed25519)**
6. **Vérification Immédiate**
7. **Construction du Sceau**
8. **Assemblage Final**
9. **Vérification Immuabilité**
10. **Autorisation Publication**

**Règle Fondatrice** : Si MODE EMIT échoue, l’ASR n’existe pas.
