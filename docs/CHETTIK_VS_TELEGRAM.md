# Chettik vs Telegram

This is an honest implementation checkpoint, not a claim of feature parity or production security.

| Feature area | Telegram | Chettik now | How Telegram does it | How Chettik does it | Gap |
|---|---|---|---|---|---|
| Auth | Phone OTP, QR and passkeys | Development OTP and desktop QR shell | Global multi-device identity service | SQLite OTP challenges, expiry, throttling and revocable sessions | Production SMS/Telegram provider, passkeys and real QR linking remain |
| Chats / Saved | Direct, group, channel and Saved Messages | Direct, group and Saved Messages | Server-side synced conversations | SQLite chat/member rows | No channels, folders or robust membership administration |
| Groups | Roles, invites, topics, permissions | Group info/edit panel, owner badge and primary chat binding | Rich server-authorized group model | SQLite groups and group members | Several management rows are UI stubs; no invites/topics workflows |
| Messages | Sync, edit/delete, reply, forward, pins, reactions | Send, edit/delete, reply, forward, pins and reactions | Globally distributed message service | Express, SQLite and WebSocket events | Reaction/reply/pin state is still client-side |
| Media / files | CDN, transcoding, previews and access rules | Uploads persisted in SQLite, authenticated download endpoint, timed-media UI | Object storage and media pipelines | Size-limited data-URL attachment records linked through message metadata | 5 MB local implementation; no object storage, scanning, thumbnails or retention |
| Voice / circles | Recorded media with streaming and playback | Composer UI placeholders | Native media encoding/playback | Message-kind UI | No real audio/video capture or playback |
| View-once / timed | Receiver-enforced cloud/secret timers | View-once, 3/10/30s metadata and local expiry UI | Protocol/client enforcement plus server metadata | Cloud metadata, local receiver UI state | No cross-device view synchronization or hardened expiry |
| Stickers / packs | Curated and user packs, sharing, analytics | PNG/WebP/GIF upload, packs, install endpoint, picker and messages | Pack CDN and Telegram pack identifiers | SQLite pack/sticker records; embedded data URLs | No reorder UI, share-link UI, moderation or conversion; HEIC unsupported |
| Secret chats | Device-bound E2E with key exchange | Device-local chat entry and local message route | MTProto secret-chat protocol | Browser-local storage and no cloud message call | Not encrypted IndexedDB, no handshake, no independent audit — must not be described as E2E |
| Privacy | Granular server policy and block lists | Profile privacy, blocks and local auto-delete controls | Mature policy system | SQLite profiles/settings | Exceptions and enforcement are incomplete |
| Devices | Session list, QR devices, terminate sessions | Current device list and terminate-other-sessions | Cross-device authorization service | Revocable SQLite sessions, dedupe by device identity | No real QR pairing or passkey management |
| Profiles / badges | Usernames, identity and Premium badges | Profiles, social links and persisted demo badge catalog | Account profile service | SQLite users/profiles/badges JSON | Badge issuance is seed/demo only |
| Settings / themes / i18n | Mature desktop/mobile settings | Neutral dark/light design system and EN/RU | Native clients | React CSS tokens and localization branches | Strings and accessibility coverage are incomplete |
| Search / folders | Global search, folders, filters | In-chat local text filtering | Indexed message search | Client-side filter | No indexed/server search or folders |
| Channels / bots / calls | Channels, bot platform, calls | Not implemented | Telegram platform services | Intentionally out of scope | Major product-scope gap |
| Stories | Synced stories | Local UI demonstration | Server media pipeline | UI only | Not persisted or delivered |
| Sync / storage | Cloud sync with secret-chat exception | SQLite cloud messages; local secret route | Multi-region cloud | Local Express/SQLite service | No production hosting, backups, migration tooling or scale |
| Desktop / mobile | Native and web clients | Responsive React desktop/mobile shells | Platform-specific clients | One responsive web client | No native apps or offline synchronization |

## Security and production readiness

Chettik has development-grade OTP/session controls and authenticated attachment access checks. It still needs deployed-origin CSRF/CORS policy, audit logs, backups, malware scanning, secure object storage, authorization integration tests, encrypted secret-chat storage, key management, and an external security review before public use.

## Product conclusion

Chettik is a focused messenger prototype with a usable local API and a restrained desktop-oriented interface. Telegram remains substantially broader and more mature in messaging scale, safety operations, content delivery, E2E secret-chat cryptography, search, channels, bots, calls, and multi-device reliability.
