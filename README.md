# Chettik

Privacy-first messenger with a neutral interface and dark-red accent. Chettik uses a React client, Node API, SQLite persistence, email OTP sessions, channels, and WebSocket message delivery.

## Run locally

```powershell
npm install
npm run dev
```

This starts the API at `http://127.0.0.1:8787` and Vite at `http://127.0.0.1:5173`.

## Email sign-in

Enter an email address, request a verification code, then enter the configured `OTP_DEV_CODE` (defaults to `123456`). The development email-provider boundary logs delivery server-side. The included local accounts are available for development and end-to-end tests:

| Role | Name | Username | Email |
| --- | --- | --- | --- |
| SuperAdmin | Nanda | @nanda | test@test.com |
| Admin | Mark | @mark | test2@test.com |
| User | Alisher | @alisher | test3@test.com |

## Production client build

```powershell
npm run build
npm run preview -- --host 0.0.0.0
```

`dist/` is a deployable SPA. Build it with the API address for its deployment environment:

```powershell
$env:VITE_API_URL = "https://api.example.com/api"
npm run build
```

The API must permit the client origin and be reachable from the browser:

```powershell
$env:API_HOST = "0.0.0.0"
$env:API_ALLOWED_ORIGINS = "https://app.example.com"
npm run dev:api
```

Put both services behind TLS in production and replace the development OTP provider with an audited transactional email provider.

## Application foundation

- `server/index.ts` provides Express endpoints for health, email OTP challenges, sessions, channels, chat reads, search, and message writes.
- SQLite stores users, sessions, chats, memberships, messages, devices, and privacy settings. The local database is `chettik.db` and is intentionally gitignored.
- The local Nanda, Mark, and Alisher accounts are inserted on API startup for development and tests.
- OTP requests are email-first, hashed before storage, expire after ten minutes, allow five verification attempts, and are rate-limited by email and IP. Sessions expire after 30 days and are revoked on logout or device termination.
- The frontend obtains a session token after sign-in, reads the Nanda–Mark thread from the API, posts new messages there, and listens for `message.created` WebSocket broadcasts.
- The development email OTP provider logs delivery locally and uses `OTP_DEV_CODE` (default `123456`). Replace this provider with an audited transactional email provider before deployment.

The generated product logo is at [public/logo.svg](public/logo.svg), used for the favicon, auth screen, and app header. Legal and credit documents are in [docs/legal](docs/legal); the product plan canvas is at [docs/plan/dev-hq-product-ideas.canvas.tsx](docs/plan/dev-hq-product-ideas.canvas.tsx).

## Credits

**Developer & founder:** Nanda — Discord `nandak070`, Telegram `nanda070`
**Developer:** Mark — Discord `schizophrenogenic`

**Contact / Связь:** Nanda · adnan.huseynli1@gmail.com · +41-77-259-9608 · Discord `nandak070` · Telegram `nanda070`

## Verify

```powershell
npm run build
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
