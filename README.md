# Chettik

A local-first messenger with email OTP, direct conversations, groups, channels, SQLite persistence, and WebSocket delivery.

## Start locally

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

`npm run dev` starts both services:

- Client: http://127.0.0.1:5173
- API: http://127.0.0.1:8787

The database is `chettik.db`. Startup removes legacy showcase conversations and preserves only the three email-login accounts plus each account's empty Saved Messages chat.

## Sign in

Use one of the local accounts and the `OTP_DEV_CODE` from `.env`:

| Email | Code |
| --- | --- |
| `test@test.com` | `123456` |
| `test2@test.com` | `123456` |
| `test3@test.com` | `123456` |

After signing in, use **New chat**, **New group**, or **New channel**. Direct chats, groups, channels, and messages are stored in SQLite.

## Build and preview

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

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
