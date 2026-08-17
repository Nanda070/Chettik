import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import path from 'node:path'
import Database from 'better-sqlite3'
import express from 'express'
import { WebSocketServer } from 'ws'

const db = new Database(path.resolve('chettik.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE, role TEXT NOT NULL, email TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL, badges_json TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT, revoked_at TEXT);
  CREATE TABLE IF NOT EXISTS otp_challenges (id TEXT PRIMARY KEY, phone TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, consumed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (chat_id, user_id));
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, bio TEXT NOT NULL DEFAULT '', github TEXT NOT NULL DEFAULT '', discord TEXT NOT NULL DEFAULT '', privacy_json TEXT NOT NULL DEFAULT '{}');
  CREATE TABLE IF NOT EXISTS privacy_settings (user_id TEXT PRIMARY KEY, phone TEXT NOT NULL DEFAULT 'Contacts', last_seen TEXT NOT NULL DEFAULT 'Contacts');
  CREATE TABLE IF NOT EXISTS blocked_users (user_id TEXT NOT NULL, blocked_user_id TEXT NOT NULL, PRIMARY KEY (user_id, blocked_user_id));
  CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, message_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, primary_chat_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS group_members (group_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', PRIMARY KEY (group_id, user_id));
`)
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
  ['nanda', 'Nanda', '@nanda', '+11111111111', 'SuperAdmin', 'test@test.com', 'N', '#9e2338'],
  ['mark', 'Mark', '@mark', '+22222222222', 'Admin', 'test2@test.com', 'M', '#6e4c97'],
  ['alisher', 'Alisher', '@alisher', '+33333333333', 'User', 'test3@test.com', 'A', '#bf8057'],
]
const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, username, phone, role, email, initials, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
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
const seedMessage = db.prepare('INSERT OR IGNORE INTO messages (id, chat_id, sender_id, text, kind) VALUES (?, ?, ?, ?, ?)')
seedMessage.run('seed-mark-1', 'nanda-mark', 'mark', 'I tried the new onboarding flow. It feels really calm.', 'text')
seedMessage.run('seed-nanda-1', 'nanda-mark', 'nanda', 'That was the idea. Less noise, more space for people.', 'text')
seedMessage.run('seed-saved-nanda-1', 'saved-nanda', 'nanda', 'Remember to write this down.', 'text')

type SessionUser = { id: string; name: string; username: string; phone: string; role: string; email: string; initials: string; color: string }
function publicUser(user: SessionUser & { badges_json?: string }) {
  const { badges_json, ...fields } = user
  return { ...fields, badges: JSON.parse(badges_json || '[]') as string[] }
}
type OtpProvider = {
  deliver: (input: { phone: string; code: string; expiresAt: string }) => Promise<void>
}
const developmentOtpProvider: OtpProvider = {
  async deliver({ phone, code, expiresAt }) {
    console.info(`[otp:development] ${phone} code=${code} expires=${expiresAt}`)
  },
}
const otpProvider = developmentOtpProvider
const OTP_TTL_MS = 10 * 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5
const OTP_PHONE_LIMIT = process.env.NODE_ENV === 'production' ? 3 : 10_000
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
app.use(express.json())
app.use((_, response, next) => { response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173'); response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS'); next() })
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
  const phone = String((request.body as { phone?: string }).phone || '').replace(/\s/g, '')
  if (!/^\+\d{10,15}$/.test(phone)) return response.status(400).json({ error: 'Enter a valid phone number' })
  if (!rateLimit(`phone:${phone}`, OTP_PHONE_LIMIT) || !rateLimit(`ip:${clientIp(request)}`, OTP_IP_LIMIT)) return response.status(429).json({ error: 'Too many verification requests. Please try again later.' })
  const id = randomUUID()
  const code = process.env.OTP_DEV_CODE || '123456'
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()
  db.prepare('INSERT INTO otp_challenges (id, phone, code_hash, expires_at) VALUES (?, ?, ?, ?)').run(id, phone, hashOtp(id, code), expiresAt)
  await otpProvider.deliver({ phone, code, expiresAt })
  response.status(201).json({ challengeId: id, expiresAt, delivery: 'development' })
})
app.post('/api/auth/otp/verify', (request, response) => {
  const { phone: rawPhone, code, challengeId, deviceLabel } = request.body as { phone?: string; code?: string; challengeId?: string; deviceLabel?: string }
  const phone = String(rawPhone || '').replace(/\s/g, '')
  if (!challengeId || !code || !/^\d{6}$/.test(code)) return response.status(400).json({ error: 'Enter the six-digit verification code' })
  const challenge = db.prepare('SELECT * FROM otp_challenges WHERE id = ? AND phone = ?').get(challengeId, phone) as { id: string; code_hash: string; expires_at: string; attempts: number; consumed_at: string | null } | undefined
  if (!challenge || challenge.consumed_at || new Date(challenge.expires_at).getTime() <= Date.now()) return response.status(401).json({ error: 'This verification code has expired. Request a new one.' })
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return response.status(429).json({ error: 'Too many invalid attempts. Request a new code.' })
  const expected = Buffer.from(challenge.code_hash, 'hex')
  const received = Buffer.from(hashOtp(challenge.id, code), 'hex')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?').run(challenge.id)
    return response.status(401).json({ error: 'Incorrect verification code' })
  }
  db.prepare("UPDATE otp_challenges SET consumed_at = datetime('now') WHERE id = ?").run(challenge.id)
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as SessionUser | undefined
  if (!user) return response.status(401).json({ error: 'This phone number is not registered' })
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
app.get('/api/me/profile', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as { bio: string; github: string; discord: string; privacy_json: string }
  response.json({ ...publicUser(user), bio: profile.bio, github: profile.github, discord: profile.discord, privacy: JSON.parse(profile.privacy_json) })
})
app.patch('/api/me/profile', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { bio = '', github = '', discord = '', privacy = {} } = request.body as { bio?: string; github?: string; discord?: string; privacy?: Record<string, string> }
  db.prepare('UPDATE profiles SET bio = ?, github = ?, discord = ?, privacy_json = ? WHERE user_id = ?').run(bio, github, discord, JSON.stringify(privacy), user.id)
  db.prepare('UPDATE privacy_settings SET phone = ?, last_seen = ? WHERE user_id = ?').run(privacy.phone || 'Contacts', privacy.lastSeen || 'Contacts', user.id)
  response.json({ ok: true })
})
app.get('/api/users/:userId/profile', (request, response) => {
  const viewer = requireSession(request, response); if (!viewer) return
  const target = db.prepare('SELECT u.*, p.bio, p.github, p.discord, p.privacy_json FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?').get(request.params.userId) as (SessionUser & { bio: string; github: string; discord: string; privacy_json: string }) | undefined
  if (!target) return response.status(404).json({ error: 'User not found' })
  const privacy = JSON.parse(target.privacy_json) as Record<string, string>
  const phoneVisible = target.id === viewer.id || privacy.phone !== 'Nobody'
  response.json({ ...publicUser(target), phone: phoneVisible ? target.phone : undefined, privacy })
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
  response.json(db.prepare('SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ? ORDER BY m.created_at').all(request.params.chatId))
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

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' })
function broadcast(payload: object) { const text = JSON.stringify(payload); for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(text) }
app.post('/api/chats/:chatId/messages', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { text, kind = 'text', metadata = {} } = request.body as { text?: string; kind?: string; metadata?: Record<string, unknown> }
  if (!text?.trim() || text.length > 4000) return response.status(400).json({ error: 'Message text must be 1–4000 characters' })
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(request.params.chatId, user.id)
  if (!member) return response.status(403).json({ error: 'Not a chat member' })
  const message = { id: randomUUID(), chat_id: request.params.chatId, sender_id: user.id, text: text.trim(), kind, metadata, created_at: new Date().toISOString(), sender_name: user.name }
  db.prepare('INSERT INTO messages (id, chat_id, sender_id, text, kind, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(message.id, message.chat_id, message.sender_id, message.text, message.kind, JSON.stringify(metadata), message.created_at)
  broadcast({ type: 'message.created', message })
  response.status(201).json(message)
})

const port = Number(process.env.API_PORT || 8787)
httpServer.listen(port, '127.0.0.1', () => console.log(`Chettik API listening on http://127.0.0.1:${port}`))
