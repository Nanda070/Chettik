import { Bot, Code2, GitPullRequest, Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { Account } from './Chettik'

type LocalBot = { id: string; name: string; handle: string; active: boolean }
const STORE = 'chettik-stage-5'

function readBots(account: Account): LocalBot[] {
  const data = JSON.parse(localStorage.getItem(STORE) || '{}')
  return data[account.phone] || [{ id: 'bot-1', name: 'Release notes', handle: '@release_notes_bot', active: true }]
}

export function Stage5Panel({ account, onBack }: { account: Account; onBack: () => void }) {
  const [bots, setBots] = useState(() => readBots(account))
  const [name, setName] = useState('')
  const persist = (next: LocalBot[]) => {
    const data = JSON.parse(localStorage.getItem(STORE) || '{}')
    localStorage.setItem(STORE, JSON.stringify({ ...data, [account.phone]: next }))
    setBots(next)
  }
  const createBot = () => {
    const label = name.trim()
    if (!label) return
    persist([...bots, { id: crypto.randomUUID(), name: label, handle: `@${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_bot`, active: true }])
    setName('')
  }
  return <main className="settings-page dark"><header><button className="back" onClick={onBack}>← Back to chats</button></header><article><div className="eyebrow">STAGE 5 / PROGRAMMER WORKSPACE</div><h1>Automate with intent.</h1><p>Local-only bot and pull-request spaces for developer accounts. Nothing connects to GitHub or leaves this device.</p>
    <section className="settings-list"><div className="stage5-title"><Bot size={19} /><span><strong>User bots</strong><small>Private automations scoped to your local account</small></span></div>{bots.map(bot => <button key={bot.id} onClick={() => persist(bots.map(item => item.id === bot.id ? { ...item, active: !item.active } : item))}><span><strong>{bot.name}</strong><small>{bot.handle} · {bot.active ? 'Enabled' : 'Paused'}</small></span><ShieldCheck size={17} /></button>)}<label><strong>New bot</strong><input aria-label="New bot name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Review reminders" /></label><button onClick={createBot}><Plus size={17} />Create local bot</button></section>
    <section className="settings-list"><div className="stage5-title"><Code2 size={19} /><span><strong>Repository spaces</strong><small>Programmer-only local mock data</small></span></div><button><span><strong>chettik/web</strong><small>main · 3 open pull requests</small></span><GitPullRequest size={17} /></button><button><span><strong>PR #42 · Privacy-aware profile panels</strong><small>Nanda → main · ready for review</small></span><GitPullRequest size={17} /></button><button><span><strong>PR #41 · Composer media affordances</strong><small>Mark → main · changes requested</small></span><GitPullRequest size={17} /></button></section>
  </article></main>
}
