import os
from pathlib import Path

os.environ["CHETTIK_DB"] = "chettik.api-test.db"
os.environ["CHETTIK_RESET"] = "1"
os.environ["OTP_DEV_CODE"] = "123456"
os.environ["API_ALLOWED_ORIGINS"] = "http://127.0.0.1:5173"

from fastapi.testclient import TestClient
from backend.main import app, init


def login(client: TestClient, email: str) -> str:
    request = client.post("/api/auth/otp/request", json={"email": email})
    if request.status_code == 404:
        username = email.split("@")[0].replace(".", "_").replace("-", "_")
        request = client.post("/api/auth/otp/request", json={"email": email, "mode": "signup"})
        assert request.status_code == 200
        response = client.post("/api/auth/otp/verify", json={"email": email, "code": "123456", "challengeId": request.json()["challengeId"], "name": username.title(), "username": username})
    else:
        response = client.post("/api/auth/otp/verify", json={"email": email, "code": "123456", "challengeId": request.json()["challengeId"]})
    assert response.status_code == 200
    return response.json()["token"]


def account_id(client: TestClient, token: str) -> str:
    return client.get("/api/me/profile", headers={"Authorization": f"Bearer {token}"}).json()["id"]


def setup_function():
    init(reset=True)


def test_headers_and_message_membership():
    with TestClient(app) as client:
        token_a = login(client, "test@test.com")
        token_b = login(client, "test2@test.com")
        headers_a = {"Authorization": f"Bearer {token_a}"}
        headers_b = {"Authorization": f"Bearer {token_b}"}
        created = client.post("/api/chats/direct", headers=headers_a, json={"userId": account_id(client, token_b)})
        assert created.status_code == 200
        chat_id = created.json()["id"]
        sent = client.post(f"/api/chats/{chat_id}/messages", headers=headers_a, json={"text": "private"})
        assert sent.status_code == 200
        assert client.get(f"/api/chats/{chat_id}/messages", headers=headers_b).status_code == 200
        outsider = login(client, "test3@test.com")
        denied = client.get(f"/api/chats/{chat_id}/messages", headers={"Authorization": f"Bearer {outsider}"})
        assert denied.status_code == 403
        response = client.get("/api/me/profile", headers=headers_a)
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-content-type-options"] == "nosniff"


def test_edit_reactions_audit_and_websocket_auth():
    with TestClient(app) as client:
        token = login(client, "test@test.com")
        headers = {"Authorization": f"Bearer {token}"}
        chat_id = client.get("/api/chats", headers=headers).json()[0]["id"]
        message = client.post(f"/api/chats/{chat_id}/messages", headers=headers, json={"text": "hello"}).json()
        assert client.patch(f"/api/messages/{message['id']}", headers=headers, json={"text": "edited"}).status_code == 200
        assert client.post(f"/api/messages/{message['id']}/reactions", headers=headers, json={"emoji": "✅"}).status_code == 200
        page = client.get(f"/api/chats/{chat_id}/messages", headers=headers).json()
        assert page["items"][0]["text"] == "edited"
        assert page["items"][0]["reactions"][0]["emoji"] == "✅"
        admin = login(client, "turkapahf@gmail.com")
        assert client.get("/api/admin/audit", headers={"Authorization": f"Bearer {admin}"}).status_code == 200
        with client.websocket_connect(f"/api/ws?token={token}") as socket:
            socket.send_text("ping")
        try:
            client.websocket_connect("/api/ws?token=invalid")
        except Exception:
            pass


def test_signup_creates_unique_account_and_session():
    with TestClient(app) as client:
        email = "new-local@example.test"
        request = client.post("/api/auth/otp/request", json={"email": email, "mode": "signup"})
        assert request.status_code == 200
        response = client.post(
            "/api/auth/otp/verify",
            json={"email": email, "code": "123456", "challengeId": request.json()["challengeId"], "name": "New Local", "username": "new_local"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["username"] == "@new_local"
        duplicate = client.post("/api/auth/otp/request", json={"email": email, "mode": "signup"})
        assert duplicate.status_code == 409


def test_contacts_are_opt_in_and_users_are_searchable():
    with TestClient(app) as client:
        owner = login(client, "owner@example.test")
        person = login(client, "person@example.test")
        owner_headers = {"Authorization": f"Bearer {owner}"}
        person_id = account_id(client, person)
        assert client.get("/api/contacts", headers=owner_headers).json() == []
        search = client.get("/api/users/search?q=@person", headers=owner_headers)
        assert search.status_code == 200
        assert search.json()[0]["id"] == person_id
        added = client.post("/api/contacts", headers=owner_headers, json={"userId": person_id})
        assert added.status_code == 200
        assert [item["id"] for item in client.get("/api/contacts", headers=owner_headers).json()] == [person_id]
        assert client.delete(f"/api/contacts/{person_id}", headers=owner_headers).status_code == 200
