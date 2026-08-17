import { ArrowRight, BellOff, Check, ChevronLeft, CircleUserRound, Copy, Edit3, Flag, Forward, Lock, Menu, MessageCircle, Moon, MoreHorizontal, Paperclip, Pencil, Pin, Plus, QrCode, Search, Send, Settings, ShieldCheck, ShieldAlert, Smile, Sun, Trash2, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import './App.css'
import { API_URL, websocketUrl } from './api'
import { decryptSecretMessage, encryptSecretMessage, getDeviceIdentity, loadSecretHistory, saveSecretHistory, type SecretHistoryItem } from './secretCrypto'
import { SettingsDrawer } from './Stage3Panels'
import { MediaSendSheet, type MediaExpiry, RichComposerSheet, VoiceButton } from './Stage4Panels'
import { ChatContextMenu, ConfirmModal, type ConfirmAction, ForwardPanel, GroupPanel, MessageContextMenu, ProfilePanel } from './InteractionPanels'

export type Account = {
  id?: string
  role: 'SuperAdmin' | 'Admin' | 'User'
  name: string
  username: string
  email: string
  initials: string
  color: string
  badges?: string[]
  avatarUrl?: string | null
}

type LegalDoc = 'terms' | 'privacy' | 'authors'

type Language = 'EN' | 'RU'
type MessageKind = 'text' | 'voice' | 'poll' | 'location' | 'circle' | 'media' | 'sticker'
type Message = { id: string; sender: string; text: string; time: string; mine: boolean; reactions: string[]; pinned?: boolean; edited?: boolean; replyTo?: string; kind?: MessageKind; pollVotes?: number; voted?: boolean; mediaExpiry?: MediaExpiry; opened?: boolean; stickerUrl?: string }
export type ChatName = string
type ChatMessages = Record<ChatName, Message[]>
export type Audience = 'Everybody' | 'Contacts' | 'Nobody'
export type Profile = {
  bio: string; github: string; discord: string; lastSeen: Audience; blocked: string[]
  avatarUrl?: string | null; avatarMediaId?: string | null
  privacy?: Record<string, Audience>; privacyExceptions?: Record<string, { always: string[]; never: string[] }>
  passcode?: boolean; biometrics?: boolean; twoStep?: boolean; passkeys?: boolean; loginEmail?: string
  autoDelete?: string; scheduledEnabled?: boolean; timedMedia?: boolean; viewOnce?: boolean; pushEnabled?: boolean; telemetryEnabled?: boolean
}
const sessionKey = (account: Account) => `chettik-api-session-${account.email}`
const credits = {
  ru: { dev: 'Разработчик и основатель: Nanda, Discord: nandak070, Telegram: nanda070', mark: 'Разработчик: Mark, Discord: schizophrenogenic', contact: 'Связь', all: 'Nanda · Email: adnan.huseynli1@gmail.com · Discord: nandak070 · Telegram: nanda070' },
  en: { dev: 'Developer & founder: Nanda, Discord: nandak070, Telegram: nanda070', mark: 'Developer: Mark, Discord: schizophrenogenic', contact: 'Contact', all: 'Nanda · Email: adnan.huseynli1@gmail.com · Discord: nandak070 · Telegram: nanda070' },
}
export default function Chettik() {
  const [dark, setDark] = useState(true)
  const [language, setLanguage] = useState<Language>('EN')
  const [picked, setPicked] = useState<Account | null>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpChallengeId, setOtpChallengeId] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [authPending, setAuthPending] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [signupName, setSignupName] = useState('')
  const [signupUsername, setSignupUsername] = useState('')
  const [session, setSession] = useState<Account | null>(null)
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const [desktopLogin, setDesktopLogin] = useState<'qr' | 'email' | 'passkey'>('qr')
  const ru = language === 'RU'
  useEffect(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined) }, [])
  const tr = ru ? { invalid: 'Введите корректный email.', code: 'Код отправлен на email.', legal: ['Условия', 'Конфиденциальность', 'Авторы'] } : { invalid: 'Enter a valid email address.', code: 'A verification code was sent to your email.', legal: ['Terms', 'Privacy', 'Authors'] }
  const copy = ru
    ? { title: 'Тише. Ближе. По-своему.', subtitle: 'Приватность — по умолчанию. Знакомый интерфейс.', pick: 'Выберите аккаунт', email: 'или введите email', continue: 'Продолжить', secure: 'Вход защищён одноразовым кодом, отправленным на email.', code: 'Введите код из 6 цифр', verify: 'Подтвердить и войти', back: 'Назад' }
    : { title: 'A quieter place to be close.', subtitle: 'Private by instinct. Familiar by design.', pick: 'Choose an account', email: 'or enter your email address', continue: 'Continue', secure: 'Sign in is protected by a one-time code delivered to your email.', code: 'Enter the 6-digit code', verify: 'Verify & enter', back: 'Back' }

  const beginOtp = async (targetEmail: string) => {
    const normalizedEmail = targetEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setAuthNotice(tr.invalid)
    setAuthNotice('')
    setAuthPending(true)
    try {
      const response = await fetch(`${API_URL}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: normalizedEmail, mode: authMode }) })
      const payload = await response.json().catch(() => ({})) as { challengeId?: string; error?: string; detail?: string }
      if (!response.ok || !payload.challengeId) return setAuthNotice(payload.error || (typeof payload.detail === 'string' ? payload.detail : '') || tr.invalid)
      setEmail(normalizedEmail)
      setOtp('')
      setOtpChallengeId(payload.challengeId)
      setPicked({ role: 'User', email: normalizedEmail, name: signupName || 'New user', username: `@${signupUsername || 'new'}`, initials: (signupName || 'N').slice(0, 1).toUpperCase(), color: '#4c8a83' })
    } catch {
      setAuthNotice(ru ? 'Не удалось подключиться. Попробуйте ещё раз.' : 'Could not connect. Please try again.')
    } finally {
      setAuthPending(false)
    }
  }
  const requestOtp = () => { void beginOtp(email) }
  const verifyOtp = async () => {
    if (!picked || !otpChallengeId) return setAuthNotice(tr.code)
    setAuthPending(true)
    try {
      const response = await fetch(`${API_URL}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: picked.email, code: otp, challengeId: otpChallengeId, deviceLabel: 'Web • Browser', ...(authMode === 'signup' ? { name: signupName, username: signupUsername } : {}) }) })
      const payload = await response.json().catch(() => ({})) as { token?: string; user?: Account; error?: string; detail?: string }
      if (!response.ok || !payload.token || !payload.user) return setAuthNotice(payload.error || (typeof payload.detail === 'string' ? payload.detail : '') || tr.code)
      localStorage.setItem(sessionKey(payload.user), payload.token)
      setAuthNotice('')
      setSession(payload.user)
    } catch {
      setAuthNotice(ru ? 'Не удалось подключиться. Попробуйте ещё раз.' : 'Could not connect. Please try again.')
    } finally {
      setAuthPending(false)
    }
  }
  if (legal) return <LegalPage doc={legal} language={language} dark={dark} onBack={() => setLegal(null)} />
  if (session) return <Messenger account={session} dark={dark} setDark={setDark} language={language} onLanguage={() => setLanguage(ru ? 'EN' : 'RU')} onLogout={() => { localStorage.removeItem(sessionKey(session)); setSession(null) }} />
  return <main className={`auth-screen ${dark ? 'dark' : ''}`}>
    <section className="desktop-login">
      <header>
        {desktopLogin === 'qr'
          ? <span className="desktop-header-spacer" />
          : <button className="desktop-back" aria-label={ru ? 'Назад к QR-коду' : 'Back to QR'} onClick={() => setDesktopLogin('qr')}><ChevronLeft size={19} />{ru ? 'QR-код' : 'QR code'}</button>}
        <div className="desktop-auth-controls">
          <button aria-label={ru ? 'Сменить язык' : 'Change language'} onClick={() => setLanguage(ru ? 'EN' : 'RU')}>{language}</button>
          <button aria-label={ru ? 'Сменить тему' : 'Toggle theme'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </header>
      <div className="desktop-login-stage">
        <div className="desktop-login-panel" key={`${desktopLogin}-${picked ? 'confirm' : 'start'}`}>
          <div className="auth-brand-lockup"><img src="/logo.svg" alt="" /><span>Chettik</span></div>
          {desktopLogin === 'passkey' ? <>
            <div className="desktop-passkey">⌁</div>
            <h1>{ru ? 'Войти с ключом доступа' : 'Log in with a passkey'}</h1>
            <p>{ru ? 'Ключи доступа настраиваются после входа. Используйте QR-код или email.' : 'Passkeys are configured after sign-in. Use the QR code or your email address.'}</p>
            <button className="desktop-primary" onClick={() => setDesktopLogin('qr')}>{ru ? 'Вернуться к QR-коду' : 'Back to QR code'}</button>
          </> : desktopLogin === 'email' ? <div className="desktop-login-card email-login">
            {!picked ? <>
              <h1>{authMode === 'signup' ? (ru ? 'Создайте аккаунт' : 'Create your account') : (ru ? 'Войдите по email' : 'Log in with email')}</h1>
              <p>{authMode === 'signup' ? (ru ? 'Подтвердите email и выберите имя пользователя.' : 'Verify your email and choose your username.') : (ru ? 'Введите адрес, привязанный к вашему аккаунту Chettik.' : 'Enter the address linked to your Chettik account.')}</p>
              <form onSubmit={event => { event.preventDefault(); requestOtp() }}>
                {authMode === 'signup' && <><label htmlFor="signup-name">{ru ? 'Имя' : 'Display name'}</label><input id="signup-name" value={signupName} onChange={event => setSignupName(event.target.value)} minLength={2} maxLength={80} required /><label htmlFor="signup-username">{ru ? 'Имя пользователя' : 'Username'}</label><input id="signup-username" value={signupUsername} onChange={event => setSignupUsername(event.target.value.replace(/^@/, '').toLowerCase())} minLength={3} maxLength={32} pattern="[a-z0-9_]+" required /></>}
                <label htmlFor="desktop-auth-email">{ru ? 'Email' : 'Email address'}</label>
                <input id="desktop-auth-email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" aria-label="Email address" type="email" autoComplete="email" required />
                <button className="desktop-primary" type="submit" disabled={authPending}>{authPending ? (ru ? 'Отправляем…' : 'Sending…') : (ru ? 'Продолжить' : 'Continue')}</button>
              </form>
              <button className="desktop-tertiary" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthNotice('') }}>{authMode === 'login' ? (ru ? 'Создать аккаунт' : 'Create account') : (ru ? 'Уже есть аккаунт? Войти' : 'Already have an account? Sign in')}</button>
              <button className="desktop-secondary" onClick={() => setDesktopLogin('qr')}><QrCode size={17} />{ru ? 'Войти через QR-код' : 'Sign in with QR code'}</button>
              {authNotice && <p className="form-notice" role="alert">{authNotice}</p>}
            </> : <>
              <h1>{ru ? 'Проверьте почту' : 'Check your email'}</h1>
              <p>{ru ? `Введите 6-значный код, отправленный на ${picked.email}.` : `Enter the 6-digit code sent to ${picked.email}.`}</p>
              <form className="otp-form" onSubmit={event => { event.preventDefault(); void verifyOtp() }}>
                <OtpCells value={otp} onChange={setOtp} desktop />
                <button className="desktop-primary" disabled={authPending || otp.length !== 6}>{authPending ? (ru ? 'Проверяем…' : 'Verifying…') : (ru ? 'Войти' : 'Sign in')}</button>
              </form>
              <button className="desktop-secondary" onClick={() => { setPicked(null); setOtp(''); setOtpChallengeId(''); setAuthNotice('') }}>{ru ? 'Изменить email' : 'Use a different email'}</button>
              {authNotice && <p className="form-notice" role="alert">{authNotice}</p>}
            </>}
          </div> : <div className="desktop-login-card qr-login">
            <div className="desktop-qr"><QrCode size={176} strokeWidth={1.25} /><img src="/logo.svg" alt="" /></div>
            <h1>{ru ? 'Сканируйте в мобильном Chettik' : 'Scan from mobile Chettik'}</h1>
            <p className="qr-subtitle">{ru ? 'Быстрый и безопасный вход без ввода кода.' : 'A quick, secure sign-in without typing a code.'}</p>
            <ol>
              <li>{ru ? 'Откройте Chettik на устройстве с активной сессией' : 'Open Chettik on a signed-in device'}</li>
              <li>{ru ? 'Откройте Настройки → Устройства' : 'Go to Settings → Devices'}</li>
              <li>{ru ? 'Нажмите «Добавить устройство» и сканируйте код' : 'Choose Add Device and scan this code'}</li>
            </ol>
            <button className="desktop-secondary" onClick={() => setDesktopLogin('email')}>{ru ? 'Войти по email' : 'Log in using email'}</button>
            <button className="desktop-tertiary" onClick={() => setDesktopLogin('passkey')}>{ru ? 'Войти с ключом доступа' : 'Log in using passkey'}</button>
          </div>}
        </div>
      </div>
    </section>
    <div className="auth-ambient one" /><div className="auth-ambient two" />
    <header className="auth-header">
      <div className="auth-logo"><img src="/logo.svg" alt="" /> chettik</div>
      <div className="auth-controls"><button onClick={() => setLanguage(ru ? 'EN' : 'RU')}>{language}</button><button aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    </header>
    <section className="auth-layout">
      <div className="auth-intro"><div className="eyebrow"><ShieldCheck size={15} /> PRIVATE MESSENGER</div><h1>{copy.title}</h1><p>{copy.subtitle}</p><div className="auth-note"><Check size={16} /> {copy.secure}</div></div>
      <div className="auth-card">
        <div className="mobile-card-brand"><img src="/logo.svg" alt="" /><span>Chettik</span></div>
        {!picked && <><h1>{authMode === 'signup' ? (ru ? 'Создайте аккаунт' : 'Create account') : (ru ? 'Войдите по email' : 'Log in with email')}</h1><p className="code-copy">{authMode === 'signup' ? (ru ? 'Подтвердите email и выберите имя пользователя.' : 'Verify email and choose a username.') : (ru ? 'Введите адрес, привязанный к вашему аккаунту.' : 'Enter the address linked to your account.')}</p><form onSubmit={(e) => { e.preventDefault(); requestOtp() }}>{authMode === 'signup' && <><input value={signupName} onChange={e => setSignupName(e.target.value)} placeholder={ru ? 'Отображаемое имя' : 'Display name'} aria-label="Display name" minLength={2} maxLength={80} required /><input value={signupUsername} onChange={e => setSignupUsername(e.target.value.replace(/^@/, '').toLowerCase())} placeholder={ru ? 'Имя пользователя' : 'Username'} aria-label="Username" minLength={3} maxLength={32} pattern="[a-z0-9_]+" required /></>}<input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email address" type="email" autoComplete="email" required /><button className="primary" type="submit" disabled={authPending}>{authPending ? (ru ? 'Отправляем…' : 'Sending…') : copy.continue} <ArrowRight size={16} /></button></form><button className="desktop-tertiary" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthNotice('') }}>{authMode === 'login' ? (ru ? 'Создать аккаунт' : 'Create account') : (ru ? 'Войти' : 'Sign in')}</button>{authNotice && <p className="form-notice" role="alert">{authNotice}</p>}</>}
        {picked && <><button className="back" onClick={() => { setPicked(null); setOtp(''); setOtpChallengeId(''); setAuthNotice('') }}><ChevronLeft size={16} /> {copy.back}</button><div className="code-user"><span>{picked.email}</span></div><p className="code-copy">{copy.code}</p><form className="otp-form" onSubmit={(e) => { e.preventDefault(); void verifyOtp() }}><OtpCells value={otp} onChange={setOtp} /><button className="primary" type="submit" disabled={authPending || otp.length !== 6}>{authPending ? (ru ? 'Проверяем…' : 'Verifying…') : copy.verify} <ArrowRight size={16} /></button></form>{authNotice && <p className="form-notice" role="alert">{authNotice}</p>}</>}
      </div>
    </section>
    <footer><span>© 2026 Chettik</span><span><button onClick={() => setLegal('terms')}>{tr.legal[0]}</button> · <button onClick={() => setLegal('privacy')}>{tr.legal[1]}</button> · <button onClick={() => setLegal('authors')}>{tr.legal[2]}</button></span></footer>
  </main>
}

function OtpCells({ value, onChange, desktop = false }: { value: string; onChange: (value: string) => void; desktop?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, index) => value[index] || '')
  const focus = (index: number) => refs.current[Math.max(0, Math.min(index, 5))]?.focus()
  useEffect(() => {
    if (desktop === window.matchMedia('(min-width: 768px)').matches) focus(0)
  }, [desktop])
  const applyDigits = (raw: string, start: number) => {
    const clean = raw.replace(/\D/g, '').slice(0, 6 - start)
    const next = [...digits]
    if (!clean) next[start] = ''
    else clean.split('').forEach((digit, offset) => { next[start + offset] = digit })
    onChange(next.join(''))
    focus(Math.min(start + clean.length, 5))
  }
  return <div className="otp-cells" role="group" aria-label="Verification code">
    {digits.map((digit, index) => <input key={index} ref={element => { refs.current[index] = element }} className="otp-cell" value={digit} aria-label={`OTP digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={6} onChange={event => applyDigits(event.target.value, index)} onPaste={event => { event.preventDefault(); applyDigits(event.clipboardData.getData('text'), index) }} onKeyDown={event => { if (event.key === 'Backspace' && !digits[index] && index > 0) { event.preventDefault(); const next = [...digits]; next[index - 1] = ''; onChange(next.join('')); focus(index - 1) } else if (event.key === 'ArrowLeft') { event.preventDefault(); focus(index - 1) } else if (event.key === 'ArrowRight') { event.preventDefault(); focus(index + 1) } }} />)}
  </div>
}

function LegalPage({ doc, language, dark, onBack }: { doc: LegalDoc; language: 'EN' | 'RU'; dark: boolean; onBack: () => void }) {
  const ru = language === 'RU'
  const pages: Record<LegalDoc, [string, string, string[]]> = {
    terms: ru ? ['Условия использования', 'Черновик для Stage 1 · вступает в силу после юридической проверки', ['Использование сервиса', 'Chettik — сервис обмена сообщениями. Вы обязуетесь использовать его законно, не нарушать права других лиц и не обходить меры безопасности.', 'Аккаунт и модерация', 'Email является основной идентичностью аккаунта. Мы можем ограничить доступ при нарушении правил, обработке валидного репорта или требованиях закона.', 'Статус документа', 'Этот текст — продуктовый placeholder. До публичного запуска он будет заменён версией, проверенной юристами для CIS/RF, EU, US и Canada.']] : ['Terms of Service', 'Stage 1 draft · effective after legal review', ['Using Chettik', 'Chettik is a messaging service. You agree to use it lawfully, respect other people’s rights, and not evade security measures.', 'Accounts and moderation', 'An email address is the primary account identity. We may limit access following policy violations, valid reports, or legal requirements.', 'Document status', 'This is a product placeholder. It will be replaced before public launch by counsel-reviewed terms for CIS/RF, EU, US, and Canada.']],
    privacy: ru ? ['Политика конфиденциальности', 'Черновик для Stage 1 · версия 0.1', ['Данные, которые нужны сервису', 'Для аккаунта обрабатываются email, профиль и данные сессии. Содержимое облачных чатов обрабатывается для доставки сообщений; секретные чаты проектируются отдельно как device-bound E2E.', 'Ваш контроль', 'Настройки приватности дают аудитории everybody / nobody / contacts / exceptions. Пользователь может управлять сообщениями, блокировками, данными профиля и удалением аккаунта.', 'Хранение и права', 'Финальная политика определит сроки хранения, удаление, контакты privacy и права, применимые на рынках запуска.']] : ['Privacy Policy', 'Stage 1 draft · version 0.1', ['Data needed for the service', 'We process an email address, profile information, and session data for your account. Cloud-chat content is processed to deliver messages; secret chats are separately designed as device-bound E2E.', 'Your control', 'Privacy settings support everybody / nobody / contacts / exceptions audiences. You can manage messages, blocks, profile data, and account deletion.', 'Retention and rights', 'The final policy will define retention, deletion, privacy contacts, and rights for each launch market.']],
    authors: ru ? ['Авторы и благодарности', 'Chettik · продуктовый документ', ['Команда', credits.ru.dev, 'Участники', credits.ru.mark, credits.ru.contact, credits.ru.all]] : ['Authors & Credits', 'Chettik · product notice', ['Team', credits.en.dev, 'Contributors', credits.en.mark, credits.en.contact, credits.en.all]],
  }
  const content = pages[doc]
  return <main className={`legal-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Chettik</button><span>{language}</span></header><article><div className="eyebrow">LEGAL / {doc.toUpperCase()}</div><h1>{content[0]}</h1><p className="legal-subtitle">{content[1]}</p>{content[2].map((line, index) => index % 2 === 0 ? <section key={line}><h2>{line}</h2><p>{content[2][index + 1]}</p></section> : null)}</article></main>
}

type MessengerProps = { account: Account; dark: boolean; setDark: (value: boolean) => void; language: Language; onLanguage: () => void; onLogout: () => void }
type Channel = { id: string; title: string; description: string; username: string | null; visibility: 'public' | 'private'; owner_id: string; chat_id: string; subscriber_count: number; my_role: '' | 'owner' | 'admin' | 'subscriber' }
type ChatRow = { id: string; name: ChatName; preview: string; time: string; initials: string; color: string; unread: number; kind?: string; secret?: boolean; channel?: Channel; avatarUrl?: string | null; participant?: Account }
type SecretDevice = { id: string; user_id: string; public_key: string; label: string }
type SecretChat = { id: string; participant: Account; devices: SecretDevice[] }

function Messenger({ account, dark, setDark, language, onLanguage, onLogout }: MessengerProps) {
  const [message, setMessage] = useState('')
  const [page, setPage] = useState<'chat' | 'settings' | 'admin'>('chat')
  const [selectedChat, setSelectedChat] = useState<ChatName>('Saved Messages')
  const [chatMessages, setChatMessages] = useState<ChatMessages>({})
  const [profile, setProfile] = useState<Profile>(() => ({ bio: '', github: '', discord: '', lastSeen: 'Contacts', blocked: [], privacy: { lastSeen: 'Contacts', photo: 'Everybody', bio: 'Everybody', birthday: 'Contacts', forwards: 'Everybody', voice: 'Contacts', messages: 'Everybody' }, privacyExceptions: {}, autoDelete: '6 months', pushEnabled: false, telemetryEnabled: false }))
  const [reports, setReports] = useState<string[]>([])
  const [chatRows, setChatRows] = useState<ChatRow[]>([])
  const [secretChats, setSecretChats] = useState<Record<string, SecretChat>>({})
  const [secretDevice, setSecretDevice] = useState<{ id: string; publicKey: string; privateKey: string } | null>(null)
  const [safetyNotice, setSafetyNotice] = useState('')
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
  const [profileAccount, setProfileAccount] = useState<Account | null>(null)
  const [confirm, setConfirm] = useState<{ action: ConfirmAction; message?: Message } | null>(null)
  const [chatMenu, setChatMenu] = useState<{ name: ChatName; x: number; y: number } | null>(null)
  const [messageMenu, setMessageMenu] = useState<Message | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null)
  const [chatPinned, setChatPinned] = useState(false)
  const [chatMuted, setChatMuted] = useState(false)
  const [, setChannels] = useState<Channel[]>([])
  const [createChannelOpen, setCreateChannelOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [contacts, setContacts] = useState<Account[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [peopleResults, setPeopleResults] = useState<Account[]>([])
  const [hasOpenedChat, setHasOpenedChat] = useState(false)
  const [channelInfoOpen, setChannelInfoOpen] = useState(false)
  const [channelEditOpen, setChannelEditOpen] = useState(false)
  const [channelMenuOpen, setChannelMenuOpen] = useState(false)
  const [channelMuted, setChannelMuted] = useState(false)
  const [chatListWidth, setChatListWidth] = useState(() => Number(localStorage.getItem('chettik-chat-list-width')) || 300)
  const fileInput = useRef<HTMLInputElement>(null)
  const stickerInput = useRef<HTMLInputElement>(null)
  const resizeFrame = useRef<number | null>(null)
  const pendingChatListWidth = useRef(chatListWidth)
  const savedMessages = chatRows.find(row => row.name === 'Saved Messages')
  const conversations = chatRows.filter(row => row.name !== 'Saved Messages')
  const inboxEmpty = conversations.length === 0 && !hasOpenedChat
  const messages = chatMessages[selectedChat] || []
  const selectedRow = chatRows.find(row => row.name === selectedChat)
  const selectedChannel = selectedRow?.channel
  const canPublish = !selectedChannel || selectedChannel.my_role === 'owner' || selectedChannel.my_role === 'admin'
  const logout = () => {
    if (token) void fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    onLogout()
  }
  const setMessages = (update: Message[] | ((current: Message[]) => Message[])) => setChatMessages(current => ({
    ...current,
    [selectedChat]: typeof update === 'function' ? update(current[selectedChat]) : update,
  }))
  const openChat = (chat: ChatName) => {
    setHasOpenedChat(true)
    setSelectedChat(chat)
    setMessage('')
    setReply(null)
    setEditing(null)
    setChatMenu(null)
    const row = chatRows.find(item => item.name === chat)
    if (row?.secret) {
      const secret = secretChats[row.id]
      if (secret) void openSecretHistory(secret)
    }
  }
  const openSecretHistory = async (chat: SecretChat, device = secretDevice) => {
    if (!device || !token) return
    const name = `Secret chat · ${chat.participant.name}`
    const saved = await loadSecretHistory(chat.id)
    const response = await fetch(`${API_URL}/secret-chats/${chat.id}/messages?deviceId=${encodeURIComponent(device.id)}`, { headers: { Authorization: `Bearer ${token}` } })
    const encrypted = response.ok ? await response.json() as Array<{ id: string; sender_id: string; sender_key_id: string; ciphertext: string; nonce: string; created_at: string }> : []
    const peerKeys = new Map(chat.devices.map(item => [item.id, item.public_key]))
    const incoming: Array<SecretHistoryItem | null> = await Promise.all(encrypted.map(async item => {
      const senderKey = peerKeys.get(item.sender_key_id)
      if (!senderKey) return null
      try { return { id: item.id, sender: chat.participant.name, text: await decryptSecretMessage(device.privateKey, senderKey, item.ciphertext, item.nonce), createdAt: item.created_at, mine: false } as SecretHistoryItem } catch { return null }
    }))
    const merged = [...saved, ...incoming.filter((item): item is SecretHistoryItem => Boolean(item)).filter(item => !saved.some(local => local.id === item.id))]
    await saveSecretHistory(chat.id, merged)
    setChatMessages(current => ({ ...current, [name]: merged.map(item => ({ id: item.id, sender: item.sender, text: item.text, time: new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mine: item.mine, reactions: [] })) }))
  }
  const startSecretChat = async (target?: Account) => {
    if (!target) return
    if (!token || !target.id || !secretDevice) return
    const response = await fetch(`${API_URL}/secret-chats`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: target.id }) })
    if (!response.ok) return
    const chat = await response.json() as SecretChat
    const name = `Secret chat · ${chat.participant.name}`
    setSecretChats(current => ({ ...current, [chat.id]: chat }))
    setChatRows(current => current.some(item => item.id === chat.id) ? current : [{ id: chat.id, name, preview: '🔒 End-to-end encrypted · this device', time: '', initials: chat.participant.initials, color: chat.participant.color, unread: 0, secret: true }, ...current])
    await openSecretHistory(chat)
    openChat(name)
    setProfileOpen(false)
  }
  const addToChat = (chat: ChatName, item: Message) => setChatMessages(current => ({ ...current, [chat]: [...current[chat], item] }))
  const openContacts = async () => {
    if (!token) return
    const response = await fetch(`${API_URL}/contacts`, { headers: { Authorization: `Bearer ${token}` } })
    if (response.ok) setContacts(await response.json() as Account[])
    setContactSearch('')
    setPeopleResults([])
    setContactsOpen(true)
  }
  const searchPeople = async (query: string) => {
    setContactSearch(query)
    if (!token || !query.trim()) return setPeopleResults([])
    const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } })
    if (response.ok) setPeopleResults(await response.json() as Account[])
  }
  const addContact = async (person: Account) => {
    if (!token || !person.id) return
    const response = await fetch(`${API_URL}/contacts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: person.id }) })
    if (response.ok) {
      const contact = await response.json() as Account
      setContacts(current => current.some(item => item.id === contact.id) ? current : [...current, contact])
    }
  }
  const startDirectChat = async (contact: Account) => {
    if (!token || !contact.id) return
    const response = await fetch(`${API_URL}/chats/direct`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: contact.id }) })
    if (!response.ok) return
    const created = await response.json() as { id: string; title: ChatName }
    const row: ChatRow = { id: created.id, name: created.title, preview: '', time: '', initials: contact.initials, color: contact.color, unread: 0, avatarUrl: contact.avatarUrl, participant: contact }
    setChatRows(current => current.some(chat => chat.id === row.id) ? current : [row, ...current])
    setChatMessages(current => current[created.title] ? current : { ...current, [created.title]: [] })
    openChat(created.title)
    setContactsOpen(false)
    setMenuOpen(false)
  }
  useEffect(() => {
    let disposed = false
    const connect = async () => {
      let apiToken = localStorage.getItem(sessionKey(account))
      if (!apiToken) return
      setToken(apiToken)
      const headers = { Authorization: `Bearer ${apiToken}` }
      const identity = await getDeviceIdentity(account.id || account.email)
      const deviceResponse = await fetch(`${API_URL}/secret/devices`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ publicKey: identity.publicKey, label: 'Web browser' }) })
      if (!deviceResponse.ok) return
      const registeredDevice = await deviceResponse.json() as { id: string }
      if (disposed) return
      setSecretDevice({ ...identity, id: registeredDevice.id })
      const [profileResponse, chatsResponse, channelsResponse, secretResponse] = await Promise.all([fetch(`${API_URL}/me/profile`, { headers }), fetch(`${API_URL}/chats`, { headers }), fetch(`${API_URL}/channels`, { headers }), fetch(`${API_URL}/secret-chats`, { headers })])
      if (!profileResponse.ok || !chatsResponse.ok || !channelsResponse.ok || !secretResponse.ok || disposed) return
      const remoteProfile = await profileResponse.json() as Profile
      const remoteChats = await chatsResponse.json() as Array<{ id: string; title: ChatName; type: string; preview: string; last_message_at: string | null; avatarUrl?: string | null }>
      const remoteChannels = await channelsResponse.json() as Channel[]
      const remoteSecretChats = await secretResponse.json() as SecretChat[]
      setChannels(remoteChannels)
      setProfile(current => ({ ...current, ...remoteProfile, privacy: { ...current.privacy, ...remoteProfile.privacy }, lastSeen: remoteProfile.privacy?.lastSeen || current.lastSeen }))
      const rows = remoteChats.map(item => {
        const channel = remoteChannels.find(value => value.chat_id === item.id)
        return { initials: item.title.slice(0, 1).toUpperCase(), color: item.type === 'saved' ? account.color : '#9e2338', id: item.id, name: item.title, preview: item.preview, time: item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '', unread: 0, kind: item.type, channel, avatarUrl: item.type === 'saved' ? remoteProfile.avatarUrl : item.avatarUrl }
      })
      const secretRows = remoteSecretChats.map(chat => ({ id: chat.id, name: `Secret chat · ${chat.participant.name}`, preview: '🔒 End-to-end encrypted · this device', time: '', initials: chat.participant.initials, color: chat.participant.color, unread: 0, secret: true }))
      setSecretChats(Object.fromEntries(remoteSecretChats.map(chat => [chat.id, chat])))
      setChatRows([...secretRows, ...rows])
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
          const page = remote as { items?: Array<{ id: string; sender_name: string; text: string; kind: MessageKind; metadata?: { mediaExpiry?: MediaExpiry; stickerUrl?: string }; metadata_json?: string; created_at: string }> }
          const loaded = (page.items || []).map(item => {
            const metadata = item.metadata || JSON.parse(item.metadata_json || '{}') as { mediaExpiry?: MediaExpiry; stickerUrl?: string }
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
    if (!token) return
    const socket = new WebSocket(`${websocketUrl()}?token=${encodeURIComponent(token)}`)
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
  }, [account, chatRows, token])
  useEffect(() => {
    if (!token) return
    const timeout = window.setTimeout(() => {
      fetch(`${API_URL}/me/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ bio: profile.bio, github: profile.github, discord: profile.discord, privacy: profile.privacy }) }).catch(() => undefined)
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [profile, token])
  useEffect(() => {
    if (!token || !profileOpen || !profileAccount) return
    fetch(`${API_URL}/users/${profileAccount.username.slice(1)}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(response => response.ok ? response.json() : undefined)
      .catch(() => undefined)
  }, [profileAccount, profileOpen, token])
  const closeTransient = () => {
    setMenuOpen(false); setMessageMenu(null); setChatMenu(null); setEmojiOpen(false)
    setRichOpen(false); setMediaFile(null); setSettingsOpen(false); setStoryOpen(null); setProfileOpen(false)
    setGroupOpen(false); setGroupMenuOpen(false); setChannelMenuOpen(false); setCreateChannelOpen(false)
    setChannelInfoOpen(false); setChannelEditOpen(false); setForwardMessage(null); setConfirm(null)
  }
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeTransient() }
    const closeOnBackdrop = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target?.closest('.context-menu, .emoji-picker, .main-menu, .tg-panel, .profile-panel, .forward-card, .rich-sheet, .story-card, .confirm-card, .media-expiry-picker')) closeTransient()
    }
    window.addEventListener('keydown', closeOnEscape)
    document.addEventListener('pointerdown', closeOnBackdrop, true)
    return () => { window.removeEventListener('keydown', closeOnEscape); document.removeEventListener('pointerdown', closeOnBackdrop, true) }
  }, [])
  useEffect(() => () => { if (resizeFrame.current) cancelAnimationFrame(resizeFrame.current) }, [])
  const startSidebarResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const updateWidth = (pointerEvent: PointerEvent) => {
      pendingChatListWidth.current = Math.max(240, Math.min(420, Math.round(pointerEvent.clientX - 76)))
      if (resizeFrame.current !== null) return
      resizeFrame.current = requestAnimationFrame(() => {
        setChatListWidth(pendingChatListWidth.current)
        resizeFrame.current = null
      })
    }
    const finish = () => {
      if (resizeFrame.current !== null) { cancelAnimationFrame(resizeFrame.current); resizeFrame.current = null }
      setChatListWidth(pendingChatListWidth.current)
      localStorage.setItem('chettik-chat-list-width', String(pendingChatListWidth.current))
      window.removeEventListener('pointermove', updateWidth)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', updateWidth)
    window.addEventListener('pointerup', finish, { once: true })
  }
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
    else if (action === 'secret') startSecretChat()
    else if (action === 'clear-history' || action === 'delete-chat') setConfirm({ action })
    setChatMenu(null)
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
  const deliver = async (rawText: string, kind: MessageKind = 'text', mediaExpiry?: MediaExpiry, stickerUrl?: string, mediaId?: string) => {
    const text = rawText.trim()
    if (!text || text.length > 4000) return
    const chat = chatRows.find(row => row.name === selectedChat)
    if (!chat || (chat.channel && !canPublish)) return
    if (chat.secret) {
      const secret = secretChats[chat.id]
      if (!secret || !secretDevice) return
      const recipients = secret.devices.filter(device => device.user_id === secret.participant.id)
      const envelopes = await Promise.all(recipients.map(async device => ({
        recipientKeyId: device.id,
        ...await encryptSecretMessage(secretDevice.privateKey, device.public_key, text),
      })))
      const response = await fetch(`${API_URL}/secret-chats/${chat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senderKeyId: secretDevice.id, envelopes }),
      })
      if (!response.ok) return
      const created = await response.json() as { createdAt: string }
      const local: SecretHistoryItem = { id: crypto.randomUUID(), sender: account.name, text, createdAt: created.createdAt, mine: true }
      const history = [...await loadSecretHistory(chat.id), local]
      await saveSecretHistory(chat.id, history)
      setMessages(old => [...old, { id: local.id, mine: true, sender: account.name, text, time: 'now', reactions: [], kind, mediaExpiry, stickerUrl }])
      return
    }
    if (!token) return
    const response = await fetch(`${API_URL}/chats/${chat.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text, kind, mediaId, metadata: { ...(mediaExpiry ? { mediaExpiry } : {}), ...(stickerUrl ? { stickerUrl } : {}) } }) })
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
  const uploadAndDeliver = async (file: File, expiry?: MediaExpiry) => {
    if (!token) return
    const form = new FormData()
    form.append('file', file)
    const upload = await fetch(`${API_URL}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
    if (!upload.ok) return
    const media = await upload.json() as { id: string; name: string; mimeType: string; byteSize: number; url: string }
    await deliver(`📎 ${media.name} · ${Math.ceil(media.byteSize / 1024)} KB`, 'media', expiry, undefined, media.id)
  }
  const attach = (file?: File) => { if (!file) return; if (file.type.startsWith('image/') || file.type.startsWith('video/')) setMediaFile(file); else void uploadAndDeliver(file) }
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
    <div className={`app-shell ${inboxEmpty ? 'inbox-empty-state' : ''}`} style={{ '--sidebar-width': `${chatListWidth}px` } as CSSProperties}>
      <nav className="rail"><img className="mark" src="/logo.svg" alt="Chettik" /><button className="rail-btn active" aria-label="Open main menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><button className="rail-btn" aria-label="Open saved messages" onClick={() => openChat('Saved Messages')}><Pin size={19} /></button><div className="rail-spacer" />{account.role !== 'User' && <button className="rail-btn" title="Operations console" onClick={() => setPage('admin')}><ShieldAlert size={19} /></button>}<button className="avatar me" aria-label="Open my profile" title={account.name} onClick={() => setSettingsOpen(true)}>{profile.avatarUrl ? <img src={profile.avatarUrl.startsWith('/') ? new URL(profile.avatarUrl, API_URL).toString() : profile.avatarUrl} alt="" /> : account.initials}</button></nav>
      <aside className="sidebar" aria-label={language === 'RU' ? 'Список чатов' : 'Chat list'}>
        <div className="side-top"><div className="wordmark"><img src="/logo.svg" alt="" /><span>Chettik</span></div><button className="icon-btn" aria-label="New chat" onClick={() => void openContacts()}><MessageCircle size={19} /></button></div>
        <label className="search"><Search size={15} /><input value={search} onChange={e => { setSearch(e.target.value); void searchPeople(e.target.value) }} placeholder={language === 'RU' ? 'Поиск чатов и людей' : 'Search chats and people'} /></label>
        <div className="list-title">{language === 'RU' ? 'Чаты' : 'Chats'} · {conversations.length}</div>
        <div className="chat-list">
          {savedMessages && <ChatListRow chat={savedMessages} selected={selectedChat === savedMessages.name} muted={false} onOpen={openChat} onMenu={setChatMenu} />}
          {conversations.filter(chat => chat.name.toLowerCase().includes(search.toLowerCase())).map(chat => <ChatListRow key={chat.id} chat={chat} selected={selectedChat === chat.name} muted={Boolean(channelMuted && chat.channel && selectedChat === chat.name)} onOpen={openChat} onMenu={setChatMenu} />)}
          {peopleResults.length > 0 && <div className="search-people"><small>People</small>{peopleResults.map(person => <button key={person.id} onClick={() => void startDirectChat(person)}><span className="avatar" style={{ background: person.color }}>{person.avatarUrl ? <img src={person.avatarUrl.startsWith('/') ? new URL(person.avatarUrl, API_URL).toString() : person.avatarUrl} alt="" /> : person.initials}</span><span><strong>{person.name}</strong><small>{person.username}</small></span></button>)}</div>}
          {inboxEmpty && <div className="chat-list-empty"><div className="chat-list-empty-icon"><MessageCircle size={18} /></div><strong>{language === 'RU' ? 'Диалогов пока нет' : 'No conversations yet'}</strong><span>{language === 'RU' ? 'Начните новый чат, когда будете готовы.' : 'Start a new chat when you are ready.'}</span><button onClick={() => void openContacts()}>{language === 'RU' ? 'Новый чат' : 'New chat'}</button></div>}
        </div>
      </aside><div className="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Resize chat list" onPointerDown={startSidebarResize} />
      <section className="chat">
        {!inboxEmpty && <header className="chat-head"><button className="icon-btn mobile-menu" aria-label="Open main menu" onClick={() => setMenuOpen(true)}><Menu size={20} /></button><button className="icon-btn profile-open" aria-label={selectedRow?.kind === 'group' ? 'Open group info' : selectedChannel ? 'Open channel info' : 'Open user profile'} onClick={() => selectedChannel ? setChannelInfoOpen(true) : selectedRow?.kind === 'group' ? setGroupOpen(true) : selectedRow?.participant && (setProfileAccount(selectedRow.participant), setProfileOpen(true))}><div className={`avatar ${selectedChannel ? 'channel-avatar' : ''}`} style={{ background: selectedRow?.color || account.color }}>{selectedRow?.avatarUrl ? <img src={selectedRow.avatarUrl.startsWith('/') ? new URL(selectedRow.avatarUrl, API_URL).toString() : selectedRow.avatarUrl} alt="" /> : selectedChannel ? <MessageCircle size={18} /> : selectedChat === 'Saved Messages' ? account.initials : selectedRow?.initials}</div></button><button className="chat-person profile-open" onClick={() => selectedChannel ? setChannelInfoOpen(true) : selectedRow?.kind === 'group' ? setGroupOpen(true) : selectedRow?.participant && (setProfileAccount(selectedRow.participant), setProfileOpen(true))}><strong>{selectedChat}</strong><span>{selectedChat === 'Saved Messages' ? 'Messages saved for yourself' : selectedChannel ? `${selectedChannel.subscriber_count} subscribers · channel` : selectedRow?.kind === 'group' ? 'group chat' : 'cloud chat'}</span></button><div className="head-actions">{selectedChannel && <><button className="icon-btn" aria-label="Open channel info" onClick={() => setChannelInfoOpen(true)}><Users size={19} /></button><button className="icon-btn" aria-label="Open channel menu" onClick={() => setChannelMenuOpen(true)}><MoreHorizontal size={19} /></button></>}{selectedRow?.kind === 'group' && <button className="icon-btn" aria-label="Open group menu" onClick={() => setGroupMenuOpen(true)}><MoreHorizontal size={19} /></button>}<button className="icon-btn header-action" title="Switch language" onClick={onLanguage}>{language}</button><button className="icon-btn header-action" aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>}
        {inboxEmpty ? <div className="inbox-empty"><div className="inbox-empty-icon"><MessageCircle size={34} strokeWidth={1.6} /></div><h2>{language === 'RU' ? 'Пока нет чатов' : 'No chats yet'}</h2><p>{language === 'RU' ? 'Начните личный диалог, создайте группу или откройте канал.' : 'Start a direct conversation, create a group, or open a channel.'}</p><div><button className="empty-primary" onClick={() => void openContacts()}>{language === 'RU' ? 'Новый чат' : 'New chat'}</button><button onClick={() => setCreateGroupOpen(true)}>{language === 'RU' ? 'Новая группа' : 'New group'}</button><button onClick={() => setCreateChannelOpen(true)}>{language === 'RU' ? 'Новый канал' : 'New channel'}</button></div></div> : <><div className="messages" aria-live="polite"><div className="date">{language === 'RU' ? 'Сегодня' : 'Today'}</div>{matches.map(item => <div onContextMenu={event => { event.preventDefault(); setMessageMenu(item) }} className={`message ${item.mine ? 'mine' : ''}`} key={item.id}><div className="avatar" style={{ background: item.mine ? account.color : '#6e4c97' }}>{item.mine ? account.initials : 'M'}</div><div className={`bubble ${item.kind ? `bubble-${item.kind}` : ''}`}>{item.replyTo && <small className="reply-ref">↳ {item.replyTo}</small>}{item.kind !== 'sticker' && <span className="sender">{item.sender}</span>}{item.kind === 'sticker' ? <img className="sticker-message" src={item.stickerUrl} alt={item.text} /> : item.kind === 'voice' ? <div className="voice-message"><span className="voice-wave">▁▃▆▇▅▇▃▂</span><strong>{item.text}</strong></div> : item.kind === 'circle' ? <div className="circle-message"><span>▶</span><small>{item.text}</small></div> : item.kind === 'media' ? <button className="timed-media" aria-label="Open timed media" onClick={() => { if (item.mediaExpiry === 'once') setMessages(old => old.filter(message => message.id !== item.id)); else if (item.mediaExpiry && item.mediaExpiry !== 'never') { setMessages(old => old.map(message => message.id === item.id ? { ...message, opened: true } : message)); window.setTimeout(() => setMessages(old => old.filter(message => message.id !== item.id)), Number(item.mediaExpiry) * 1000) } }}><span>▧</span><strong>{item.opened ? 'Media opened' : item.text}</strong><small>{item.mediaExpiry === 'once' ? '1 · View once' : item.mediaExpiry === 'never' || !item.mediaExpiry ? 'Saved media' : `${item.mediaExpiry}s · tap to view`}</small></button> : item.kind === 'location' ? <div className="location-message"><span>⌖</span><strong>{item.text}</strong><small>Private chat location</small></div> : item.kind === 'poll' ? <div className="poll-message"><strong>{item.text}</strong><button onClick={() => setMessages(old => old.map(m => m.id === item.id ? { ...m, voted: !m.voted, pollVotes: (m.pollVotes || 0) + (m.voted ? -1 : 1) } : m))}>{item.voted ? '✓ Yes, works for me' : 'Yes, works for me'} <em>{item.pollVotes || 0}</em></button><button onClick={() => setMessages(old => old.map(m => m.id === item.id ? { ...m, voted: !m.voted } : m))}>Need another time</button><small>{item.pollVotes || 0} votes · public in this chat</small></div> : item.text}<div className="message-tools" /><span className="meta">{item.time} {item.mine ? '✓✓' : ''}</span></div></div>)}</div>
        <form className={`compose ${editing ? 'editing' : ''}`} onSubmit={(e) => { e.preventDefault(); send() }}>
          {(reply || editing) && <div className="compose-context"><Pencil size={17} /><span><strong>{editing ? 'Edit message' : 'Replying to Mark'}</strong><small>{(editing || reply)?.text.slice(0, 72)}</small></span><button type="button" onClick={() => { setEditing(null); setReply(null); setMessage('') }}><X size={17} /></button></div>}
          {!canPublish ? <div className="channel-readonly"><BellOff size={17} />Only channel administrators can post</div> : <><input ref={fileInput} type="file" hidden onChange={e => { attach(e.target.files?.[0]); e.currentTarget.value = '' }} /><input ref={stickerInput} type="file" hidden accept="image/png,image/webp,image/gif" onChange={e => { void uploadSticker(e.target.files?.[0]); e.currentTarget.value = '' }} /><button className="icon-btn" type="button" title="Attach file" onClick={() => fileInput.current?.click()}><Paperclip size={19} /></button><button className="icon-btn rich-trigger" type="button" aria-label="Open rich message tools" onClick={() => setRichOpen(true)}><Plus size={19} /></button><input aria-label="Message text" maxLength={4000} value={message} onChange={e => setMessage(e.target.value)} placeholder={selectedChannel ? 'Broadcast a post…' : language === 'RU' ? 'Написать сообщение…' : 'Write a message…'} /><button className="icon-btn" type="button" aria-label="Open emoji picker" onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={19} /></button>{!message && !editing ? <VoiceButton mode={recordingMode} active={recording} onModeToggle={() => setRecordingMode(mode => mode === 'voice' ? 'circle' : 'voice')} onStart={startRecording} onStop={stopRecording} /> : <button className="send" aria-label={editing ? 'Save message' : selectedChannel ? 'Publish post' : 'Send message'}>{editing ? <Check size={18} /> : <Send size={17} />}</button>}</>}
          {emojiOpen && <div className="emoji-picker"><div className="emoji-tabs"><button className={pickerTab === 'emoji' ? 'active' : ''} onClick={() => setPickerTab('emoji')}>Emoji</button><button className={pickerTab === 'stickers' ? 'active' : ''} onClick={() => setPickerTab('stickers')}>Stickers</button><button className={pickerTab === 'gifs' ? 'active' : ''} onClick={() => setPickerTab('gifs')}>GIFs</button></div>{pickerTab === 'emoji' ? <><input aria-label="Search emoji" placeholder="Search emoji" readOnly /><div className="emoji-grid">{['😀','😂','🥰','😍','😎','🤝','❤️','🔥','✨','👍','🙏','🎉','💬','🌙','🚀','🍒','✅','🤍','🤔','👏','🎈','💯','🫶','😌'].map(emoji => <button key={emoji} type="button" onClick={() => { setMessage(m => `${m}${emoji}`); setEmojiOpen(false) }}>{emoji}</button>)}</div></> : pickerTab === 'stickers' ? <div className="sticker-picker"><button className="sticker-upload" type="button" onClick={() => stickerInput.current?.click()}>+ Add PNG, WebP or GIF</button><div className="sticker-grid">{stickers.map(sticker => <button key={sticker.id} type="button" aria-label={`Send ${sticker.name}`} onClick={() => { void deliver(sticker.name, 'sticker', undefined, sticker.data_url); setEmojiOpen(false) }}><img src={sticker.data_url} alt={sticker.name} /></button>)}</div></div> : <p className="picker-empty">GIF search is coming soon.</p>}</div>}
        </form></>}
        <nav className="mobile-nav"><button className="active"><MessageCircle size={19} />Chats</button><button onClick={() => setSettingsOpen(true)}><CircleUserRound size={19} />Profile</button><button onClick={() => setSettingsOpen(true)}><Settings size={19} />Settings</button></nav>
      </section>
      {settingsOpen && <SettingsDrawer account={account} profile={profile} setProfile={setProfile} token={token} dark={dark} setDark={setDark} language={language} onLanguage={onLanguage} onClose={() => setSettingsOpen(false)} onLogout={logout} />}
      {contactsOpen && <ContactsPanel contacts={contacts} query={contactSearch} results={peopleResults} onSearch={searchPeople} onClose={() => setContactsOpen(false)} onAdd={addContact} onSelect={contact => void startDirectChat(contact)} />}
      {richOpen && <RichComposerSheet language={language} onClose={() => setRichOpen(false)} onSend={addRich} />}
      {mediaFile && <MediaSendSheet file={mediaFile} language={language} onClose={() => setMediaFile(null)} onSend={mode => { void (async () => { await uploadAndDeliver(mediaFile, mode); setMediaFile(null) })() }} />}
      {storyOpen && <div className="story-overlay" role="dialog" aria-modal="true" aria-label={`${storyOpen} story`} onClick={() => setStoryOpen(null)}><div className="story-card" onClick={e => e.stopPropagation()}><button aria-label="Close story" onClick={() => setStoryOpen(null)}><X size={19} /></button><div className="story-progress"><i /></div><div className="story-copy"><span className="avatar" style={{ background: storyOpen === 'Mark' ? '#6e4c97' : storyOpen === 'Nanda' ? '#9e2338' : '#bf8057' }}>{storyOpen[0]}</span><strong>{storyOpen}</strong><small>{language === 'RU' ? 'только что' : 'just now'}</small></div><p>{language === 'RU' ? 'Немного тишины между важными делами.' : 'A little quiet between important things.'}</p><small className="story-privacy"><ShieldCheck size={14} />{language === 'RU' ? 'История исчезнет через 24 часа' : 'This story disappears in 24 hours'}</small></div></div>}
      {safetyNotice && <div className="contacts-overlay" role="dialog" aria-modal="true" aria-label="Secret-chat safety number" onClick={() => setSafetyNotice('')}><section className="contacts-panel" onClick={event => event.stopPropagation()}><header><strong>Safety number</strong><button aria-label="Close safety number" onClick={() => setSafetyNotice('')}><X size={19} /></button></header><p>Compare this number with the other person by a trusted channel. A changed number means a device key changed.</p><pre className="safety-number">{safetyNotice}</pre><small>Chettik uses static X25519 device keys here. This is not a Signal double-ratchet and does not provide forward secrecy.</small></section></div>}
      {profileOpen && profileAccount && <ProfilePanel account={profileAccount} onClose={() => setProfileOpen(false)} onStartSecret={() => startSecretChat(profileAccount)} onBlock={() => { setProfileOpen(false); setConfirm({ action: 'block' }) }} />}
      {groupOpen && <GroupPanel token={token} chatId={selectedRow?.id} chats={chatRows.map(chat => ({ id: chat.id, name: chat.name }))} onClose={() => setGroupOpen(false)} />}
      {groupMenuOpen && <div className="floating-dismiss" onClick={() => setGroupMenuOpen(false)}><div className="context-menu group-header-menu" onClick={event => event.stopPropagation()}><button onClick={() => setChatMuted(!chatMuted)}><Smile size={16} />{chatMuted ? 'Unmute' : 'Mute'}</button><button onClick={() => { setGroupMenuOpen(false); setGroupOpen(true) }}><Users size={16} />View group info</button><button onClick={() => { setGroupMenuOpen(false); setGroupOpen(true) }}><Pencil size={16} />Manage group</button><button onClick={() => { setGroupMenuOpen(false); addRich('poll') }}><Plus size={16} />Create poll</button><button onClick={() => setGroupMenuOpen(false)}><Forward size={16} />Export chat history</button><button onClick={() => { setGroupMenuOpen(false); setConfirm({ action: 'clear-history' }) }}><Trash2 size={16} />Clear history</button><button className="danger-item" onClick={() => { setGroupMenuOpen(false); setConfirm({ action: 'delete-chat' }) }}><Trash2 size={16} />Delete and leave</button></div></div>}
      {channelMenuOpen && selectedChannel && <div className="floating-dismiss" onClick={() => setChannelMenuOpen(false)}><div className="context-menu group-header-menu" onClick={event => event.stopPropagation()}><button onClick={() => { setChannelMuted(value => !value); setChannelMenuOpen(false) }}><BellOff size={16} />{channelMuted ? 'Unmute channel' : 'Mute channel'}</button><button onClick={() => { setChannelMenuOpen(false); setChannelInfoOpen(true) }}><Users size={16} />Channel info</button>{canPublish && <button onClick={() => { setChannelMenuOpen(false); setChannelEditOpen(true) }}><Edit3 size={16} />Manage channel</button>}</div></div>}
      {confirm && <ConfirmModal action={confirm.action} name="Mark" onClose={() => setConfirm(null)} onConfirm={confirmAction} />}
      {messageMenu && <div className="floating-dismiss" onClick={() => setMessageMenu(null)}><div onClick={event => event.stopPropagation()}><MessageContextMenu mine={messageMenu.mine} time={messageMenu.time} onAction={handleMessageMenu} /></div></div>}
      {forwardMessage && <ForwardPanel onClose={() => setForwardMessage(null)} onForward={target => { addToChat(target, { id: crypto.randomUUID(), mine: true, sender: account.name, text: forwardMessage.text, time: 'now', reactions: [] }); setForwardMessage(null) }} />}
      {createGroupOpen && <GroupForm token={token} onClose={() => setCreateGroupOpen(false)} onSaved={chat => { const row: ChatRow = { id: chat.id, name: chat.title, preview: '', time: '', initials: chat.title.slice(0, 1).toUpperCase(), color: '#4c8a83', unread: 0, kind: 'group' }; setChatRows(rows => rows.some(item => item.id === row.id) ? rows : [row, ...rows]); setChatMessages(items => ({ ...items, [row.name]: [] })); setSelectedChat(row.name); setCreateGroupOpen(false) }} />}
      {createChannelOpen && <ChannelForm token={token} onClose={() => setCreateChannelOpen(false)} onSaved={channel => { setChannels(values => values.some(item => item.id === channel.id) ? values : [channel, ...values]); const row: ChatRow = { id: channel.chat_id, name: channel.title, preview: '', time: '', initials: channel.title.slice(0, 1).toUpperCase(), color: '#9e2338', unread: 0, channel }; setChatRows(values => values.some(item => item.id === row.id) ? values : [row, ...values]); setChatMessages(values => ({ ...values, [channel.title]: values[channel.title] || [] })); openChat(channel.title); setCreateChannelOpen(false) }} />}
      {channelInfoOpen && selectedChannel && <ChannelInfo channel={selectedChannel} muted={channelMuted} token={token} onClose={() => setChannelInfoOpen(false)} onMute={() => setChannelMuted(value => !value)} onManage={() => { setChannelInfoOpen(false); setChannelEditOpen(true) }} onSubscribed={channel => { setChannels(values => values.map(value => value.id === channel.id ? channel : value)); setChatRows(values => values.some(row => row.id === channel.chat_id) ? values.map(row => row.id === channel.chat_id ? { ...row, channel } : row) : [{ id: channel.chat_id, name: channel.title, preview: 'No posts yet', time: '', initials: channel.title.slice(0, 1).toUpperCase(), color: '#9e2338', unread: 0, channel }, ...values]); setChatMessages(values => ({ ...values, [channel.title]: values[channel.title] || [] })) }} />}
      {channelEditOpen && selectedChannel && <ChannelForm channel={selectedChannel} token={token} onClose={() => setChannelEditOpen(false)} onSaved={channel => { setChannels(values => values.map(value => value.id === channel.id ? channel : value)); setChatRows(values => values.map(row => row.id === channel.chat_id ? { ...row, name: channel.title, channel } : row)); if (selectedChat !== channel.title) setSelectedChat(channel.title); setChannelEditOpen(false) }} />}
      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)}><aside className="main-menu telegram-menu" onClick={e => e.stopPropagation()}><button className="menu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={18} /></button><button className="menu-user" onClick={() => { setMenuOpen(false); setProfileAccount(account); setProfileOpen(true) }}><div className="avatar" style={{ background: account.color }}>{account.initials}</div><span><strong>{account.name}</strong><small>{account.username}</small></span><ArrowRight size={17} /></button><div className="menu-links"><button onClick={() => { setMenuOpen(false); void openContacts() }}><MessageCircle size={19} />New chat</button><button onClick={() => { setMenuOpen(false); setCreateGroupOpen(true) }}><Users size={19} />New group</button><button onClick={() => { setMenuOpen(false); setCreateChannelOpen(true) }}><MessageCircle size={19} />New channel</button><button onClick={() => { setMenuOpen(false); void openContacts() }}><Users size={19} />Contacts</button><button onClick={() => { setMenuOpen(false); openChat('Saved Messages') }}><Pin size={19} />Saved messages</button><button onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}><Settings size={19} />Settings</button></div><button className="night-row" onClick={() => setDark(!dark)}><span>{dark ? <Moon size={19} /> : <Sun size={19} />}{dark ? 'Night Mode' : 'Day Mode'}</span><span className={`switch ${dark ? 'on' : ''}`}><i /></span></button><footer>Chettik Web<br /><small>Private by instinct</small></footer></aside></div>}
    </div>
      {chatMenu && <div className="floating-dismiss" onClick={() => setChatMenu(null)}><div onClick={event => event.stopPropagation()}><ChatContextMenu name={chatMenu.name} pinned={chatPinned} muted={chatMuted} onAction={handleChatMenu} style={{ left: chatMenu.x, top: chatMenu.y }} /></div></div>}
  </div>
}

function ChatListRow({ chat, selected, muted, onOpen, onMenu }: { chat: ChatRow; selected: boolean; muted: boolean; onOpen: (name: ChatName) => void; onMenu: (value: { name: ChatName; x: number; y: number }) => void }) {
  const avatarSource = chat.avatarUrl?.startsWith('/') ? new URL(chat.avatarUrl, API_URL).toString() : chat.avatarUrl
  return <button onClick={() => onOpen(chat.name)} onContextMenu={event => { event.preventDefault(); onMenu({ name: chat.name, x: event.clientX, y: event.clientY }) }} className={`chat-row ${selected ? 'active' : ''}`}><div className={`avatar ${chat.channel ? 'channel-avatar' : ''}`} style={{ background: chat.color }}>{avatarSource ? <img src={avatarSource} alt="" /> : chat.secret ? <Lock size={16} /> : chat.channel ? <MessageCircle size={18} /> : chat.initials}</div><div className="chat-copy"><div className="chat-name">{chat.name}{chat.secret ? <Lock size={13} aria-label="End-to-end encrypted" /> : null}{chat.channel ? <span className="channel-mark">CHANNEL</span> : null}<span className="time">{chat.time}</span></div><div className="chat-preview">{muted ? 'Muted' : chat.preview || (chat.name === 'Saved Messages' ? 'Messages saved for yourself' : '')}</div></div>{chat.unread ? <span className="unread">{chat.unread}</span> : null}</button>
}

function ContactsPanel({ contacts, query, results, onSearch, onClose, onAdd, onSelect }: { contacts: Account[]; query: string; results: Account[]; onSearch: (query: string) => void; onClose: () => void; onAdd: (contact: Account) => void; onSelect: (contact: Account) => void }) {
  const avatar = (contact: Account) => contact.avatarUrl ? <img src={contact.avatarUrl.startsWith('/') ? new URL(contact.avatarUrl, API_URL).toString() : contact.avatarUrl} alt="" /> : contact.initials
  return <div className="contacts-overlay" role="dialog" aria-modal="true" aria-label="Contacts" onClick={onClose}><section className="contacts-panel" onClick={event => event.stopPropagation()}><header><strong>Contacts</strong><button aria-label="Close contacts" onClick={onClose}><X size={19} /></button></header><label className="search"><Search size={15} /><input aria-label="Search people" value={query} onChange={event => onSearch(event.target.value)} placeholder="Search @username or name" /></label>{query && <><p>People</p><div>{results.map(person => <button key={person.id} onClick={() => onSelect(person)}><span className="avatar" style={{ background: person.color }}>{avatar(person)}</span><span><strong>{person.name}</strong><small>{person.username}</small></span>{contacts.some(contact => contact.id === person.id) ? <ArrowRight size={17} /> : <span className="contact-actions"><span role="button" tabIndex={0} aria-label={`Add ${person.name}`} onClick={event => { event.stopPropagation(); onAdd(person) }}>Add</span><ArrowRight size={17} /></span>}</button>)}</div></>}<p>{contacts.length ? 'Your contacts' : 'No contacts yet. Search by username to add someone.'}</p><div>{contacts.map(contact => <button key={contact.id} onClick={() => onSelect(contact)}><span className="avatar" style={{ background: contact.color }}>{avatar(contact)}</span><span><strong>{contact.name}</strong><small>{contact.username}</small></span><ArrowRight size={17} /></button>)}</div></section></div>
}

function GroupForm({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: (chat: { id: string; title: string }) => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notice, setNotice] = useState('')
  const save = async () => {
    const response = await fetch(`${API_URL}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description, createChat: true }) })
    const group = await response.json() as { primaryChatId?: string; title?: string; error?: string }
    if (!response.ok || !group.primaryChatId || !group.title) return setNotice(group.error || 'Group could not be created')
    onSaved({ id: group.primaryChatId, title: group.title })
  }
  return <div className="contacts-overlay" role="dialog" aria-modal="true" aria-label="New group" onClick={onClose}><form className="contacts-panel group-create" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void save() }}><header><strong>New group</strong><button type="button" aria-label="Close new group" onClick={onClose}><X size={19} /></button></header><label>Group name<input aria-label="Group name" value={title} onChange={event => setTitle(event.target.value)} placeholder="Weekend plans" autoFocus required /></label><label>Description <span>optional</span><textarea aria-label="Group description" value={description} onChange={event => setDescription(event.target.value)} placeholder="What is this group for?" /></label>{notice && <p className="form-notice">{notice}</p>}<button className="channel-primary" type="submit">Create group</button></form></div>
}

function ChannelForm({ token, channel, onClose, onSaved }: { token: string; channel?: Channel; onClose: () => void; onSaved: (channel: Channel) => void }) {
  const [title, setTitle] = useState(channel?.title || '')
  const [description, setDescription] = useState(channel?.description || '')
  const [visibility, setVisibility] = useState<'public' | 'private'>(channel?.visibility || 'public')
  const [username, setUsername] = useState(channel?.username || '')
  const [notice, setNotice] = useState('')
  const save = async () => {
    const response = await fetch(`${API_URL}/channels${channel ? `/${channel.id}` : ''}`, {
      method: channel ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, description, visibility, username }),
    })
    const payload = await response.json() as Channel & { error?: string }
    if (!response.ok) return setNotice(payload.error || 'Channel could not be saved')
    onSaved({ ...channel, ...payload, chat_id: payload.chat_id || (payload as Channel & { chatId?: string }).chatId || channel?.chat_id || '', subscriber_count: payload.subscriber_count ?? channel?.subscriber_count ?? 1, my_role: payload.my_role ?? channel?.my_role ?? 'owner' } as Channel)
  }
  return <div className="tg-overlay" onClick={onClose}><aside className="tg-panel channel-panel" role="dialog" aria-modal="true" aria-label={channel ? 'Edit channel' : 'New Channel'} onClick={event => event.stopPropagation()}><header className="tg-panel-head"><button className="icon-btn" aria-label="Close channel form" onClick={onClose}><X size={21} /></button><strong>{channel ? 'Edit channel' : 'New Channel'}</strong><button className="group-save" onClick={() => void save()}>{channel ? 'Save' : 'Create'}</button></header><div className="channel-form"><div className="channel-form-icon"><MessageCircle size={28} /></div><label>Channel name<input aria-label="Channel name" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="Channel name" autoFocus /></label><label>Description<textarea aria-label="Channel description" value={description} maxLength={1000} onChange={event => setDescription(event.target.value)} placeholder="What is this channel about?" /></label><div className="channel-type"><strong>Channel type</strong><button className={visibility === 'public' ? 'selected' : ''} onClick={() => setVisibility('public')}><span><b>Public channel</b><small>Anyone can find and subscribe</small></span>{visibility === 'public' && <Check size={17} />}</button><button className={visibility === 'private' ? 'selected' : ''} onClick={() => setVisibility('private')}><span><b>Private channel</b><small>Only people you add can view posts</small></span>{visibility === 'private' && <Check size={17} />}</button></div>{visibility === 'public' && <label>Public link<input aria-label="Channel handle" value={username} maxLength={32} onChange={event => setUsername(event.target.value.replace(/^@/, '').toLowerCase())} placeholder="channel_handle" /><small>chettik.me/{username || 'channel_handle'}</small></label>}{notice && <p className="form-notice" role="alert">{notice}</p>}<button className="channel-primary" onClick={() => void save()}>{channel ? 'Save changes' : 'Create channel'}</button></div></aside></div>
}

function ChannelInfo({ channel, muted, token, onClose, onMute, onManage, onSubscribed }: { channel: Channel; muted: boolean; token: string; onClose: () => void; onMute: () => void; onManage: () => void; onSubscribed: (channel: Channel) => void }) {
  const canManage = channel.my_role === 'owner' || channel.my_role === 'admin'
  const subscribe = async () => {
    const response = await fetch(`${API_URL}/channels/${channel.id}/subscribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (response.ok) onSubscribed({ ...channel, my_role: 'subscriber', subscriber_count: channel.subscriber_count + 1 })
  }
  return <div className="tg-overlay" onClick={onClose}><aside className="tg-panel channel-panel" role="dialog" aria-modal="true" aria-label={`${channel.title} channel info`} onClick={event => event.stopPropagation()}><header className="tg-panel-head"><button className="icon-btn" aria-label="Close channel info" onClick={onClose}><X size={21} /></button><strong>Channel info</strong></header><div className="channel-info"><div className="channel-hero"><div className="avatar channel-avatar"><MessageCircle size={28} /></div><h2>{channel.title}</h2><p>{channel.subscriber_count} subscriber{channel.subscriber_count === 1 ? '' : 's'}</p>{channel.username && <small>@{channel.username}</small>}</div>{channel.description && <p className="channel-description">{channel.description}</p>}<div className="tg-list"><button className="tg-row" onClick={onMute}><span className="tg-row-icon"><BellOff size={20} /></span><span className="tg-row-copy"><strong>{muted ? 'Unmute' : 'Mute'}</strong><small>{muted ? 'Notifications are paused' : 'Choose when this channel can notify you'}</small></span></button>{canManage && <InviteControls token={token} target="channel" targetId={channel.id} publicHandle={channel.username} />}{canManage ? <button className="tg-row" onClick={onManage}><span className="tg-row-icon"><Edit3 size={20} /></span><span className="tg-row-copy"><strong>Manage channel</strong><small>Edit details and public link</small></span></button> : channel.my_role ? <div className="channel-subscribed"><Check size={17} />Subscribed</div> : <button className="channel-primary" onClick={() => void subscribe()}>Subscribe</button>}<button className="tg-row" onClick={onClose}><span className="tg-row-icon"><MoreHorizontal size={20} /></span><span className="tg-row-copy"><strong>More</strong><small>Share or report channel</small></span></button></div></div></aside></div>
}

function InviteControls({ token, target, targetId, publicHandle }: { token: string; target: 'group' | 'channel'; targetId: string; publicHandle?: string | null }) {
  const [people, setPeople] = useState<Account[]>([])
  const [expanded, setExpanded] = useState(false)
  const [link, setLink] = useState('')
  const [notice, setNotice] = useState('')
  const open = async () => {
    setExpanded(value => !value)
    if (!people.length) {
      const response = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) setPeople(await response.json() as Account[])
    }
  }
  const createLink = async () => {
    const response = await fetch(`${API_URL}/${target}s/${targetId}/invite-link`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const payload = await response.json() as { url?: string; error?: string }
    if (response.ok && payload.url) { setLink(payload.url); setNotice('Invite link ready') } else setNotice(payload.error || 'Could not create an invite link')
  }
  const add = async (person: Account) => {
    const response = await fetch(`${API_URL}/${target}s/${targetId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: person.id }) })
    setNotice(response.ok ? `${person.name} added` : 'Could not add subscriber')
  }
  return <div className="invite-controls"><button className="tg-row" onClick={() => void open()}><span className="tg-row-icon"><Users size={20} /></span><span className="tg-row-copy"><strong>Add {target === 'channel' ? 'subscribers' : 'members'}</strong><small>Invite people from your contacts</small></span></button><button className="tg-row" onClick={() => void createLink()}><span className="tg-row-icon"><Copy size={20} /></span><span className="tg-row-copy"><strong>Invite link</strong><small>{publicHandle ? `@${publicHandle} · also share a private link` : 'Create a private link for this chat'}</small></span></button>{expanded && <div className="invite-people">{people.map(person => <button key={person.id} onClick={() => void add(person)}><span className="avatar" style={{ background: person.color }}>{person.initials}</span><span><strong>{person.name}</strong><small>{person.username}</small></span><Users size={16} /></button>)}</div>}{link && <button className="invite-link" onClick={() => { void navigator.clipboard.writeText(link); setNotice('Invite link copied') }}><span>{link}</span><Copy size={16} /></button>}{notice && <p className="invite-notice">{notice}</p>}</div>
}

export function SettingsPage({ account, dark, profile, setProfile, onBack, onLogout }: { account: Account; dark: boolean; profile: Profile; setProfile: (p: Profile) => void; onBack: () => void; onLogout: () => void }) {
  const update = (key: keyof Profile, value: string) => setProfile({ ...profile, [key]: value })
  return <main className={`settings-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">PROFILE & PRIVACY</div><h1>Your profile</h1><p>Cloud-synced with your Chettik account. Privacy defaults apply immediately.</p><div className="profile-card"><img src="/logo.svg" alt="" /><strong>{account.name} <span className="badge">{account.role}</span></strong><small>{account.email}</small></div><div className="settings-list"><label><strong>Bio</strong><textarea value={profile.bio} onChange={e => update('bio', e.target.value)} placeholder="Tell people about yourself" /></label><label><strong>Discord</strong><input value={profile.discord} onChange={e => update('discord', e.target.value)} placeholder="discord username" /></label><label><strong>GitHub</strong><input value={profile.github} onChange={e => update('github', e.target.value)} placeholder="github username" /></label><label><strong>Who sees last seen</strong><select value={profile.lastSeen} onChange={e => update('lastSeen', e.target.value)}><option>Everybody</option><option>Contacts</option><option>Nobody</option></select></label><button onClick={() => setProfile({ ...profile, blocked: [...profile.blocked, 'Mark'] })}><span><strong>Block Mark</strong><small>{profile.blocked.includes('Mark') ? 'Blocked' : 'Prevent messages and presence'}</small></span><Lock size={16} /></button></div><button className="danger" onClick={onLogout}>Log out safely</button></article></main>
}

function AdminPage({ account, reports, clearReports, onBack }: { account: Account; reports: string[]; clearReports: () => void; onBack: () => void }) {
  return <main className="settings-page dark"><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">CHEttik operations</div><h1>Moderation console</h1><p>Signed in as {account.role} {account.name}. Local environment data only.</p><div className="admin-grid"><div><ShieldCheck size={22} /><strong>{reports.length}</strong><small>Open reports</small></div><div><Users size={22} /><strong>3</strong><small>Seed accounts</small></div><div><MessageCircle size={22} /><strong>Cloud</strong><small>Chat store</small></div></div><div className="settings-list">{reports.length ? reports.map((r, i) => <button key={`${r}-${i}`}><span><strong>Pending report</strong><small>{r}</small></span><Flag size={16} /></button>) : <div className="empty">No reports yet. Use a message’s flag action to create one.</div>}</div><button className="danger" onClick={clearReports}>Resolve all reports</button></article></main>
}
