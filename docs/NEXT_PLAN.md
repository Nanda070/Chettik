# Next development plan

This checkpoint delivers an email-first SQLite messenger with API-backed profiles, devices, chats, channels, messages, and WebSocket updates. The following work remains before production use.

## Reliability and security

1. ✅ Use email OTP with provider boundary, rate limits, expiry, and session revocation. The local provider logs the configured fixed development code server-side; deploy a transactional email provider before public launch.
2. Add password hashing, CSRF/CORS policy for deployed origins, audit logs, migrations, backups, and encrypted-at-rest secrets.
3. Add authorization tests for every resource, especially direct-chat membership, blocks, reports, and device termination.

## Messaging

1. Persist reactions, replies, forwards, pins, chat read state, mute/archive state, and attachments instead of their current UI-only behavior. Reactions and message pins now have SQLite/API persistence; replies, forwards, receipts, and chat state still need canonical server records.
2. Add pagination/cursor loading and virtualized rendering for large conversation histories.
3. Add message search, delivery/read receipts, typing indicators, presence, and message edit/delete history.
4. ✅ Store uploaded media behind authenticated local download URLs. Add object storage, virus scanning, retention rules, thumbnails, and a production upload pipeline.

## Product and privacy

1. Persist contacts, stories, notification preferences, report review workflows, and account deletion. Broadcast channels now persist public/private metadata, subscribers, administrators, and administrator-only posts, with Telegram-style create, list, info, mute, subscribe and edit flows. Comments, invite links and full administrator management remain.
2. Secret-chat entry and timed-media UX are implemented as device-local MVPs: secret messages do not use the cloud API, and cloud-media expiry metadata is stored. Replace browser-local secret storage with audited encrypted IndexedDB and add device-key handshake before production.
3. Profile badge assignments are now persisted with user records. The current Staff, Early Supporter, System, Official, OP, and Chettik-house catalog is seed/demo data; add administration and authorization workflows before public issuance.
4. Global settings no longer surface message-delivery controls; secret chats and expiring media belong in their per-chat composer and user-action flows.
5. ✅ Device sessions are deduplicated by device identity, other sessions can be revoked with confirmation, and shared-media profile tiles open functional Photos/Files/Links panels. Replace placeholder gallery items with authenticated attachment queries as upload storage lands.
6. ✅ Sticker packs support local PNG/WebP/GIF upload, API-backed pack/sticker records, install endpoints, picker delivery and sticker messages. Add share-link UI, pack reordering, moderation, conversion, and production object storage.
2. Implement real QR device linking and passkeys.
3. Define secret-chat cryptography, device key management, recovery, and independent security review before claiming E2E support.

## Delivery

1. Add API integration tests, isolated SQLite test databases, deterministic seed/reset scripts, and CI.
2. Containerize the app, add production configuration, structured logging, health checks, and observability.
3. Complete accessibility, localization, responsive-device, and performance audits before public release.
