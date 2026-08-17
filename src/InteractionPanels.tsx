import { Archive, BellOff, Check, ChevronRight, Clock3, Copy, Edit3, FileText, Forward, Lock, MessageCircle, MoreHorizontal, Pin, Search, Send, Share2, Trash2, UserRound, VolumeX, X } from 'lucide-react'
import { useState } from 'react'
import type { Account, ChatName } from './Chettik'

export type ConfirmAction = 'report' | 'block' | 'delete-message' | 'delete-chat' | 'clear-history'

export function BadgeStrip({ account, compact = false }: { account: Account; compact?: boolean }) {
  const definitions: Record<string, { icon: string; name: string; detail: string; tone: string }> = {
    staff: { icon: '✦', name: 'Staff', detail: 'Chettik operations team', tone: 'rose' },
    'early-supporter': { icon: '♥', name: 'Early Supporter', detail: 'Supported Chettik early', tone: 'gold' },
    system: { icon: '⚙', name: 'System', detail: 'Official automated account', tone: 'blue' },
    official: { icon: '✓', name: 'Official', detail: 'Verified Chettik identity', tone: 'blue' },
    op: { icon: 'OP', name: 'Original Poster', detail: 'Started this discussion', tone: 'violet' },
    'crimson-circle': { icon: '◈', name: 'Crimson Circle', detail: 'Chettik’s founding house', tone: 'rose' },
    'ember-house': { icon: '◆', name: 'Ember House', detail: 'Calm leadership achievement', tone: 'violet' },
    'aurora-house': { icon: '✧', name: 'Aurora House', detail: 'Thoughtful community achievement', tone: 'mint' },
  }
  const badges = (account.badges || []).map(id => definitions[id]).filter(Boolean)
  return <div className={`badge-strip ${compact ? 'compact' : ''}`} aria-label={`${account.name} achievements`}>{badges.map((badge, index) => <span className={`profile-badge ${badge.tone} ${index === 0 ? 'selected' : ''}`} key={badge.name} title={`${badge.name} — ${badge.detail}`} aria-label={badge.name}>{badge.icon}</span>)}</div>
}

export function ConfirmModal({ action, name, onClose, onConfirm }: { action: ConfirmAction; name: string; onClose: () => void; onConfirm: (alsoDelete: boolean) => void }) {
  const [alsoDelete, setAlsoDelete] = useState(false)
  const copy: Record<ConfirmAction, [string, string, string, boolean]> = {
    report: ['Report message?', 'Your report helps us review this message. You can also remove it from this conversation.', 'Report', true],
    block: [`Block ${name}?`, `They will no longer be able to message you or see your presence in Chettik.`, 'Block', false],
    'delete-message': ['Delete message?', 'This message will be removed from your cloud-chat view.', 'Delete', false],
    'delete-chat': [`Delete chat with ${name}?`, 'This clears the local conversation from your chat list.', 'Delete chat', true],
    'clear-history': ['Clear history?', 'Messages in this local chat will be cleared. This cannot be undone.', 'Clear', false],
  }
  const [title, body, destructive, checkbox] = copy[action]
  return <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <div className="confirm-card"><h2>{title}</h2><p>{body}</p>{checkbox && <label className="confirm-check"><input type="checkbox" checked={alsoDelete} onChange={event => setAlsoDelete(event.target.checked)} /><span>Also delete for {name}</span></label>}<div className="confirm-actions"><button onClick={onClose}>Cancel</button><button className="destructive" onClick={() => onConfirm(alsoDelete)}>{destructive}</button></div></div>
  </div>
}

export function ProfilePanel({ account, phoneVisible, onClose, onBlock, onStartSecret }: { account: Account; phoneVisible: boolean; onClose: () => void; onBlock: () => void; onStartSecret: () => void }) {
  const [more, setMore] = useState(false)
  return <div className="profile-overlay" role="dialog" aria-modal="true" aria-label={`${account.name} profile`} onClick={onClose}>
    <aside className="profile-panel" onClick={event => event.stopPropagation()}><header><button aria-label="Close profile" onClick={onClose}><X size={20} /></button><button aria-label="More profile actions" onClick={() => setMore(value => !value)}><MoreHorizontal size={21} /></button>{more && <div className="profile-more-menu"><button>Share profile</button><button>Export chat</button><button onClick={onStartSecret}><Lock size={16} />Start secret chat</button><button>Clear history</button><button className="danger-item" onClick={onBlock}>Block user</button></div>}</header>
      <div className="profile-hero"><div className="avatar profile-photo" style={{ background: account.color }}>{account.initials}</div><h2>{account.name}</h2><span>{account.role === 'Admin' ? 'online · admin' : 'last seen recently'}</span></div>
      <div className="profile-nameplate"><strong>{account.username}</strong><BadgeStrip account={account} /></div>
      <div className="profile-actions"><button><MessageCircle size={19} /><small>Message</small></button><button><BellOff size={19} /><small>Mute</small></button><button><MoreHorizontal size={19} /><small>More</small></button></div>
      <section className="profile-info"><p><UserRound size={18} /><span><strong>{account.username}</strong><small>Username</small></span></p>{phoneVisible && <p><Lock size={18} /><span><strong>{account.phone.slice(0, 4)} ••• ••• {account.phone.slice(-3)}</strong><small>Mobile</small></span></p>}<p><FileText size={18} /><span><strong>Building calm, private spaces.</strong><small>Bio</small></span></p><p><Clock3 size={18} /><span><strong>May 14</strong><small>Birthday</small></span></p></section>
      <section className="shared-stub"><strong>Shared media</strong><div><span>12<br /><small>Photos</small></span><span>4<br /><small>Files</small></span><span>2<br /><small>Links</small></span></div></section>
      <div className="profile-list"><button><Share2 size={18} />Share contact</button><button><Edit3 size={18} />Edit contact</button><button onClick={onStartSecret}><Lock size={18} />Start secret chat</button><button className="profile-danger" onClick={onBlock}><VolumeX size={18} />Block user</button></div>
    </aside>
  </div>
}

export function ChatContextMenu({ pinned, muted, onAction }: { name: string; pinned: boolean; muted: boolean; onAction: (action: string) => void }) {
  const items = [
    ['new-window', 'Open in new window', <MessageCircle size={17} />], ['archive', 'Archive', <Archive size={17} />], ['pin', pinned ? 'Unpin' : 'Pin', <Pin size={17} />], ['mute', muted ? 'Unmute' : 'Mute', <BellOff size={17} />],
    ['unread', 'Mark as unread', <Clock3 size={17} />], ['secret', 'Start secret chat', <Lock size={17} />], ['folder', 'Add to folder', <ChevronRight size={17} />], ['clear-history', 'Clear history', <Trash2 size={17} />], ['delete-chat', 'Delete chat', <Trash2 size={17} />],
  ]
  return <div className="context-menu chat-context" role="menu">{items.map(([action, label, icon], index) => <button className={action === 'delete-chat' ? 'danger-item' : index === 6 ? 'menu-divider' : ''} key={action as string} onClick={() => onAction(action as string)}>{icon}{label}</button>)}</div>
}

export function MessageContextMenu({ mine, time, onAction }: { mine: boolean; time: string; onAction: (action: string) => void }) {
  const items = [['reply', 'Reply', <MessageCircle size={17} />], ...(mine ? [['edit', 'Edit', <Edit3 size={17} />]] : []), ['pin', 'Pin', <Pin size={17} />], ['copy', 'Copy text', <Copy size={17} />], ['forward', 'Forward', <Forward size={17} />], ['select', 'Select', <Check size={17} />], ['delete-message', 'Delete', <Trash2 size={17} />]]
  return <div className="context-menu message-context" role="menu"><div className="reaction-bar">{['❤️', '👌', '🤔', '👍', '👎', '🔥', '＋'].map(emoji => <button key={emoji} aria-label={emoji === '＋' ? 'More reactions' : `React ${emoji}`} onClick={() => emoji !== '＋' && onAction(`react-${emoji}`)}>{emoji}</button>)}</div>{items.map(([action, label, icon]) => <button className={action === 'delete-message' ? 'danger-item' : ''} key={action as string} onClick={() => onAction(action as string)}>{icon}{label}</button>)}<footer><span>{time}</span><span>✓✓</span></footer></div>
}

export function ForwardPanel({ onClose, onForward }: { onClose: () => void; onForward: (target: Exclude<ChatName, 'Mark'>) => void }) {
  return <div className="forward-overlay" role="dialog" aria-modal="true" aria-label="Forward to">
    <div className="forward-card"><header><button aria-label="Close forward" onClick={onClose}><X size={20} /></button><strong>Forward to…</strong></header><label><Search size={16} /><input autoFocus placeholder="Search chats" /></label>{(['Saved Messages', 'Design circle', 'Alisher'] as const).map((chat, index) => <button className="forward-chat" key={chat} onClick={() => onForward(chat)}><span className="avatar" style={{ background: ['#9e2338', '#4c8a83', '#bf8057'][index] }}>{chat[0]}</span><span><strong>{chat}</strong><small>{index === 0 ? 'Keep it for yourself' : 'Private cloud chat'}</small></span><Send size={16} /></button>)}</div>
  </div>
}
