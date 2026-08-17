import { ArrowRight, Check, ChevronLeft, CircleUserRound, Flag, Forward, Lock, Menu, MessageCircle, Moon, MoreHorizontal, Paperclip, Pencil, Pin, Plus, QrCode, Search, Send, Settings, ShieldCheck, ShieldAlert, Smile, Sun, Trash2, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import './App.css'
import { SettingsDrawer } from './Stage3Panels'
import { MediaSendSheet, type MediaExpiry, RichComposerSheet, VoiceButton } from './Stage4Panels'
import { ChatContextMenu, ConfirmModal, type ConfirmAction, ForwardPanel, GroupPanel, MessageContextMenu, ProfilePanel } from './InteractionPanels'

export type Account = {
  role: 'SuperAdmin' | 'Admin' | 'User'
  name: string
  username: string
  email: string
  initials: string
  color: string
  badges?: string[]
}

type LegalDoc = 'terms' | 'privacy' | 'authors'

export const seedAccounts: Account[] = [
  { role: 'SuperAdmin', name: 'Nanda', username: '@nanda', email: 'test@test.com', initials: 'N', color: '#9e2338', badges: ['staff', 'early-supporter', 'official', 'crimson-circle'] },
  { role: 'Admin', name: 'Mark', username: '@mark', email: 'test2@test.com', initials: 'M', color: '#6e4c97', badges: ['staff', 'early-supporter', 'ember-house'] },
  { role: 'User', name: 'Alisher', username: '@alisher', email: 'test3@test.com', initials: 'A', color: '#bf8057', badges: ['early-supporter', 'aurora-house'] },
]

type Language = 'EN' | 'RU'
type MessageKind = 'text' | 'voice' | 'poll' | 'location' | 'circle' | 'media' | 'sticker'
type Message = { id: string; sender: string; text: string; time: string; mine: boolean; reactions: string[]; pinned?: boolean; edited?: boolean; replyTo?: string; kind?: MessageKind; pollVotes?: number; voted?: boolean; mediaExpiry?: MediaExpiry; opened?: boolean; stickerUrl?: string }
export type ChatName = string
type ChatMessages = Record<ChatName, Message[]>
export type Audience = 'Everybody' | 'Contacts' | 'Nobody'
export type Profile = {
  bio: string; github: string; discord: string; lastSeen: Audience; blocked: string[]
  privacy?: Record<string, Audience>; privacyExceptions?: Record<string, { always: string[]; never: string[] }>
  passcode?: boolean; biometrics?: boolean; twoStep?: boolean; passkeys?: boolean; loginEmail?: string
  autoDelete?: string; scheduledEnabled?: boolean; timedMedia?: boolean; viewOnce?: boolean; pushEnabled?: boolean; telemetryEnabled?: boolean
}
const API_URL = 'http://127.0.0.1:8787/api'
const sessionKey = (account: Account) => `chettik-api-session-${account.email}`
const credits = {
  ru: { dev: 'Разработчик и основатель: Nanda, Discord: nandak070, Telegram: nanda070', mark: 'Разработчик: Mark, Discord: schizophrenogenic', contact: 'Связь', all: 'Nanda · Email: adnan.huseynli1@gmail.com · Discord: nandak070 · Telegram: nanda070' },
  en: { dev: 'Developer & founder: Nanda, Discord: nandak070, Telegram: nanda070', mark: 'Developer: Mark, Discord: schizophrenogenic', contact: 'Contact', all: 'Nanda · Email: adnan.huseynli1@gmail.com · Discord: nandak070 · Telegram: nanda070' },
}
const initialMessages = (name: string): Message[] => [
  { id: 'm1', sender: 'Mark', text: 'I tried the new onboarding flow. It feels really calm.', time: '10:38', mine: false, reactions: ['❤️'] },
  { id: 'm2', sender: name, text: 'That was the idea. Less noise, more space for people.', time: '10:40', mine: true, reactions: [] },
  { id: 'm3', sender: 'Mark', text: 'That reads much better. And the dark red feels like a real signature.', time: '10:42', mine: false, reactions: [], pinned: true },
]
const initialChatMessages = (account: Account): ChatMessages => ({
  Mark: initialMessages(account.name),
  'Design circle': [],
  'Saved Messages': [{ id: 'saved-1', sender: account.name, text: 'Remember to write this down.', time: 'Mon', mine: true, reactions: [] }],
  Alisher: [],
})
export default function Chettik() {
  const [dark, setDark] = useState(true)
  const [language, setLanguage] = useState<Language>('EN')
  const [picked, setPicked] = useState<Account | null>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpChallengeId, setOtpChallengeId] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [session, setSession] = useState<Account | null>(null)
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const [desktopLogin, setDesktopLogin] = useState<'qr' | 'email' | 'settings' | 'passkey'>('qr')
  const ru = language === 'RU'
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined) }, [])
  const tr = ru ? { invalid: 'Введите корректный email.', code: 'Код отправлен на email.', legal: ['Условия', 'Конфиденциальность', 'Авторы'] } : { invalid: 'Enter a valid email address.', code: 'A verification code was sent to your email.', legal: ['Terms', 'Privacy', 'Authors'] }
  const copy = ru
    ? { title: 'Тише. Ближе. По-своему.', subtitle: 'Приватность — по умолчанию. Знакомый интерфейс.', pick: 'Выберите аккаунт', email: 'или введите email', continue: 'Продолжить', secure: 'Вход защищён одноразовым кодом, отправленным на email.', code: 'Введите код из 6 цифр', verify: 'Подтвердить и войти', back: 'Назад' }
    : { title: 'A quieter place to be close.', subtitle: 'Private by instinct. Familiar by design.', pick: 'Choose an account', email: 'or enter your email address', continue: 'Continue', secure: 'Sign in is protected by a one-time code delivered to your email.', code: 'Enter the 6-digit code', verify: 'Verify & enter', back: 'Back' }

  const beginOtp = async (targetEmail: string, fallback?: Account) => {
    const normalizedEmail = targetEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setAuthNotice(tr.invalid)
    setAuthNotice('')
    const response = await fetch(`${API_URL}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalizedEmail }) })
    const payload = await response.json() as { challengeId?: string; error?: string }
    if (!response.ok || !payload.challengeId) return setAuthNotice(payload.error || tr.invalid)
    setEmail(normalizedEmail)
    setOtp('')
    setOtpChallengeId(payload.challengeId)
    setPicked(fallback || seedAccounts.find(account => account.email === normalizedEmail) || { ...seedAccounts[2], email: normalizedEmail, name: 'New user', username: '@new' })
  }
  const requestOtp = () => { void beginOtp(email) }
  const verifyOtp = async () => {
    if (!picked || !otpChallengeId) return setAuthNotice(tr.code)
    const response = await fetch(`${API_URL}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: picked.email, code: otp, challengeId: otpChallengeId, deviceLabel: 'Web • Browser' }) })
    const payload = await response.json() as { token?: string; user?: Account; error?: string }
    if (!response.ok || !payload.token || !payload.user) return setAuthNotice(payload.error || tr.code)
    localStorage.setItem(sessionKey(payload.user), payload.token)
    setAuthNotice('')
    setSession(payload.user)
  }
  if (legal) return <LegalPage doc={legal} language={language} dark={dark} onBack={() => setLegal(null)} />
  if (session) return <Messenger account={session} dark={dark} setDark={setDark} language={language} onLanguage={() => setLanguage(ru ? 'EN' : 'RU')} onLogout={() => { localStorage.removeItem(sessionKey(session)); setSession(null) }} />
  return <main className={`auth-screen ${dark ? 'dark' : ''}`}>
    <section className="desktop-login"><header><button aria-label="Back" onClick={() => setDesktopLogin('qr')}><ChevronLeft size={20} /></button><button onClick={() => setDesktopLogin('settings')}>SETTINGS</button></header>{desktopLogin === 'settings' ? <div className="desktop-login-card"><img src="/logo.svg" alt="" /><h1>{ru ? 'Настройки входа' : 'Login settings'}</h1><p>{ru ? 'Язык и тема сохраняются локально на этом устройстве.' : 'Language and appearance are stored only on this device.'}</p><button className="desktop-outline" onClick={() => setLanguage(ru ? 'EN' : 'RU')}>{language === 'RU' ? 'English' : 'Русский'}</button><button className="desktop-outline" onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button></div> : desktopLogin === 'passkey' ? <div className="desktop-login-card"><div className="desktop-passkey">⌁</div><h1>{ru ? 'Войти с ключом доступа' : 'Log in with a passkey'}</h1><p>{ru ? 'Ключи доступа настраиваются после входа. Используйте QR или email.' : 'Passkeys are configured after sign-in in this local environment. Use QR or your email address.'}</p><button className="desktop-primary" onClick={() => setDesktopLogin('qr')}>{ru ? 'К QR-коду' : 'Back to QR'}</button></div> : desktopLogin === 'email' ? <div className="desktop-login-card email-login">{!picked ? <><h1>{ru ? 'Ваш email' : 'Your email address'}</h1><p>{ru ? 'Мы отправим одноразовый код для входа.' : 'We will send a one-time sign-in code.'}</p><form onSubmit={e => { e.preventDefault(); requestOtp() }}><input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email address" type="email" required /><button className="desktop-primary" type="submit">{ru ? 'Далее' : 'Next'}</button></form><button className="desktop-link" onClick={() => setDesktopLogin('qr')}>{ru ? 'Вход через QR' : 'Sign in with QR'}</button><div className="seed-login">{seedAccounts.map(item => <button key={item.email} onClick={() => void beginOtp(item.email, item)}>{item.name}</button>)}</div>{authNotice && <p className="form-notice">{authNotice}</p>}</> : <><div className="avatar" style={{ background: picked.color }}>{picked.initials}</div><h1>{ru ? 'Подтвердите вход' : 'Confirm sign in'}</h1><p>{picked.email} · {tr.code}</p><form onSubmit={e => { e.preventDefault(); void verifyOtp() }}><input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Desktop OTP" placeholder="••••••" autoFocus /><button className="desktop-primary">{ru ? 'Войти' : 'Sign in'}</button></form><button className="desktop-link" onClick={() => { setPicked(null); setOtp(''); setOtpChallengeId('') }}>{ru ? 'Изменить email' : 'Change email'}</button>{authNotice && <p className="form-notice">{authNotice}</p>}</>}</div> : <div className="desktop-login-card qr-login"><div className="desktop-qr"><QrCode size={154} strokeWidth={1.25} /><img src="/logo.svg" alt="Chettik" /></div><h1>{ru ? 'Сканируйте в мобильном Chettik' : 'Scan From Mobile Chettik'}</h1><ol><li>{ru ? 'Откройте Chettik на устройстве с активной сессией' : 'Open Chettik on a signed-in device'}</li><li>{ru ? 'Настройки → Устройства → Добавить устройство' : 'Go to Settings → Devices → Add Device'}</li><li>{ru ? 'Сканируйте код для входа' : 'Scan this code to log in'}</li></ol><button className="desktop-link" onClick={() => setDesktopLogin('email')}>{ru ? 'Войти по email' : 'Log in using email'}</button><button className="desktop-link" onClick={() => setDesktopLogin('passkey')}>{ru ? 'Войти с ключом доступа' : 'Log in using passkey'}</button><button className="qr-demo" onClick={() => { setDesktopLogin('email'); void beginOtp(seedAccounts[0].email, seedAccounts[0]) }}>{ru ? 'Отправить код Nanda' : 'Send Nanda sign-in code'}</button></div>}</section>
    <div className="auth-ambient one" /><div className="auth-ambient two" />
    <header className="auth-header">
      <div className="auth-logo"><img src="/logo.svg" alt="" /> chettik</div>
      <div className="auth-controls"><button onClick={() => setLanguage(ru ? 'EN' : 'RU')}>{language}</button><button aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    </header>
    <section className="auth-layout">
      <div className="auth-intro"><div className="eyebrow"><ShieldCheck size={15} /> PRIVATE MESSENGER</div><h1>{copy.title}</h1><p>{copy.subtitle}</p><div className="auth-note"><Check size={16} /> {copy.secure}</div></div>
      <div className="auth-card">
        {!picked && <><div className="card-kicker">{copy.pick}</div><div className="account-options">{seedAccounts.map(account => <button className="account-option" key={account.email} onClick={() => void beginOtp(account.email, account)}><div className="avatar" style={{ background: account.color }}>{account.initials}</div><span><strong>{account.name}</strong><small>{account.username} · {account.role}</small></span><ArrowRight size={17} /></button>)}</div><div className="divider"><span>{copy.email}</span></div><form onSubmit={(e) => { e.preventDefault(); requestOtp() }}><input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email address" type="email" required /><button className="primary" type="submit">{copy.continue} <ArrowRight size={16} /></button></form>{authNotice && <p className="form-notice" role="alert">{authNotice}</p>}</>}
        {picked && <><button className="back" onClick={() => { setPicked(null); setOtp(''); setOtpChallengeId(''); setAuthNotice('') }}><ChevronLeft size={16} /> {copy.back}</button><div className="code-user"><div className="avatar" style={{ background: picked.color }}>{picked.initials}</div><strong>{picked.name}</strong><span>{picked.email}</span></div><p className="code-copy">{copy.code}</p><form onSubmit={(e) => { e.preventDefault(); void verifyOtp() }}><input className="otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" autoFocus required /><button className="primary" type="submit">{copy.verify} <ArrowRight size={16} /></button></form><small className="demo-hint">{tr.code}</small>{authNotice && <p className="form-notice" role="alert">{authNotice}</p>}</>}
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
type ChatRow = { id: string; name: ChatName; preview: string; time: string; initials: string; color: string; unread: number; secret?: boolean }
const fallbackChats: ChatRow[] = [
  { id: 'nanda-mark', name: 'Mark', preview: 'That reads much better.', time: '10:42', initials: 'M', color: '#6e4c97', unread: 2 },
  { id: 'design-circle', name: 'Design circle', preview: 'Nanda: I shared the new motion study ✨', time: '09:30', initials: 'D', color: '#4c8a83', unread: 0 },
  { id: 'saved-nanda', name: 'Saved Messages', preview: 'You: Remember to write this down.', time: 'Mon', initials: 'S', color: '#9e2338', unread: 0 },
  { id: 'nanda-alisher', name: 'Alisher', preview: 'See you after work!', time: 'Sun', initials: 'A', color: '#bf8057', unread: 0 },
]

function Messenger({ account, dark, setDark, language, onLanguage, onLogout }: MessengerProps) {
  const [message, setMessage] = useState('')
  const [page, setPage] = useState<'chat' | 'settings' | 'admin'>('chat')
  const [selectedChat, setSelectedChat] = useState<ChatName>('Mark')
  const [chatMessages, setChatMessages] = useState<ChatMessages>(() => initialChatMessages(account))
  const [profile, setProfile] = useState<Profile>(() => ({ bio: '', github: '', discord: '', lastSeen: 'Contacts', blocked: [], privacy: { lastSeen: 'Contacts', photo: 'Everybody', bio: 'Everybody', birthday: 'Contacts', forwards: 'Everybody', voice: 'Contacts', messages: 'Everybody' }, privacyExceptions: {}, autoDelete: '6 months', pushEnabled: false, telemetryEnabled: false }))
  const [reports, setReports] = useState<string[]>([])
  const [chatRows, setChatRows] = useState<ChatRow[]>(fallbackChats)
  const [token, setToken] = useState('')
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stickers' | 'gifs'>('emoji')
  const [stickers, setStickers] = useState<Array<{ id: string; name: string; data_url: string; mime_type: string }>>([])
  const [stickerPackId, setStickerPackId] = useState('chettik-starters')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [richOpen, setRichOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingMode, setRecordingMode] = useState<'voice' | 'circle'>('voice')
  const [storyOpen, setStoryOpen] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [profileAccount, setProfileAccount] = useState<Account>(seedAccounts[1])
  const [confirm, setConfirm] = useState<{ action: ConfirmAction; message?: Message } | null>(null)
  const [chatMenu, setChatMenu] = useState(false)
  const [messageMenu, setMessageMenu] = useState<Message | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
  const [chatPinned, setChatPinned] = useState(false)
  const [chatMuted, setChatMuted] = useState(false)
  const [chatUnread, setChatUnread] = useState(false)
  const [menuStub, setMenuStub] = useState<string | null>(null)
  const [chatListWidth, setChatListWidth] = useState(() => Number(localStorage.getItem('chettik-chat-list-width')) || 300)
  const fileInput = useRef<HTMLInputElement>(null)
  const stickerInput = useRef<HTMLInputElement>(null)
  const messages = chatMessages[selectedChat]
  const logout = () => {
    if (token) void fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    onLogout()
  }
  const setMessages = (update: Message[] | ((current: Message[]) => Message[])) => setChatMessages(current => ({
    ...current,
    [selectedChat]: typeof update === 'function' ? update(current[selectedChat]) : update,
  }))
  const openChat = (chat: ChatName) => {
    setSelectedChat(chat)
    setMessage('')
    setReply(null)
    setEditing(null)
    setChatMenu(false)
  }
  const startSecretChat = (target: Account = seedAccounts[1]) => {
    const name = `Secret chat · ${target.name}`
    const secret = { id: `secret-${target.email}`, name, preview: 'End-to-end on this device', time: '', initials: target.initials, color: target.color, unread: 0, secret: true }
    setChatRows(current => current.some(chat => chat.id === secret.id) ? current : [secret, ...current])
    setChatMessages(current => current[name] ? current : ({ ...current, [name]: [] }))
    localStorage.setItem(`chettik-secret-chat-${account.email}-${target.email}`, JSON.stringify({ createdAt: new Date().toISOString(), deviceOnly: true }))
    openChat(name)
    setProfileOpen(false)
  }
  const addToChat = (chat: ChatName, item: Message) => setChatMessages(current => ({ ...current, [chat]: [...current[chat], item] }))
  useEffect(() => {
    let disposed = false
    const connect = async () => {
      let apiToken = localStorage.getItem(sessionKey(account))
      if (!apiToken) return
      setToken(apiToken)
      const headers = { Authorization: `Bearer ${apiToken}` }
      const [profileResponse, chatsResponse] = await Promise.all([fetch(`${API_URL}/me/profile`, { headers }), fetch(`${API_URL}/chats`, { headers })])
      if (!profileResponse.ok || !chatsResponse.ok || disposed) return
      const remoteProfile = await profileResponse.json() as Profile
      const remoteChats = await chatsResponse.json() as Array<{ id: string; title: ChatName; preview: string; last_message_at: string | null }>
      setProfile(current => ({ ...current, ...remoteProfile, privacy: { ...current.privacy, ...remoteProfile.privacy }, lastSeen: remoteProfile.privacy?.lastSeen || current.lastSeen }))
      const rows = remoteChats.map(item => {
        const fallback = fallbackChats.find(chat => chat.name === item.title)
        return { ...(fallback || fallbackChats[0]), id: item.id, name: item.title, preview: item.preview || fallback?.preview || '', time: item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '', unread: 0 }
      })
      setChatRows(rows)
      const packsResponse = await fetch(`${API_URL}/sticker-packs`, { headers })
      const packs = packsResponse.ok ? await packsResponse.json() as Array<{ id: string }> : []
      const packId = packs[0]?.id || 'chettik-starters'
      setStickerPackId(packId)
      const stickersResponse = await fetch(`${API_URL}/sticker-packs/${packId}/stickers`, { headers })
      if (stickersResponse.ok) setStickers(await stickersResponse.json())
      const entries = await Promise.all(rows.map(async row => [row.name, await (await fetch(`${API_URL}/chats/${row.id}/messages`, { headers })).json()] as const))
      if (disposed) return
      setChatMessages(current => ({
        ...current,
        ...Object.fromEntries(entries.map(([name, remote]) => {
          const loaded = (remote as Array<{ id: string; sender_name: string; text: string; kind: MessageKind; metadata_json: string; created_at: string }>).map(item => {
            const metadata = JSON.parse(item.metadata_json || '{}') as { mediaExpiry?: MediaExpiry; stickerUrl?: string }
            return { id: item.id, sender: item.sender_name, text: item.text, time: new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mine: item.sender_name === account.name, reactions: [], kind: item.kind === 'text' ? undefined : item.kind, mediaExpiry: metadata.mediaExpiry, stickerUrl: metadata.stickerUrl }
          })
          return [name, loaded]
        })),
      }))
    }
    connect().catch(() => undefined)
    return () => { disposed = true }
  }, [account])
  useEffect(() => {
    const socket = new WebSocket('ws://127.0.0.1:8787/api/ws')
    socket.onmessage = event => {
      const payload = JSON.parse(event.data) as { type: string; message?: { id: string; chat_id: string; sender_name?: string; text?: string; kind?: MessageKind; created_at?: string } }
      const chat = chatRows.find(row => row.id === payload.message?.chat_id)
      if (!payload.message || !chat) return
      const item = payload.message
      if (payload.type === 'message.updated') { setChatMessages(current => ({ ...current, [chat.name]: current[chat.name].map(message => message.id === item.id ? { ...message, text: item.text || message.text, edited: true } : message) })); return }
      if (payload.type === 'message.deleted') { setChatMessages(current => ({ ...current, [chat.name]: current[chat.name].filter(message => message.id !== item.id) })); return }
      setChatMessages(current => current[chat.name].some(message => message.id === item.id) ? current : ({ ...current, [chat.name]: [...current[chat.name], { id: item.id, sender: item.sender_name || '', text: item.text || '', time: new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mine: item.sender_name === account.name, reactions: [], kind: item.kind === 'text' ? undefined : item.kind }] }))
    }
    return () => socket.close()
  }, [account, chatRows])
  useEffect(() => {
    if (!token) return
    const timeout = window.setTimeout(() => {
      fetch(`${API_URL}/me/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ bio: profile.bio, github: profile.github, discord: profile.discord, privacy: profile.privacy }) }).catch(() => undefined)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [profile, token])
  useEffect(() => {
    if (!token || !profileOpen) return
    fetch(`${API_URL}/users/${profileAccount.username.slice(1)}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.json() : undefined)
      .catch(() => undefined)
  }, [profileAccount, profileOpen, token])
  useEffect(() => { const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setMenuStub(null); setMessageMenu(null); setChatMenu(false); setEmojiOpen(false) } }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [])
  useEffect(() => {
    const sidebar = document.querySelector<HTMLElement>('.sidebar')
    if (!sidebar) return
    sidebar.style.width = `${Math.max(240, Math.min(420, chatListWidth))}px`
    const observer = new ResizeObserver(() => {
      const width = Math.round(sidebar.getBoundingClientRect().width)
      if (width >= 240 && width <= 420) {
        localStorage.setItem('chettik-chat-list-width', String(width))
        setChatListWidth(width)
      }
    })
    observer.observe(sidebar)
    return () => observer.disconnect()
  }, [chatListWidth])
  const addRich = (kind: MessageKind) => {
    const text = kind === 'poll' ? 'Team sync at 15:00?' : kind === 'location' ? 'Moscow Avenue · precise location' : 'A quiet moment from the studio'
    void deliver(text, kind)
  }
  const startRecording = () => setRecording(true)
  const stopRecording = () => {
    if (!recording) return
    const kind = recordingMode === 'voice' ? 'voice' : 'circle'
    void deliver(kind === 'voice' ? '0:08' : 'A quiet moment from the studio', kind)
    setRecording(false)
  }
  const confirmAction = () => {
    if (!confirm) return
    if (confirm.action === 'report' && confirm.message) { void fetch(`${API_URL}/messages/${confirm.message.id}/reports`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); setReports(old => [...old, `Report: ${confirm.message?.text}`]) }
    if (confirm.action === 'block') { void fetch(`${API_URL}/users/mark/block`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); setProfile({ ...profile, blocked: profile.blocked.includes('Mark') ? profile.blocked : [...profile.blocked, 'Mark'] }) }
    if (confirm.action === 'delete-message' && confirm.message) void deleteMessage(confirm.message.id)
    if (confirm.action === 'clear-history') setMessages([])
    if (confirm.action === 'delete-chat') setMessages([])
    setConfirm(null)
  }
  const handleChatMenu = (action: string) => {
    if (action === 'pin') setChatPinned(value => !value)
    else if (action === 'mute') setChatMuted(value => !value)
    else if (action === 'unread') setChatUnread(true)
    else if (action === 'secret') startSecretChat()
    else if (action === 'clear-history' || action === 'delete-chat') setConfirm({ action })
    setChatMenu(false)
  }
  const handleMessageMenu = (action: string) => {
    const selected = messageMenu
    if (!selected) return
    if (action === 'reply') setReply(selected)
    else if (action === 'edit' && selected.mine) { setEditing(selected); setMessage(selected.text) }
    else if (action === 'pin') setMessages(old => old.map(item => item.id === selected.id ? { ...item, pinned: !item.pinned } : item))
    else if (action === 'copy') navigator.clipboard?.writeText(selected.text).catch(() => undefined)
    else if (action === 'forward') setForwardMessage(selected)
    else if (action === 'delete-message') setConfirm({ action: 'delete-message', message: selected })
    else if (action.startsWith('react-')) setMessages(old => old.map(item => item.id === selected.id ? { ...item, reactions: [...item.reactions, action.slice(6)] } : item))
    setMessageMenu(null)
  }
  const deliver = async (rawText: string, kind: MessageKind = 'text', mediaExpiry?: MediaExpiry, stickerUrl?: string, attachmentId?: string) => {
    const text = rawText.trim()
    if (!text || text.length > 4000) return
    const chat = chatRows.find(row => row.name === selectedChat)
    if (!chat) return
    if (chat.secret) {
      setMessages(old => [...old, { id: crypto.randomUUID(), mine: true, sender: account.name, text, time: 'now', reactions: [], kind, mediaExpiry, stickerUrl }])
      return
    }
    if (!token) return
    const response = await fetch(`${API_URL}/chats/${chat.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text, kind, metadata: { ...(mediaExpiry ? { mediaExpiry } : {}), ...(stickerUrl ? { stickerUrl } : {}), ...(attachmentId ? { attachmentId } : {}) } }) })
    const remote = await response.json() as { id: string; created_at: string }
    if (!response.ok) return
    setMessages(old => old.some(item => item.id === remote.id) ? old : [...old, { id: remote.id, mine: true, sender: account.name, text, time: new Date(remote.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reactions: [], replyTo: reply?.text, kind: kind === 'text' ? undefined : kind, mediaExpiry, stickerUrl }])
  }
  const send = async () => {
    const text = message.trim()
    if (editing) {
      const response = await fetch(`${API_URL}/messages/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) })
      if (response.ok) setMessages(old => old.map(item => item.id === editing.id ? { ...item, text, edited: true } : item))
    }
    else await deliver(text)
    setMessage('')
    setReply(null)
    setEditing(null)
  }
  const attach = (file?: File) => { if (!file) return; if (file.type.startsWith('image/') || file.type.startsWith('video/')) setMediaFile(file); else void deliver(`📎 ${file.name} · ${Math.ceil(file.size / 1024)} KB`) }
  const uploadSticker = async (file?: File) => {
    if (!file || !['image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1_000_000 || !token) return
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
    let packId = stickerPackId
    if (packId === 'chettik-starters') {
      const created = await fetch(`${API_URL}/sticker-packs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: 'My stickers', author: account.name, visibility: 'private' }) })
      if (!created.ok) return
      packId = (await created.json() as { id: string }).id
      setStickerPackId(packId)
    }
    const response = await fetch(`${API_URL}/sticker-packs/${packId}/stickers`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: file.name, mimeType: file.type, dataUrl }) })
    if (response.ok) { const sticker = await response.json() as { id: string; name: string; data_url: string; mime_type: string }; setStickers(current => [...current, sticker]) }
  }
  const deleteMessage = async (id: string) => {
    const response = await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    if (response.ok) setMessages(old => old.filter(message => message.id !== id))
  }
  const matches = messages.filter(m => m.text.toLowerCase().includes(search.toLowerCase()))
  if (page === 'admin') return <AdminPage account={account} reports={reports} clearReports={() => setReports([])} onBack={() => setPage('chat')} />
  return <div className={`app ${dark ? 'dark' : ''}`}>
    <div className="app-shell">
      <nav className="rail"><img className="mark" src="/logo.svg" alt="Chettik" /><button className="rail-btn active" aria-label="Open main menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><button className="rail-btn" aria-label="Open saved messages" onClick={() => openChat('Saved Messages')}><Pin size={19} /></button><div className="rail-spacer" />{account.role !== 'User' && <button className="rail-btn" title="Operations console" onClick={() => setPage('admin')}><ShieldAlert size={19} /></button>}<button className="avatar me" aria-label="Open my profile" title={account.name} onClick={() => { setProfileAccount(account); setProfileOpen(true) }}>{account.initials}</button></nav>
      <aside className="sidebar"><div className="side-top"><div className="wordmark"><img src="/logo.svg" alt="" />chett<span>i</span>k</div><button className="icon-btn" aria-label="New chat"><MessageCircle size={19} /></button></div><label className="search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={language === 'RU' ? 'Поиск сообщений' : 'Search messages'} /></label><div className="stories" aria-label={language === 'RU' ? 'Истории' : 'Stories'}>{[{ name: 'Mark', initials: 'M', color: '#6e4c97' }, { name: 'Nanda', initials: 'N', color: '#9e2338' }, { name: 'Alisher', initials: 'A', color: '#bf8057' }].map(story => <button className="story" key={story.name} onClick={() => setStoryOpen(story.name)}><span className="avatar" style={{ background: story.color }}>{story.initials}</span><span>{story.name}</span></button>)}</div><div className="list-title">Cloud chats · {matches.length} matches</div><div className="chat-list">{chatRows.map(chat => <button onClick={() => openChat(chat.name)} onContextMenu={event => { if (chat.name === 'Mark') { event.preventDefault(); setChatMenu(true) } }} className={`chat-row ${selectedChat === chat.name ? 'active' : ''}`} key={chat.id}><div className="avatar" style={{ background: chat.color }}>{chat.initials}</div><div className="chat-copy"><div className="chat-name">{chat.name}{chat.name === 'Mark' && chatPinned ? <Pin size={11} /> : null}<span className="time">{chat.time}</span></div><div className="chat-preview">{chatMuted && chat.name === 'Mark' ? 'Muted' : chat.preview}</div></div>{(chat.unread || (chat.name === 'Mark' && chatUnread)) ? <span className="unread">{chat.name === 'Mark' && chatUnread ? 1 : chat.unread}</span> : null}</button>)}</div>{chatMenu && <ChatContextMenu name="Mark" pinned={chatPinned} muted={chatMuted} onAction={handleChatMenu} />}</aside>
      <section className="chat">
        <header className="chat-head"><button className="icon-btn mobile-menu" aria-label="Open main menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>{selectedChat === 'Mark' ? <><button className="icon-btn profile-open" aria-label="Open Mark profile" onClick={() => { setProfileAccount(seedAccounts[1]); setProfileOpen(true) }}><div className="avatar" style={{ background: '#6e4c97' }}>M</div></button><button className="chat-person profile-open" aria-label="Open Mark profile" onClick={() => { setProfileAccount(seedAccounts[1]); setProfileOpen(true) }}><strong>Mark <span className="badge">ADMIN</span></strong><span>online · cloud chat</span></button></> : <><div className="avatar" style={{ background: selectedChat === 'Saved Messages' ? account.color : chatRows.find(chat => chat.name === selectedChat)?.color }}>{selectedChat === 'Saved Messages' ? account.initials : selectedChat[0]}</div><button className="chat-person profile-open" onClick={() => selectedChat === 'Design circle' && setGroupOpen(true)}><strong>{selectedChat}</strong><span>{selectedChat === 'Saved Messages' ? 'Messages saved for yourself' : selectedChat === 'Design circle' ? '3 members · group chat' : 'cloud chat'}</span></button></>}<div className="head-actions">{selectedChat === 'Design circle' && <button className="icon-btn" aria-label="Open group menu" onClick={() => setGroupMenuOpen(true)}><MoreHorizontal size={19} /></button>}<button className="icon-btn" title="Switch language" onClick={onLanguage}>{language}</button><button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>
        <div className="mobile-stories stories" aria-label={language === 'RU' ? 'Истории' : 'Stories'}>{[{ name: 'Mark', initials: 'M', color: '#6e4c97' }, { name: 'Nanda', initials: 'N', color: '#9e2338' }, { name: 'Alisher', initials: 'A', color: '#bf8057' }].map(story => <button className="story" key={story.name} onClick={() => setStoryOpen(story.name)}><span className="avatar" style={{ background: story.color }}>{story.initials}</span><span>{story.name}</span></button>)}</div>
        <div className="messages" aria-live="polite"><div className="date">{language === 'RU' ? 'Сегодня' : 'Today'}</div>{matches.map(item => <div onContextMenu={event => { event.preventDefault(); setMessageMenu(item) }} className={`message ${item.mine ? 'mine' : ''}`} key={item.id}><div className="avatar" style={{ background: item.mine ? account.color : '#6e4c97' }}>{item.mine ? account.initials : 'M'}</div><div className={`bubble ${item.kind ? `bubble-${item.kind}` : ''}`}>{item.replyTo && <small className="reply-ref">↳ {item.replyTo}</small>}{item.kind !== 'sticker' && <span className="sender">{item.sender}</span>}{item.kind === 'sticker' ? <img className="sticker-message" src={item.stickerUrl} alt={item.text} /> : item.kind === 'voice' ? <div className="voice-message"><span className="voice-wave">▁▃▆▇▅▇▃▂</span><strong>{item.text}</strong></div> : item.kind === 'circle' ? <div className="circle-message"><span>▶</span><small>{item.text}</small></div> : item.kind === 'media' ? <button className="timed-media" aria-label="Open timed media" onClick={() => { if (item.mediaExpiry === 'once') setMessages(old => old.filter(message => message.id !== item.id)); else if (item.mediaExpiry && item.mediaExpiry !== 'never') { setMessages(old => old.map(message => message.id === item.id ? { ...message, opened: true } : message)); window.setTimeout(() => setMessages(old => old.filter(message => message.id !== item.id)), Number(item.mediaExpiry) * 1000) } }}><span>▧</span><strong>{item.opened ? 'Media opened' : item.text}</strong><small>{item.mediaExpiry === 'once' ? '1 · View once' : item.mediaExpiry === 'never' || !item.mediaExpiry ? 'Saved media' : `${item.mediaExpiry}s · tap to view`}</small></button> : item.kind === 'location' ? <div className="location-message"><span>⌖</span><strong>{item.text}</strong><small>Private chat location</small></div> : item.kind === 'poll' ? <div className="poll-message"><strong>{item.text}</strong><button onClick={() => setMessages(old => old.map(m => m.id === item.id ? { ...m, voted: !m.voted, pollVotes: (m.pollVotes || 0) + (m.voted ? -1 : 1) } : m))}>{item.voted ? '✓ Yes, works for me' : 'Yes, works for me'} <em>{item.pollVotes || 0}</em></button><button onClick={() => setMessages(old => old.map(m => m.id === item.id ? { ...m, voted: !m.voted } : m))}>Need another time</button><small>{item.pollVotes || 0} votes · public in this chat</small></div> : item.text}<div className="message-tools" /><span className="meta">{item.time} {item.mine ? '✓✓' : ''}</span></div></div>)}</div>
        <form className={`compose ${editing ? 'editing' : ''}`} onSubmit={(e) => { e.preventDefault(); send() }}>
          {(reply || editing) && <div className="compose-context"><Pencil size={17} /><span><strong>{editing ? 'Edit message' : 'Replying to Mark'}</strong><small>{(editing || reply)?.text.slice(0, 72)}</small></span><button type="button" onClick={() => { setEditing(null); setReply(null); setMessage('') }}><X size={17} /></button></div>}
          <input ref={fileInput} type="file" hidden onChange={e => { attach(e.target.files?.[0]); e.currentTarget.value = '' }} /><input ref={stickerInput} type="file" hidden accept="image/png,image/webp,image/gif" onChange={e => { void uploadSticker(e.target.files?.[0]); e.currentTarget.value = '' }} /><button className="icon-btn" type="button" title="Attach file" onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><button className="icon-btn rich-trigger" type="button" aria-label="Open rich message tools" onClick={() => setRichOpen(true)}><Plus size={19} /></button><input aria-label="Message text" maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder={language === 'RU' ? 'Написать сообщение…' : 'Write a message…'} /><button className="icon-btn" type="button" aria-label="Open emoji picker" onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={19} /></button>{!message && !editing ? <VoiceButton mode={recordingMode} active={recording} onModeToggle={() => setRecordingMode(mode => mode === 'voice' ? 'circle' : 'voice')} onStart={startRecording} onStop={stopRecording} /> : <button className="send" aria-label={editing ? 'Save message' : 'Send message'}>{editing ? <Check size={18} /> : <Send size={17} />}</button>}
          {emojiOpen && <div className="emoji-picker"><div className="emoji-tabs"><button className={pickerTab === 'emoji' ? 'active' : ''} onClick={() => setPickerTab('emoji')}>Emoji</button><button className={pickerTab === 'stickers' ? 'active' : ''} onClick={() => setPickerTab('stickers')}>Stickers</button><button className={pickerTab === 'gifs' ? 'active' : ''} onClick={() => setPickerTab('gifs')}>GIFs</button></div>{pickerTab === 'emoji' ? <><input aria-label="Search emoji" placeholder="Search emoji" readOnly /><div className="emoji-grid">{['😀','😂','🥰','😍','😎','🤝','❤️','🔥','✨','👍','🙏','🎉','💬','🌙','🚀','🍒','✅','🤍','🤔','👏','🎈','💯','🫶','😌'].map(emoji => <button key={emoji} type="button" onClick={() => { setMessage(m => `${m}${emoji}`); setEmojiOpen(false) }}>{emoji}</button>)}</div></> : pickerTab === 'stickers' ? <div className="sticker-picker"><button className="sticker-upload" type="button" onClick={() => stickerInput.current?.click()}>+ Add PNG, WebP or GIF</button><div className="sticker-grid">{stickers.map(sticker => <button key={sticker.id} type="button" aria-label={`Send ${sticker.name}`} onClick={() => { void deliver(sticker.name, 'sticker', undefined, sticker.data_url); setEmojiOpen(false) }}><img src={sticker.data_url} alt={sticker.name} /></button>)}</div></div> : <p className="picker-empty">GIF search is coming soon.</p>}</div>}
        </form>
        <nav className="mobile-nav"><button className="active"><MessageCircle size={19} />Chats</button><button onClick={() => setSettingsOpen(true)}><CircleUserRound size={19} />Profile</button><button onClick={() => setSettingsOpen(true)}><Settings size={19} />Settings</button></nav>
      </section>
      {settingsOpen && <SettingsDrawer account={account} profile={profile} setProfile={setProfile} token={token} dark={dark} setDark={setDark} language={language} onLanguage={onLanguage} onClose={() => setSettingsOpen(false)} onLogout={logout} />}
      {richOpen && <RichComposerSheet language={language} onClose={() => setRichOpen(false)} onSend={addRich} />}
      {mediaFile && <MediaSendSheet file={mediaFile} language={language} onClose={() => setMediaFile(null)} onSend={mode => { void (async () => { const file = mediaFile; const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) }); const upload = await fetch(`${API_URL}/attachments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: file.name, mimeType: file.type, dataUrl }) }); if (upload.ok) { const attachment = await upload.json() as { id: string }; await deliver(`📷 ${file.name}`, 'media', mode, undefined, attachment.id) }; setMediaFile(null) })() }} />}
      {storyOpen && <div className="story-overlay" role="dialog" aria-modal="true" aria-label={`${storyOpen} story`} onClick={() => setStoryOpen(null)}><div className="story-card" onClick={e => e.stopPropagation()}><button aria-label="Close story" onClick={() => setStoryOpen(null)}><X size={19} /></button><div className="story-progress"><i /></div><div className="story-copy"><span className="avatar" style={{ background: storyOpen === 'Mark' ? '#6e4c97' : storyOpen === 'Nanda' ? '#9e2338' : '#bf8057' }}>{storyOpen[0]}</span><strong>{storyOpen}</strong><small>{language === 'RU' ? 'только что' : 'just now'}</small></div><p>{language === 'RU' ? 'Немного тишины между важными делами.' : 'A little quiet between important things.'}</p><small className="story-privacy"><ShieldCheck size={14} />{language === 'RU' ? 'История исчезнет через 24 часа' : 'This story disappears in 24 hours'}</small></div></div>}
      {profileOpen && <ProfilePanel account={profileAccount} onClose={() => setProfileOpen(false)} onStartSecret={() => startSecretChat(profileAccount)} onBlock={() => { setProfileOpen(false); setConfirm({ action: 'block' }) }} />}
      {groupOpen && <GroupPanel token={token} chats={chatRows.map(chat => ({ id: chat.id, name: chat.name }))} onClose={() => setGroupOpen(false)} />}
      {groupMenuOpen && <div className="floating-dismiss" onClick={() => setGroupMenuOpen(false)}><div className="context-menu group-header-menu" onClick={event => event.stopPropagation()}><button onClick={() => setChatMuted(!chatMuted)}><Smile size={16} />{chatMuted ? 'Unmute' : 'Mute'}</button><button onClick={() => { setGroupMenuOpen(false); setGroupOpen(true) }}><Users size={16} />View group info</button><button onClick={() => { setGroupMenuOpen(false); setGroupOpen(true) }}><Pencil size={16} />Manage group</button><button onClick={() => { setGroupMenuOpen(false); addRich('poll') }}><Plus size={16} />Create poll</button><button onClick={() => setGroupMenuOpen(false)}><Forward size={16} />Export chat history</button><button onClick={() => { setGroupMenuOpen(false); setConfirm({ action: 'clear-history' }) }}><Trash2 size={16} />Clear history</button><button className="danger-item" onClick={() => { setGroupMenuOpen(false); setConfirm({ action: 'delete-chat' }) }}><Trash2 size={16} />Delete and leave</button></div></div>}
      {confirm && <ConfirmModal action={confirm.action} name="Mark" onClose={() => setConfirm(null)} onConfirm={confirmAction} />}
      {messageMenu && <div className="floating-dismiss" onClick={() => setMessageMenu(null)}><div onClick={event => event.stopPropagation()}><MessageContextMenu mine={messageMenu.mine} time={messageMenu.time} onAction={handleMessageMenu} /></div></div>}
      {forwardMessage && <ForwardPanel onClose={() => setForwardMessage(null)} onForward={target => { addToChat(target, { id: crypto.randomUUID(), mine: true, sender: account.name, text: forwardMessage.text, time: 'now', reactions: [] }); setForwardMessage(null) }} />}
      {menuOpen && <div className="menu-overlay" onClick={() => { setMenuOpen(false); setMenuStub(null) }}><aside className="main-menu telegram-menu" onClick={e => e.stopPropagation()}>{menuStub ? <><header className="menu-stub-head"><button aria-label="Back to main menu" onClick={() => setMenuStub(null)}><ChevronLeft size={19} /></button><strong>{menuStub}</strong><button aria-label="Close menu" onClick={() => { setMenuOpen(false); setMenuStub(null) }}><X size={18} /></button></header><div className="menu-stub-body"><div className="menu-stub-icon"><MessageCircle size={25} /></div><h3>{menuStub}</h3><p>{menuStub === 'Contacts' ? 'Your trusted contacts will appear here. Import stays on-device in this privacy-first messenger.' : `${menuStub} is ready as a focused Chettik messenger flow.`}</p><button onClick={() => setMenuStub(null)}>Back to menu</button></div></> : <><button className="menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={18} /></button><button className="menu-user" onClick={() => { setMenuOpen(false); setProfileAccount(account); setProfileOpen(true) }}><div className="avatar" style={{ background: account.color }}>{account.initials}</div><span><strong>{account.name}</strong><small>Set emoji status · {account.username}</small></span><ArrowRight size={17} /></button><div className="menu-links"><button onClick={() => { setMenuOpen(false); setProfileAccount(account); setProfileOpen(true) }}><CircleUserRound size={19} />My Profile</button><button onClick={() => setMenuStub('New Group')}><Users size={19} />New Group</button><button onClick={() => setMenuStub('New Channel')}><MessageCircle size={19} />New Channel</button><button onClick={() => setMenuStub('Contacts')}><Users size={19} />Contacts</button><button onClick={() => { setMenuOpen(false); openChat('Saved Messages') }}><Pin size={19} />Saved Messages</button><button onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}><Settings size={19} />Settings</button></div><button className="night-row" onClick={() => setDark(!dark)}><span>{dark ? <Moon size={19} /> : <Sun size={19} />}{dark ? 'Night Mode' : 'Day Mode'}</span><span className={`switch ${dark ? 'on' : ''}`}><i /></span></button><footer>Chettik Web<br /><small>Private by instinct</small></footer></>}</aside></div>}
    </div>
  </div>
}

export function SettingsPage({ account, dark, profile, setProfile, onBack, onLogout }: { account: Account; dark: boolean; profile: Profile; setProfile: (p: Profile) => void; onBack: () => void; onLogout: () => void }) {
  const update = (key: keyof Profile, value: string) => setProfile({ ...profile, [key]: value })
  return <main className={`settings-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">PROFILE & PRIVACY</div><h1>Your profile</h1><p>Cloud-synced with your Chettik account. Privacy defaults apply immediately.</p><div className="profile-card"><img src="/logo.svg" alt="" /><strong>{account.name} <span className="badge">{account.role}</span></strong><small>{account.email}</small></div><div className="settings-list"><label><strong>Bio</strong><textarea value={profile.bio} onChange={e => update('bio', e.target.value)} placeholder="Tell people about yourself" /></label><label><strong>Discord</strong><input value={profile.discord} onChange={e => update('discord', e.target.value)} placeholder="discord username" /></label><label><strong>GitHub</strong><input value={profile.github} onChange={e => update('github', e.target.value)} placeholder="github username" /></label><label><strong>Who sees last seen</strong><select value={profile.lastSeen} onChange={e => update('lastSeen', e.target.value)}><option>Everybody</option><option>Contacts</option><option>Nobody</option></select></label><button onClick={() => setProfile({ ...profile, blocked: [...profile.blocked, 'Mark'] })}><span><strong>Block Mark</strong><small>{profile.blocked.includes('Mark') ? 'Blocked' : 'Prevent messages and presence'}</small></span><Lock size={16} /></button></div><button className="danger" onClick={onLogout}>Log out safely</button></article></main>
}

function AdminPage({ account, reports, clearReports, onBack }: { account: Account; reports: string[]; clearReports: () => void; onBack: () => void }) {
  return <main className="settings-page dark"><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">CHEttik operations</div><h1>Moderation console</h1><p>Signed in as {account.role} {account.name}. Local environment data only.</p><div className="admin-grid"><div><ShieldCheck size={22} /><strong>{reports.length}</strong><small>Open reports</small></div><div><Users size={22} /><strong>3</strong><small>Seed accounts</small></div><div><MessageCircle size={22} /><strong>Cloud</strong><small>Chat store</small></div></div><div className="settings-list">{reports.length ? reports.map((r, i) => <button key={`${r}-${i}`}><span><strong>Pending report</strong><small>{r}</small></span><Flag size={16} /></button>) : <div className="empty">No reports yet. Use a message’s flag action to create one.</div>}</div><button className="danger" onClick={clearReports}>Resolve all reports</button></article></main>
}
