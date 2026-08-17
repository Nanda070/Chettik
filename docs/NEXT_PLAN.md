# Next development plan

This checkpoint delivers an email-first SQLite messenger with API-backed profiles, devices, chats, channels, messages, authenticated membership-scoped WebSocket updates, local audit events, rate limiting, Docker delivery, and backup tooling. The following work remains before public production use.

## Reliability and security

1. ✅ Use SMTP email OTP with scrypt-hashed challenges, expiry, retry limits, and session revocation. `OTP_DEV_CODE` is an explicit CI/local-only override, never an SMTP failure fallback.
2. ✅ Local-only CORS/security headers, audit logs, rate limits, backup/restore instructions, authenticated media, and authorization tests are present. Add deployed-origin CSRF policy, encryption at rest for server data, and a real migration framework before public deployment.
3. Expand authorization tests to every administrative transition and independent security review coverage.

## Messaging

1. Reactions, pins, read receipts, and mute/archive state now have SQLite/API records. Finish canonical reply/forward records, thread semantics, and client synchronization for every advanced composer mode.
2. Add pagination/cursor loading and virtualized rendering for large conversation histories.
3. Add message search, delivery/read receipts, typing indicators, presence, and message edit/delete history.
4. ✅ Store uploaded media behind authenticated local download URLs. Add object storage, virus scanning, retention rules, thumbnails, and a production upload pipeline.

## Product and privacy

1. Persist contacts, stories, notification preferences, report review workflows, and account deletion. Broadcast channels now persist public/private metadata, subscribers, administrators, and administrator-only posts, with Telegram-style create, list, info, mute, subscribe and edit flows. Comments, invite links and full administrator management remain.
2. ✅ Secret chats now exchange device public keys through the API and retain only ciphertext envelopes server-side. Decrypted device history and private keys are encrypted in IndexedDB. Add a ratchet, identity verification, backup/recovery policy, abuse controls, and an independent cryptographic audit before production.
3. Profile badge assignments are now persisted with user records. The current Staff, Early Supporter, System, Official, OP, and Chettik-house catalog is seed/demo data; add administration and authorization workflows before public issuance.
4. Global settings no longer surface message-delivery controls; secret chats and expiring media belong in their per-chat composer and user-action flows.
5. ✅ Device sessions are deduplicated by device identity, other sessions can be revoked with confirmation, and shared-media profile tiles open functional Photos/Files/Links panels. Replace placeholder gallery items with authenticated attachment queries as upload storage lands.
6. ✅ Sticker packs support local PNG/WebP/GIF upload, API-backed pack/sticker records, install endpoints, picker delivery and sticker messages. Add share-link UI, pack reordering, moderation, conversion, and production object storage.
2. Implement real QR device linking and passkeys.
3. Define recovery, device-verification UX, key rotation, and an independent security review before making stronger E2E claims.

## Delivery

1. Add API integration tests, isolated SQLite test databases, deterministic seed/reset scripts, and CI.
2. ✅ Local Compose, health/readiness, backup/cleanup scripts, and environment configuration are available. Add centralized observability and managed persistence for public deployment.
3. Complete accessibility, localization, responsive-device, and performance audits before public release.
