# Local readiness

Chettik can be run as a localhost-only FastAPI/SQLite/React application. It is not a public deployment guide.

## Run

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`; the API is `http://127.0.0.1:8787`. For isolated local testing set `OTP_DEV_CODE=123456` in untracked `.env`. Do not enable that variable on a machine reachable by other users.

The email screen supports both sign-in and browser registration. Registration sends the same OTP, then creates a unique email/username account and its Saved Messages chat after successful verification.

For a local production-shaped stack:

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8080`. Compose binds ports to loopback only and persists SQLite/media in its `chettik-data` volume.

## Backup and restore

Create an archive while the app is stopped (or after a SQLite checkpoint):

```powershell
.\scripts\backup-local.ps1
```

To restore, stop Chettik, unpack the archive, replace `chettik.db` plus optional `-wal`/`-shm` files and `backend/media/`, then start it. For Docker, copy the extracted files into the `chettik-data` volume while containers are stopped. Test restores on a copy first.

Run retention cleanup explicitly:

```powershell
python scripts\cleanup-media.py
```

It only removes unreferenced media older than `MEDIA_RETENTION_DAYS`.

## Local security boundary

- CORS accepts only configured `localhost`/`127.0.0.1` origins. API responses carry restrictive browser security headers; auth/profile responses are `no-store`.
- OTPs are scrypt-hashed; sessions can be revoked. SQLite audit records cover OTP/login/session, message, invite, upload, block, and report actions.
- API authorization checks membership/roles for chats, group/channel operations, media, secret chats, and local admin audit access. WebSockets require a session token and only send chat events to members.
- Uploads are size-limited and MIME allowlisted; local files use UUID keys and authenticated message-linked downloads.
- Rate limits are local SQLite counters. They protect one local instance only, not a distributed public service.

## Secret chat truth

Secret chats encrypt envelopes with libsodium X25519 `crypto_box`; private keys and decrypted history remain encrypted in browser IndexedDB. The server receives public keys and ciphertext only. A safety number lets people compare a device pair manually.

This is **not** Signal's double ratchet: no forward secrecy, post-compromise security, key transparency, audited protocol, recovery, or multi-device secret-history synchronization. A changed device key requires manual re-verification.

## Still requires external infrastructure

Public DNS, HTTPS certificates/reverse proxy, a real SMTP provider, S3/CDN, malware scanning/transcoding, off-device encrypted backup/recovery, distributed rate limiting, centralized logs/metrics, passkeys/real QR pairing, and an independent security/cryptographic audit cannot be completed purely on one local machine.
