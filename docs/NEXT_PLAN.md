# Next development plan

This checkpoint delivers a usable local SQLite messenger with API-backed profiles, privacy, devices, chats, messages, and WebSocket updates. The following work remains before production use.

## Reliability and security

1. Replace the local OTP stub with a provider-backed verification flow, rate limits, expiry, and session revocation.
2. Add password hashing, CSRF/CORS policy for deployed origins, audit logs, migrations, backups, and encrypted-at-rest secrets.
3. Add authorization tests for every resource, especially direct-chat membership, blocks, reports, and device termination.

## Messaging

1. Persist reactions, replies, forwards, pins, chat read state, mute/archive state, and attachments instead of their current UI-only behavior.
2. Add pagination/cursor loading and virtualized rendering for large conversation histories.
3. Add message search, delivery/read receipts, typing indicators, presence, and message edit/delete history.
4. Store uploaded media safely behind authenticated download URLs; add virus scanning and retention rules.

## Product and privacy

1. Persist contacts, groups/channels, stories, notification preferences, report review workflows, and account deletion.
2. Implement real QR device linking and passkeys.
3. Define secret-chat cryptography, device key management, recovery, and independent security review before claiming E2E support.

## Delivery

1. Add API integration tests, isolated SQLite test databases, deterministic seed/reset scripts, and CI.
2. Containerize the app, add production configuration, structured logging, health checks, and observability.
3. Complete accessibility, localization, responsive-device, and performance audits before public release.
