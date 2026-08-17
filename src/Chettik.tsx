import { ArrowRight, Bell, Check, ChevronLeft, CircleUserRound, Compass, Menu, MessageCircle, Moon, MoreHorizontal, Paperclip, Plus, Search, Send, Settings, ShieldCheck, Smile, Sun, Users } from 'lucide-react'
import { useState } from 'react'
import './App.css'

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

export default function Chettik() {
  const [dark, setDark] = useState(true)
  const [language, setLanguage] = useState<'EN' | 'RU'>('EN')
  const [picked, setPicked] = useState<Account | null>(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [session, setSession] = useState<Account | null>(null)
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  const ru = language === 'RU'
  const copy = ru
    ? { title: 'Тише. Ближе. По-своему.', subtitle: 'Приватность — по умолчанию. Знакомый интерфейс.', pick: 'Выберите демо-аккаунт', phone: 'или введите номер телефона', continue: 'Продолжить', secure: 'Телефон — основа личности. Сначала SMS OTP, затем fallback в Telegram.', code: 'Введите код из 6 цифр', verify: 'Подтвердить и войти', back: 'Назад' }
    : { title: 'A quieter place to be close.', subtitle: 'Private by instinct. Familiar by design.', pick: 'Choose a demo account', phone: 'or enter your phone number', continue: 'Continue', secure: 'Phone-first identity. SMS OTP with Telegram delivery fallback.', code: 'Enter the 6-digit code', verify: 'Verify & enter', back: 'Back' }

  if (legal) return <LegalPage doc={legal} language={language} dark={dark} onBack={() => setLegal(null)} />
  if (session) return <Messenger account={session} dark={dark} setDark={setDark} />
  return <main className={`auth-screen ${dark ? 'dark' : ''}`}>
    <div className="auth-ambient one" /><div className="auth-ambient two" />
    <header className="auth-header">
      <div className="auth-logo"><span>C</span> chettik</div>
      <div className="auth-controls"><button onClick={() => setLanguage(ru ? 'EN' : 'RU')}>{language}</button><button aria-label="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
    </header>
    <section className="auth-layout">
      <div className="auth-intro"><div className="eyebrow"><ShieldCheck size={15} /> PRIVATE MESSENGER</div><h1>{copy.title}</h1><p>{copy.subtitle}</p><div className="auth-note"><Check size={16} /> {copy.secure}</div></div>
      <div className="auth-card">
        {!picked && <><div className="card-kicker">{copy.pick}</div><div className="account-options">{seedAccounts.map(account => <button className="account-option" key={account.phone} onClick={() => setPicked(account)}><div className="avatar" style={{ background: account.color }}>{account.initials}</div><span><strong>{account.name}</strong><small>{account.username} · {account.role}</small></span><ArrowRight size={17} /></button>)}</div><div className="divider"><span>{copy.phone}</span></div><form onSubmit={(e) => { e.preventDefault(); if (phone) setPicked(seedAccounts.find(a => a.phone === phone) ?? seedAccounts[2]) }}><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900" aria-label="Phone number" /><button className="primary" type="submit">{copy.continue} <ArrowRight size={16} /></button></form></>}
        {picked && <><button className="back" onClick={() => { setPicked(null); setOtp('') }}><ChevronLeft size={16} /> {copy.back}</button><div className="code-user"><div className="avatar" style={{ background: picked.color }}>{picked.initials}</div><strong>{picked.name}</strong><span>{picked.phone}</span></div><p className="code-copy">{copy.code}</p><form onSubmit={(e) => { e.preventDefault(); if (otp.length >= 4) setSession(picked) }}><input className="otp" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" inputMode="numeric" autoFocus /><button className="primary" type="submit">{copy.verify} <ArrowRight size={16} /></button></form><small className="demo-hint">Demo: enter any 4+ digits.</small></>}
      </div>
    </section>
    <footer><span>© 2026 Chettik</span><span><button onClick={() => setLegal('terms')}>Terms</button> · <button onClick={() => setLegal('privacy')}>Privacy</button> · <button onClick={() => setLegal('authors')}>Authors</button></span></footer>
  </main>
}

function LegalPage({ doc, language, dark, onBack }: { doc: LegalDoc; language: 'EN' | 'RU'; dark: boolean; onBack: () => void }) {
  const ru = language === 'RU'
  const pages: Record<LegalDoc, [string, string, string[]]> = {
    terms: ru ? ['Условия использования', 'Черновик для Stage 1 · вступает в силу после юридической проверки', ['Использование сервиса', 'Chettik — сервис обмена сообщениями. Вы обязуетесь использовать его законно, не нарушать права других лиц и не обходить меры безопасности.', 'Аккаунт и модерация', 'Телефон является основной идентичностью аккаунта. Мы можем ограничить доступ при нарушении правил, обработке валидного репорта или требованиях закона.', 'Статус документа', 'Этот текст — продуктовый placeholder. До публичного запуска он будет заменён версией, проверенной юристами для CIS/RF, EU, US и Canada.']] : ['Terms of Service', 'Stage 1 draft · effective after legal review', ['Using Chettik', 'Chettik is a messaging service. You agree to use it lawfully, respect other people’s rights, and not evade security measures.', 'Accounts and moderation', 'A phone number is the primary account identity. We may limit access following policy violations, valid reports, or legal requirements.', 'Document status', 'This is a product placeholder. It will be replaced before public launch by counsel-reviewed terms for CIS/RF, EU, US, and Canada.']],
    privacy: ru ? ['Политика конфиденциальности', 'Черновик для Stage 1 · версия 0.1', ['Данные, которые нужны сервису', 'Для аккаунта обрабатываются номер телефона, профиль и данные сессии. Содержимое облачных чатов обрабатывается для доставки сообщений; секретные чаты проектируются отдельно как device-bound E2E.', 'Ваш контроль', 'Настройки приватности дают аудитории everybody / nobody / contacts / exceptions. Пользователь может управлять сообщениями, блокировками, данными профиля и удалением аккаунта.', 'Хранение и права', 'Финальная политика определит сроки хранения, удаление, контакты privacy и права, применимые на рынках запуска.']] : ['Privacy Policy', 'Stage 1 draft · version 0.1', ['Data needed for the service', 'We process a phone number, profile information, and session data for your account. Cloud-chat content is processed to deliver messages; secret chats are separately designed as device-bound E2E.', 'Your control', 'Privacy settings support everybody / nobody / contacts / exceptions audiences. You can manage messages, blocks, profile data, and account deletion.', 'Retention and rights', 'The final policy will define retention, deletion, privacy contacts, and rights for each launch market.']],
    authors: ru ? ['Авторы и благодарности', 'Chettik · продуктовый документ', ['Продукт', 'Chettik — автор и оператор продукта. Авторы и владельцы продукта будут указаны в финальном релизе.', 'Участники', 'Contributors: TBD. Мы добавим участников и их роли после формирования команды и подтверждения вкладов.', 'Open source', 'Веб-клиент использует React, Vite и Lucide. Уведомления о сторонних лицензиях будут опубликованы до публичного запуска.']] : ['Authors & Credits', 'Chettik · product notice', ['Product', 'Chettik is the product author and operator. Product authors and owners will be named in the final release.', 'Contributors', 'Contributors: TBD. We will add contributors and roles once the team and contributions are confirmed.', 'Open source', 'The web client uses React, Vite, and Lucide. Third-party license notices will be published before public launch.']],
  }
  const content = pages[doc]
  return <main className={`legal-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Chettik</button><span>{language}</span></header><article><div className="eyebrow">LEGAL / {doc.toUpperCase()}</div><h1>{content[0]}</h1><p className="legal-subtitle">{content[1]}</p>{content[2].map((line, index) => index % 2 === 0 ? <section key={line}><h2>{line}</h2><p>{content[2][index + 1]}</p></section> : null)}</article></main>
}

type MessengerProps = { account: Account; dark: boolean; setDark: (value: boolean) => void }
const chats = [
  { name: 'Mark', preview: 'That reads much better.', time: '10:42', initials: 'M', color: '#6e4c97', unread: 2 },
  { name: 'Design circle', preview: 'Nanda: I shared the new motion study ✨', time: '09:30', initials: 'D', color: '#4c8a83', unread: 0 },
  { name: 'Saved Messages', preview: 'You: Remember to write this down.', time: 'Mon', initials: 'S', color: '#9e2338', unread: 0 },
  { name: 'Alisher', preview: 'See you after work!', time: 'Sun', initials: 'A', color: '#bf8057', unread: 0 },
]

function Messenger({ account, dark, setDark }: MessengerProps) {
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState(false)
  const [messages, setMessages] = useState([{ mine: false, sender: 'Mark', text: 'I tried the new onboarding flow. It feels really calm.', time: '10:38' }, { mine: true, sender: account.name, text: 'That was the idea. Less noise, more space for people.', time: '10:40' }, { mine: false, sender: 'Mark', text: 'That reads much better. And the dark red feels like a real signature.', time: '10:42' }])
  const send = () => { if (!message.trim()) return; setMessages([...messages, { mine: true, sender: account.name, text: message.trim(), time: 'now' }]); setMessage('') }
  if (settings) return <SettingsPage account={account} dark={dark} onBack={() => setSettings(false)} />
  return <div className={`app ${dark ? 'dark' : ''}`}>
    <div className="app-shell">
      <nav className="rail"><div className="mark">C</div><button className="rail-btn active"><MessageCircle size={20} /></button><button className="rail-btn"><Users size={20} /></button><button className="rail-btn"><Compass size={20} /></button><div className="rail-spacer" /><button className="rail-btn"><Bell size={19} /></button><button className="avatar me" title={account.name}>{account.initials}</button></nav>
      <aside className="sidebar"><div className="side-top"><div className="wordmark">chett<span>i</span>k</div><button className="icon-btn"><Plus size={19} /></button></div><div className="search"><Search size={15} /> Search messages</div><div className="stories">{['N', 'M', 'A', 'D'].map((initial, index) => <div className="story" key={initial}><div className="avatar" style={{ background: ['#9e2338', '#6e4c97', '#bf8057', '#4c8a83'][index] }}>{initial}</div><span>{['Nanda', 'Mark', 'Alisher', 'Dasha'][index]}</span></div>)}</div><div className="list-title">Direct messages</div><div className="chat-list">{chats.map((chat, i) => <button className={`chat-row ${i === 0 ? 'active' : ''}`} key={chat.name}><div className="avatar" style={{ background: chat.color }}>{chat.initials}</div><div className="chat-copy"><div className="chat-name">{chat.name}<span className="time">{chat.time}</span></div><div className="chat-preview">{chat.preview}</div></div>{chat.unread ? <span className="unread">{chat.unread}</span> : null}</button>)}</div></aside>
      <section className="chat"><header className="chat-head"><button className="icon-btn mobile-menu"><Menu size={20} /></button><div className="avatar" style={{ background: '#6e4c97' }}>M</div><div className="chat-person"><strong>Mark <span className="badge">ADMIN</span></strong><span>online</span></div><div className="head-actions"><button className="icon-btn"><Search size={19} /></button><button className="icon-btn"><MoreHorizontal size={20} /></button><button className="icon-btn" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header><div className="messages"><div className="date">Today</div>{messages.map((item, i) => <div className={`message ${item.mine ? 'mine' : ''}`} key={`${item.time}-${i}`}><div className="avatar" style={{ background: item.mine ? account.color : '#6e4c97' }}>{item.mine ? account.initials : 'M'}</div><div className="bubble"><span className="sender">{item.sender}</span>{item.text}<span className="meta">{item.time} {item.mine ? '✓✓' : ''}</span></div></div>)}</div><form className="compose" onSubmit={(e) => { e.preventDefault(); send() }}><button className="icon-btn" type="button"><Paperclip size={19} /></button><input value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message…" /><button className="icon-btn" type="button"><Smile size={19} /></button><button className="send" aria-label="Send message"><Send size={17} /></button></form><nav className="mobile-nav"><button className="active"><MessageCircle size={19} />Chats</button><button><CircleUserRound size={19} />Profile</button><button onClick={() => setSettings(true)}><Settings size={19} />Settings</button></nav></section>
    </div>
  </div>
}

function SettingsPage({ account, dark, onBack }: { account: Account; dark: boolean; onBack: () => void }) {
  const rows = [['Account', `${account.phone} · ${account.email}`], ['Privacy', 'Phone, last seen, photo, bio, birthday, forwards, voice & messages'], ['Security', 'Passcode / Face ID · 2FA · passkeys · active sessions'], ['Messages', 'Auto-delete · blocked users · storage'], ['Devices', 'QR sign-in · profile QR · login alerts'], ['Account deletion', '1 / 3 / 6 / 12 / 18 / 24 months of inactivity']]
  return <main className={`settings-page ${dark ? 'dark' : ''}`}><header><button className="back" onClick={onBack}><ChevronLeft size={17} /> Back to chats</button></header><article><div className="eyebrow">STAGE 1 / SETTINGS</div><h1>Settings foundations</h1><p>Product stubs for the account, safety, and privacy controls planned for Chettik.</p><div className="settings-list">{rows.map(([title, detail]) => <button key={title}><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={17} /></button>)}</div></article></main>
}
