"""Signature de fichiers en RSA-PSS et vérification.

Les clés ne sont jamais stockées : une paire générée pour l'occasion est renvoyée une
seule fois à l'appelant, une clé privée importée sert le temps de la requête.
"""
import base64
import binascii
import hashlib
import hmac

from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

HASHES = {"SHA-256": hashes.SHA256, "SHA-512": hashes.SHA512}
KEY_SIZES = (2048, 4096)
MIN_IMPORTED_KEY_BITS = 2048


def _hash_algorithm(name: str) -> hashes.HashAlgorithm:
    try:
        return HASHES[name]()
    except KeyError:
        raise ValueError(
            f"Empreinte non supportée : {name}. Choisissez {' ou '.join(HASHES)}."
        ) from None


def _pss(algorithm: hashes.HashAlgorithm) -> padding.PSS:
    # Sel de la taille de l'empreinte : réglage standard, identique à la signature et à la vérification.
    return padding.PSS(mgf=padding.MGF1(algorithm), salt_length=algorithm.digest_size)


def _file_digest(data: bytes, hash_name: str) -> str:
    return hashlib.new(hash_name.replace("-", "").lower(), data).hexdigest()


def public_key_fingerprint(public_key: rsa.RSAPublicKey) -> str:
    """SHA-256 de la clé publique (DER, SubjectPublicKeyInfo), en hexadécimal."""
    der = public_key.public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return hashlib.sha256(der).hexdigest()


def _public_pem(public_key: rsa.RSAPublicKey) -> str:
    return public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")


def _load_private_key(pem: str) -> rsa.RSAPrivateKey:
    try:
        key = serialization.load_pem_private_key(pem.strip().encode("utf-8"), password=None)
    except TypeError:
        raise ValueError(
            "Cette clé privée est protégée par un mot de passe : "
            "retirez la protection avant de l'importer."
        ) from None
    except (ValueError, UnsupportedAlgorithm):
        raise ValueError("La clé privée n'est pas une clé PEM valide.") from None
    if not isinstance(key, rsa.RSAPrivateKey):
        raise ValueError("La clé privée fournie n'est pas une clé RSA.")
    if key.key_size < MIN_IMPORTED_KEY_BITS:
        raise ValueError(f"La clé RSA doit faire au moins {MIN_IMPORTED_KEY_BITS} bits.")
    return key


def _load_public_key(pem: str) -> rsa.RSAPublicKey:
    try:
        key = serialization.load_pem_public_key(pem.strip().encode("utf-8"))
    except (ValueError, UnsupportedAlgorithm, TypeError):
        raise ValueError("La clé publique n'est pas une clé PEM valide.") from None
    if not isinstance(key, rsa.RSAPublicKey):
        raise ValueError("La clé publique fournie n'est pas une clé RSA.")
    return key


def sign_file(
    data: bytes,
    *,
    hash_name: str = "SHA-256",
    key_size: int = 2048,
    private_key_pem: str | None = None,
) -> dict:
    if not data:
        raise ValueError("Le fichier à signer est vide.")
    algorithm = _hash_algorithm(hash_name)

    generated = not private_key_pem
    if generated:
        if key_size not in KEY_SIZES:
            raise ValueError("La taille de clé doit être 2048 ou 4096 bits.")
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=key_size)
    else:
        private_key = _load_private_key(private_key_pem)

    signature = private_key.sign(data, _pss(algorithm), algorithm)
    public_key = private_key.public_key()

    result = {
        "algorithm": "RSA-PSS",
        "hashAlgorithm": hash_name,
        "keySize": private_key.key_size,
        "signature": base64.b64encode(signature).decode("ascii"),
        "fileDigest": _file_digest(data, hash_name),
        "publicKeyPem": _public_pem(public_key),
        "publicKeyFingerprint": public_key_fingerprint(public_key),
        "privateKeyPem": None,
    }
    if generated:
        result["privateKeyPem"] = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("ascii")
    return result


def verify_file(
    data: bytes,
    *,
    signature_b64: str,
    public_key_pem: str,
    hash_name: str = "SHA-256",
    expected_digest: str | None = None,
) -> dict:
    """Vérifie la signature et, si fourni, compare l'empreinte du fichier à celle attendue."""
    if not data:
        raise ValueError("Le fichier à vérifier est vide.")
    algorithm = _hash_algorithm(hash_name)
    public_key = _load_public_key(public_key_pem)

    try:
        signature = base64.b64decode(signature_b64.strip(), validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("La signature doit être encodée en base64 valide.") from None

    try:
        public_key.verify(signature, data, _pss(algorithm), algorithm)
        valid = True
    except InvalidSignature:
        valid = False

    digest = _file_digest(data, hash_name)
    digest_match = None
    if expected_digest and expected_digest.strip():
        digest_match = hmac.compare_digest(digest, expected_digest.strip().lower())

    return {
        "valid": valid,
        "hashAlgorithm": hash_name,
        "fileDigest": digest,
        "digestMatch": digest_match,
        "publicKeyFingerprint": public_key_fingerprint(public_key),
        "keySize": public_key.key_size,
    }
