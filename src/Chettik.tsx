import { ArrowLeft, ArrowRight, Check, ChevronLeft, CircleUserRound, Flag, Forward, Lock, Menu, MessageCircle, Moon, Paperclip, Pencil, Pin, Search, Send, Settings, ShieldCheck, ShieldAlert, Smile, Sun, Trash2, Users, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { SettingsDrawer } from './Stage3Panels'

export type Account = {
  role: 'SuperAdmin' | 'Admin' | 'User'
  name: string
  username: string
  phone: string
  email: string
  initials: string
  color: string
}

type LegalDoc = 'terms' | 'privacy' | 'authors'

export const seedAccounts: Account[] = [
  { role: 'SuperAdmin', name: 'Nanda', username: '@nanda', phone: '+11111111111', email: 'test@test.com', initials: 'N', color: '#9e2338' },
  { role: 'Admin', name: 'Mark', username: '@mark', phone: '+22222222222', email: 'test2@test.com', initials: 'M', color: '#6e4c97' },
  { role: 'User', name: 'Alisher', username: '@alisher', phone: '+33333333333', email: 'test3@test.com', initials: 'A', color: '#bf8057' },
]

type Language = 'EN' | 'RU'
type Message = { id: string; sender: string; text: string; time: string; mine: boolean; reactions: string[]; pinned?: boolean; edited?: boolean; replyTo?: string }
export type Audience = 'Everybody' | 'Contacts' | 'Nobody'
export type Profile = {
  bio: string; github: string; discord: string; lastSeen: Audience; phoneVisibility: Audience; blocked: string[]
  privacy?: Record<string, Audience>; privacyExceptions?: Record<string, { always: string[]; never: string[] }>
  passcode?: boolean; biometrics?: boolean; twoStep?: boolean; passkeys?: boolean; loginEmail?: string
  autoDelete?: string; scheduledEnabled?: boolean; timedMedia?: boolean; viewOnce?: boolean
}
const STORE = 'chettik-stage-2'
const credits = {
  ru: { dev: 'Разработчик и основатель: Nanda, Discord: nandak070, Telegram: nanda070', mark: 'Разработчик: Mark, Discord: schizophrenogenic', contact: 'Связь', all: 'Nanda · Email: adnan.huseynli1@gmail.com · Телефон: +41-77-259-9608 · Discord: nandak070 · Telegram: nanda070' },
  en: { dev: 'Developer & founder: Nanda, Discord: nandak070, Telegram: nanda070', mark: 'Developer: Mark, Discord: schizophrenogenic', contact: 'Contact', all: 'Nanda · Email: adnan.huseynli1@gmail.com · Phone: +41-77-259-9608 · Discord: nandak070 · Telegram: nanda070' },
}
const initialMessages = (name: string): Message[] => [
  { id: 'm1', sender: 'Mark', text: 'I tried the new onboarding flow. It feels really calm.', time: '10:38', mine: false, reactions: ['❤️'] },
  { id: 'm2', sender: name, text: 'That was the idea. Less noise, more space for people.', time: '10:40', mine: true, reactions: [] },
  { id: 'm3', sender: 'Mark', text: 'That reads much better. And the dark red feels like a real signature.', time: '10:42', mine: false, reactions: [], pinned: true },
]
function load(account: Account) {
  const saved = JSON.parse(localStorage.getItem(STORE) || '{}')
  return { messages: saved.messages?.[account.phone] || initialMessages(account.name), profile: saved.profile?.[account.phone] || { bio: '', github: '', discord: '', lastSeen: 'Contacts', phoneVisibility: 'Contacts', blocked: [], privacy: { phone: 'Contacts', lastSeen: 'Contacts', photo: 'Everybody', bio: 'Everybody', birthday: 'Contacts', forwards: 'Everybody', voice: 'Contacts', messages: 'Everybody' }, privacyExceptions: {}, autoDelete: '6 months' } as Profile, reports: saved.reports || [] as string[] }
}
function persist(account: Account, data: { messages: Message[]; profile: Profile; reports: string[] }) {
  const saved = JSON.parse(localStorage.getItem(STORE) || '{}')
  localStorage.setItem(STORE, JSON.stringify({ ...saved, messages: { ...saved.messages, [account.phone]: data.messages }, profile: { ...saved.profile, [account.phone]: data.profile }, reports: data.reports }))
}

export default function Chettik() {
  const [dark, setDark] = useState(true)
  const [language, setLanguage] = useState<Language>('EN')
  const [picked, setPicked] = useState<Account | null>(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [session, setSession] = useState<Account | null>(null)
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const ru = language === 'RU'
  const tr = ru ? { invalid: 'Введите корректный номер телефона.', code: 'Код отправлен в локальную SMS-заглушку. Для демо: любые 4–6 цифр.', legal: ['Условия', 'Конфиденциальность', 'Авторы'] } : { invalid: 'Enter a valid phone number.', code: 'Code sent to the local SMS stub. Demo: any 4–6 digits.', legal: ['Terms', 'Privacy', 'Authors'] }
  const copy = ru
    ? { title: 'Тише. Ближе. По-своему.', subtitle: 'Приватность — по умолчанию. Знакомый интерфейс.', pick: 'Выберите демо-аккаунт', phone: 'или введите номер телефона', continue: 'Продолжить', secure: 'Телефон — основа личности. Сначала SMS OTP, затем fallback в Telegram.', code: 'Введите код из 6 цифр', verify: 'Подтвердить и войти', back: 'Назад' }
    : { title: 'A quieter place to be close.', subtitle: 'Private by instinct. Familiar by design.', pick: 'Choose a demo account', phone: 'or enter your phone number', continue: 'Continue', secure: 'Phone-first identity. SMS OTP with Telegram delivery fallback.', code: 'Enter the 6-digit code', verify: 'Verify & enter', back: 'Back' }

  const requestOtp = () => { if (/^\+\d{10,15}$/.test(phone.replace(/\s/g, ''))) { setAuthNotice(''); setPicked(seedAccounts.find(a => a.phone === phone.replace(/\s/g, '')) ?? { ...seedAccounts[2], phone: phone.replace(/\s/g, ''), name: 'New user', username: '@new' }) } else setAuthNotice(tr.invalid) }
  if (legal) return <LegalPage doc={legal} language={language} dark={dark} onBack={() => setLegal(null)} />
  if (session) return <Messenger account={session} dark={dark} setDark={setDark} language={language} onLanguage={() => setLanguage(ru ? 'EN' : 'RU')} onLogout={() => setSession(null)} />
  return <main className={`auth-screen ${dark ? 'dark' : ''}`}>
    <div className="auth-ambient one" /><div className="auth-ambient two" />
    <header className="auth-header">
      <div className="auth-logo"><img src="/logo.svg" alt="" /> chettik</div>
      <div className="auth-controls"><button onClick={() => setLanguage(ru ? 'EN' : 'RU')}>{language}</button><button aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    </header>
    <section className="auth-layout">
      <div className="auth-intro"><div className="eyebrow"><ShieldCheck size={15} /> PRIVATE MESSENGER</div><h1>{copy.title}</h1><p>{copy.subtitle}</p><div className="auth-note"><Check size={16} /> {copy.secure}</div></div>
      <div className="auth-card">
        {!picked && <><div className="card-kicker">{copy.pick}</div><div className="account-options">{seedAccounts.map(account => <button className="account-option" key={account.phone} onClick={() => setPicked(account)}><div className="avatar" style={{ background: account.color }}>{account.initials}</div><span><strong>{account.name}</strong><small>{account.username} · {account.role}</small></span><ArrowRight size={17} /></button>)}</div><div className="divider"><span>{copy.phone}</span></div><form onSubmit={(e) => { e.preventDefault(); requestOtp() }}><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" aria-label="Phone number" required /><button className="primary" type="submit">{copy.continue} <ArrowRight size={16} /></button></form>{authNotice && <p className="form-notice" role="alert">{authNotice}</p>}</>}
        {picked && <><button className="back" onClick={() => { setPicked(null); setOtp(''); setAuthNotice('') }}><ChevronLeft size={16} /> {copy.back}</button><div className="code-user"><div className="avatar" style={{ background: picked.color }}>{picked.initials}</div><strong>{picked.name}</strong><span>{picked.phone}</span></div><p className="code-copy">{copy.code}</p><form onSubmit={(e) => { e.preventDefault(); if (otp.length >= 4) { setAuthNotice(''); setSession(picked) } else setAuthNotice(tr.code) }}><input className="otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" autoFocus required /><button className="primary" type="submit">{copy.verify} <ArrowRight size={16} /></button></form><small className="demo-hint">{tr.code}</small>{authNotice && <p className="form-notice" role="alert">{authNotice}</p>}</>}
      </div>
    </section>
    <footer><span>© 2026 Chettik</span><span><button onClick={() => setLegal('terms')}>{tr.legal[0]}</button> · <button onClick={() => setLegal('privacy')}>{tr.legal[1]}</button> · <button onClick={() => setLegal('authors')}>{tr.legal[2]}</button></span></footer>
  </main>
}

function LegalPage({ doc, language, dark, onBack }: { doc: LegalDoc; language: 'EN' | 'RU'; dark: boolean; onBack: () => void }) {
  const ru = language === 'RU'
  const pages: Record<LegalDoc, [string, string, string[]]> = {
    terms: ru ? ['Условия использования', 'Черновик для Stage 1 · вступает в силу после юридической проверки', ['Использование сервиса', 'Chettik — сервис обмена сообщениями. Вы обязуетесь использовать его законно, не нарушать права других лиц и не обходить меры безопасности.', 'Аккаунт и модерация', 'Телефон является основной идентичностью аккаунта. Мы можем ограничить доступ при нарушении правил, обработке валидного репорта или требованиях закона.', 'Статус документа', 'Этот текст — продуктовый placeholder. До публичного запуска он будет заменён версией, проверенной юристами для CIS/RF, EU, US и Canada.']] : ['Terms of Service', 'Stage 1 draft · effective after legal review', ['Using Chettik', 'Chettik is a messaging service. You agree to use it lawfully, respect other people’s rights, and not evade security measures.', 'Accounts and moderation', 'A phone number is the primary account identity. We may limit access following policy violations, valid reports, or legal requirements.', 'Document status', 'This is a product placeholder. It will be replaced before public launch by counsel-reviewed terms for CIS/RF, EU, US, and Canada.']],
    privacy: ru ? ['Политика конфиденциальности', 'Черновик для Stage 1 · версия 0.1', ['Данные, которые нужны сервису', 'Для аккаунта обрабатываются номер телефона, профиль и данные сессии. Содержимое облачных чатов обрабатывается для доставки сообщений; секретные чаты проектируются отдельно как device-bound E2E.', 'Ваш контроль', 'Настройки приватности дают аудитории everybody / nobody / contacts / exceptions. Пользователь может управлять сообщениями, блокировками, данными профиля и удалением аккаунта.', 'Хранение и права', 'Финальная политика определит сроки хранения, удаление, контакты privacy и права, применимые на рынках запуска.']] : ['Privacy Policy', 'Stage 1 draft · version 0.1', ['Data needed for the service', 'We process a phone number, profile information, and session data for your account. Cloud-chat content is processed to deliver messages; secret chats are separately designed as device-bound E2E.', 'Your control', 'Privacy settings support everybody / nobody / contacts / exceptions audiences. You can manage messages, blocks, profile data, and account deletion.', 'Retention and rights', 'The final policy will define retention, deletion, privacy contacts, and rights for each launch market.']],
    authors: ru ? ['Авторы и благодарности', 'Chettik · продуктовый документ', ['Команда', credits.ru.dev, 'Участники', credits.ru.mark, credits.ru.contact, credits.ru.all]] : ['Authors & Credits', 'Chettik · product notice', ['Team', credits.en.dev, 'Contributors', credits.en.mark, credits.en.contact, credits.en.all]],
  }
  const content = pages[doc]
  return <main className={`legal-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Chettik</button><span>{language}</span></header><article><div className="eyebrow">LEGAL / {doc.toUpperCase()}</div><h1>{content[0]}</h1><p className="legal-subtitle">{content[1]}</p>{content[2].map((line, index) => index % 2 === 0 ? <section key={line}><h2>{line}</h2><p>{content[2][index + 1]}</p></section> : null)}</article></main>
}

type MessengerProps = { account: Account; dark: boolean; setDark: (value: boolean) => void; language: Language; onLanguage: () => void; onLogout: () => void }
const chats = [
  { name: 'Mark', preview: 'That reads much better.', time: '10:42', initials: 'M', color: '#6e4c97', unread: 2 },
  { name: 'Design circle', preview: 'Nanda: I shared the new motion study ✨', time: '09:30', initials: 'D', color: '#4c8a83', unread: 0 },
  { name: 'Saved Messages', preview: 'You: Remember to write this down.', time: 'Mon', initials: 'S', color: '#9e2338', unread: 0 },
  { name: 'Alisher', preview: 'See you after work!', time: 'Sun', initials: 'A', color: '#bf8057', unread: 0 },
]

function Messenger({ account, dark, setDark, language, onLanguage, onLogout }: MessengerProps) {
  const [message, setMessage] = useState('')
  const [page, setPage] = useState<'chat' | 'settings' | 'admin'>('chat')
  const saved = useMemo(() => load(account), [account])
  const [messages, setMessages] = useState<Message[]>(saved.messages)
  const [profile, setProfile] = useState<Profile>(saved.profile)
  const [reports, setReports] = useState<string[]>(saved.reports)
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => persist(account, { messages, profile, reports }), [account, messages, profile, reports])
  const send = () => { const text = message.trim(); if (!text || text.length > 4000) return; if (editing) setMessages(old => old.map(item => item.id === editing.id ? { ...item, text, edited: true } : item)); else setMessages(old => [...old, { id: crypto.randomUUID(), mine: true, sender: account.name, text, time: 'now', reactions: [], replyTo: reply?.text }]); setMessage(''); setReply(null); setEditing(null) }
  const attach = (file?: File) => { if (!file) return; setMessages(old => [...old, { id: crypto.randomUUID(), mine: true, sender: account.name, text: `📎 ${file.name} · ${Math.ceil(file.size / 1024)} KB${file.type.startsWith('image/') ? ' · photo as file' : ''}`, time: 'now', reactions: [] }]) }
  const deleteMessage = (id: string) => setMessages(old => old.filter(m => m.id !== id))
  const matches = messages.filter(m => m.text.toLowerCase().includes(search.toLowerCase()))
  if (page === 'admin') return <AdminPage account={account} reports={reports} clearReports={() => setReports([])} onBack={() => setPage('chat')} />
  return <div className={`app ${dark ? 'dark' : ''}`}>
    <div className="app-shell">
      <nav className="rail"><img className="mark" src="/logo.svg" alt="Chettik" /><button className="rail-btn active"><MessageCircle size={20} /></button><button className="rail-btn"><Users size={20} /></button><div className="rail-spacer" />{account.role !== 'User' && <button className="rail-btn" title="Operations console" onClick={() => setPage('admin')}><ShieldAlert size={19} /></button>}<button className="avatar me" title={account.name} onClick={() => setPage('settings')}>{account.initials}</button></nav>
      <aside className="sidebar"><div className="side-top"><div className="wordmark"><img src="/logo.svg" alt="" />chett<span>i</span>k</div><button className="icon-btn" aria-label="New chat"><MessageCircle size={19} /></button></div><label className="search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages" /></label><div className="list-title">Cloud chats · {matches.length} matches</div><div className="chat-list">{chats.map((chat, i) => <button className={`chat-row ${i === 0 ? 'active' : ''}`} key={chat.name}><div className="avatar" style={{ background: chat.color }}>{chat.initials}</div><div className="chat-copy"><div className="chat-name">{chat.name}<span className="time">{chat.time}</span></div><div className="chat-preview">{chat.preview}</div></div>{chat.unread ? <span className="unread">{chat.unread}</span> : null}</button>)}</div></aside>
      <section className="chat">
        <header className="chat-head"><button className="icon-btn mobile-menu" aria-label="Open main menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><div className="avatar" style={{ background: '#6e4c97' }}>M</div><div className="chat-person"><strong>Mark <span className="badge">ADMIN</span></strong><span>online · cloud chat</span></div><div className="head-actions"><button className="icon-btn" title="Switch language" onClick={onLanguage}>{language}</button><button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}><Settings size={19} /></button><button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>
        <div className="messages"><div className="date">Today</div>{matches.map(item => <div className={`message ${item.mine ? 'mine' : ''}`} key={item.id}><div className="avatar" style={{ background: item.mine ? account.color : '#6e4c97' }}>{item.mine ? account.initials : 'M'}</div><div className="bubble">{item.replyTo && <small className="reply-ref">↳ {item.replyTo}</small>}<span className="sender">{item.sender}</span>{item.text}<div className="message-tools"><button onClick={() => setReply(item)} title="Reply"><ArrowLeft size={12} /></button><button onClick={() => setMessages(old => old.map(m => m.id === item.id ? { ...m, reactions: [...m.reactions, '❤️'] } : m))}>❤️ {item.reactions.length || ''}</button><button title="Forward" onClick={() => setMessage(`Fwd: ${item.text}`)}><Forward size={12} /></button><button title="Pin" onClick={() => setMessages(old => old.map(m => m.id === item.id ? { ...m, pinned: !m.pinned } : m))}><Pin size={12} /></button>{item.mine && <button aria-label="Edit message" onClick={() => { setEditing(item); setMessage(item.text); setReply(null) }}><Pencil size={12} /></button>}<button onClick={() => setReports(old => [...old, `Report: ${item.text}`])}><Flag size={12} /></button>{item.mine && <button onClick={() => deleteMessage(item.id)}><Trash2 size={12} /></button>}</div><span className="meta">{item.pinned ? '📌 ' : ''}{item.time} {item.edited ? 'edited' : ''} {item.mine ? '✓✓' : ''}</span></div></div>)}</div>
        <form className={`compose ${editing ? 'editing' : ''}`} onSubmit={(e) => { e.preventDefault(); send() }}>
          {(reply || editing) && <div className="compose-context"><Pencil size={17} /><span><strong>{editing ? 'Edit message' : 'Replying to Mark'}</strong><small>{(editing || reply)?.text.slice(0, 72)}</small></span><button type="button" onClick={() => { setEditing(null); setReply(null); setMessage('') }}><X size={17} /></button></div>}
          <input ref={fileInput} type="file" hidden onChange={e => { attach(e.target.files?.[0]); e.currentTarget.value = '' }} /><button className="icon-btn" type="button" title="Attach file" onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><input aria-label="Message text" maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message…" /><button className="icon-btn" type="button" aria-label="Open emoji picker" onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={19} /></button><button className="send" aria-label={editing ? 'Save message' : 'Send message'}>{editing ? <Check size={18} /> : <Send size={17} />}</button>
          {emojiOpen && <div className="emoji-picker"><div className="emoji-tabs"><button className="active">Emoji</button><button>Stickers</button><button>GIFs</button></div><input aria-label="Search emoji" placeholder="Search emoji" readOnly /><div className="emoji-grid">{['😀','😂','🥰','😍','😎','🤝','❤️','🔥','✨','👍','🙏','🎉','💬','🌙','🚀','🍒','✅','🤍','🤔','👏','🎈','💯','🫶','😌'].map(emoji => <button key={emoji} type="button" onClick={() => { setMessage(m => `${m}${emoji}`); setEmojiOpen(false) }}>{emoji}</button>)}</div></div>}
        </form>
        <nav className="mobile-nav"><button className="active"><MessageCircle size={19} />Chats</button><button onClick={() => setSettingsOpen(true)}><CircleUserRound size={19} />Profile</button><button onClick={() => setSettingsOpen(true)}><Settings size={19} />Settings</button></nav>
      </section>
      {settingsOpen && <SettingsDrawer account={account} profile={profile} setProfile={setProfile} dark={dark} setDark={setDark} language={language} onLanguage={onLanguage} onClose={() => setSettingsOpen(false)} onLogout={onLogout} />}
      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)}><aside className="main-menu" onClick={e => e.stopPropagation()}><button className="menu-close" onClick={() => setMenuOpen(false)}><X size={18} /></button><div className="menu-user"><div className="avatar" style={{ background: account.color }}>{account.initials}</div><strong>{account.name}</strong><small>{account.phone}</small></div><button onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}><Settings size={19} />Settings</button><button onClick={() => { setDark(!dark) }}>{dark ? <Sun size={19} /> : <Moon size={19} />}{dark ? 'Switch to light mode' : 'Switch to dark mode'}</button><button onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}><ShieldCheck size={19} />Saved privacy controls</button></aside></div>}
    </div>
  </div>
}

export function SettingsPage({ account, dark, profile, setProfile, onBack, onLogout }: { account: Account; dark: boolean; profile: Profile; setProfile: (p: Profile) => void; onBack: () => void; onLogout: () => void }) {
  const update = (key: keyof Profile, value: string) => setProfile({ ...profile, [key]: value })
  return <main className={`settings-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">STAGE 2 / PROFILE & PRIVACY</div><h1>Your profile</h1><p>Cloud-synced locally in this demo. Privacy defaults apply immediately.</p><div className="profile-card"><img src="/logo.svg" alt="" /><strong>{account.name} <span className="badge">{account.role}</span></strong><small>{account.phone} · {account.email}</small></div><div className="settings-list"><label><strong>Bio</strong><textarea value={profile.bio} onChange={e => update('bio', e.target.value)} placeholder="Tell people about yourself" /></label><label><strong>Discord</strong><input value={profile.discord} onChange={e => update('discord', e.target.value)} placeholder="discord username" /></label><label><strong>GitHub</strong><input value={profile.github} onChange={e => update('github', e.target.value)} placeholder="github username" /></label><label><strong>Who sees your phone</strong><select value={profile.phoneVisibility} onChange={e => update('phoneVisibility', e.target.value)}><option>Everybody</option><option>Contacts</option><option>Nobody</option></select></label><label><strong>Who sees last seen</strong><select value={profile.lastSeen} onChange={e => update('lastSeen', e.target.value)}><option>Everybody</option><option>Contacts</option><option>Nobody</option></select></label><button onClick={() => setProfile({ ...profile, blocked: [...profile.blocked, 'Mark'] })}><span><strong>Block Mark</strong><small>{profile.blocked.includes('Mark') ? 'Blocked' : 'Prevent messages and presence'}</small></span><Lock size={16} /></button></div><button className="danger" onClick={onLogout}>Log out safely</button></article></main>
}

function AdminPage({ account, reports, clearReports, onBack }: { account: Account; reports: string[]; clearReports: () => void; onBack: () => void }) {
  return <main className="settings-page dark"><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">CHEttik operations</div><h1>Moderation console</h1><p>Signed in as {account.role} {account.name}. Local demo data only.</p><div className="admin-grid"><div><ShieldCheck size={22} /><strong>{reports.length}</strong><small>Open reports</small></div><div><Users size={22} /><strong>3</strong><small>Seed accounts</small></div><div><MessageCircle size={22} /><strong>Cloud</strong><small>Chat store</small></div></div><div className="settings-list">{reports.length ? reports.map((r, i) => <button key={`${r}-${i}`}><span><strong>Pending report</strong><small>{r}</small></span><Flag size={16} /></button>) : <div className="empty">No reports yet. Use a message’s flag action to create one.</div>}</div><button className="danger" onClick={clearReports}>Resolve all reports</button></article></main>
}
