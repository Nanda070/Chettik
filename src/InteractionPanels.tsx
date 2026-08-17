import { Archive, ArrowLeft, BellOff, Check, ChevronRight, Clock3, Copy, Edit3, FileText, Forward, Lock, MessageCircle, MoreHorizontal, Pin, Search, Send, Share2, Trash2, UserRound, VolumeX, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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

export function ProfilePanel({ account, onClose, onBlock, onStartSecret }: { account: Account; onClose: () => void; onBlock: () => void; onStartSecret: () => void }) {
  const [more, setMore] = useState(false)
  const [gallery, setGallery] = useState<'photos' | 'files' | 'links' | null>(null)
  if (gallery) return <SharedGallery kind={gallery} onBack={() => setGallery(null)} onClose={onClose} />
  return <div className="profile-overlay" role="dialog" aria-modal="true" aria-label={`${account.name} profile`} onClick={onClose}>
    <aside className="profile-panel" onClick={event => event.stopPropagation()}><header><button aria-label="Close profile" onClick={onClose}><X size={20} /></button><button aria-label="More profile actions" onClick={() => setMore(value => !value)}><MoreHorizontal size={21} /></button>{more && <div className="profile-more-menu"><button>Share profile</button><button>Export chat</button><button onClick={onStartSecret}><Lock size={16} />Start secret chat</button><button>Clear history</button><button className="danger-item" onClick={onBlock}>Block user</button></div>}</header>
      <div className="profile-hero"><div className="avatar profile-photo" style={{ background: account.color }}>{account.initials}</div><h2>{account.name}</h2><span>{account.role === 'Admin' ? 'online · admin' : 'last seen recently'}</span></div>
      <div className="profile-nameplate"><strong>{account.username}</strong><BadgeStrip account={account} /></div>
      <div className="profile-actions"><button><MessageCircle size={19} /><small>Message</small></button><button><BellOff size={19} /><small>Mute</small></button><button><MoreHorizontal size={19} /><small>More</small></button></div>
      <section className="profile-info"><p><UserRound size={18} /><span><strong>{account.username}</strong><small>Username</small></span></p><p><FileText size={18} /><span><strong>Building calm, private spaces.</strong><small>Bio</small></span></p><p><Clock3 size={18} /><span><strong>May 14</strong><small>Birthday</small></span></p></section>
      <section className="shared-stub"><strong>Shared media</strong><div><button onClick={() => setGallery('photos')}><b>12</b><small>Photos</small></button><button onClick={() => setGallery('files')}><b>4</b><small>Files</small></button><button onClick={() => setGallery('links')}><b>2</b><small>Links</small></button></div></section>
      <div className="profile-list"><button><Share2 size={18} />Share contact</button><button><Edit3 size={18} />Edit contact</button><button onClick={onStartSecret}><Lock size={18} />Start secret chat</button><button className="profile-danger" onClick={onBlock}><VolumeX size={18} />Block user</button></div>
    </aside>
  </div>
}

type GroupRecord = { id: string; title: string; description: string; owner_id: string; primary_chat_id: string | null; member_count: number }
export function GroupPanel({ token, chats, onClose }: { token: string; chats: Array<{ id: string; name: string }>; onClose: () => void }) {
  const [group, setGroup] = useState<GroupRecord | null>(null)
  const [view, setView] = useState<'info' | 'edit' | 'link'>('info')
  const [title, setTitle] = useState('Design circle')
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const API_URL = 'http://127.0.0.1:8787/api'
  useEffect(() => {
    fetch(`${API_URL}/groups`, { headers: { Authorization: `Bearer ${token}` } }).then(response => response.json()).then((items: GroupRecord[]) => {
      const current = items.find(item => item.id === 'design-circle') || items[0]
      if (current) { setGroup(current); setTitle(current.title); setDescription(current.description) }
    }).catch(() => undefined)
  }, [token])
  const save = async () => {
    if (!group) return
    const response = await fetch(`${API_URL}/groups/${group.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title, description }) })
    if (response.ok) { setGroup({ ...group, title, description }); setView('info') }
  }
  const link = async (chatId: string) => {
    if (!group) return
    const response = await fetch(`${API_URL}/groups/${group.id}/link-chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ chatId }) })
    if (response.ok) { setGroup({ ...group, primary_chat_id: chatId }); setView('edit') }
  }
  return <div className="profile-overlay" role="dialog" aria-modal="true" aria-label={view === 'info' ? 'Design circle group info' : view === 'edit' ? 'Edit group' : 'Link existing chat'} onClick={onClose}>
    <aside className="profile-panel group-panel" onClick={event => event.stopPropagation()}><header><button aria-label={view === 'info' ? 'Close group info' : 'Back'} onClick={() => view === 'info' ? onClose() : setView(view === 'link' ? 'edit' : 'info')}>{view === 'info' ? <X size={20} /> : <ArrowLeft size={20} />}</button><strong>{view === 'info' ? 'Group info' : view === 'edit' ? 'Edit group' : 'Link existing chat'}</strong>{view === 'info' ? <button aria-label="Manage group" onClick={() => setView('edit')}><Edit3 size={19} /></button> : view === 'edit' ? <button className="group-save" onClick={() => void save()}>Save</button> : <span />}</header>
      {view === 'info' && <><div className="profile-hero"><div className="avatar profile-photo">D</div><h2>{group?.title || title}</h2><span>{group?.member_count || 3} members</span></div><div className="profile-actions"><button><BellOff size={19} /><small>Mute</small></button><button onClick={() => setView('edit')}><Edit3 size={19} /><small>Manage</small></button><button onClick={() => setMoreOpen(!moreOpen)}><MoreHorizontal size={19} /><small>More</small></button></div>{moreOpen && <div className="group-profile-menu context-menu"><button onClick={() => setMoreOpen(false)}><Clock3 size={16} />Auto-delete</button><button onClick={() => setMoreOpen(false)}><UserRound size={16} />Add members</button><button onClick={() => { setMoreOpen(false); setView('edit') }}><Edit3 size={16} />Manage group</button><button onClick={() => setMoreOpen(false)}><Share2 size={16} />Export chat history</button><button onClick={() => setMoreOpen(false)}><Archive size={16} />Add to folder</button></div>}<section className="shared-stub"><strong>Shared media</strong><div><button><b>12</b><small>Photos</small></button><button><b>4</b><small>Files</small></button><button><b>2</b><small>Links</small></button></div></section><div className="tg-section">Members</div><div className="group-members">{[['Nanda', 'owner'], ['Mark', 'admin'], ['Alisher', 'member']].map(([name, role]) => <button key={name}><span className="avatar">{name[0]}</span><span><strong>{name}</strong><small>{role === 'owner' ? 'Group owner' : role}</small></span>{role === 'owner' && <em>OWNER</em>}</button>)}<button className="group-add"><UserRound size={18} />Add member</button></div></>}
      {view === 'edit' && <div className="group-edit"><div className="avatar edit-avatar">D</div><label>Group name<input value={title} onChange={event => setTitle(event.target.value)} /></label><label>Description<textarea value={description} onChange={event => setDescription(event.target.value)} /></label><button><span><strong>Group type</strong><small>Private group</small></span><ChevronRight size={18} /></button><button><span><strong>Chat history for new members</strong><small>Visible</small></span><ChevronRight size={18} /></button><button disabled><span><strong>Topics</strong><small>Coming later</small></span></button><button><span><strong>Reactions</strong><small>All reactions</small></span><ChevronRight size={18} /></button><button><span><strong>Permissions</strong><small>Default permissions</small></span><ChevronRight size={18} /></button><button><span><strong>Invite links</strong><small>1 active link</small></span><ChevronRight size={18} /></button><button><span><strong>Administrators</strong><small>2</small></span><ChevronRight size={18} /></button><button><span><strong>Members</strong><small>{group?.member_count || 3}</small></span><ChevronRight size={18} /></button><button onClick={() => setView('link')}><span><strong>Link existing chat</strong><small>{group?.primary_chat_id ? 'Primary chat linked' : 'Choose from your chats'}</small></span><ChevronRight size={18} /></button><button onClick={() => void fetch(`${API_URL}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: `${title} chat`, description, createChat: true }) })}><span><strong>Create new chat</strong><small>Create a cloud chat for this group</small></span><MessageCircle size={18} /></button></div>}
      {view === 'link' && <div className="group-link"><label><Search size={16} /><input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Search chats" /></label>{chats.filter(chat => chat.name.toLowerCase().includes(search.toLowerCase())).map(chat => <button key={chat.id} onClick={() => void link(chat.id)}><span className="avatar">{chat.name[0]}</span><span><strong>{chat.name}</strong><small>{chat.id === group?.primary_chat_id ? 'Currently linked' : 'Cloud chat'}</small></span><ChevronRight size={18} /></button>)}</div>}
    </aside>
  </div>
}

function SharedGallery({ kind, onBack, onClose }: { kind: 'photos' | 'files' | 'links'; onBack: () => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [menu, setMenu] = useState(false)
  const title = kind === 'photos' ? 'Photos and videos' : kind === 'files' ? 'Files' : 'Shared links'
  const photoItems = ['Quiet studio', 'Design review', 'Red evening', 'Gallery preview', 'Video · 0:14', 'Weekend notes']
  const files = [{ name: 'Chettik-brand-guide.pdf', size: '2.4 MB' }, { name: 'onboarding-notes.docx', size: '84 KB' }, { name: 'motion-study.mp4', size: '14.8 MB' }]
  const links = [{ title: 'Chettik product brief', url: 'https://github.com/Nanda070/Chettik' }, { title: 'Design inspiration', url: 'https://www.telegram.org/' }]
  return <div className="profile-overlay shared-gallery-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <aside className="profile-panel shared-gallery" onClick={event => event.stopPropagation()}><header><button aria-label="Back to profile" onClick={onBack}><ArrowLeft size={20} /></button><strong>{title}</strong><button aria-label="More gallery actions" onClick={() => setMenu(value => !value)}><MoreHorizontal size={20} /></button>{menu && <div className="profile-more-menu gallery-menu"><button onClick={() => setZoom(value => Math.min(1.45, value + .15))}>Zoom In</button><button onClick={() => setZoom(value => Math.max(.7, value - .15))}>Zoom Out</button><button onClick={() => { setMenu(false); document.querySelector('.gallery-month')?.scrollIntoView({ behavior: 'smooth' }) }}>Calendar</button></div>}</header>
      {kind === 'photos' && <><h3 className="gallery-month">August 2026</h3><div className="gallery-grid" style={{ '--gallery-zoom': zoom } as React.CSSProperties}>{photoItems.map((item, index) => <button key={item} className="gallery-photo" onClick={() => window.alert(`${item} preview`)}><span>{index === 4 ? '▶ 0:14' : '▧'}</span><small>{item}</small></button>)}</div></>}
      {kind === 'files' && <div className="gallery-list"><h3>August 2026</h3>{files.map(file => <button key={file.name} onClick={() => { const link = document.createElement('a'); link.href = `data:text/plain,${encodeURIComponent(file.name)}`; link.download = file.name; link.click() }}><FileText size={22} /><span><strong>{file.name}</strong><small>{file.size} · Tap to download</small></span></button>)}</div>}
      {kind === 'links' && <div className="gallery-list"><label className="gallery-search"><Search size={16} /><input placeholder="Search links" /></label>{links.map(link => <button key={link.url} onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}><Share2 size={21} /><span><strong>{link.title}</strong><small>{link.url}</small></span></button>)}</div>}
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
  const items = [['reply', 'Reply', <MessageCircle size={17} />], ...(mine ? [['edit', 'Edit message', <Edit3 size={17} />]] : []), ['pin', 'Pin', <Pin size={17} />], ['copy', 'Copy text', <Copy size={17} />], ['forward', 'Forward', <Forward size={17} />], ['select', 'Select', <Check size={17} />], ['delete-message', 'Delete', <Trash2 size={17} />]]
  return <div className="context-menu message-context" role="menu"><div className="reaction-bar">{['❤️', '👌', '🤔', '👍', '👎', '🔥', '＋'].map(emoji => <button key={emoji} aria-label={emoji === '＋' ? 'More reactions' : `React ${emoji}`} onClick={() => emoji !== '＋' && onAction(`react-${emoji}`)}>{emoji}</button>)}</div>{items.map(([action, label, icon]) => <button className={action === 'delete-message' ? 'danger-item' : ''} key={action as string} onClick={() => onAction(action as string)}>{icon}{label}</button>)}<footer><span>{time}</span><span>✓✓</span></footer></div>
}

export function ForwardPanel({ onClose, onForward }: { onClose: () => void; onForward: (target: Exclude<ChatName, 'Mark'>) => void }) {
  return <div className="forward-overlay" role="dialog" aria-modal="true" aria-label="Forward to">
    <div className="forward-card"><header><button aria-label="Close forward" onClick={onClose}><X size={20} /></button><strong>Forward to…</strong></header><label><Search size={16} /><input autoFocus placeholder="Search chats" /></label>{(['Saved Messages', 'Design circle', 'Alisher'] as const).map((chat, index) => <button className="forward-chat" key={chat} onClick={() => onForward(chat)}><span className="avatar" style={{ background: ['#9e2338', '#4c8a83', '#bf8057'][index] }}>{chat[0]}</span><span><strong>{chat}</strong><small>{index === 0 ? 'Keep it for yourself' : 'Private cloud chat'}</small></span><Send size={16} /></button>)}</div>
  </div>
}
