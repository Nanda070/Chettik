import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import path from 'node:path'
import Database from 'better-sqlite3'
import express from 'express'
import { WebSocketServer } from 'ws'

const db = new Database(path.resolve('chettik.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL, email TEXT NOT NULL UNIQUE, initials TEXT NOT NULL, color TEXT NOT NULL, badges_json TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, revoked_at TEXT);
  CREATE TABLE IF NOT EXISTS otp_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (chat_id, user_id));
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, bio TEXT NOT NULL DEFAULT '', github TEXT NOT NULL DEFAULT '', discord TEXT NOT NULL DEFAULT '', privacy_json TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE IF NOT EXISTS privacy_settings (user_id TEXT PRIMARY KEY, last_seen TEXT NOT NULL DEFAULT 'Contacts');
  CREATE TABLE IF NOT EXISTS blocked_users (user_id TEXT NOT NULL, blocked_user_id TEXT NOT NULL, PRIMARY KEY (user_id, blocked_user_id));
  CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, message_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, primary_chat_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY (group_id, user_id));
  CREATE TABLE IF NOT EXISTS sticker_packs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', share_code TEXT NOT NULL UNIQUE, cover_sticker_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS stickers (id TEXT PRIMARY KEY, pack_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, data_url TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS installed_sticker_packs (user_id TEXT NOT NULL, pack_id TEXT NOT NULL, PRIMARY KEY (user_id, pack_id));
  CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, uploader_id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, data_url TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS message_reactions (message_id TEXT NOT NULL, user_id TEXT NOT NULL, emoji TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (message_id, user_id, emoji));
  CREATE TABLE IF NOT EXISTS chat_pins (chat_id TEXT NOT NULL, message_id TEXT NOT NULL, pinned_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (chat_id, message_id));
  CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', username TEXT UNIQUE, visibility TEXT NOT NULL DEFAULT 'private', owner_id TEXT NOT NULL, chat_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS channel_members (channel_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'subscriber', joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (channel_id, user_id));
`)
const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
if (userColumns.some(column => column.name === 'phone')) {
  db.exec(`
    ALTER TABLE users RENAME TO users_legacy;
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, role TEXT NOT NULL, email TEXT NOT NULL UNIQUE, initials TEXT NOT NULL, color TEXT NOT NULL, badges_json TEXT NOT NULL DEFAULT '[]');
    INSERT INTO users (id, name, username, role, email, initials, color, badges_json)
      SELECT id, name, username, role, email, initials, color, badges_json FROM users_legacy;
    DROP TABLE users_legacy;
  `)
}
const otpColumns = db.prepare('PRAGMA table_info(otp_challenges)').all() as Array<{ name: string }>
if (otpColumns.some(column => column.name === 'phone')) {
  db.exec(`
    ALTER TABLE otp_challenges RENAME TO otp_challenges_legacy;
    CREATE TABLE otp_challenges (id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    DROP TABLE otp_challenges_legacy;
  `)
}
const privacyColumns = db.prepare('PRAGMA table_info(privacy_settings)').all() as Array<{ name: string }>
if (privacyColumns.some(column => column.name === 'phone')) {
  db.exec(`
    ALTER TABLE privacy_settings RENAME TO privacy_settings_legacy;
    CREATE TABLE privacy_settings (user_id TEXT PRIMARY KEY, last_seen TEXT NOT NULL DEFAULT 'Contacts');
    INSERT INTO privacy_settings (user_id, last_seen) SELECT user_id, last_seen FROM privacy_settings_legacy;
    DROP TABLE privacy_settings_legacy;
  `)
}
function addColumn(table: string, definition: string) {
  const column = definition.split(' ')[0]
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!columns.some(item => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}
addColumn('sessions', 'device_id TEXT')
addColumn('sessions', 'expires_at TEXT')
addColumn('sessions', 'revoked_at TEXT')
addColumn('messages', "metadata_json TEXT NOT NULL DEFAULT '{}'")
addColumn('users', "badges_json TEXT NOT NULL DEFAULT '[]'")
const users = [
  ['nanda', 'Nanda', '@nanda', 'SuperAdmin', 'test@test.com', 'N', '#9e2338'],
  ['mark', 'Mark', '@mark', 'Admin', 'test2@test.com', 'M', '#6e4c97'],
  ['alisher', 'Alisher', '@alisher', 'User', 'test3@test.com', 'A', '#bf8057'],
]
const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, username, role, email, initials, color) VALUES (?, ?, ?, ?, ?, ?, ?)')
const insertPrivacy = db.prepare('INSERT OR IGNORE INTO privacy_settings (user_id) VALUES (?)')
const insertProfile = db.prepare('INSERT OR IGNORE INTO profiles (user_id) VALUES (?)')
const insertDevice = db.prepare('INSERT OR IGNORE INTO devices (id, user_id, label) VALUES (?, ?, ?)')
for (const user of users) { insertUser.run(...user); insertPrivacy.run(user[0]); insertProfile.run(user[0]); insertDevice.run(`${user[0]}-local`, user[0], 'Windows • Chrome') }
const seedBadges: Record<string, string[]> = { nanda: ['staff', 'early-supporter', 'official', 'crimson-circle'], mark: ['staff', 'early-supporter', 'ember-house'], alisher: ['early-supporter', 'aurora-house'] }
for (const [id, badges] of Object.entries(seedBadges)) db.prepare('UPDATE users SET badges_json = ? WHERE id = ?').run(JSON.stringify(badges), id)
db.prepare("UPDATE devices SET label = 'Windows • Chrome' WHERE id LIKE '%-local'").run()
const seedChat = (id: string, title: string, type: string, members: string[]) => {
  db.prepare('INSERT OR IGNORE INTO chats (id, title, type) VALUES (?, ?, ?)').run(id, title, type)
  const join = db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)')
  members.forEach(member => join.run(id, member))
}
seedChat('nanda-mark', 'Mark', 'direct', ['nanda', 'mark'])
seedChat('design-circle', 'Design circle', 'group', ['nanda', 'mark', 'alisher'])
seedChat('nanda-alisher', 'Alisher', 'direct', ['nanda', 'alisher'])
users.forEach(([id]) => seedChat(`saved-${id}`, 'Saved Messages', 'saved', [id]))
const joinEverySeedChat = db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)')
for (const chatId of ['nanda-mark', 'design-circle', 'nanda-alisher', 'saved-nanda', 'saved-mark', 'saved-alisher']) {
  for (const [userId] of users) joinEverySeedChat.run(chatId, userId)
}
db.prepare("INSERT OR IGNORE INTO groups (id, title, description, owner_id, primary_chat_id) VALUES ('design-circle', 'Design circle', 'A calm place for thoughtful product reviews.', 'nanda', 'design-circle')").run()
for (const [id] of users) db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES ('design-circle', ?, ?)").run(id, id === 'nanda' ? 'owner' : 'member')
db.prepare("INSERT OR IGNORE INTO sticker_packs (id, owner_id, title, author, visibility, share_code) VALUES ('chettik-starters', 'nanda', 'Chettik starters', 'Chettik', 'public', 'CHETTIK1')").run()
db.prepare("INSERT OR IGNORE INTO stickers (id, pack_id, owner_id, name, mime_type, data_url, position) VALUES ('chettik-heart', 'chettik-starters', 'nanda', 'Crimson heart', 'image/svg+xml', ?, 0)").run('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ctext y=".9em" font-size="90"%3E❤️%3C/text%3E%3C/svg%3E')
const seedMessage = db.prepare('INSERT OR IGNORE INTO messages (id, chat_id, sender_id, text, kind) VALUES (?, ?, ?, ?, ?)')
seedMessage.run('seed-mark-1', 'nanda-mark', 'mark', 'I tried the new onboarding flow. It feels really calm.', 'text')
seedMessage.run('seed-nanda-1', 'nanda-mark', 'nanda', 'That was the idea. Less noise, more space for people.', 'text')
seedMessage.run('seed-saved-nanda-1', 'saved-nanda', 'nanda', 'Remember to write this down.', 'text')

type SessionUser = { id: string; name: string; username: string; role: string; email: string; initials: string; color: string }
function publicUser(user: SessionUser & { badges_json?: string }) {
  const { badges_json, ...fields } = user
  return { ...fields, badges: JSON.parse(badges_json || '[]') as string[] }
}
type OtpProvider = {
  deliver: (input: { email: string; code: string; expiresAt: string }) => Promise<void>
}
const emailOtpProvider: OtpProvider = {
  async deliver({ email, code, expiresAt }) {
    // Replace this boundary with a transactional email provider in deployment.
    console.info(`[otp:email] ${email} code=${code} expires=${expiresAt}`)
  },
}
const otpProvider = emailOtpProvider
const OTP_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5
const OTP_EMAIL_LIMIT = process.env.NODE_ENV === 'production' ? 3 : 10_000
const OTP_IP_LIMIT = process.env.NODE_ENV === 'production' ? 10 : 10_000
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000
const otpRequests = new Map<string, number[]>()
function pruneRateLimit(key: string) {
  const now = Date.now()
  const requests = (otpRequests.get(key) || []).filter(time => now - time < OTP_RATE_WINDOW_MS)
  otpRequests.set(key, requests)
  return requests
}
function rateLimit(key: string, limit: number) {
  const requests = pruneRateLimit(key)
  if (requests.length >= limit) return false
  requests.push(Date.now())
  otpRequests.set(key, requests)
  return true
}
function hashOtp(id: string, code: string) {
  return scryptSync(code, id, 32).toString('hex')
}
function clientIp(request: express.Request) {
  return request.ip || request.socket.remoteAddress || 'unknown'
}
const app = express()
app.use(express.json({ limit: '7mb' }))
const allowedOrigins = (process.env.API_ALLOWED_ORIGINS || 'http://127.0.0.1:5173').split(',').map(origin => origin.trim()).filter(Boolean)
app.use((request, response, next) => {
  const origin = request.header('origin')
  if (origin && allowedOrigins.includes(origin)) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  next()
})
app.options('/api/{*path}', (_, response) => response.sendStatus(204))

function session(request: express.Request): SessionUser | undefined {
  const token = request.header('authorization')?.replace('Bearer ', '')
  if (!token) return undefined
  return db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > datetime('now'))").get(token) as SessionUser | undefined
}
function requireSession(request: express.Request, response: express.Response): SessionUser | undefined {
  const user = session(request)
  if (!user) response.status(401).json({ error: 'Authentication required' })
  return user
}

app.get('/api/health', (_, response) => response.json({ ok: true, storage: 'sqlite' }))
app.post('/api/auth/otp/request', async (request, response) => {
  const email = String((request.body as { email?: string }).email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address' })
  if (!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return response.status(404).json({ error: 'No Chettik account uses this email address' })
  if (!rateLimit(`email:${email}`, OTP_EMAIL_LIMIT) || !rateLimit(`ip:${clientIp(request)}`, OTP_IP_LIMIT)) return response.status(429).json({ error: 'Too many verification requests. Please try again later.' })
  const id = randomUUID()
  const code = process.env.OTP_DEV_CODE || '123456'
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()
  db.prepare('INSERT INTO otp_challenges (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)').run(id, email, hashOtp(id, code), expiresAt)
  await otpProvider.deliver({ email, code, expiresAt })
  response.status(201).json({ challengeId: id, expiresAt, delivery: 'email' })
})
app.post('/api/auth/otp/verify', (request, response) => {
  const { email: rawEmail, code, challengeId, deviceLabel } = request.body as { email?: string; code?: string; challengeId?: string; deviceLabel?: string }
  const email = String(rawEmail || '').trim().toLowerCase()
  if (!challengeId || !code || !/^\d{6}$/.test(code)) return response.status(400).json({ error: 'Enter the six-digit verification code' })
  const challenge = db.prepare('SELECT * FROM otp_challenges WHERE id = ? AND email = ?').get(challengeId, email) as { id: string; code_hash: string; expires_at: string; attempts: number; consumed_at: string | null } | undefined
  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) return response.status(401).json({ error: 'This verification code has expired. Request a new one.' })
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return response.status(429).json({ error: 'Too many invalid attempts. Request a new code.' })
  const expected = Buffer.from(challenge.code_hash, 'hex')
  const received = Buffer.from(hashOtp(challenge.id, code), 'hex')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(challenge.id)
    return response.status(401).json({ error: 'Incorrect verification code' })
  }
  db.prepare("UPDATE otp_challenges SET consumed_at = datetime('now') WHERE id = ?").run(challenge.id)
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as SessionUser | undefined
  if (!user) return response.status(401).json({ error: 'This email address is not registered' })
  const token = randomUUID()
  const label = String(deviceLabel || 'Web • Browser').slice(0, 80)
  const existingDevice = db.prepare('SELECT id FROM devices WHERE user_id = ? AND label = ? ORDER BY last_seen DESC LIMIT 1').get(user.id, label) as { id: string } | undefined
  const deviceId = existingDevice?.id || randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  if (existingDevice) db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(new Date().toISOString(), deviceId)
  else db.prepare('INSERT INTO devices (id, user_id, label, last_seen) VALUES (?, ?, ?, ?)').run(deviceId, user.id, label, new Date().toISOString())
  db.prepare('INSERT INTO sessions (token, user_id, device_id, expires_at) VALUES (?, ?, ?, ?)').run(token, user.id, deviceId, expiresAt)
  response.json({ token, user: publicUser(user), expiresAt })
})
app.post('/api/auth/logout', (request, response) => {
  const token = request.header('authorization')?.replace('Bearer ', '')
  if (token) db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token = ?").run(token)
  response.status(204).end()
})
app.get('/api/chats', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const chats = db.prepare(`
    SELECT c.*, COALESCE((SELECT m.text FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1), '') AS preview,
    (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
    FROM chats c JOIN chat_members cm ON cm.chat_id = c.id
    WHERE cm.user_id = ? AND (c.type != 'saved' OR c.id = 'saved-' || ?)
    ORDER BY COALESCE(last_message_at, '') DESC, c.title
  `).all(user.id, user.id)
  response.json(chats)
})
app.get('/api/groups', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  response.json(db.prepare(`
    SELECT g.*, COUNT(gm.user_id) AS member_count
    FROM groups g JOIN group_members gm ON gm.group_id = g.id
    WHERE EXISTS (SELECT 1 FROM group_members own WHERE own.group_id = g.id AND own.user_id = ?)
    GROUP BY g.id ORDER BY g.created_at DESC
  `).all(user.id))
})
app.post('/api/groups', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { title, description = '', createChat = true } = request.body as { title?: string; description?: string; createChat?: boolean }
  if (!title?.trim() || title.length > 120 || description.length > 1000) return response.status(400).json({ error: 'Provide a title up to 120 characters and description up to 1000 characters' })
  const groupId = randomUUID()
  const chatId = createChat ? randomUUID() : null
  const create = db.transaction(() => {
    if (chatId) {
      db.prepare("INSERT INTO chats (id, title, type) VALUES (?, ?, 'group')").run(chatId, title.trim())
      db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(chatId, user.id)
    }
    db.prepare('INSERT INTO groups (id, title, description, owner_id, primary_chat_id) VALUES (?, ?, ?, ?, ?)').run(groupId, title.trim(), description, user.id, chatId)
    db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'owner')").run(groupId, user.id)
  })
  create()
  response.status(201).json({ id: groupId, title: title.trim(), description, primaryChatId: chatId })
})
app.patch('/api/groups/:groupId', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND owner_id = ?').get(request.params.groupId, user.id) as { id: string } | undefined
  if (!group) return response.status(403).json({ error: 'Only the group owner can edit this group' })
  const { title, description } = request.body as { title?: string; description?: string }
  if (!title?.trim() || title.length > 120 || (description || '').length > 1000) return response.status(400).json({ error: 'Provide a title up to 120 characters and description up to 1000 characters' })
  db.prepare('UPDATE groups SET title = ?, description = ? WHERE id = ?').run(title.trim(), description || '', group.id)
  response.json(db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id))
})
app.post('/api/groups/:groupId/link-chat', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { chatId } = request.body as { chatId?: string }
  const owns = db.prepare('SELECT 1 FROM groups WHERE id = ? AND owner_id = ?').get(request.params.groupId, user.id)
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, user.id)
  if (!owns || !member || !chatId) return response.status(403).json({ error: 'You can only link a chat you belong to' })
  db.prepare('UPDATE groups SET primary_chat_id = ? WHERE id = ?').run(chatId, request.params.groupId)
  response.json({ ok: true, primaryChatId: chatId })
})
app.post('/api/groups/:groupId/members', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { userId, role = 'member' } = request.body as { userId?: string; role?: string }
  const owner = db.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND role IN ('owner', 'admin')").get(request.params.groupId, user.id)
  if (!owner || !userId || !['member', 'admin'].includes(role) || !db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId)) return response.status(403).json({ error: 'Only group administrators can invite members' })
  db.prepare('INSERT OR REPLACE INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(request.params.groupId, userId, role)
  const group = db.prepare('SELECT primary_chat_id FROM groups WHERE id = ?').get(request.params.groupId) as { primary_chat_id: string | null } | undefined
  if (group?.primary_chat_id) db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(group.primary_chat_id, userId)
  response.status(201).json({ ok: true })
})
app.get('/api/channels', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  response.json(db.prepare(`
    SELECT c.*, COUNT(cm.user_id) AS subscriber_count,
      COALESCE((SELECT role FROM channel_members mine WHERE mine.channel_id = c.id AND mine.user_id = ?), '') AS my_role
    FROM channels c LEFT JOIN channel_members cm ON cm.channel_id = c.id
    WHERE c.visibility = 'public' OR EXISTS (SELECT 1 FROM channel_members own WHERE own.channel_id = c.id AND own.user_id = ?)
    GROUP BY c.id ORDER BY c.created_at DESC
  `).all(user.id, user.id))
})
app.post('/api/channels', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { title, description = '', visibility = 'private', username } = request.body as { title?: string; description?: string; visibility?: string; username?: string }
  const handle = String(username || '').trim().replace(/^@/, '').toLowerCase()
  if (!title?.trim() || title.length > 120 || description.length > 1000 || !['public', 'private'].includes(visibility) || (visibility === 'public' && !/^[a-z0-9_]{5,32}$/.test(handle))) return response.status(400).json({ error: 'Provide a title and a valid public handle when required' })
  const channelId = randomUUID(), chatId = randomUUID()
  try {
    db.transaction(() => {
      db.prepare("INSERT INTO chats (id, title, type) VALUES (?, ?, 'channel')").run(chatId, title.trim())
      db.prepare('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(chatId, user.id)
      db.prepare('INSERT INTO channels (id, title, description, username, visibility, owner_id, chat_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(channelId, title.trim(), description, visibility === 'public' ? handle : null, visibility, user.id, chatId)
      db.prepare("INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'owner')").run(channelId, user.id)
    })()
  } catch { return response.status(409).json({ error: 'That public handle is unavailable' }) }
  response.status(201).json({ id: channelId, title: title.trim(), description, username: visibility === 'public' ? handle : null, visibility, owner_id: user.id, chat_id: chatId, subscriber_count: 1, my_role: 'owner' })
})
app.patch('/api/channels/:channelId', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const channel = db.prepare("SELECT c.* FROM channels c JOIN channel_members cm ON cm.channel_id = c.id WHERE c.id = ? AND cm.user_id = ? AND cm.role IN ('owner', 'admin')").get(request.params.channelId, user.id) as { id: string; chat_id: string } | undefined
  const { title, description = '', visibility, username } = request.body as { title?: string; description?: string; visibility?: string; username?: string }
  if (!channel || !title?.trim() || !['public', 'private'].includes(String(visibility)) || (visibility === 'public' && !/^[a-z0-9_]{5,32}$/.test(String(username || '').replace(/^@/, '')))) return response.status(400).json({ error: 'Channel details are invalid or you are not an administrator' })
  db.prepare('UPDATE channels SET title = ?, description = ?, visibility = ?, username = ? WHERE id = ?').run(title.trim(), description, visibility, visibility === 'public' ? String(username).replace(/^@/, '').toLowerCase() : null, channel.id)
  db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title.trim(), channel.chat_id)
  response.json(db.prepare('SELECT * FROM channels WHERE id = ?').get(channel.id))
})
app.post('/api/channels/:channelId/subscribe', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const channel = db.prepare("SELECT * FROM channels WHERE id = ? AND visibility = 'public'").get(request.params.channelId) as { chat_id: string } | undefined
  if (!channel) return response.status(404).json({ error: 'Public channel not found' })
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(request.params.channelId, user.id)
  db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)').run(channel.chat_id, user.id)
  response.status(201).json({ ok: true })
})
app.get('/api/me/profile', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as { bio: string; github: string; discord: string; privacy_json: string }
  response.json({ ...publicUser(user), bio: profile.bio, github: profile.github, discord: profile.discord, privacy: JSON.parse(profile.privacy_json) })
})
app.patch('/api/me/profile', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { bio = '', github = '', discord = '', privacy = {} } = request.body as { bio?: string; github?: string; discord?: string; privacy?: Record<string, string> }
  db.prepare('UPDATE profiles SET bio = ?, github = ?, discord = ?, privacy_json = ? WHERE user_id = ?').run(bio, github, discord, JSON.stringify(privacy), user.id)
  db.prepare('UPDATE privacy_settings SET last_seen = ? WHERE user_id = ?').run(privacy.lastSeen || 'Contacts', user.id)
  response.json({ ok: true })
})
app.get('/api/users/:userId/profile', (request, response) => {
  const viewer = requireSession(request, response); if (!viewer) return
  const target = db.prepare('SELECT u.*, p.bio, p.github, p.discord, p.privacy_json FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?').get(request.params.userId) as (SessionUser & { bio: string; github: string; discord: string; privacy_json: string }) | undefined
  if (!target) return response.status(404).json({ error: 'User not found' })
  const privacy = JSON.parse(target.privacy_json) as Record<string, string>
  response.json({ ...publicUser(target), privacy })
})
app.get('/api/me/devices', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  response.json(db.prepare('SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen DESC').all(user.id))
})
app.delete('/api/me/devices/:deviceId', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const deleted = db.prepare('DELETE FROM devices WHERE id = ? AND user_id = ?').run(request.params.deviceId, user.id)
  if (!deleted.changes) return response.status(404).json({ error: 'Device not found' })
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE device_id = ? AND user_id = ?").run(request.params.deviceId, user.id)
  response.status(204).end()
})
app.post('/api/me/sessions/revoke-others', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const token = request.header('authorization')?.replace('Bearer ', '')
  db.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND token != ? AND revoked_at IS NULL").run(user.id, token)
  response.status(204).end()
})
app.get('/api/chats/:chatId/messages', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(request.params.chatId, user.id)
  if (!member) return response.status(403).json({ error: 'Not a chat member' })
  const messages = db.prepare(`
    SELECT m.*, u.name AS sender_name,
      COALESCE((SELECT json_group_array(emoji) FROM (SELECT emoji, COUNT(*) AS count FROM message_reactions WHERE message_id = m.id GROUP BY emoji)), '[]') AS reactions_json,
      EXISTS(SELECT 1 FROM chat_pins p WHERE p.message_id = m.id) AS pinned
    FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ? ORDER BY m.created_at
  `).all(request.params.chatId)
  response.json(messages)
})
app.post('/api/messages/:messageId/reactions', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { emoji } = request.body as { emoji?: string }
  const message = db.prepare('SELECT m.* FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id WHERE m.id = ? AND cm.user_id = ?').get(request.params.messageId, user.id) as { id: string; chat_id: string } | undefined
  if (!message || !emoji || [...emoji].length > 8) return response.status(400).json({ error: 'Reaction is invalid or message is unavailable' })
  db.prepare('INSERT OR IGNORE INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(message.id, user.id, emoji)
  broadcast({ type: 'message.reaction', messageId: message.id, chatId: message.chat_id, emoji })
  response.status(201).json({ ok: true })
})
app.delete('/api/messages/:messageId/reactions/:emoji', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(request.params.messageId, user.id, request.params.emoji)
  response.status(204).end()
})
app.post('/api/messages/:messageId/pin', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const message = db.prepare('SELECT m.* FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id WHERE m.id = ? AND cm.user_id = ?').get(request.params.messageId, user.id) as { id: string; chat_id: string } | undefined
  if (!message) return response.status(404).json({ error: 'Message not found' })
  db.prepare('INSERT OR IGNORE INTO chat_pins (chat_id, message_id, pinned_by) VALUES (?, ?, ?)').run(message.chat_id, message.id, user.id)
  broadcast({ type: 'message.pinned', messageId: message.id, chatId: message.chat_id })
  response.status(201).json({ ok: true })
})
app.get('/api/search/messages', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const query = String(request.query.q || '').trim()
  if (query.length < 2) return response.json([])
  response.json(db.prepare(`
    SELECT m.id, m.chat_id, m.text, m.created_at, c.title, u.name AS sender_name
    FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id JOIN chats c ON c.id = m.chat_id JOIN users u ON u.id = m.sender_id
    WHERE cm.user_id = ? AND m.text LIKE ? ORDER BY m.created_at DESC LIMIT 50
  `).all(user.id, `%${query}%`))
})
app.patch('/api/messages/:messageId', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { text } = request.body as { text?: string }
  if (!text?.trim() || text.length > 4000) return response.status(400).json({ error: 'Message text must be 1–4000 characters' })
  const message = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(request.params.messageId, user.id) as { id: string; chat_id: string } | undefined
  if (!message) return response.status(403).json({ error: 'Only the sender can edit this message' })
  db.prepare('UPDATE messages SET text = ? WHERE id = ?').run(text.trim(), message.id)
  broadcast({ type: 'message.updated', message: { id: message.id, chat_id: message.chat_id, text: text.trim() } })
  response.json({ ...message, text: text.trim() })
})
app.delete('/api/messages/:messageId', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const message = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(request.params.messageId, user.id) as { id: string; chat_id: string } | undefined
  if (!message) return response.status(403).json({ error: 'Only the sender can delete this message' })
  db.prepare('DELETE FROM messages WHERE id = ?').run(message.id)
  broadcast({ type: 'message.deleted', message: { id: message.id, chat_id: message.chat_id } })
  response.status(204).end()
})
app.post('/api/messages/:messageId/reports', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const exists = db.prepare('SELECT 1 FROM messages WHERE id = ?').get(request.params.messageId)
  if (!exists) return response.status(404).json({ error: 'Message not found' })
  db.prepare('INSERT OR IGNORE INTO reports (id, reporter_id, message_id) VALUES (?, ?, ?)').run(randomUUID(), user.id, request.params.messageId)
  response.status(201).json({ ok: true })
})
app.post('/api/users/:userId/block', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  if (user.id === request.params.userId) return response.status(400).json({ error: 'Cannot block yourself' })
  db.prepare('INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)').run(user.id, request.params.userId)
  response.status(201).json({ ok: true })
})
app.get('/api/sticker-packs', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  response.json(db.prepare(`SELECT p.*, EXISTS(SELECT 1 FROM installed_sticker_packs i WHERE i.pack_id = p.id AND i.user_id = ?) AS installed FROM sticker_packs p WHERE p.owner_id = ? OR p.visibility = 'public' OR EXISTS(SELECT 1 FROM installed_sticker_packs i WHERE i.pack_id = p.id AND i.user_id = ?) ORDER BY p.created_at DESC`).all(user.id, user.id, user.id))
})
app.get('/api/sticker-packs/:packId/stickers', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const access = db.prepare(`SELECT 1 FROM sticker_packs p WHERE p.id = ? AND (p.owner_id = ? OR p.visibility = 'public' OR EXISTS(SELECT 1 FROM installed_sticker_packs i WHERE i.pack_id = p.id AND i.user_id = ?))`).get(request.params.packId, user.id, user.id)
  if (!access) return response.status(403).json({ error: 'Sticker pack is not available' })
  response.json(db.prepare('SELECT id, pack_id, name, mime_type, data_url, position FROM stickers WHERE pack_id = ? ORDER BY position, created_at').all(request.params.packId))
})
app.post('/api/sticker-packs', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { title, author = user.name, visibility = 'private' } = request.body as { title?: string; author?: string; visibility?: string }
  if (!title?.trim() || title.length > 80 || !['private', 'unlisted', 'public'].includes(visibility)) return response.status(400).json({ error: 'Provide a valid pack title and visibility' })
  const pack = { id: randomUUID(), title: title.trim(), author: author.slice(0, 80), visibility, shareCode: randomUUID().slice(0, 8) }
  db.prepare('INSERT INTO sticker_packs (id, owner_id, title, author, visibility, share_code) VALUES (?, ?, ?, ?, ?, ?)').run(pack.id, user.id, pack.title, pack.author, pack.visibility, pack.shareCode)
  db.prepare('INSERT INTO installed_sticker_packs (user_id, pack_id) VALUES (?, ?)').run(user.id, pack.id)
  response.status(201).json(pack)
})
app.post('/api/sticker-packs/:packId/stickers', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { name, mimeType, dataUrl } = request.body as { name?: string; mimeType?: string; dataUrl?: string }
  const owns = db.prepare('SELECT 1 FROM sticker_packs WHERE id = ? AND owner_id = ?').get(request.params.packId, user.id)
  if (!owns || !name || !mimeType || !dataUrl || !['image/png', 'image/webp', 'image/gif'].includes(mimeType) || dataUrl.length > 1_500_000) return response.status(400).json({ error: 'Use a PNG, WebP, or GIF sticker up to 1 MB' })
  const id = randomUUID()
  db.prepare('INSERT INTO stickers (id, pack_id, owner_id, name, mime_type, data_url, position) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM stickers WHERE pack_id = ?), 0))').run(id, request.params.packId, user.id, name.slice(0, 120), mimeType, dataUrl, request.params.packId)
  response.status(201).json({ id, packId: request.params.packId, name, mimeType, dataUrl })
})
app.post('/api/sticker-packs/:packId/install', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const pack = db.prepare("SELECT 1 FROM sticker_packs WHERE id = ? AND visibility != 'private'").get(request.params.packId)
  if (!pack) return response.status(404).json({ error: 'Public or unlisted pack not found' })
  db.prepare('INSERT OR IGNORE INTO installed_sticker_packs (user_id, pack_id) VALUES (?, ?)').run(user.id, request.params.packId)
  response.status(204).end()
})
app.post('/api/attachments', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { name, mimeType, dataUrl } = request.body as { name?: string; mimeType?: string; dataUrl?: string }
  if (!name || !mimeType || !dataUrl?.startsWith(`data:${mimeType};base64,`) || dataUrl.length > 6_500_000) return response.status(400).json({ error: 'Attachment is invalid or exceeds 5 MB' })
  const id = randomUUID()
  const byteSize = Buffer.byteLength(dataUrl.split(',')[1] || '', 'base64')
  db.prepare('INSERT INTO attachments (id, uploader_id, name, mime_type, byte_size, data_url) VALUES (?, ?, ?, ?, ?, ?)').run(id, user.id, name.slice(0, 160), mimeType.slice(0, 120), byteSize, dataUrl)
  response.status(201).json({ id, name, mimeType, byteSize, url: `/api/attachments/${id}` })
})
app.get('/api/attachments/:attachmentId', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(request.params.attachmentId) as { id: string; name: string; mime_type: string; data_url: string } | undefined
  if (!attachment) return response.status(404).json({ error: 'Attachment not found' })
  const hasAccess = db.prepare(`SELECT 1 FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id WHERE cm.user_id = ? AND m.metadata_json LIKE ? LIMIT 1`).get(user.id, `%"attachmentId":"${attachment.id}"%`)
  if (!hasAccess) return response.status(403).json({ error: 'Attachment is not shared with you' })
  const content = Buffer.from(attachment.data_url.split(',')[1], 'base64')
  response.type(attachment.mime_type).setHeader('Content-Disposition', `inline; filename="${attachment.name.replace(/"/g, '')}"`).send(content)
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' })
function broadcast(payload: object) { const text = JSON.stringify(payload); for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(text) }
app.post('/api/chats/:chatId/messages', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { text, kind = 'text', metadata = {} } = request.body as { text?: string; kind?: string; metadata?: Record<string, unknown> }
  if (!text?.trim() || text.length > 4000) return response.status(400).json({ error: 'Message text must be 1–4000 characters' })
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(request.params.chatId, user.id)
  if (!member) return response.status(403).json({ error: 'Not a chat member' })
  const channel = db.prepare('SELECT id FROM channels WHERE chat_id = ?').get(request.params.chatId) as { id: string } | undefined
  if (channel && !db.prepare("SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ? AND role IN ('owner', 'admin')").get(channel.id, user.id)) return response.status(403).json({ error: 'Only channel administrators can publish posts' })
  const message = { id: randomUUID(), chat_id: request.params.chatId, sender_id: user.id, text: text.trim(), kind, metadata, created_at: new Date().toISOString(), sender_name: user.name }
  db.prepare('INSERT INTO messages (id, chat_id, sender_id, text, kind, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(message.id, message.chat_id, message.sender_id, message.text, message.kind, JSON.stringify(metadata), message.created_at)
  broadcast({ type: 'message.created', message })
  response.status(201).json(message)
})

const port = Number(process.env.API_PORT || 8787)
const host = process.env.API_HOST || '127.0.0.1'
httpServer.listen(port, host, () => console.log(`Chettik API listening on http://${host}:${port}`))
