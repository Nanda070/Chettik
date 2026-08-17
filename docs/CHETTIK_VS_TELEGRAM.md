# Chettik vs Telegram

This is an honest implementation checkpoint, not a claim of feature parity or production security.

| Feature area | Telegram | Chettik now | How Telegram does it | How Chettik does it | Gap |
|---|---|---|---|---|---|
| Auth | Phone OTP, QR and passkeys | SMTP email OTP and email-session QR shell | Global multi-device identity service | scrypt-hashed SQLite OTP challenges, SMTP delivery, expiry, throttling and revocable sessions | Passkeys and real QR pairing remain |
| Chats / Saved | Direct, group, channel and Saved Messages | Direct, group, channel and Saved Messages | Server-side synced conversations | SQLite chat/member rows | Folders and robust membership administration remain |
| Groups | Roles, invites, topics, permissions | Group info/edit panel, owner/admin invite endpoint and primary chat binding | Rich server-authorized group model | SQLite groups and group members | Invite links and topics remain |
| Messages | Sync, edit/delete, reply, forward, pins, reactions | Send, edit/delete, reply, forward, pins and reactions | Globally distributed message service | Express, SQLite and WebSocket events | Reactions and pins persist; reply/forward state and receiver synchronization remain |
| Media / files | CDN, transcoding, previews and access rules | Multipart uploads and authenticated local downloads | Object storage and media pipelines | UUID files in local storage; SQLite media ID/MIME/size/message linkage; replaceable storage interface | No S3/CDN adapter, scanning, thumbnails, transcoding or retention |
| Voice / circles | Recorded media with streaming and playback | Composer UI placeholders | Native media encoding/playback | Message-kind UI | No real audio/video capture or playback |
| View-once / timed | Receiver-enforced cloud/secret timers | View-once, 3/10/30s metadata and local expiry UI | Protocol/client enforcement plus server metadata | Cloud metadata, local receiver UI state | No cross-device view synchronization or hardened expiry |
| Stickers / packs | Curated and user packs, sharing, analytics | PNG/WebP/GIF upload, packs, install endpoint, picker and messages | Pack CDN and Telegram pack identifiers | SQLite pack/sticker records; embedded data URLs | No reorder UI, share-link UI, moderation or conversion; HEIC unsupported |
| Secret chats | Device-bound E2E with key exchange | Device-bound encrypted secret chats | MTProto secret-chat protocol | libsodium X25519 `crypto_box`; public-key signaling and opaque server envelopes; AES-GCM-encrypted IndexedDB device history | No ratchet/forward secrecy, verification UI, recovery, multi-device sync or independent audit |
| Privacy | Granular server policy and block lists | Profile privacy, blocks and local auto-delete controls | Mature policy system | SQLite profiles/settings | Exceptions and enforcement are incomplete |
| Devices | Session list, QR devices, terminate sessions | Current device list and terminate-other-sessions | Cross-device authorization service | Revocable SQLite sessions, dedupe by device identity | No real QR pairing or passkey management |
| Profiles / badges | Usernames, identity and Premium badges | Profiles, social links and persisted demo badge catalog | Account profile service | SQLite users/profiles/badges JSON | Badge issuance is seed/demo only |
| Settings / themes / i18n | Mature desktop/mobile settings | Neutral dark/light design system and EN/RU | Native clients | React CSS tokens and localization branches | Strings and accessibility coverage are incomplete |
| Search / folders | Global search, folders, filters | In-chat filtering plus API message search | Indexed message search | SQLite membership-scoped `LIKE` search | No ranked/indexed search or folders |
| Channels / bots / calls | Channels, bot platform, calls | Public/private broadcast channels with creation, list entries, info, mute, subscribe, edit and admin-only posts | Telegram platform services | SQLite channels, channel members and channel chats exposed through the React messenger shell | Invite links, comments, bots, calls and full administrator management remain |
| Stories | Synced stories | Local UI demonstration | Server media pipeline | UI only | Not persisted or delivered |
| Sync / storage | Cloud sync with secret-chat exception | SQLite cloud messages; local secret route | Multi-region cloud | Local Express/SQLite service | No production hosting, backups, migration tooling or scale |
| Desktop / mobile | Native and web clients | Responsive React desktop/mobile shells | Platform-specific clients | One responsive web client | No native apps or offline synchronization |

## Security and production readiness

Chettik has SMTP OTP/session controls, authenticated media access checks, and a constrained device-bound E2E implementation. It still needs deployed-origin CSRF/CORS policy, audit logs, backups, malware scanning, secure object storage, authorization integration tests, a ratchet/identity verification/recovery design, and an external security review before public use.

## Product conclusion

Chettik is a focused messenger with a usable local API and a restrained desktop-oriented interface. Telegram remains substantially broader and more mature in messaging scale, safety operations, content delivery, E2E secret-chat cryptography, search quality, bots, calls, and multi-device reliability.
