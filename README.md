# Chettik

Privacy-first messenger web foundation. The interface uses a dark-red identity, a Discord-like desktop shell, and a Telegram-like mobile shell. Stage 1 is a front-end demonstration with no real authentication or backend.

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`).

## Demo login

Choose a seeded account, then enter any 4+ digits for the OTP mock:

| Role | Name | Phone | Username | Email |
| --- | --- | --- | --- | --- |
| SuperAdmin | Nanda | +11111111111 | @nanda | test@test.com |
| Admin | Mark | +22222222222 | @mark | test2@test.com |
| User | Alisher | +33333333333 | @alisher | test3@test.com |

## Stage 1 status

All four Stage 1 fields are implemented: foundation, mock auth and seed data, responsive chat shell, and legal/settings foundations. See [ROADMAP.md](ROADMAP.md) for approval gates and later stages.

Legal placeholders are available in-app from the login screen and in [docs/legal](docs/legal). The versioned product plan canvas is stored at [docs/plan/dev-hq-product-ideas.canvas.tsx](docs/plan/dev-hq-product-ideas.canvas.tsx).

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
