import asyncio
import json
import os
import secrets
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text().splitlines() if (ROOT / ".env").exists() else []:
    if "=" in line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())
DB_PATH = ROOT / "chettik.db"
OTP_CODE = os.getenv("OTP_DEV_CODE", "123456")

app = FastAPI(title="Chettik API")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("API_ALLOWED_ORIGINS", "http://127.0.0.1:5173").split(","), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
clients: set[WebSocket] = set()

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

def now() -> str: return datetime.now(timezone.utc).isoformat()
def row(value: sqlite3.Row | None): return dict(value) if value else None
def uid(): return str(uuid.uuid4())

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, role TEXT NOT NULL, email TEXT UNIQUE NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, badges_json TEXT NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS otp_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT);
CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(chat_id,user_id));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, primary_chat_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY(group_id,user_id));
CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', username TEXT UNIQUE, visibility TEXT NOT NULL, owner_id TEXT NOT NULL, chat_id TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS channel_members (channel_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'subscriber', PRIMARY KEY(channel_id,user_id));
CREATE TABLE IF NOT EXISTS invite_links (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, code TEXT UNIQUE NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, bio TEXT NOT NULL DEFAULT '', github TEXT NOT NULL DEFAULT '', discord TEXT NOT NULL DEFAULT '', privacy_json TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT NOT NULL, last_seen TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stickers (id TEXT PRIMARY KEY, pack_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, data_url TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sticker_packs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', share_code TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, uploader_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, data_url TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS message_reactions (message_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY(message_id,user_id,emoji));
CREATE TABLE IF NOT EXISTS chat_pins (chat_id TEXT NOT NULL, message_id TEXT NOT NULL, pinned_by TEXT NOT NULL, PRIMARY KEY(chat_id,message_id));
CREATE TABLE IF NOT EXISTS blocked_users (user_id TEXT NOT NULL, blocked_user_id TEXT NOT NULL, PRIMARY KEY(user_id,blocked_user_id));
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, message_id TEXT NOT NULL, created_at TEXT NOT NULL);
"""
def init():
    with db() as c:
        c.executescript(SCHEMA)
        seeds = [("nanda","Nanda","@nanda","SuperAdmin","test@test.com","N","#9e2338"),("mark","Mark","@mark","Admin","test2@test.com","M","#6e4c97"),("alisher","Alisher","@alisher","User","test3@test.com","A","#bf8057")]
        for user in seeds:
            c.execute("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,?, '[]')", user)
            c.execute("INSERT OR IGNORE INTO profiles(user_id) VALUES (?)", (user[0],))
            saved = f"saved-{user[0]}"
            c.execute("INSERT OR IGNORE INTO chats VALUES (?, 'Saved Messages', 'saved')", (saved,))
            c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)", (saved,user[0]))
init()

def current(auth: str | None):
    token = (auth or "").removeprefix("Bearer ")
    with db() as c:
        user = c.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.revoked_at IS NULL AND s.expires_at>?", (token, now())).fetchone()
    if not user: raise HTTPException(401, "Authentication required")
    return row(user)
def public(user): return {k:user[k] for k in ("id","name","username","role","email","initials","color")} | {"badges":json.loads(user.get("badges_json","[]"))}
async def broadcast(payload: dict):
    dead = []
    for socket in clients:
        try: await socket.send_json(payload)
        except Exception: dead.append(socket)
    clients.difference_update(dead)

@app.get("/api/health")
def health(): return {"ok":True,"storage":"sqlite","runtime":"fastapi"}
@app.post("/api/auth/otp/request")
def request_otp(body: dict):
    email = str(body.get("email","")).lower().strip()
    with db() as c:
        if not c.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(): raise HTTPException(404,"No Chettik account uses this email address")
        challenge=uid(); expires=(datetime.now(timezone.utc)+timedelta(minutes=10)).isoformat()
        c.execute("INSERT INTO otp_challenges VALUES (?,?,?,NULL)",(challenge,email,expires))
    return {"challengeId":challenge,"expiresAt":expires,"delivery":"email"}
@app.post("/api/auth/otp/verify")
def verify_otp(body: dict):
    email, code, challenge = str(body.get("email","")).lower(), body.get("code"), body.get("challengeId")
    with db() as c:
        found=c.execute("SELECT * FROM otp_challenges WHERE id=? AND email=? AND consumed_at IS NULL AND expires_at>?",(challenge,email,now())).fetchone()
        if not found or code != OTP_CODE: raise HTTPException(401,"Incorrect or expired verification code")
        user=c.execute("SELECT * FROM users WHERE email=?",(email,)).fetchone()
        token=secrets.token_urlsafe(32); expiry=(datetime.now(timezone.utc)+timedelta(days=30)).isoformat()
        c.execute("UPDATE otp_challenges SET consumed_at=? WHERE id=?",(now(),challenge)); c.execute("INSERT INTO sessions VALUES (?,?,?, ?,NULL)",(token,user["id"],now(),expiry))
    return {"token":token,"user":public(row(user)),"expiresAt":expiry}
@app.get("/api/users")
def users(authorization: str|None=Header(None)):
    user=current(authorization)
    with db() as c: return [public(row(x)) for x in c.execute("SELECT * FROM users WHERE id!=? ORDER BY name",(user["id"],))]
@app.get("/api/chats")
def chats(authorization: str|None=Header(None)):
    user=current(authorization)
    with db() as c:
        values=c.execute("""SELECT c.*, COALESCE((SELECT m.text FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1),'') preview, (SELECT m.created_at FROM messages m WHERE m.chat_id=c.id ORDER BY m.created_at DESC LIMIT 1) last_message_at FROM chats c JOIN chat_members cm ON cm.chat_id=c.id WHERE cm.user_id=? ORDER BY COALESCE(last_message_at,'') DESC""",(user["id"],)).fetchall()
    return [row(x) for x in values]
@app.post("/api/chats/direct")
def direct(body:dict, authorization:str|None=Header(None)):
    user=current(authorization); target=body.get("userId")
    with db() as c:
        other=c.execute("SELECT * FROM users WHERE id=?",(target,)).fetchone()
        if not other or target==user["id"]: raise HTTPException(400,"Choose another user")
        chat="direct-"+"-".join(sorted([user["id"],target])); c.execute("INSERT OR IGNORE INTO chats VALUES (?,?,'direct')",(chat,other["name"]))
        for member in (user["id"],target): c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)",(chat,member))
    return {"id":chat,"title":other["name"],"type":"direct","participant":public(row(other)),"preview":"","last_message_at":None}
@app.get("/api/chats/{chat_id}/messages")
def get_messages(chat_id:str, authorization:str|None=Header(None)):
    user=current(authorization)
    with db() as c:
        if not c.execute("SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?",(chat_id,user["id"])).fetchone(): raise HTTPException(403,"Not a chat member")
        return [row(x) for x in c.execute("SELECT m.*,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE chat_id=? ORDER BY created_at",(chat_id,))]
@app.post("/api/chats/{chat_id}/messages")
async def post_message(chat_id:str, body:dict, authorization:str|None=Header(None)):
    user=current(authorization); text=str(body.get("text","")).strip()
    if not text: raise HTTPException(400,"Message text required")
    with db() as c:
        if not c.execute("SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?",(chat_id,user["id"])).fetchone(): raise HTTPException(403,"Not a chat member")
        channel=c.execute("SELECT id FROM channels WHERE chat_id=?",(chat_id,)).fetchone()
        if channel and not c.execute("SELECT 1 FROM channel_members WHERE channel_id=? AND user_id=? AND role IN ('owner','admin')",(channel["id"],user["id"])).fetchone(): raise HTTPException(403,"Only channel administrators can publish posts")
        message={"id":uid(),"chat_id":chat_id,"sender_id":user["id"],"sender_name":user["name"],"text":text,"kind":body.get("kind","text"),"metadata":body.get("metadata",{}),"created_at":now()}
        c.execute("INSERT INTO messages VALUES (?,?,?,?,?,?,?)",(message["id"],chat_id,user["id"],text,message["kind"],json.dumps(message["metadata"]),message["created_at"]))
    await broadcast({"type":"message.created","message":message}); return message

@app.get("/api/groups")
def groups(authorization:str|None=Header(None)):
    user=current(authorization)
    with db() as c: return [row(x) for x in c.execute("SELECT g.*,COUNT(gm.user_id) member_count FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE EXISTS(SELECT 1 FROM group_members own WHERE own.group_id=g.id AND own.user_id=?) GROUP BY g.id",(user["id"],))]
@app.post("/api/groups")
def create_group(body:dict, authorization:str|None=Header(None)):
    user=current(authorization); title=str(body.get("title","")).strip(); description=str(body.get("description",""))
    if not title: raise HTTPException(400,"Group name required")
    group,chat=uid(),uid()
    with db() as c:
        c.execute("INSERT INTO chats VALUES (?,?,'group')",(chat,title)); c.execute("INSERT INTO chat_members VALUES (?,?)",(chat,user["id"]))
        c.execute("INSERT INTO groups VALUES (?,?,?,?,?,?)",(group,title,description,user["id"],chat,now())); c.execute("INSERT INTO group_members VALUES (?,?,'owner')",(group,user["id"]))
    return {"id":group,"title":title,"description":description,"primaryChatId":chat}
@app.post("/api/groups/{group_id}/members")
def add_group_member(group_id:str, body:dict, authorization:str|None=Header(None)):
    user=current(authorization); target=body.get("userId")
    with db() as c:
        if not c.execute("SELECT 1 FROM group_members WHERE group_id=? AND user_id=? AND role IN ('owner','admin')",(group_id,user["id"])).fetchone(): raise HTTPException(403,"Only group administrators can invite members")
        group=c.execute("SELECT primary_chat_id FROM groups WHERE id=?",(group_id,)).fetchone()
        c.execute("INSERT OR IGNORE INTO group_members VALUES (?,?,'member')",(group_id,target)); c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)",(group["primary_chat_id"],target))
    return {"ok":True}
def invite(target_type,target_id,user):
    with db() as c:
        existing=c.execute("SELECT code FROM invite_links WHERE target_type=? AND target_id=?",(target_type,target_id)).fetchone()
        code=existing["code"] if existing else secrets.token_urlsafe(12)
        if not existing: c.execute("INSERT INTO invite_links VALUES (?,?,?,?,?,?)",(uid(),target_type,target_id,code,user["id"],now()))
    return {"code":code,"url":f"http://127.0.0.1:5173/join/{code}"}
@app.post("/api/groups/{group_id}/invite-link")
def group_invite(group_id:str, authorization:str|None=Header(None)):
    user=current(authorization)
    with db() as c:
        if not c.execute("SELECT 1 FROM group_members WHERE group_id=? AND user_id=? AND role IN ('owner','admin')",(group_id,user["id"])).fetchone(): raise HTTPException(403,"Only group administrators can manage invite links")
    return invite("group",group_id,user)
@app.get("/api/channels")
def channels(authorization:str|None=Header(None)):
    user=current(authorization)
    with db() as c: return [row(x) for x in c.execute("""SELECT c.*,COUNT(cm.user_id) subscriber_count,COALESCE((SELECT role FROM channel_members m WHERE m.channel_id=c.id AND m.user_id=?),'') my_role FROM channels c LEFT JOIN channel_members cm ON cm.channel_id=c.id WHERE c.visibility='public' OR EXISTS(SELECT 1 FROM channel_members mine WHERE mine.channel_id=c.id AND mine.user_id=?) GROUP BY c.id""",(user["id"],user["id"]))]
@app.post("/api/channels")
def create_channel(body:dict, authorization:str|None=Header(None)):
    user=current(authorization); title=str(body.get("title","")).strip(); visibility=body.get("visibility","private"); handle=str(body.get("username","")).replace("@","").lower() or None
    if not title or visibility not in ("private","public") or (visibility=="public" and not handle): raise HTTPException(400,"Channel details are invalid")
    channel,chat=uid(),uid()
    try:
        with db() as c:
            c.execute("INSERT INTO chats VALUES (?,?,'channel')",(chat,title)); c.execute("INSERT INTO chat_members VALUES (?,?)",(chat,user["id"]))
            c.execute("INSERT INTO channels VALUES (?,?,?,?,?,?,?,?)",(channel,title,body.get("description",""),handle if visibility=="public" else None,visibility,user["id"],chat,now())); c.execute("INSERT INTO channel_members VALUES (?,?,'owner')",(channel,user["id"]))
    except sqlite3.IntegrityError: raise HTTPException(409,"That public handle is unavailable")
    return {"id":channel,"title":title,"description":body.get("description",""),"username":handle,"visibility":visibility,"owner_id":user["id"],"chat_id":chat,"subscriber_count":1,"my_role":"owner"}
@app.post("/api/channels/{channel_id}/members")
def add_channel_member(channel_id:str,body:dict,authorization:str|None=Header(None)):
    user=current(authorization); target=body.get("userId")
    with db() as c:
        channel=c.execute("SELECT c.chat_id FROM channels c JOIN channel_members m ON m.channel_id=c.id WHERE c.id=? AND m.user_id=? AND m.role IN ('owner','admin')",(channel_id,user["id"])).fetchone()
        if not channel: raise HTTPException(403,"Only channel administrators can add subscribers")
        c.execute("INSERT OR IGNORE INTO channel_members VALUES (?,?,'subscriber')",(channel_id,target)); c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)",(channel["chat_id"],target))
    return {"ok":True}
@app.post("/api/channels/{channel_id}/invite-link")
def channel_invite(channel_id:str,authorization:str|None=Header(None)):
    user=current(authorization)
    with db() as c:
        if not c.execute("SELECT 1 FROM channel_members WHERE channel_id=? AND user_id=? AND role IN ('owner','admin')",(channel_id,user["id"])).fetchone(): raise HTTPException(403,"Only channel administrators can manage invite links")
    return invite("channel",channel_id,user)
@app.post("/api/invites/{code}/join")
def join_invite(code:str,authorization:str|None=Header(None)):
    user=current(authorization)
    with db() as c:
        found=c.execute("SELECT * FROM invite_links WHERE code=?",(code,)).fetchone()
        if not found: raise HTTPException(404,"Invite link not found")
        if found["target_type"]=="group":
            group=c.execute("SELECT primary_chat_id FROM groups WHERE id=?",(found["target_id"],)).fetchone(); c.execute("INSERT OR IGNORE INTO group_members VALUES (?,?,'member')",(found["target_id"],user["id"])); c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)",(group["primary_chat_id"],user["id"]))
        else:
            channel=c.execute("SELECT chat_id FROM channels WHERE id=?",(found["target_id"],)).fetchone(); c.execute("INSERT OR IGNORE INTO channel_members VALUES (?,?,'subscriber')",(found["target_id"],user["id"])); c.execute("INSERT OR IGNORE INTO chat_members VALUES (?,?)",(channel["chat_id"],user["id"]))
    return {"ok":True}
@app.websocket("/api/ws")
async def websocket(socket:WebSocket):
    await socket.accept(); clients.add(socket)
    try:
        while True: await socket.receive_text()
    except WebSocketDisconnect: clients.discard(socket)
