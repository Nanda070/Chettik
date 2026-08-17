# Chettik

Privacy-first messenger prototype with a dark-red identity, a Discord-like desktop shell, and a Telegram-like mobile shell. Stage 2 adds an OTP delivery stub, persistent local cloud-chat data, profiles/privacy controls, message moderation actions, and a role-gated operations-console foundation.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Demo login

Choose a seeded account, then enter any 4+ digits for the local OTP stub:

| Role | Name | Phone | Username | Email |
| --- | --- | --- | --- | --- |
| SuperAdmin | Nanda | +11111111111 | @nanda | test@test.com |
| Admin | Mark | +22222222222 | @mark | test2@test.com |
| User | Alisher | +33333333333 | @alisher | test3@test.com |

## Stage 2 demo notes

The local demo persists messages, profile fields, privacy choices, blocks, and reports in browser `localStorage`, keyed by account. This is intentionally not a production server or real SMS integration. The requested delivery design is SMS first with a Telegram fallback; Stage 3 must replace the stub with audited server-side identity and device safety systems.

The generated product logo is at [public/logo.svg](public/logo.svg), used for the favicon, auth screen, and app header. Legal and credit documents are in [docs/legal](docs/legal); the product plan canvas is at [docs/plan/dev-hq-product-ideas.canvas.tsx](docs/plan/dev-hq-product-ideas.canvas.tsx).

## Credits

**Developer & founder:** Nanda — Discord `nandak070`, Telegram `nanda070`
**Developer:** Mark — Discord `schizophrenogenic`

**Contact / Связь:** Nanda · adnan.huseynli1@gmail.com · +41-77-259-9608 · Discord `nandak070` · Telegram `nanda070`

## Verify

```powershell
npm run build
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
