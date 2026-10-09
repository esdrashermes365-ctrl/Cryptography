from tests.helpers import logged_in


def test_audit_events_record_crypto_results_without_sensitive_content(client):
    logged_in(client)
    secret = "texte privé à ne pas journaliser"
    assert client.post(
        "/api/crypto/encrypt",
        json={"payload": secret, "algorithm": "AES-256-GCM"},
    ).status_code == 200
    assert client.post(
        "/api/crypto/encrypt",
        json={"payload": secret, "algorithm": "DES"},
    ).status_code == 400
    assert client.post(
        "/api/hash/verify",
        json={"payload": secret, "hash": "incorrect", "algorithm": "SHA-256"},
    ).json()["match"] is False

    response = client.get("/api/audit-logs")
    assert response.status_code == 200
    body = response.json()
    assert body["hasMore"] is False
    assert [(item["action"], item["success"]) for item in body["items"]] == [
        ("verify_hash", False),
        ("encrypt", False),
        ("encrypt", True),
    ]
    assert secret not in response.text
    assert {item["algorithm"] for item in body["items"]} == {"AES-256-GCM", "DES", "SHA-256"}


def test_audit_events_are_private_and_endpoint_requires_login(client):
    assert client.get("/api/audit-logs").status_code == 401

    logged_in(client)
    assert client.post(
        "/api/hash/create",
        json={"payload": "account one", "algorithm": "SHA-256"},
    ).status_code == 200

    from fastapi.testclient import TestClient

    from app.main import app

    other_client = TestClient(app)
    logged_in(other_client, email="another@example.com")
    assert other_client.get("/api/audit-logs").json() == {"items": [], "hasMore": False}
    assert other_client.get("/api/audit-logs?limit=101").status_code == 422


def test_audit_events_are_paginated(client):
    logged_in(client)
    for value in ("one", "two", "three"):
        response = client.post(
            "/api/hash/create",
            json={"payload": value, "algorithm": "SHA-256"},
        )
        assert response.status_code == 200

    first_page = client.get("/api/audit-logs?limit=2")
    assert first_page.status_code == 200
    assert len(first_page.json()["items"]) == 2
    assert first_page.json()["hasMore"] is True

    second_page = client.get("/api/audit-logs?limit=2&offset=2")
    assert len(second_page.json()["items"]) == 1
    assert second_page.json()["hasMore"] is False


def test_signature_success_and_failure_are_audited(client):
    logged_in(client)
    signed = client.post(
        "/api/signature/sign",
        files={"file": ("document.txt", b"document", "text/plain")},
        data={"hash_algorithm": "SHA-256", "key_size": "2048"},
    )
    assert signed.status_code == 200
    signed_data = signed.json()

    invalid = client.post(
        "/api/signature/verify",
        files={"file": ("document.txt", b"modified", "text/plain")},
        data={
            "signature": signed_data["signature"],
            "public_key": signed_data["publicKeyPem"],
            "hash_algorithm": "SHA-256",
        },
    )
    assert invalid.status_code == 200
    assert invalid.json()["valid"] is False

    events = client.get("/api/audit-logs").json()["items"]
    assert [(event["action"], event["success"]) for event in events] == [
        ("verify_signature", False),
        ("sign", True),
    ]
