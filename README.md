# Chettik

A local-first messenger with email OTP, direct conversations, groups, channels, SQLite persistence, and WebSocket delivery.

For the complete localhost security, Docker, backup, restore, and limitation guide, see [docs/LOCAL_READINESS.md](docs/LOCAL_READINESS.md).

## Start locally

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
npm install
npm run dev
```

`npm run dev` starts both services:

- Client: http://127.0.0.1:5173
- API: http://127.0.0.1:8787

The API is FastAPI (`backend/main.py`) with SQLite. The former Express implementation
in `server/index.ts` is retained only as a historical reference and is no longer run.

The database is `chettik.db`. Startup removes legacy showcase conversations and preserves only the three email-login accounts plus each account's empty Saved Messages chat.

## Sign in and SMTP

Configure SMTP in your untracked `.env`. The API generates a random six-digit OTP,
stores only its scrypt hash, and sends the code with SMTP. Delivery errors are logged
and fail the request; they never silently accept a code.

For isolated CI/local tests only, explicitly set `OTP_DEV_CODE=123456`; it bypasses
SMTP and is never a production fallback. The seeded addresses are `test@test.com`,
`test2@test.com`, and `test3@test.com`.

After signing in, use **New chat**, **New group**, or **New channel**. Direct chats, groups, channels, and messages are stored in SQLite.

The browser email screen also supports **Create account**: enter a new email, receive an OTP, then choose a display name and unique username. SMTP is used whenever it is configured; `OTP_DEV_CODE` is only for isolated local/CI testing.

## Secret chats

Secret chats are device-bound and use `libsodium-wrappers-sumo`: X25519 key agreement
via `crypto_box` (XSalsa20-Poly1305 authenticated encryption). Browser-generated
key pairs and decrypted history are encrypted at rest in IndexedDB using a
non-extractable Web Crypto AES-GCM device key. The server only receives public keys,
opaque ciphertext/nonce envelopes, and routing metadata; it does not receive secret
message plaintext.

This is not Signal or Telegram MTProto: there is no ratchet, forward secrecy,
multi-device secret-chat synchronization, identity verification UI, recovery, or
independent cryptographic audit. Losing browser storage loses that device's history.

## Media storage

`POST /api/media` accepts authenticated multipart uploads (25 MB by default) with an
allow-list of content types. UUID-named files are stored in `backend/media/`, while
SQLite stores media ID, MIME type, size, and message linkage. Downloads require a
chat membership check. `backend/storage.py` defines the storage interface so an
S3/CDN adapter can replace `LocalStorage` later.

## Build and preview

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

## Verify

```powershell
npm run build
npm run test:api
npm run test:crypto
npm run test:e2e
```

---

# Vite scaffold notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
