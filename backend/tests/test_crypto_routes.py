import pytest

from tests.helpers import logged_in

SYMMETRIC = ["AES-128-GCM", "AES-256-GCM", "ChaCha20-Poly1305", "AES-256-CBC"]


def encrypt(client, payload="message secret", algorithm="AES-256-GCM", key=None):
    return client.post(
        "/api/crypto/encrypt", json={"payload": payload, "algorithm": algorithm, "key": key}
    )


def decrypt(client, enc, algorithm):
    return client.post(
        "/api/crypto/decrypt",
        json={"data": enc["data"], "algorithm": algorithm, "key": enc["key"], "iv": enc["iv"], "tag": enc["tag"]},
    )


def test_crypto_routes_require_session(client):
    assert encrypt(client).status_code == 401
    assert client.post("/api/crypto/decrypt", json={"data": "a", "algorithm": "AES-256-GCM", "key": "k"}).status_code == 401


@pytest.mark.parametrize("algorithm", SYMMETRIC)
def test_symmetric_roundtrip(client, algorithm):
    logged_in(client)
    enc = encrypt(client, "message secret éà", algorithm)
    assert enc.status_code == 200
    assert "message secret" not in enc.json()["data"]
    dec = decrypt(client, enc.json(), algorithm)
    assert dec.status_code == 200
    assert dec.json()["plainText"] == "message secret éà"


def test_rsa_oaep_roundtrip(client):
    logged_in(client)
    enc = encrypt(client, "court message", "RSA-OAEP").json()
    assert enc["key"].startswith("-----BEGIN PRIVATE KEY-----")
    dec = client.post(
        "/api/crypto/decrypt",
        json={"data": enc["data"], "algorithm": "RSA-OAEP", "key": enc["key"]},
    )
    assert dec.json()["plainText"] == "court message"


def test_wrong_key_and_tampered_data_are_rejected(client):
    logged_in(client)
    enc = encrypt(client).json()
    other = encrypt(client).json()
    bad_key = decrypt(client, {**enc, "key": other["key"]}, "AES-256-GCM")
    assert bad_key.status_code == 400
    flipped = ("A" if enc["data"][0] != "A" else "B") + enc["data"][1:]
    assert decrypt(client, {**enc, "data": flipped}, "AES-256-GCM").status_code == 400


def test_unknown_algorithm_is_rejected(client):
    logged_in(client)
    assert encrypt(client, algorithm="DES").status_code == 400
