import os
import tempfile

# Environnement de test posé AVANT l'import de l'application.
_db_file = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ.update(
    {
        "APP_ENV": "development",
        "DATABASE_URL": f"sqlite:///{_db_file}",
        "ENCRYPTION_SECRET_KEY": "11" * 32,
        "JWT_SECRET_KEY": "22" * 32,
        "EMAIL_HASH_KEY": "33" * 32,
        "CORS_ORIGINS": "http://localhost:5173",
    }
)

import pytest
from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app
from app.security import limiter


@pytest.fixture(autouse=True)
def clean_state():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    limiter._hits.clear()
    yield


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


GOOD_PASSWORD = "cheval-agrafe-lune-42"


def register(client, email="esdras@example.com", password=GOOD_PASSWORD, name="Esdras G"):
    return client.post(
        "/api/register",
        json={
            "fullName": name,
            "email": email,
            "password": password,
            "confirmPassword": password,
        },
    )
