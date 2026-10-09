import pytest

from tests.helpers import logged_in

ALGORITHMS = ["Argon2id", "Bcrypt", "SHA-256", "SHA-512"]


def create(client, payload="motdepasse", algorithm="SHA-256"):
    return client.post("/api/hash/create", json={"payload": payload, "algorithm": algorithm})


def verify(client, payload, digest, algorithm):
    return client.post(
        "/api/hash/verify", json={"payload": payload, "hash": digest, "algorithm": algorithm}
    )


def test_hash_routes_require_session(client):
    assert create(client).status_code == 401
    assert verify(client, "a", "b", "SHA-256").status_code == 401


@pytest.mark.parametrize("algorithm", ALGORITHMS)
def test_create_then_verify_roundtrip(client, algorithm):
    logged_in(client)
    created = create(client, "bonjour le monde", algorithm)
    assert created.status_code == 200
    digest = created.json()["hash"]
    assert created.json()["algorithm"] == algorithm

    ok = verify(client, "bonjour le monde", digest, algorithm)
    assert ok.status_code == 200
    assert ok.json() == {"match": True, "message": "Empreinte valide"}

    ko = verify(client, "autre texte", digest, algorithm)
    assert ko.json()["match"] is False
    assert ko.json()["message"] == "Empreinte non correspondante"


def test_known_sha256_vector(client):
    logged_in(client)
    digest = create(client, "abc", "SHA-256").json()["hash"]
    assert digest == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_sha_comparison_ignores_case_and_surrounding_spaces(client):
    logged_in(client)
    digest = create(client, "abc", "SHA-256").json()["hash"]
    assert verify(client, "abc", f"  {digest.upper()}\n", "SHA-256").json()["match"] is True


def test_argon2_and_bcrypt_are_salted(client):
    logged_in(client)
    for algorithm in ("Argon2id", "Bcrypt"):
        assert create(client, "x", algorithm).json()["hash"] != create(client, "x", algorithm).json()["hash"]
    assert create(client, "x", "Argon2id").json()["hash"].startswith("$argon2id$")


def test_bcrypt_handles_long_input_without_truncation(client):
    logged_in(client)
    long_text = "a" * 100
    digest = create(client, long_text, "Bcrypt").json()["hash"]
    assert verify(client, long_text, digest, "Bcrypt").json()["match"] is True
    # Au-delà de 72 octets, bcrypt brut ignorerait la fin : ici elle compte.
    assert verify(client, "a" * 99 + "b", digest, "Bcrypt").json()["match"] is False


def test_verify_accepts_standard_bcrypt_hash_from_elsewhere(client):
    import bcrypt

    logged_in(client)
    foreign = bcrypt.hashpw(b"secret", bcrypt.gensalt(rounds=4)).decode()
    assert verify(client, "secret", foreign, "Bcrypt").json()["match"] is True
    assert verify(client, "faux", foreign, "Bcrypt").json()["match"] is False


def test_verify_with_garbage_hash_is_a_clean_mismatch_not_an_error(client):
    logged_in(client)
    for algorithm in ALGORITHMS:
        response = verify(client, "abc", "ceci-n-est-pas-une-empreinte", algorithm)
        assert response.status_code == 200
        assert response.json()["match"] is False


def test_verify_rejects_wrong_algorithm_for_the_hash(client):
    logged_in(client)
    digest = create(client, "abc", "SHA-256").json()["hash"]
    assert verify(client, "abc", digest, "SHA-512").json()["match"] is False
    assert verify(client, "abc", digest, "Argon2id").json()["match"] is False


def test_unknown_algorithm_and_empty_values_are_rejected(client):
    logged_in(client)
    assert create(client, "abc", "MD5").status_code == 400
    assert create(client, "", "SHA-256").status_code == 422
    assert verify(client, "abc", "", "SHA-256").status_code == 422
    assert verify(client, "", "abc", "SHA-256").status_code == 422
    assert verify(client, "abc", "abc", "MD5").status_code == 400


def test_oversized_payload_is_refused(client):
    from app import config

    logged_in(client)
    assert create(client, "a" * (config.MAX_TEXT_CHARS + 1)).status_code == 422
