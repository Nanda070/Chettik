import { BellRing, Check, ChevronRight, EyeOff, MapPin, Mic, Radio, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { useState } from 'react'

type Props = {
  language: 'EN' | 'RU'
  onClose: () => void
  onSend: (kind: 'poll' | 'location' | 'circle') => void
}

export function RichComposerSheet({ language, onClose, onSend }: Props) {
  const ru = language === 'RU'
  const [poll, setPoll] = useState(['Team sync at 15:00?', 'Yes, works for me', 'Need another time'])
  const [view, setView] = useState<'actions' | 'poll' | 'location'>('actions')
  const labels = ru
    ? { title: 'Вложения', poll: 'Опрос', location: 'Геопозиция', circle: 'Видеосообщение', create: 'Создать опрос', cancel: 'Отмена', share: 'Отправить геопозицию', question: 'Вопрос', option: 'Вариант' }
    : { title: 'Share securely', poll: 'Poll', location: 'Location', circle: 'Video circle', create: 'Create poll', cancel: 'Cancel', share: 'Share location', question: 'Question', option: 'Option' }
  if (view === 'poll') return <div className="rich-sheet" role="dialog" aria-modal="true" aria-label={labels.poll}>
    <SheetHead title={labels.poll} onClose={onClose} />
    <div className="rich-form">
      <label>{labels.question}<input value={poll[0]} maxLength={120} onChange={e => setPoll([e.target.value, poll[1], poll[2]])} /></label>
      {poll.slice(1).map((value, index) => <label key={index}>{labels.option} {index + 1}<input value={value} maxLength={80} onChange={e => { const next = [...poll]; next[index + 1] = e.target.value; setPoll(next) }} /></label>)}
      <button className="rich-primary" onClick={() => { onSend('poll'); onClose() }}><Check size={17} />{labels.create}</button>
      <button className="rich-secondary" onClick={() => setView('actions')}>{labels.cancel}</button>
    </div>
  </div>
  if (view === 'location') return <div className="rich-sheet" role="dialog" aria-modal="true" aria-label={labels.location}>
    <SheetHead title={labels.location} onClose={onClose} />
    <div className="location-preview"><div className="map-grid"><MapPin size={34} fill="currentColor" /></div><strong>{ru ? 'Точное местоположение' : 'Precise location'}</strong><small>{ru ? 'Московский проспект · только в этом чате' : 'Moscow Avenue · only in this chat'}</small><p><EyeOff size={15} />{ru ? 'Не публикуется в профиле и не используется для рекламы.' : 'Never added to your profile or used for ads.'}</p><button className="rich-primary" onClick={() => { onSend('location'); onClose() }}><MapPin size={17} />{labels.share}</button></div>
  </div>
  return <div className="rich-sheet" role="dialog" aria-modal="true" aria-label={labels.title}>
    <SheetHead title={labels.title} onClose={onClose} />
    <div className="rich-actions">
      <button onClick={() => setView('poll')}><span className="rich-icon poll"><SlidersHorizontal size={21} /></span><span><strong>{labels.poll}</strong><small>{ru ? 'Соберите решение без шума' : 'Decide together, quietly'}</small></span><ChevronRight size={18} /></button>
      <button onClick={() => setView('location')}><span className="rich-icon location"><MapPin size={21} /></span><span><strong>{labels.location}</strong><small>{ru ? 'Поделитесь только в чате' : 'Share only with this chat'}</small></span><ChevronRight size={18} /></button>
      <button onClick={() => { onSend('circle'); onClose() }}><span className="rich-icon circle"><Radio size={21} /></span><span><strong>{labels.circle}</strong><small>{ru ? 'Короткое личное видео' : 'A short, personal video'}</small></span><ChevronRight size={18} /></button>
    </div>
  </div>
}

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return <header className="rich-head"><strong>{title}</strong><button aria-label="Close" onClick={onClose}><X size={20} /></button></header>
}

export function DeliveryPanel({ language, enabled, telemetry, onChange, onClose }: { language: 'EN' | 'RU'; enabled: boolean; telemetry: boolean; onChange: (value: { push?: boolean; telemetry?: boolean }) => void; onClose: () => void }) {
  const ru = language === 'RU'
  const rows = [
    { icon: <BellRing size={20} />, title: ru ? 'Уведомления' : 'Push notifications', hint: ru ? 'Новые сообщения и ответы' : 'New messages and replies', value: enabled, key: 'push' as const },
    { icon: <ShieldCheck size={20} />, title: ru ? 'Приватная телеметрия' : 'Private telemetry', hint: ru ? 'Только обезличенные показатели качества' : 'Only anonymous reliability signals', value: telemetry, key: 'telemetry' as const },
  ]
  return <div className="tg-overlay" role="dialog" aria-modal="true" aria-label={ru ? 'Доставка и приватность' : 'Delivery and privacy'}>
    <aside className="tg-panel delivery-panel"><header className="tg-panel-head"><button className="icon-btn" aria-label="Close settings" onClick={onClose}><X size={21} /></button><strong>{ru ? 'Доставка и приватность' : 'Delivery and privacy'}</strong></header>
      <div className="delivery-intro"><span><BellRing size={19} /></span><h3>{ru ? 'Спокойно. Только важное.' : 'Quiet. Only what matters.'}</h3><p>{ru ? 'Настройте доставку без рекламного профилирования и скрытого отслеживания.' : 'Control delivery without advertising profiles or hidden tracking.'}</p></div>
      <div className="tg-list">{rows.map(row => <button className="tg-row" key={row.key} onClick={() => onChange({ [row.key]: !row.value })}><span className="tg-row-icon">{row.icon}</span><span className="tg-row-copy"><strong>{row.title}</strong><small>{row.hint}</small></span><span className={`switch ${row.value ? 'on' : ''}`} aria-label={`${row.title}: ${row.value ? 'on' : 'off'}`}><i /></span></button>)}</div>
      <p className="delivery-note"><EyeOff size={15} />{ru ? 'Push-ключ и метаданные уведомлений остаются только на вашем устройстве в этой локальной PWA-демонстрации.' : 'The push key and notification metadata stay on this device in this local PWA demonstration.'}</p>
    </aside>
  </div>
}

export function VoiceButton({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return <button className={`voice-button ${active ? 'recording' : ''}`} type="button" aria-label={label} title={label} onClick={onToggle}>{active ? <span className="record-dot" /> : <Mic size={19} />}</button>
}
