# Chettik roadmap

Chettik is a privacy-first messenger: Telegram-like messaging on phone and a Discord-like desktop shell. The product starts in CIS (including Russia), EU, US, and Canada; China is out of scope. RU and EN, dark and light themes are launch requirements.

## Stage 1 — Web foundation (current)

| Field | Deliverable | Gate |
| --- | --- | --- |
| 1. Project scaffold | Vite + React + TypeScript, responsive desktop/mobile shells, dark-red theme tokens, RU/EN foundation | Complete |
| 2. Auth UI and seed data | Account picker, phone OTP mock, seeded SuperAdmin/Admin/User, local session stub | Complete |
| 3. Core chat shell | Desktop sidebar, chat list, polished message view and composer; Telegram-like mobile treatment | Complete |
| 4. Legal and settings stubs | Terms, Privacy, Authors/Credits, Settings entry points | Complete |

Approval gate: review the local demo and Stage 1 scope before any Stage 2 work begins.

## Stage 2 — Identity, cloud messaging and moderation

1. Phone OTP service with SMS first and Telegram delivery fallback.
2. Server-backed accounts, sessions, profile, contacts, Saved Messages and cloud chats.
3. Messaging primitives: reply, forward, edit, pin, reactions, search, media, any files and photo-as-file.
4. Block/report/delete-for-both and internal Chettik operations console.
5. Profile badges, presence and optional Discord/GitHub profile links.

## Stage 3 — Privacy, devices and account safety

1. Privacy audiences for phone, last seen, photo, bio, birthday, forwards, voice and messages.
2. Device list, QR sign-in, profile QR, login-alert system bot.
3. Passcode/biometrics, two-step verification, passkeys, login email and account auto-delete.
4. Scheduled send, view-once and timed media.
5. Secret chats: device-bound E2E architecture and independent security review.

## Stage 4 — Rich messaging and mobile delivery

1. Voice messages, circles, polls, location, stories and PWA/push foundation.
2. Native iOS/Android Telegram-like shell and desktop Discord-like shell.
3. Accessibility, localization review, telemetry with privacy controls and launch-readiness testing.

## Stage 5 — Later extensions

1. User bots and bot platform.
2. Optional programmer-only GitHub repository/PR layer.
3. No VS Code/Cursor integration and no calls in the currently approved scope.
