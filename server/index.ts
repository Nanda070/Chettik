import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import path from 'node:path'
import Database from 'better-sqlite3'
import express from 'express'
import { WebSocketServer } from 'ws'

const db = new Database(path.resolve('chettik.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, phone TEXT NOT NULL UNIQUE, role TEXT NOT NULL, email TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS chat_members (chat_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (chat_id, user_id));
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, chat_id TEXT NOT NULL, sender_id TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, label TEXT NOT NULL, last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS privacy_settings (user_id TEXT PRIMARY KEY, phone TEXT NOT NULL DEFAULT 'Contacts', last_seen TEXT NOT NULL DEFAULT 'Contacts');
`)
const users = [
  ['nanda', 'Nanda', '@nanda', '+11111111111', 'SuperAdmin', 'test@test.com', 'N', '#9e2338'],
  ['mark', 'Mark', '@mark', '+22222222222', 'Admin', 'test2@test.com', 'M', '#6e4c97'],
  ['alisher', 'Alisher', '@alisher', '+33333333333', 'User', 'test3@test.com', 'A', '#bf8057'],
]
const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, username, phone, role, email, initials, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
const insertPrivacy = db.prepare('INSERT OR IGNORE INTO privacy_settings (user_id) VALUES (?)')
const insertDevice = db.prepare('INSERT OR IGNORE INTO devices (id, user_id, label) VALUES (?, ?, ?)')
for (const user of users) { insertUser.run(...user); insertPrivacy.run(user[0]); insertDevice.run(`${user[0]}-local`, user[0], 'Local development device') }
db.prepare("INSERT OR IGNORE INTO chats (id, title, type) VALUES ('nanda-mark', 'Mark', 'direct')").run()
db.prepare("INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES ('nanda-mark', ?)").run('nanda')
db.prepare("INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES ('nanda-mark', ?)").run('mark')
const seedMessage = db.prepare('INSERT OR IGNORE INTO messages (id, chat_id, sender_id, text, kind) VALUES (?, ?, ?, ?, ?)')
seedMessage.run('seed-mark-1', 'nanda-mark', 'mark', 'I tried the new onboarding flow. It feels really calm.', 'text')
seedMessage.run('seed-nanda-1', 'nanda-mark', 'nanda', 'That was the idea. Less noise, more space for people.', 'text')

type SessionUser = { id: string; name: string; username: string; phone: string; role: string; email: string; initials: string; color: string }
const app = express()
app.use(express.json())
app.use((_, response, next) => { response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173'); response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); next() })

function session(request: express.Request): SessionUser | undefined {
  const token = request.header('authorization')?.replace('Bearer ', '')
  if (!token) return undefined
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) as SessionUser | undefined
}
function requireSession(request: express.Request, response: express.Response): SessionUser | undefined {
  const user = session(request)
  if (!user) response.status(401).json({ error: 'Authentication required' })
  return user
}

app.get('/api/health', (_, response) => response.json({ ok: true, storage: 'sqlite' }))
app.post('/api/auth/otp', (request, response) => {
  const { phone, code } = request.body as { phone?: string; code?: string }
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as SessionUser | undefined
  if (!user || !code || !/^\d{4,6}$/.test(code)) return response.status(401).json({ error: 'Invalid local OTP' })
  const token = randomUUID()
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id)
  response.json({ token, user })
})
app.get('/api/chats', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const chats = db.prepare('SELECT c.* FROM chats c JOIN chat_members m ON m.chat_id = c.id WHERE m.user_id = ?').all(user.id)
  response.json(chats)
})
app.get('/api/chats/:chatId/messages', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(request.params.chatId, user.id)
  if (!member) return response.status(403).json({ error: 'Not a chat member' })
  response.json(db.prepare('SELECT m.*, u.name AS sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.chat_id = ? ORDER BY m.created_at').all(request.params.chatId))
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer, path: '/api/ws' })
function broadcast(payload: object) { const text = JSON.stringify(payload); for (const client of wss.clients) if (client.readyState === client.OPEN) client.send(text) }
app.post('/api/chats/:chatId/messages', (request, response) => {
  const user = requireSession(request, response); if (!user) return
  const { text, kind = 'text' } = request.body as { text?: string; kind?: string }
  if (!text?.trim() || text.length > 4000) return response.status(400).json({ error: 'Message text must be 1–4000 characters' })
  const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(request.params.chatId, user.id)
  if (!member) return response.status(403).json({ error: 'Not a chat member' })
  const message = { id: randomUUID(), chat_id: request.params.chatId, sender_id: user.id, text: text.trim(), kind, created_at: new Date().toISOString(), sender_name: user.name }
  db.prepare('INSERT INTO messages (id, chat_id, sender_id, text, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(message.id, message.chat_id, message.sender_id, message.text, message.kind, message.created_at)
  broadcast({ type: 'message.created', message })
  response.status(201).json(message)
})

const port = Number(process.env.API_PORT || 8787)
httpServer.listen(port, '127.0.0.1', () => console.log(`Chettik API listening on http://127.0.0.1:${port}`))
