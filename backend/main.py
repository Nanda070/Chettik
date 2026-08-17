import json
import logging
import os
import secrets
import sqlite3
import uuid
import hashlib
import hmac
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import aiosmtplib
from email.message import EmailMessage
from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.storage import configured_storage

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines() if (ROOT / ".env").exists() else []:
    if "=" in line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

DB_PATH = ROOT / os.getenv("CHETTIK_DB", "chettik.db")
MEDIA_ROOT = ROOT / os.getenv("MEDIA_ROOT", "backend/media")
storage = configured_storage(MEDIA_ROOT)
logger = logging.getLogger("chettik")
OTP_TTL = timedelta(minutes=10)
OTP_MAX_ATTEMPTS = 5
MEDIA_MAX_BYTES = int(os.getenv("MEDIA_MAX_BYTES", str(25 * 1024 * 1024)))
MESSAGE_PAGE_SIZE = min(max(int(os.getenv("MESSAGE_PAGE_SIZE", "50")), 10), 200)
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMITS = {
    "otp_request": int(os.getenv("RATE_LIMIT_OTP_REQUEST", "20")),
    "otp_verify": int(os.getenv("RATE_LIMIT_OTP_VERIFY", "30")),
    "message_send": int(os.getenv("RATE_LIMIT_MESSAGE_SEND", "40")),
    "media_upload": int(os.getenv("RATE_LIMIT_MEDIA_UPLOAD", "10")),
    "invite": int(os.getenv("RATE_LIMIT_INVITE", "10")),
    "report": int(os.getenv("RATE_LIMIT_REPORT", "10")),
}
ALLOWED_MEDIA_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4",
    "video/webm", "audio/mpeg", "audio/ogg", "application/pdf", "text/plain",
}

DEFAULT_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173"
configured_origins = [origin.strip().rstrip("/") for origin in os.getenv("API_ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if origin.strip()]
if not configured_origins or any(
    origin == "*" or not origin.startswith(("http://127.0.0.1:", "http://localhost:"))
    for origin in configured_origins
):
    raise RuntimeError("API_ALLOWED_ORIGINS must contain explicit localhost or 127.0.0.1 origins only")
app = FastAPI(title="Chettik API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
clients: dict[str, set[WebSocket]] = {}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", uid())
    try:
        response = await call_next(request)
    except HTTPException as error:
        response = JSONResponse({"error": {"code": f"HTTP_{error.status_code}", "message": str(error.detail), "requestId": request_id}}, status_code=error.status_code)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    if request.url.path.startswith("/api/auth/") or request.url.path == "/api/me/profile":
        response.headers["Cache-Control"] = "no-store"
    return response


@contextmanager
def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def row(value: sqlite3.Row | None):
    return dict(value) if value else None


def uid() -> str:
    return str(uuid.uuid4())


def hash_otp(challenge_id: str, code: str) -> str:
    return hashlib.scrypt(code.encode(), salt=challenge_id.encode(), n=2**14, r=8, p=1).hex()


async def deliver_otp(email: str, code: str, expires_at: str) -> None:
    message = EmailMessage()
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = email
    message["Subject"] = "Your Chettik verification code"
    message.set_content(f"Your Chettik verification code is {code}. It expires at {expires_at}.")
    await aiosmtplib.send(
        message,
        hostname=os.environ["SMTP_HOST"],
        port=int(os.getenv("SMTP_PORT", "465")),
        username=os.environ["SMTP_USER"],
        password=os.environ["SMTP_PASS"],
        use_tls=os.getenv("SMTP_SECURE", "true").lower() == "true",
        timeout=10,
    )


def smtp_is_configured() -> bool:
    return all(os.getenv(key) for key in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"))


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, role TEXT NOT NULL, email TEXT UNIQUE NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, badges_json TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS otp_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT);
CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(chat_id,user_id));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', metadata_json TEXT NOT NULL DEFAULT '{}', media_id TEXT, media_mime TEXT, media_size INTEGER, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, primary_chat_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', username TEXT UNIQUE, visibility TEXT NOT NULL, owner_id TEXT NOT NULL, chat_id TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS channel_members (channel_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'subscriber', PRIMARY KEY(channel_id,user_id));
CREATE TABLE IF NOT EXISTS invite_links (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, code TEXT UNIQUE NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, bio TEXT NOT NULL DEFAULT '', github TEXT NOT NULL DEFAULT '', discord TEXT NOT NULL DEFAULT '', privacy_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS sticker_packs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', share_code TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS stickers (id TEXT PRIMARY KEY, pack_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, data_url TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, uploader_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, data_url TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS media_objects (id TEXT PRIMARY KEY, uploader_id TEXT NOT NULL, storage_key TEXT NOT NULL UNIQUE, name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS secret_chats (id TEXT PRIMARY KEY, user_a_id TEXT NOT NULL, user_b_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_a_id, user_b_id));
CREATE TABLE IF NOT EXISTS secret_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, public_key TEXT NOT NULL, label TEXT NOT NULL, created_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, UNIQUE(user_id, public_key));
CREATE TABLE IF NOT EXISTS secret_messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, sender_key_id TEXT NOT NULL, ciphertext TEXT NOT NULL, nonce TEXT NOT NULL, recipient_key_id TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (scope TEXT NOT NULL, subject TEXT NOT NULL, window_started INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(scope, subject));
CREATE TABLE IF NOT EXISTS message_reactions (message_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(message_id, user_id, emoji));
CREATE TABLE IF NOT EXISTS message_pins (message_id TEXT PRIMARY KEY, pinned_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS message_receipts (message_id TEXT NOT NULL, user_id TEXT NOT NULL, read_at TEXT NOT NULL, PRIMARY KEY(message_id, user_id));
CREATE TABLE IF NOT EXISTS chat_preferences (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, muted_until TEXT, archived_at TEXT, PRIMARY KEY(chat_id, user_id));
CREATE TABLE IF NOT EXISTS blocked_users (blocker_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(blocker_id, blocked_id));
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, message_id TEXT, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
"""


def init(reset: bool = False):
    with db() as c:
        if reset:
            c.executescript(
                """
                PRAGMA foreign_keys = OFF;
                DROP TABLE IF EXISTS audit_log;
                DROP TABLE IF EXISTS rate_limits;
                DROP TABLE IF EXISTS message_reactions;
                DROP TABLE IF EXISTS message_pins;
                DROP TABLE IF EXISTS message_receipts;
                DROP TABLE IF EXISTS chat_preferences;
                DROP TABLE IF EXISTS reports;
                DROP TABLE IF EXISTS blocked_users;
                DROP TABLE IF EXISTS attachments;
                DROP TABLE IF EXISTS media_objects;
                DROP TABLE IF EXISTS secret_messages;
                DROP TABLE IF EXISTS secret_devices;
                DROP TABLE IF EXISTS secret_chats;
                DROP TABLE IF EXISTS stickers;
                DROP TABLE IF EXISTS sticker_packs;
                DROP TABLE IF EXISTS invite_links;
                DROP TABLE IF EXISTS channel_members;
                DROP TABLE IF EXISTS channels;
                DROP TABLE IF EXISTS group_members;
                DROP TABLE IF EXISTS groups;
                DROP TABLE IF EXISTS messages;
                DROP TABLE IF EXISTS chat_members;
                DROP TABLE IF EXISTS chats;
                DROP TABLE IF EXISTS profiles;
                DROP TABLE IF EXISTS otp_challenges;
                DROP TABLE IF EXISTS sessions;
                DROP TABLE IF EXISTS users;
                PRAGMA foreign_keys = ON;
                """
            )
        c.executescript(SCHEMA)
        message_columns = {item[1] for item in c.execute("PRAGMA table_info(messages)").fetchall()}
        for definition in ("media_id TEXT", "media_mime TEXT", "media_size INTEGER"):
            if definition.split()[0] not in message_columns:
                c.execute(f"ALTER TABLE messages ADD COLUMN {definition}")
        secret_columns = {item[1] for item in c.execute("PRAGMA table_info(secret_messages)").fetchall()}
        if "sender_key_id" not in secret_columns:
            c.execute("ALTER TABLE secret_messages ADD COLUMN sender_key_id TEXT")
        # Express schemas differ (extra columns). Recreate drifted auth tables in place.
        for table, ddl, expected in (
            (
                "otp_challenges",
                "CREATE TABLE otp_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT)",
                {"id", "email", "code_hash", "expires_at", "attempts", "consumed_at"},
            ),
            (
                "sessions",
                "CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT)",
                {"token", "user_id", "created_at", "expires_at", "revoked_at"},
            ),
        ):
            cols = {row[1] for row in c.execute(f"PRAGMA table_info({table})").fetchall()}
            if cols and cols != expected:
                c.execute(f"DROP TABLE {table}")
                c.execute(ddl)
        seeds = [
            ("nanda", "Nanda", "@nanda", "SuperAdmin", "test@test.com", "N", "#9e2338"),
            ("mark", "Mark", "@mark", "Admin", "test2@test.com", "M", "#6e4c97"),
            ("alisher", "Alisher", "@alisher", "User", "test3@test.com", "A", "#bf8057"),
        ]
        for user in seeds:
            c.execute("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,?, '[]')", user)
            c.execute("INSERT OR IGNORE INTO profiles(user_id) VALUES (?)", (user[0],))
            saved = f"saved-{user[0]}"
            c.execute("INSERT OR IGNORE INTO chats VALUES (?, 'Saved Messages', 'saved')", (saved,))
            c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)", (saved, user[0]))


@app.on_event("startup")
def on_startup():
    init(reset=os.getenv("CHETTIK_RESET") == "1")


@app.post("/api/dev/reset-inbox")
def reset_inbox(authorization: str | None = Header(None)):
    """Test helper: keep Saved Messages, drop every other chat for the current user."""
    if os.getenv("CHETTIK_RESET") != "1":
        raise HTTPException(404, "Not found")
    user = current(authorization)
    with db() as c:
        chats = c.execute(
            "SELECT c.id, c.type FROM chats c JOIN chat_members cm ON cm.chat_id=c.id WHERE cm.user_id=? AND c.type!='saved'",
            (user["id"],),
        ).fetchall()
        for chat in chats:
            chat_id = chat["id"]
            channel = c.execute("SELECT id FROM channels WHERE chat_id=?", (chat_id,)).fetchone()
            if channel:
                c.execute("DELETE FROM channel_members WHERE channel_id=?", (channel["id"],))
                c.execute("DELETE FROM invite_links WHERE target_type='channel' AND target_id=?", (channel["id"],))
                c.execute("DELETE FROM channels WHERE id=?", (channel["id"],))
            group = c.execute("SELECT id FROM groups WHERE primary_chat_id=?", (chat_id,)).fetchone()
            if group:
                c.execute("DELETE FROM group_members WHERE group_id=?", (group["id"],))
                c.execute("DELETE FROM invite_links WHERE target_type='group' AND target_id=?", (group["id"],))
                c.execute("DELETE FROM groups WHERE id=?", (group["id"],))
            c.execute("DELETE FROM messages WHERE chat_id=?", (chat_id,))
            c.execute("DELETE FROM chat_members WHERE chat_id=?", (chat_id,))
            c.execute("DELETE FROM chats WHERE id=?", (chat_id,))
    return {"ok": True}


def current(auth: str | None):
    token = (auth or "").removeprefix("Bearer ").strip()
    with db() as c:
        user = c.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.revoked_at IS NULL AND s.expires_at>?",
            (token, now()),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Authentication required")
    return row(user)


def audit(connection: sqlite3.Connection, actor_id: str | None, action: str, target_type: str, target_id: str | None = None, **metadata):
    connection.execute(
        "INSERT INTO audit_log VALUES (?,?,?,?,?,?,?)",
        (uid(), actor_id, action, target_type, target_id, json.dumps(metadata), now()),
    )


def enforce_rate_limit(connection: sqlite3.Connection, scope: str, subject: str):
    limit = RATE_LIMITS[scope]
    epoch = int(datetime.now(timezone.utc).timestamp())
    window_started = epoch - (epoch % RATE_LIMIT_WINDOW_SECONDS)
    found = connection.execute("SELECT window_started,count FROM rate_limits WHERE scope=? AND subject=?", (scope, subject)).fetchone()
    if not found or found["window_started"] != window_started:
        connection.execute(
            "INSERT INTO rate_limits(scope,subject,window_started,count) VALUES (?,?,?,1) ON CONFLICT(scope,subject) DO UPDATE SET window_started=excluded.window_started,count=1",
            (scope, subject, window_started),
        )
        return
    if found["count"] >= limit:
        retry_after = RATE_LIMIT_WINDOW_SECONDS - (epoch - window_started)
        raise HTTPException(429, f"Too many requests. Try again in {retry_after} seconds.", headers={"Retry-After": str(retry_after)})
    connection.execute("UPDATE rate_limits SET count=count+1 WHERE scope=? AND subject=?", (scope, subject))


def require_chat_member(connection: sqlite3.Connection, chat_id: str, user_id: str):
    if not connection.execute("SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?", (chat_id, user_id)).fetchone():
        raise HTTPException(403, "Not a chat member")


def message_with_state(connection: sqlite3.Connection, message: sqlite3.Row, user_id: str) -> dict:
    data = row(message)
    data["metadata"] = json.loads(data.pop("metadata_json") or "{}")
    data["reactions"] = [row(item) for item in connection.execute("SELECT user_id,emoji FROM message_reactions WHERE message_id=? ORDER BY created_at", (data["id"],))]
    data["pinned"] = bool(connection.execute("SELECT 1 FROM message_pins WHERE message_id=?", (data["id"],)).fetchone())
    data["read"] = bool(connection.execute("SELECT 1 FROM message_receipts WHERE message_id=? AND user_id=?", (data["id"], user_id)).fetchone())
    return data


def public(user):
    return {k: user[k] for k in ("id", "name", "username", "role", "email", "initials", "color")} | {
        "badges": json.loads(user.get("badges_json") or "[]")
    }


async def broadcast(payload: dict, recipients: set[str] | None = None):
    dead = []
    sockets = [
        socket for user_id, owned in clients.items()
        if recipients is None or user_id in recipients
        for socket in owned
    ]
    for socket in sockets:
        try:
            await socket.send_json(payload)
        except Exception:
            dead.append(socket)
    for user_id in list(clients):
        clients[user_id].difference_update(dead)
        if not clients[user_id]:
            del clients[user_id]


@app.get("/api/health")
def health():
    return {"ok": True, "storage": "sqlite", "runtime": "fastapi", "db": DB_PATH.name}


@app.get("/api/ready")
def ready():
    try:
        with db() as c:
            c.execute("SELECT 1").fetchone()
        MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    except Exception as error:
        logger.exception("Readiness check failed")
        raise HTTPException(503, "Local storage is not ready") from error
    return {"ok": True, "database": "ready", "media": "ready"}


@app.post("/api/auth/otp/request")
async def request_otp(body: dict):
    email = str(body.get("email", "")).lower().strip()
    mode = str(body.get("mode", "login"))
    if not email or len(email) > 254:
        raise HTTPException(400, "Enter a valid email address")
    if mode not in ("login", "signup"):
        raise HTTPException(400, "Invalid authentication mode")
    expires = (datetime.now(timezone.utc) + OTP_TTL).isoformat()
    challenge = uid()
    dev_code = os.getenv("OTP_DEV_CODE")
    code = dev_code if dev_code else f"{secrets.randbelow(1_000_000):06d}"
    with db() as c:
        enforce_rate_limit(c, "otp_request", email)
        existing = c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone()
        if mode == "login" and not existing:
            raise HTTPException(404, "No Chettik account uses this email address")
        if mode == "signup" and existing:
            raise HTTPException(409, "An account already uses this email address. Sign in instead.")
        c.execute(
            "INSERT INTO otp_challenges (id, email, code_hash, expires_at, attempts, consumed_at) VALUES (?,?,?,?,0,NULL)",
            (challenge, email, hash_otp(challenge, code), expires),
        )
        audit(c, None, "otp.requested", "account", email, mode=mode)
    if not dev_code:
        if not smtp_is_configured():
            with db() as c:
                c.execute("DELETE FROM otp_challenges WHERE id=?", (challenge,))
            logger.error("OTP delivery refused: SMTP is not configured")
            raise HTTPException(503, "Email delivery is unavailable. Try again later.")
        try:
            await deliver_otp(email, code, expires)
        except Exception:
            with db() as c:
                c.execute("DELETE FROM otp_challenges WHERE id=?", (challenge,))
            logger.exception("OTP SMTP delivery failed for %s", email)
            raise HTTPException(503, "Email delivery failed. Try again later.")
    else:
        logger.warning("OTP_DEV_CODE is enabled; SMTP delivery is bypassed")
    return {"challengeId": challenge, "expiresAt": expires, "delivery": "email"}


@app.post("/api/auth/otp/verify")
def verify_otp(body: dict):
    email = str(body.get("email", "")).lower().strip()
    code = str(body.get("code", ""))
    challenge = body.get("challengeId")
    with db() as c:
        enforce_rate_limit(c, "otp_verify", email)
        found = c.execute(
            "SELECT * FROM otp_challenges WHERE id=? AND email=? AND consumed_at IS NULL AND expires_at>?",
            (challenge, email, now()),
        ).fetchone()
        if not found:
            raise HTTPException(401, "Incorrect or expired verification code")
        if found["attempts"] >= OTP_MAX_ATTEMPTS:
            raise HTTPException(429, "Too many invalid attempts. Request a new code.")
        actual = hash_otp(found["id"], code)
        if not hmac.compare_digest(actual, found["code_hash"]):
            c.execute("UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?", (found["id"],))
            raise HTTPException(401, "Incorrect or expired verification code")
        user = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not user:
            name = str(body.get("name", "")).strip()
            username = str(body.get("username", "")).strip().lstrip("@").lower()
            if not (2 <= len(name) <= 80):
                raise HTTPException(400, "Display name must be between 2 and 80 characters")
            if not username.replace("_", "").isalnum() or not (3 <= len(username) <= 32):
                raise HTTPException(400, "Username must be 3–32 lowercase letters, digits, or underscores")
            if c.execute("SELECT 1 FROM users WHERE username=?", (f"@{username}",)).fetchone():
                raise HTTPException(409, "That username is unavailable")
            initials = "".join(part[0] for part in name.split() if part)[:2].upper() or "C"
            color = "#4c8a83"
            try:
                c.execute(
                    "INSERT INTO users VALUES (?,?,?,?,?,?,?, '[]')",
                    (uid(), name, f"@{username}", "User", email, initials, color),
                )
            except sqlite3.IntegrityError:
                raise HTTPException(409, "Email or username is already in use")
            user = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            c.execute("INSERT INTO profiles(user_id) VALUES (?)", (user["id"],))
            saved = f"saved-{user['id']}"
            c.execute("INSERT INTO chats VALUES (?, 'Saved Messages', 'saved')", (saved,))
            c.execute("INSERT INTO chat_members VALUES (?,?)", (saved, user["id"]))
            audit(c, user["id"], "account.created", "account", user["id"])
        token = secrets.token_urlsafe(32)
        expiry = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        c.execute("UPDATE otp_challenges SET consumed_at=? WHERE id=?", (now(), challenge))
        c.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at, revoked_at) VALUES (?,?,?,?,NULL)",
            (token, user["id"], now(), expiry),
        )
        audit(c, user["id"], "otp.verified", "session", token[:12])
        audit(c, user["id"], "login", "session", token[:12])
    return {"token": token, "user": public(row(user)), "expiresAt": expiry}


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(None)):
    token = (authorization or "").removeprefix("Bearer ").strip()
    if token:
        with db() as c:
            c.execute("UPDATE sessions SET revoked_at=? WHERE token=?", (now(), token))
            audit(c, None, "session.revoked", "session", token[:12])
    return {"ok": True}


@app.get("/api/me/profile")
def me_profile(authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        profile = c.execute("SELECT * FROM profiles WHERE user_id=?", (user["id"],)).fetchone()
    data = row(profile) or {"bio": "", "github": "", "discord": "", "privacy_json": "{}"}
    return {
        **public(user),
        "bio": data.get("bio", ""),
        "github": data.get("github", ""),
        "discord": data.get("discord", ""),
        "privacy": json.loads(data.get("privacy_json") or "{}"),
    }


@app.patch("/api/me/profile")
def patch_me_profile(body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        c.execute(
            "UPDATE profiles SET bio=?, github=?, discord=?, privacy_json=? WHERE user_id=?",
            (body.get("bio", ""), body.get("github", ""), body.get("discord", ""), json.dumps(body.get("privacy") or {}), user["id"]),
        )
    return {"ok": True}


@app.get("/api/users")
def users(authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        return [public(row(x)) for x in c.execute("SELECT * FROM users WHERE id!=? ORDER BY name", (user["id"],))]


@app.get("/api/chats")
def chats(authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        values = c.execute(
            """
            SELECT c.*,
              COALESCE(CASE WHEN c.type='direct' THEN (SELECT u.name FROM users u JOIN chat_members cm2 ON cm2.user_id=u.id WHERE cm2.chat_id=c.id AND u.id!=? LIMIT 1) ELSE c.title END, c.title) AS title,
              COALESCE((SELECT m.text FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1),'') preview,
              (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message_at
            FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
            WHERE cm.user_id=?
            ORDER BY COALESCE(last_message_at,'') DESC, c.title
            """,
            (user["id"], user["id"]),
        ).fetchall()
    return [row(x) for x in values]


@app.post("/api/chats/direct")
def direct(body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    target = body.get("userId")
    with db() as c:
        other = c.execute("SELECT * FROM users WHERE id=?", (target,)).fetchone()
        if not other or target == user["id"]:
            raise HTTPException(400, "Choose another user")
        chat = "direct-" + "-".join(sorted([user["id"], target]))
        c.execute("INSERT OR IGNORE INTO chats VALUES (?,?,'direct')", (chat, other["name"]))
        for member in (user["id"], target):
            c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)", (chat, member))
    return {"id": chat, "title": other["name"], "type": "direct", "participant": public(row(other)), "preview": "", "last_message_at": None}


@app.get("/api/chats/{chat_id}/messages")
def get_messages(chat_id: str, before: str | None = None, limit: int = MESSAGE_PAGE_SIZE, authorization: str | None = Header(None)):
    user = current(authorization)
    limit = min(max(limit, 1), 200)
    with db() as c:
        require_chat_member(c, chat_id, user["id"])
        where, params = "m.chat_id=?", [chat_id]
        if before:
            where += " AND m.created_at<?"
            params.append(before)
        values = c.execute(
            f"SELECT m.*,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE {where} ORDER BY m.created_at DESC LIMIT ?",
            (*params, limit + 1),
        ).fetchall()
        has_more = len(values) > limit
        page = values[:limit]
        return {"items": [message_with_state(c, value, user["id"]) for value in reversed(page)], "nextBefore": page[-1]["created_at"] if has_more and page else None}


@app.post("/api/chats/{chat_id}/messages")
async def post_message(chat_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    text = str(body.get("text", "")).strip()
    media_id = body.get("mediaId")
    if not text and not media_id:
        raise HTTPException(400, "Message text required")
    if len(text) > 4000:
        raise HTTPException(400, "Message text is too long")
    with db() as c:
        enforce_rate_limit(c, "message_send", user["id"])
        require_chat_member(c, chat_id, user["id"])
        channel = c.execute("SELECT id FROM channels WHERE chat_id=?", (chat_id,)).fetchone()
        if channel and not c.execute(
            "SELECT 1 FROM channel_members WHERE channel_id=? AND user_id=? AND role IN ('owner','admin')",
            (channel["id"], user["id"]),
        ).fetchone():
            raise HTTPException(403, "Only channel administrators can publish posts")
        media = None
        if media_id:
            media = c.execute(
                "SELECT id, mime_type, byte_size FROM media_objects WHERE id=? AND uploader_id=?",
                (media_id, user["id"]),
            ).fetchone()
            if not media:
                raise HTTPException(400, "Media upload is unavailable")
        message = {
            "id": uid(),
            "chat_id": chat_id,
            "sender_id": user["id"],
            "sender_name": user["name"],
            "text": text,
            "kind": body.get("kind", "text"),
            "metadata": body.get("metadata", {}),
            "media_id": media["id"] if media else None,
            "media_mime": media["mime_type"] if media else None,
            "media_size": media["byte_size"] if media else None,
            "created_at": now(),
        }
        c.execute(
            "INSERT INTO messages (id,chat_id,sender_id,text,kind,metadata_json,media_id,media_mime,media_size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (message["id"], chat_id, user["id"], text, message["kind"], json.dumps(message["metadata"]), message["media_id"], message["media_mime"], message["media_size"], message["created_at"]),
        )
        audit(c, user["id"], "message.created", "message", message["id"], chat_id=chat_id)
        recipients = {item["user_id"] for item in c.execute("SELECT user_id FROM chat_members WHERE chat_id=?", (chat_id,))}
    await broadcast({"type": "message.created", "message": message}, recipients)
    return message


@app.get("/api/groups")
def groups(authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        return [
            row(x)
            for x in c.execute(
                """
                SELECT g.*, COUNT(gm.user_id) member_count
                FROM groups g JOIN group_members gm ON gm.group_id=g.id
                WHERE EXISTS(SELECT 1 FROM group_members own WHERE own.group_id=g.id AND own.user_id=?)
                GROUP BY g.id
                """,
                (user["id"],),
            )
        ]


@app.post("/api/groups")
def create_group(body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    title = str(body.get("title", "")).strip()
    description = str(body.get("description", ""))
    if not title:
        raise HTTPException(400, "Group name required")
    group, chat = uid(), uid()
    with db() as c:
        c.execute("INSERT INTO chats VALUES (?,?,'group')", (chat, title))
        c.execute("INSERT INTO chat_members VALUES (?,?)", (chat, user["id"]))
        c.execute("INSERT INTO groups VALUES (?,?,?,?,?,?)", (group, title, description, user["id"], chat, now()))
        c.execute("INSERT INTO group_members VALUES (?,?,'owner')", (group, user["id"]))
    return {"id": group, "title": title, "description": description, "primaryChatId": chat}


@app.post("/api/groups/{group_id}/members")
def add_group_member(group_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    target = body.get("userId")
    with db() as c:
        if not c.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=? AND role IN ('owner','admin')",
            (group_id, user["id"]),
        ).fetchone():
            raise HTTPException(403, "Only group administrators can invite members")
        group = c.execute("SELECT primary_chat_id FROM groups WHERE id=?", (group_id,)).fetchone()
        c.execute("INSERT OR IGNORE INTO group_members VALUES (?,?,'member')", (group_id, target))
        if group and group["primary_chat_id"]:
            c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)", (group["primary_chat_id"], target))
    return {"ok": True}


def invite(target_type: str, target_id: str, user: dict):
    with db() as c:
        enforce_rate_limit(c, "invite", user["id"])
        existing = c.execute(
            "SELECT code FROM invite_links WHERE target_type=? AND target_id=?",
            (target_type, target_id),
        ).fetchone()
        code = existing["code"] if existing else secrets.token_urlsafe(12)
        if not existing:
            c.execute(
                "INSERT INTO invite_links VALUES (?,?,?,?,?,?)",
                (uid(), target_type, target_id, code, user["id"], now()),
            )
            audit(c, user["id"], "invite.generated", target_type, target_id)
    return {"code": code, "url": f"http://127.0.0.1:5173/join/{code}"}


@app.post("/api/groups/{group_id}/invite-link")
def group_invite(group_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        if not c.execute(
            "SELECT 1 FROM group_members WHERE group_id=? AND user_id=? AND role IN ('owner','admin')",
            (group_id, user["id"]),
        ).fetchone():
            raise HTTPException(403, "Only group administrators can manage invite links")
    return invite("group", group_id, user)


@app.get("/api/channels")
def channels(authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        return [
            row(x)
            for x in c.execute(
                """
                SELECT c.*, COUNT(cm.user_id) subscriber_count,
                  COALESCE((SELECT role FROM channel_members m WHERE m.channel_id=c.id AND m.user_id=?),'') my_role
                FROM channels c LEFT JOIN channel_members cm ON cm.channel_id=c.id
                WHERE c.visibility='public' OR EXISTS(SELECT 1 FROM channel_members mine WHERE mine.channel_id=c.id AND mine.user_id=?)
                GROUP BY c.id
                """,
                (user["id"], user["id"]),
            )
        ]


@app.post("/api/channels")
def create_channel(body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    title = str(body.get("title", "")).strip()
    visibility = body.get("visibility", "private")
    handle = str(body.get("username", "")).replace("@", "").lower() or None
    if not title or visibility not in ("private", "public") or (visibility == "public" and not handle):
        raise HTTPException(400, "Channel details are invalid")
    channel, chat = uid(), uid()
    try:
        with db() as c:
            c.execute("INSERT INTO chats VALUES (?,?,'channel')", (chat, title))
            c.execute("INSERT INTO chat_members VALUES (?,?)", (chat, user["id"]))
            c.execute(
                "INSERT INTO channels VALUES (?,?,?,?,?,?,?,?)",
                (channel, title, body.get("description", ""), handle if visibility == "public" else None, visibility, user["id"], chat, now()),
            )
            c.execute("INSERT INTO channel_members VALUES (?,?,'owner')", (channel, user["id"]))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That public handle is unavailable")
    return {
        "id": channel,
        "title": title,
        "description": body.get("description", ""),
        "username": handle if visibility == "public" else None,
        "visibility": visibility,
        "owner_id": user["id"],
        "chat_id": chat,
        "subscriber_count": 1,
        "my_role": "owner",
    }


@app.post("/api/channels/{channel_id}/members")
def add_channel_member(channel_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    target = body.get("userId")
    with db() as c:
        channel = c.execute(
            "SELECT c.chat_id FROM channels c JOIN channel_members m ON m.channel_id=c.id WHERE c.id=? AND m.user_id=? AND m.role IN ('owner','admin')",
            (channel_id, user["id"]),
        ).fetchone()
        if not channel:
            raise HTTPException(403, "Only channel administrators can add subscribers")
        c.execute("INSERT OR IGNORE INTO channel_members VALUES (?,?,'subscriber')", (channel_id, target))
        c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)", (channel["chat_id"], target))
    return {"ok": True}


@app.post("/api/channels/{channel_id}/invite-link")
def channel_invite(channel_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        if not c.execute(
            "SELECT 1 FROM channel_members WHERE channel_id=? AND user_id=? AND role IN ('owner','admin')",
            (channel_id, user["id"]),
        ).fetchone():
            raise HTTPException(403, "Only channel administrators can manage invite links")
    return invite("channel", channel_id, user)


@app.post("/api/channels/{channel_id}/subscribe")
def subscribe_channel(channel_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        channel = c.execute("SELECT chat_id FROM channels WHERE id=? AND visibility='public'", (channel_id,)).fetchone()
        if not channel:
            raise HTTPException(404, "Public channel not found")
        c.execute("INSERT OR IGNORE INTO channel_members VALUES (?,?,'subscriber')", (channel_id, user["id"]))
        c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)", (channel["chat_id"], user["id"]))
    return {"ok": True}


@app.get("/api/sticker-packs")
def sticker_packs(authorization: str | None = Header(None)):
    current(authorization)
    with db() as c:
        packs = [row(x) for x in c.execute("SELECT * FROM sticker_packs ORDER BY title")]
    return packs


@app.get("/api/sticker-packs/{pack_id}/stickers")
def stickers(pack_id: str, authorization: str | None = Header(None)):
    current(authorization)
    with db() as c:
        return [row(x) for x in c.execute("SELECT * FROM stickers WHERE pack_id=?", (pack_id,))]


@app.post("/api/media")
async def upload_media(
    file: UploadFile = File(...),
    authorization: str | None = Header(None),
):
    user = current(authorization)
    with db() as c:
        enforce_rate_limit(c, "media_upload", user["id"])
    mime_type = (file.content_type or "").lower()
    if mime_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(415, "Unsupported media type")
    content = await file.read(MEDIA_MAX_BYTES + 1)
    if not content or len(content) > MEDIA_MAX_BYTES:
        raise HTTPException(413, f"Media must be between 1 byte and {MEDIA_MAX_BYTES // 1024 // 1024} MB")
    media_id = uid()
    extension = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
        "video/mp4": ".mp4", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/ogg": ".ogg",
        "application/pdf": ".pdf", "text/plain": ".txt",
    }[mime_type]
    storage_key = f"{media_id}{extension}"
    from io import BytesIO
    storage.save(BytesIO(content), storage_key)
    with db() as c:
        c.execute(
            "INSERT INTO media_objects VALUES (?,?,?,?,?,?,?)",
            (media_id, user["id"], storage_key, (file.filename or "upload")[:160], mime_type, len(content), now()),
        )
        audit(c, user["id"], "media.uploaded", "media", media_id, mime_type=mime_type, byte_size=len(content))
    return {
        "id": media_id, "name": (file.filename or "upload")[:160], "mimeType": mime_type,
        "byteSize": len(content), "url": f"/api/media/{media_id}",
    }


@app.get("/api/media/{media_id}")
def download_media(media_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        media = c.execute("SELECT * FROM media_objects WHERE id=?", (media_id,)).fetchone()
        allowed = c.execute(
            "SELECT 1 FROM messages m JOIN chat_members cm ON cm.chat_id=m.chat_id WHERE m.media_id=? AND cm.user_id=? LIMIT 1",
            (media_id, user["id"]),
        ).fetchone()
    if not media or not allowed:
        raise HTTPException(404, "Media is unavailable")
    headers = {
        "Content-Disposition": f'inline; filename="{media["name"].replace(chr(34), "")}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }
    return StreamingResponse(storage.open(media["storage_key"]), media_type=media["mime_type"], headers=headers)


@app.post("/api/secret/devices")
def register_secret_device(body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    public_key = str(body.get("publicKey", ""))
    label = str(body.get("label", "Web browser"))[:80]
    if len(public_key) < 40 or len(public_key) > 200:
        raise HTTPException(400, "Invalid device public key")
    with db() as c:
        device = c.execute(
            "SELECT * FROM secret_devices WHERE user_id=? AND public_key=?",
            (user["id"], public_key),
        ).fetchone()
        if not device:
            device_id = uid()
            c.execute(
                "INSERT INTO secret_devices VALUES (?,?,?,?,?,?)",
                (device_id, user["id"], public_key, label, now(), now()),
            )
        else:
            device_id = device["id"]
            c.execute("UPDATE secret_devices SET last_seen_at=?,label=? WHERE id=?", (now(), label, device_id))
    return {"id": device_id, "publicKey": public_key}


@app.post("/api/secret-chats")
def create_secret_chat(body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    target_id = str(body.get("userId", ""))
    if target_id == user["id"]:
        raise HTTPException(400, "Choose another user")
    first, second = sorted((user["id"], target_id))
    with db() as c:
        target = c.execute("SELECT * FROM users WHERE id=?", (target_id,)).fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        chat = c.execute("SELECT * FROM secret_chats WHERE user_a_id=? AND user_b_id=?", (first, second)).fetchone()
        if not chat:
            chat_id = uid()
            c.execute("INSERT INTO secret_chats VALUES (?,?,?,?)", (chat_id, first, second, now()))
        else:
            chat_id = chat["id"]
        devices = c.execute(
            "SELECT id,user_id,public_key,label FROM secret_devices WHERE user_id IN (?,?) ORDER BY created_at",
            (user["id"], target_id),
        ).fetchall()
    own_devices = [row(device) for device in devices if device["user_id"] == user["id"]]
    target_devices = [row(device) for device in devices if device["user_id"] == target_id]
    if not own_devices or not target_devices:
        raise HTTPException(409, "Both participants must open Chettik on this device before starting a secret chat")
    return {"id": chat_id, "participant": public(row(target)), "devices": [row(device) for device in devices]}


@app.get("/api/secret-chats")
def list_secret_chats(authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        chats = c.execute(
            """SELECT s.*, u.id participant_id,u.name participant_name,u.username participant_username,
                      u.role participant_role,u.email participant_email,u.initials participant_initials,u.color participant_color
               FROM secret_chats s JOIN users u ON u.id=CASE WHEN s.user_a_id=? THEN s.user_b_id ELSE s.user_a_id END
               WHERE s.user_a_id=? OR s.user_b_id=? ORDER BY s.created_at DESC""",
            (user["id"], user["id"], user["id"]),
        ).fetchall()
        result = []
        for chat in chats:
            devices = c.execute("SELECT id,user_id,public_key,label FROM secret_devices WHERE user_id IN (?,?)", (user["id"], chat["participant_id"])).fetchall()
            result.append({"id": chat["id"], "participant": {
                "id": chat["participant_id"], "name": chat["participant_name"], "username": chat["participant_username"],
                "role": chat["participant_role"], "email": chat["participant_email"], "initials": chat["participant_initials"], "color": chat["participant_color"],
            }, "devices": [row(device) for device in devices]})
    return result


def secret_member(chat_id: str, user_id: str, connection: sqlite3.Connection):
    return connection.execute(
        "SELECT * FROM secret_chats WHERE id=? AND (user_a_id=? OR user_b_id=?)",
        (chat_id, user_id, user_id),
    ).fetchone()


@app.post("/api/secret-chats/{chat_id}/messages")
async def post_secret_message(chat_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    envelopes = body.get("envelopes")
    sender_key_id = str(body.get("senderKeyId", ""))
    if not isinstance(envelopes, list) or not envelopes or len(envelopes) > 10:
        raise HTTPException(400, "Encrypted message envelopes are required")
    created = now()
    with db() as c:
        chat = secret_member(chat_id, user["id"], c)
        if not chat:
            raise HTTPException(403, "Not a secret-chat participant")
        peer_id = chat["user_b_id"] if chat["user_a_id"] == user["id"] else chat["user_a_id"]
        if not c.execute("SELECT 1 FROM secret_devices WHERE id=? AND user_id=?", (sender_key_id, user["id"])).fetchone():
            raise HTTPException(400, "Unknown sending device")
        for envelope in envelopes:
            key_id = str(envelope.get("recipientKeyId", ""))
            ciphertext = str(envelope.get("ciphertext", ""))
            nonce = str(envelope.get("nonce", ""))
            device = c.execute("SELECT id FROM secret_devices WHERE id=? AND user_id=?", (key_id, peer_id)).fetchone()
            if not device or not (20 <= len(ciphertext) <= 100_000) or not (20 <= len(nonce) <= 100):
                raise HTTPException(400, "Invalid encrypted envelope")
            c.execute(
                "INSERT INTO secret_messages (id,chat_id,sender_id,sender_key_id,ciphertext,nonce,recipient_key_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
                (uid(), chat_id, user["id"], sender_key_id, ciphertext, nonce, key_id, created),
            )
    await broadcast({"type": "secret.message.created", "chatId": chat_id, "createdAt": created})
    return {"ok": True, "createdAt": created}


@app.get("/api/secret-chats/{chat_id}/messages")
def get_secret_messages(chat_id: str, deviceId: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        if not secret_member(chat_id, user["id"], c):
            raise HTTPException(403, "Not a secret-chat participant")
        if not c.execute("SELECT 1 FROM secret_devices WHERE id=? AND user_id=?", (deviceId, user["id"])).fetchone():
            raise HTTPException(403, "Unknown secret-chat device")
        values = c.execute(
            "SELECT * FROM secret_messages WHERE chat_id=? AND recipient_key_id=? ORDER BY created_at",
            (chat_id, deviceId),
        ).fetchall()
    return [row(value) for value in values]


@app.websocket("/api/ws")
async def websocket(socket: WebSocket):
    token = socket.query_params.get("token") or socket.headers.get("authorization")
    try:
        user = current(token)
    except HTTPException:
        await socket.close(code=4401)
        return
    await socket.accept()
    clients.setdefault(user["id"], set()).add(socket)
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        clients.get(user["id"], set()).discard(socket)
        if not clients.get(user["id"]):
            clients.pop(user["id"], None)


def get_owned_message(connection: sqlite3.Connection, message_id: str, user_id: str) -> sqlite3.Row:
    message = connection.execute("SELECT * FROM messages WHERE id=?", (message_id,)).fetchone()
    if not message:
        raise HTTPException(404, "Message not found")
    require_chat_member(connection, message["chat_id"], user_id)
    return message


@app.patch("/api/messages/{message_id}")
async def edit_message(message_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    text = str(body.get("text", "")).strip()
    if not text or len(text) > 4000:
        raise HTTPException(400, "Message text must be between 1 and 4000 characters")
    with db() as c:
        message = get_owned_message(c, message_id, user["id"])
        if message["sender_id"] != user["id"]:
            raise HTTPException(403, "Only the sender can edit this message")
        metadata = json.loads(message["metadata_json"] or "{}") | {"editedAt": now()}
        c.execute("UPDATE messages SET text=?,metadata_json=? WHERE id=?", (text, json.dumps(metadata), message_id))
        audit(c, user["id"], "message.edited", "message", message_id)
        recipients = {item["user_id"] for item in c.execute("SELECT user_id FROM chat_members WHERE chat_id=?", (message["chat_id"],))}
    await broadcast({"type": "message.updated", "message": {"id": message_id, "chat_id": message["chat_id"], "text": text}}, recipients)
    return {"id": message_id, "text": text, "editedAt": metadata["editedAt"]}


@app.delete("/api/messages/{message_id}")
async def delete_message(message_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        message = get_owned_message(c, message_id, user["id"])
        if message["sender_id"] != user["id"]:
            raise HTTPException(403, "Only the sender can delete this message")
        recipients = {item["user_id"] for item in c.execute("SELECT user_id FROM chat_members WHERE chat_id=?", (message["chat_id"],))}
        c.execute("DELETE FROM message_reactions WHERE message_id=?", (message_id,))
        c.execute("DELETE FROM message_pins WHERE message_id=?", (message_id,))
        c.execute("DELETE FROM message_receipts WHERE message_id=?", (message_id,))
        c.execute("DELETE FROM messages WHERE id=?", (message_id,))
        audit(c, user["id"], "message.deleted", "message", message_id)
    await broadcast({"type": "message.deleted", "message": {"id": message_id, "chat_id": message["chat_id"]}}, recipients)
    return {"ok": True}


@app.post("/api/messages/{message_id}/reactions")
def react_to_message(message_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    emoji = str(body.get("emoji", "")).strip()
    if not emoji or len(emoji) > 16:
        raise HTTPException(400, "A short emoji reaction is required")
    with db() as c:
        get_owned_message(c, message_id, user["id"])
        c.execute("INSERT OR IGNORE INTO message_reactions VALUES (?,?,?,?)", (message_id, user["id"], emoji, now()))
    return {"ok": True}


@app.post("/api/messages/{message_id}/pin")
def pin_message(message_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        get_owned_message(c, message_id, user["id"])
        c.execute("INSERT INTO message_pins VALUES (?,?,?) ON CONFLICT(message_id) DO UPDATE SET pinned_by=excluded.pinned_by,created_at=excluded.created_at", (message_id, user["id"], now()))
        audit(c, user["id"], "message.pinned", "message", message_id)
    return {"ok": True}


@app.post("/api/messages/{message_id}/read")
def read_message(message_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        get_owned_message(c, message_id, user["id"])
        c.execute("INSERT OR REPLACE INTO message_receipts VALUES (?,?,?)", (message_id, user["id"], now()))
    return {"ok": True}


@app.patch("/api/chats/{chat_id}/preferences")
def set_chat_preferences(chat_id: str, body: dict, authorization: str | None = Header(None)):
    user = current(authorization)
    muted_until = body.get("mutedUntil")
    archived = bool(body.get("archived", False))
    with db() as c:
        require_chat_member(c, chat_id, user["id"])
        c.execute(
            "INSERT INTO chat_preferences(chat_id,user_id,muted_until,archived_at) VALUES (?,?,?,?) ON CONFLICT(chat_id,user_id) DO UPDATE SET muted_until=excluded.muted_until,archived_at=excluded.archived_at",
            (chat_id, user["id"], muted_until, now() if archived else None),
        )
    return {"ok": True, "mutedUntil": muted_until, "archived": archived}


@app.post("/api/messages/{message_id}/reports")
def report_message(message_id: str, body: dict | None = None, authorization: str | None = Header(None)):
    user = current(authorization)
    with db() as c:
        enforce_rate_limit(c, "report", user["id"])
        get_owned_message(c, message_id, user["id"])
        report_id = uid()
        c.execute("INSERT INTO reports VALUES (?,?,?,?,?,?)", (report_id, user["id"], message_id, str((body or {}).get("reason", ""))[:500], "open", now()))
        audit(c, user["id"], "message.reported", "message", message_id, report_id=report_id)
    return {"id": report_id, "status": "open"}


@app.post("/api/users/{user_id}/block")
def block_user(user_id: str, authorization: str | None = Header(None)):
    user = current(authorization)
    if user_id == user["id"]:
        raise HTTPException(400, "You cannot block yourself")
    with db() as c:
        if not c.execute("SELECT 1 FROM users WHERE id=?", (user_id,)).fetchone():
            raise HTTPException(404, "User not found")
        c.execute("INSERT OR IGNORE INTO blocked_users VALUES (?,?,?)", (user["id"], user_id, now()))
        audit(c, user["id"], "user.blocked", "user", user_id)
    return {"ok": True}


@app.get("/api/admin/audit")
def audit_events(limit: int = 100, before: str | None = None, authorization: str | None = Header(None)):
    user = current(authorization)
    if user["role"] not in ("Admin", "SuperAdmin"):
        raise HTTPException(403, "Local administrator access required")
    limit = min(max(limit, 1), 200)
    with db() as c:
        values = c.execute(
            "SELECT * FROM audit_log WHERE (? IS NULL OR created_at<?) ORDER BY created_at DESC LIMIT ?",
            (before, before, limit),
        ).fetchall()
    return [row(value) | {"metadata": json.loads(value["metadata_json"])} for value in values]
