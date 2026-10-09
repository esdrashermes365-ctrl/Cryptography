import base64

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app import config
from tests.helpers import logged_in

CONTENT = b"contrat important\nligne 2\n"


def sign(client, content=CONTENT, **form):
    return client.post(
        "/api/signature/sign",
        files={"file": ("contrat.txt", content, "text/plain")},
        data={"hash_algorithm": "SHA-256", "key_size": "2048", **form},
    )


def verify(client, signed, content=CONTENT, **overrides):
    form = {
        "signature": signed["signature"],
        "public_key": signed["publicKeyPem"],
        "hash_algorithm": signed["hashAlgorithm"],
        **overrides,
    }
    return client.post(
        "/api/signature/verify",
        files={"file": ("contrat.txt", content, "text/plain")},
        data=form,
    )


def test_signature_routes_require_session(client):
    assert sign(client).status_code == 401
    assert client.post("/api/signature/verify").status_code == 401


def test_sign_then_verify_roundtrip(client):
    logged_in(client)
    response = sign(client)
    assert response.status_code == 200
    signed = response.json()
    assert signed["algorithm"] == "RSA-PSS"
    assert signed["keySize"] == 2048
    assert signed["privateKeyPem"].startswith("-----BEGIN PRIVATE KEY-----")
    assert signed["publicKeyPem"].startswith("-----BEGIN PUBLIC KEY-----")

    ok = verify(client, signed).json()
    assert ok["valid"] is True
    assert ok["fileDigest"] == signed["fileDigest"]
    assert ok["publicKeyFingerprint"] == signed["publicKeyFingerprint"]
    assert ok["digestMatch"] is None


def test_modified_file_invalidates_signature(client):
    logged_in(client)
    signed = sign(client).json()
    assert verify(client, signed, content=CONTENT + b"x").json()["valid"] is False


def test_other_public_key_invalidates_signature(client):
    logged_in(client)
    signed = sign(client).json()
    other = sign(client).json()
    assert verify(client, signed, public_key=other["publicKeyPem"]).json()["valid"] is False


def test_tampered_signature_is_invalid_not_an_error(client):
    logged_in(client)
    signed = sign(client).json()
    raw = bytearray(base64.b64decode(signed["signature"]))
    raw[0] ^= 0xFF
    forged = base64.b64encode(bytes(raw)).decode()
    response = verify(client, signed, signature=forged)
    assert response.status_code == 200
    assert response.json()["valid"] is False


def test_wrong_hash_algorithm_at_verification_is_invalid(client):
    logged_in(client)
    signed = sign(client).json()
    assert verify(client, signed, hash_algorithm="SHA-512").json()["valid"] is False


def test_sha512_and_4096_bits(client):
    logged_in(client)
    signed = sign(client, hash_algorithm="SHA-512", key_size="4096").json()
    assert signed["keySize"] == 4096 and signed["hashAlgorithm"] == "SHA-512"
    assert len(signed["fileDigest"]) == 128
    assert verify(client, signed).json()["valid"] is True


def test_digest_comparison(client):
    logged_in(client)
    signed = sign(client).json()
    same = verify(client, signed, expected_digest=signed["fileDigest"].upper()).json()
    assert same["digestMatch"] is True
    diff = verify(client, signed, expected_digest="0" * 64).json()
    assert diff["digestMatch"] is False
    assert diff["valid"] is True  # la signature reste valable, seule la comparaison échoue


def test_import_private_key_gives_same_public_key(client):
    logged_in(client)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    signed = sign(client, private_key=pem).json()
    assert signed["privateKeyPem"] is None  # une clé importée n'est pas renvoyée
    expected_public = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    assert signed["publicKeyPem"] == expected_public
    assert verify(client, signed).json()["valid"] is True


def test_bad_inputs_are_clean_400s(client):
    logged_in(client)
    assert sign(client, content=b"").status_code == 400
    assert sign(client, hash_algorithm="MD5").status_code == 400
    assert sign(client, key_size="1024").status_code == 400
    assert sign(client, private_key="pas une clé").status_code == 400

    weak = rsa.generate_private_key(public_exponent=65537, key_size=1024)
    weak_pem = weak.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    assert "2048" in sign(client, private_key=weak_pem).json()["detail"]

    signed = sign(client).json()
    assert verify(client, signed, signature="%%%pas-du-base64%%%").status_code == 400
    assert verify(client, signed, public_key="pas une clé").status_code == 400


def test_upload_larger_than_limit_is_refused(client, monkeypatch):
    logged_in(client)
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 1024)
    response = sign(client, content=b"a" * 2048)
    assert response.status_code == 413
    ok = sign(client, content=b"a" * 1024)
    assert ok.status_code == 200
