from tests.conftest import register
from tests.test_auth import login


def logged_in(client, email="esdras@example.com"):
    register(client, email=email)
    assert login(client, email=email).status_code == 200
    return client
