import { ArrowRight, Check, ChevronLeft, Moon, ShieldCheck, Sun } from 'lucide-react'
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
  const ru = language === 'RU'
  const copy = ru
    ? { title: 'Тише. Ближе. По-своему.', subtitle: 'Приватность — по умолчанию. Знакомый интерфейс.', pick: 'Выберите демо-аккаунт', phone: 'или введите номер телефона', continue: 'Продолжить', secure: 'Телефон — основа личности. Сначала SMS OTP, затем fallback в Telegram.', code: 'Введите код из 6 цифр', verify: 'Подтвердить и войти', back: 'Назад' }
    : { title: 'A quieter place to be close.', subtitle: 'Private by instinct. Familiar by design.', pick: 'Choose a demo account', phone: 'or enter your phone number', continue: 'Continue', secure: 'Phone-first identity. SMS OTP with Telegram delivery fallback.', code: 'Enter the 6-digit code', verify: 'Verify & enter', back: 'Back' }

  if (session) return <div className={`app ${dark ? 'dark' : ''}`}><div className="session-stub">Signed in as <strong>{session.name}</strong>. Core messenger is loading next.</div></div>
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
    <footer><span>© 2026 Chettik</span><span>Terms · Privacy · Authors</span></footer>
  </main>
}
