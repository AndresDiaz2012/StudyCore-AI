import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Users, Hash, Copy, Settings, LogOut, Send, BrainCircuit,
  Trash2, Crown, UserMinus, Loader2, X, Check,
  ChevronDown, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { groupsApi, subjectsApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import EmptyState from '../components/common/EmptyState'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

const EMOJIS = ['👥','📚','🧠','⚡','🔬','🏛️','📖','🎯','🚀','🌍','🧮','🎓','💡','🔭','🎵','🏆']

// ── Feed renderers ────────────────────────────────────────────────────────────

function TextMsg({ msg, isMe, canDelete, onDelete }) {
  return (
    <div className={`flex gap-2 group ${isMe ? 'flex-row-reverse':''}`}>
      <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand flex-shrink-0 mt-1">
        {(msg.author_name||'?')[0].toUpperCase()}
      </div>
      <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end':'items-start'}`}>
        {!isMe && <span className="text-xs text-gray-500 mb-1 ml-1">{msg.author_name}</span>}
        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
          ${isMe ? 'bg-brand text-white rounded-tr-sm' : 'bg-[#1e2a45] text-gray-200 rounded-tl-sm border border-gray-700/40'}`}>
          {msg.content}
        </div>
        <div className="flex items-center gap-2 mt-0.5 px-1">
          <span className="text-xs text-gray-600">{fmtTime(msg.created_at)}</span>
          {canDelete && (
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition text-gray-700 hover:text-red-400">
              <Trash2 size={10}/>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AIMsg({ msg, isMe }) {
  const data = typeof msg.content === 'object' ? msg.content : (() => { try { return JSON.parse(msg.content) } catch { return {question:'', answer: String(msg.content)} } })()
  const [exp, setExp] = useState(false)
  const answer = data.answer || ''
  return (
    <div className={`flex gap-2 ${isMe ? 'flex-row-reverse':''}`}>
      <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0 mt-1">
        <BrainCircuit size={13} className="text-brand"/>
      </div>
      <div className="max-w-[85%]">
        {!isMe && <span className="text-xs text-gray-500 mb-1 block ml-1">{msg.author_name} · Profesor {data.subject_name || 'IA'}</span>}
        <div className="bg-brand/8 border border-brand/20 rounded-2xl p-3 space-y-2">
          {data.question && <div className="text-xs text-gray-500 italic border-l-2 border-brand/30 pl-2">❝ {data.question} ❞</div>}
          <div className={`text-sm text-gray-300 whitespace-pre-wrap leading-relaxed ${!exp && answer.length > 400 ? 'line-clamp-6':''}`}>
            {answer}
          </div>
          {answer.length > 400 && (
            <button onClick={() => setExp(e => !e)} className="text-xs text-brand hover:underline">
              {exp ? 'Ver menos ▲' : 'Ver respuesta completa ▼'}
            </button>
          )}
        </div>
        <span className="text-xs text-gray-600 ml-1">{fmtTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

// ── AI Professor modal ────────────────────────────────────────────────────────

function AIProfModal({ open, onClose, groupId, subjects, onPosted }) {
  const [subjectId, setSubjectId] = useState('')
  const [question, setQuestion]   = useState('')
  const [sending, setSending]     = useState(false)

  const subj = subjects.find(s => s.id === parseInt(subjectId))

  const send = async () => {
    if (!question.trim()) { toast.error('Escribe una pregunta o instrucción'); return }
    setSending(true)
    try {
      const msg = await groupsApi.askAI(groupId, { question, subject_name: subj?.name || 'General' })
      onPosted(msg)
      toast.success('Respuesta del Profesor IA publicada en el grupo')
      setQuestion('')
      onClose()
    } catch (e) { toast.error(e.message) }
    finally { setSending(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Profesor IA Grupal">
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          El Profesor IA responderá y publicará en el feed del grupo para que todos lo vean.
        </p>
        <div>
          <label className="label">Materia del profesor</label>
          <select className="select" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
            <option value="">— General —</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Pregunta o instrucción *</label>
          <textarea
            className="input resize-none text-sm"
            rows={4}
            placeholder={`Ej: Dame 20 ejercicios de ${subj?.name || 'Matemáticas'} resueltos paso a paso para que todos los practiquen...`}
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={send} disabled={sending || !question.trim()} className="btn-primary disabled:opacity-50">
            {sending ? <><Loader2 size={13} className="animate-spin"/> Consultando...</> : <><BrainCircuit size={13}/> Enviar al Profesor</>}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Members panel ─────────────────────────────────────────────────────────────

function MembersPanel({ groupId, myUserId, isAdmin }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    groupsApi.members(groupId)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [groupId])

  const kick = async (uid, name) => {
    if (!window.confirm(`¿Expulsar a ${name} del grupo?`)) return
    try {
      await groupsApi.kickMember(groupId, uid)
      setMembers(m => m.filter(x => x.id !== uid))
      toast.success('Miembro expulsado')
    } catch (e) { toast.error(e.message) }
  }

  const toggleAdmin = async (uid, role) => {
    const newRole = role === 'admin' ? 'member' : 'admin'
    try {
      await groupsApi.changeRole(groupId, uid, newRole)
      setMembers(m => m.map(x => x.id === uid ? {...x, role: newRole} : x))
      toast.success(newRole === 'admin' ? '👑 Ascendido a admin' : 'Degradado a miembro')
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-brand"/></div>

  return (
    <div className="space-y-2 p-1">
      <p className="text-xs text-gray-500 mb-3">{members.length} integrante{members.length !== 1 ? 's':''}</p>
      {members.map(m => (
        <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#1a2540] border border-gray-700/30">
          <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-sm font-bold text-brand flex-shrink-0">
            {m.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-200 truncate">
              {m.name} {m.id === myUserId && <span className="text-xs text-gray-500">(tú)</span>}
            </div>
            <div className="text-xs text-gray-600 truncate">{m.email}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'admin' ? 'bg-brand/20 text-brand':'bg-gray-700/50 text-gray-500'}`}>
            {m.role === 'admin' ? '👑 Admin' : 'Miembro'}
          </span>
          {isAdmin && m.id !== myUserId && (
            <div className="flex gap-1">
              <button onClick={() => toggleAdmin(m.id, m.role)} title={m.role === 'admin' ? 'Quitar admin':'Hacer admin'}
                className="p-1.5 rounded-lg text-gray-600 hover:text-brand hover:bg-brand/10 transition">
                <Crown size={13}/>
              </button>
              <button onClick={() => kick(m.id, m.name)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition">
                <UserMinus size={13}/>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Config modal ──────────────────────────────────────────────────────────────

function ConfigModal({ open, onClose, group, onSaved }) {
  const [form, setForm] = useState({
    name: group.name, description: group.description || '',
    image: group.image || '👥', max_members: group.max_members || 50,
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const updated = await groupsApi.update(group.id, form)
      onSaved(updated); toast.success('Grupo actualizado'); onClose()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Configuración del grupo">
      <div className="space-y-4">
        <div>
          <label className="label">Icono del grupo</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setForm(f => ({...f, image: e}))}
                className={`text-xl w-9 h-9 rounded-xl transition ${form.image===e ? 'bg-brand/30 ring-2 ring-brand':'bg-[#1a2540] hover:bg-white/5'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div><label className="label">Nombre</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}/>
        </div>
        <div><label className="label">Descripción</label>
          <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}/>
        </div>
        <div><label className="label">Máximo de integrantes</label>
          <input className="input" type="number" min={2} max={500} value={form.max_members} onChange={e => setForm(f => ({...f, max_members: parseInt(e.target.value)}))}/>
        </div>
        <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 text-xs text-gray-400 flex items-center gap-2">
          <Crown size={13} className="text-brand flex-shrink-0"/>
          Solo los admins pueden publicar mensajes, compartir apuntes y usar el Profesor IA.
          Los miembros pueden leer el feed y ser ascendidos a admin.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Group detail panel ────────────────────────────────────────────────────────

function GroupPanel({ group, myUserId, onUpdated, onLeft, onDeleted }) {
  const [tab, setTab]         = useState('feed')
  const [feed, setFeed]       = useState([])
  const [loadFeed, setLoadFeed] = useState(true)
  const [msg, setMsg]         = useState('')
  const [sending, setSending] = useState(false)
  const [subjects, setSubjects] = useState([])

  // Modals
  const [showAI, setShowAI]         = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const feedEndRef   = useRef(null)
  const lastMsgIdRef = useRef(null)
  const isAdmin  = group.my_role === 'admin'
  const canPost  = isAdmin

  // Load feed & subjects, then poll every 3 s for new messages
  useEffect(() => {
    let cancelled = false

    const fetchFeed = async (initial = false) => {
      try {
        const data = await groupsApi.feed(group.id)
        if (cancelled) return
        setFeed(data)
        if (initial) setLoadFeed(false)
        // track last message id to detect new ones
        if (data.length > 0) lastMsgIdRef.current = data[data.length - 1].id
      } catch (_) {
        if (initial) setLoadFeed(false)
      }
    }

    fetchFeed(true)
    subjectsApi.list().then(setSubjects).catch(() => {})

    const interval = setInterval(() => fetchFeed(false), 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [group.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (tab === 'feed') setTimeout(() => feedEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [feed.length, tab])

  const sendMsg = async () => {
    const text = msg.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const m = await groupsApi.postFeed(group.id, { type: 'text', content: text })
      setFeed(f => [...f, m])
      setMsg('')
    } catch (e) { toast.error(e.message) }
    finally { setSending(false) }
  }

  const deleteMsg = async (id) => {
    try {
      await groupsApi.deleteMsg(group.id, id)
      setFeed(f => f.filter(x => x.id !== id))
    } catch (e) { toast.error(e.message) }
  }

  const leave = async () => {
    if (!window.confirm('¿Salir del grupo?')) return
    try { await groupsApi.leave(group.id); toast.success('Saliste del grupo'); onLeft(group.id) }
    catch (e) { toast.error(e.message) }
  }

  const deleteGroup = async () => {
    if (!window.confirm(`¿Eliminar "${group.name}"? Se borrará todo el contenido.`)) return
    try { await groupsApi.delete(group.id); toast.success('Grupo eliminado'); onDeleted(group.id) }
    catch (e) { toast.error(e.message) }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700/40 flex-shrink-0">
        <span className="text-2xl">{group.image || '👥'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-100 truncate">{group.name}</div>
          <div className="text-xs text-gray-500">{group.member_count} miembro{group.member_count !== 1 ? 's':''}</div>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(group.invite_code); toast.success('Código copiado') }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a2540] border border-gray-700/40 text-xs text-gray-400 hover:text-gray-200 transition">
          <Hash size={10}/>{group.invite_code}<Copy size={10}/>
        </button>
        {isAdmin && (
          <button onClick={() => setShowConfig(true)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition">
            <Settings size={14}/>
          </button>
        )}
        <button onClick={leave} title="Salir" className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition"><LogOut size={14}/></button>
        {isAdmin && (
          <button onClick={deleteGroup} title="Eliminar grupo" className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition"><Trash2 size={14}/></button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700/40 flex-shrink-0">
        {[['feed','💬 Feed'],['miembros','👥 Miembros']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-medium transition border-b-2 ${tab===key ? 'border-brand text-brand':'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Feed */}
      {tab === 'feed' && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loadFeed ? (
              <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-brand"/></div>
            ) : feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-2">
                <MessageSquare size={28} className="text-gray-700"/>
                <p className="text-sm text-gray-500">Sin mensajes</p>
                <p className="text-xs text-gray-600">Sé el primero en escribir algo</p>
              </div>
            ) : (
              feed.map(m => {
                const isMe = m.user_id === myUserId
                const canDel = isMe || isAdmin
                if (m.type === 'text')
                  return <TextMsg key={m.id} msg={m} isMe={isMe} canDelete={canDel} onDelete={() => deleteMsg(m.id)}/>

                if (m.type === 'ai')
                  return <AIMsg key={m.id} msg={m} isMe={isMe}/>
                return null
              })
            )}
            <div ref={feedEndRef}/>
          </div>

          {/* Toolbar */}
          {canPost ? (
            <div className="px-3 pb-3 pt-2 border-t border-gray-700/40 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setShowAI(true)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700/50 text-gray-400 hover:text-brand hover:border-brand/40 transition">
                  <BrainCircuit size={12} className="text-brand"/> Profesor IA
                </button>
              </div>
              <div className="flex gap-2 items-end">
                <textarea
                  className="input flex-1 resize-none text-sm min-h-[38px] max-h-24"
                  rows={1}
                  placeholder="Escribe un mensaje... (Enter para enviar)"
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
                />
                <button onClick={sendMsg} disabled={sending || !msg.trim()}
                  className="btn-primary h-[38px] w-[38px] p-0 flex items-center justify-center disabled:opacity-40 flex-shrink-0">
                  {sending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-gray-700/40 flex-shrink-0 flex items-center gap-2 text-xs text-gray-600">
              <Crown size={12} className="text-brand/40 flex-shrink-0"/>
              <span>Solo los <span className="text-brand/60 font-medium">admins</span> pueden publicar — pídele al admin que te ascienda desde la pestaña Miembros</span>
            </div>
          )}
        </>
      )}

      {/* Tab: Miembros */}
      {tab === 'miembros' && (
        <div className="flex-1 overflow-y-auto p-4">
          <MembersPanel groupId={group.id} myUserId={myUserId} isAdmin={isAdmin}/>
        </div>
      )}

      {/* Modals */}
      {showAI && (
        <AIProfModal open onClose={() => setShowAI(false)} groupId={group.id} subjects={subjects}
          onPosted={m => { setFeed(f => [...f, m]); setShowAI(false) }}/>
      )}
      {showConfig && (
        <ConfigModal open onClose={() => setShowConfig(false)} group={group}
          onSaved={g => { onUpdated(g); setShowConfig(false) }}/>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { user }  = useAuth()
  const [groups, setGroups]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [active, setActive]         = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin]     = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', description: '', image: '👥', max_members: 50,
  })
  const [joinCode, setJoinCode] = useState('')

  useEffect(() => {
    groupsApi.list().then(setGroups).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const createGroup = async (e) => {
    e.preventDefault()
    if (!createForm.name.trim()) { toast.error('Escribe un nombre'); return }
    try {
      const g = await groupsApi.create(createForm)
      setGroups(gs => [g, ...gs])
      setActive(g)
      setShowCreate(false)
      setCreateForm({ name:'', description:'', image:'👥', max_members: 50 })
      toast.success(`Grupo "${g.name}" creado`)
    } catch (e) { toast.error(e.message) }
  }

  const joinGroup = async (e) => {
    e.preventDefault()
    try {
      const g = await groupsApi.join(joinCode.trim())
      // Fetch with member count from fresh list
      setShowJoin(false)
      setJoinCode('')
      const fresh = await groupsApi.list()
      setGroups(fresh)
      setActive(fresh.find(x => x.id === g.id) || g)
      toast.success(`Te uniste a "${g.name}"`)
    } catch (e) { toast.error(e.message) }
  }

  const onUpdated = (updated) => {
    setGroups(gs => gs.map(g => g.id === updated.id ? {...g, ...updated} : g))
    setActive(a => a?.id === updated.id ? {...a, ...updated} : a)
  }
  const onLeft    = (id) => { setGroups(gs => gs.filter(g => g.id !== id)); if (active?.id === id) setActive(null) }
  const onDeleted = (id) => { setGroups(gs => gs.filter(g => g.id !== id)); if (active?.id === id) setActive(null) }

  if (loading) return <LoadingSpinner/>

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] animate-fade-in">

      {/* Left: group list */}
      <div className="w-60 flex-shrink-0 flex flex-col gap-2">
        <div className="flex gap-2">
          <button onClick={() => setShowJoin(true)} className="flex-1 btn-ghost border border-gray-700/50 text-xs justify-center py-2">
            <Hash size={12}/> Unirse
          </button>
          <button onClick={() => setShowCreate(true)} className="flex-1 btn-primary text-xs justify-center py-2">
            <Plus size={12}/> Crear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {groups.length === 0 ? (
            <EmptyState icon={Users} title="Sin grupos" description="Crea o únete a un grupo"/>
          ) : groups.map(g => (
            <button key={g.id} onClick={() => setActive(g)}
              className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-xl transition border
                ${active?.id === g.id ? 'bg-brand/10 border-brand/30':'border-transparent hover:bg-white/5'}`}>
              <span className="text-lg flex-shrink-0">{g.image||'👥'}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${active?.id === g.id ? 'text-white':'text-gray-300'}`}>{g.name}</div>
                <div className="text-xs text-gray-600">{g.member_count} miembros · {g.my_role==='admin'?'👑 Admin':'Miembro'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: group detail */}
      <div className="flex-1 card p-0 overflow-hidden flex flex-col">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-gray-500">
            <Users size={36} className="text-gray-700"/>
            <div>
              <p className="text-sm">Selecciona un grupo</p>
              <p className="text-xs text-gray-600 mt-1">o crea uno nuevo para estudiar en equipo</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-1"><Plus size={14}/> Crear grupo</button>
          </div>
        ) : (
          <GroupPanel key={active.id} group={active} myUserId={user?.id}
            onUpdated={onUpdated} onLeft={onLeft} onDeleted={onDeleted}/>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear Grupo de Estudio">
        <form onSubmit={createGroup} className="space-y-4">
          <div>
            <label className="label">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => setCreateForm(f => ({...f, image: e}))}
                  className={`text-xl w-9 h-9 rounded-xl transition ${createForm.image===e ? 'bg-brand/30 ring-2 ring-brand':'bg-[#1a2540] hover:bg-white/5'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Nombre del grupo *</label>
            <input className="input" value={createForm.name} onChange={e => setCreateForm(f=>({...f,name:e.target.value}))} required placeholder="Ej: Física 5to año"/>
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea className="input resize-none" rows={2} value={createForm.description} onChange={e => setCreateForm(f=>({...f,description:e.target.value}))} placeholder="¿De qué trata el grupo?"/>
          </div>
          <div>
            <label className="label">Máximo de integrantes</label>
            <input className="input" type="number" min={2} max={500} value={createForm.max_members} onChange={e => setCreateForm(f=>({...f,max_members:parseInt(e.target.value)}))}/>
          </div>
          <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 text-xs text-gray-400 flex items-center gap-2">
            <Crown size={13} className="text-brand flex-shrink-0"/>
            Solo los admins pueden publicar en el grupo.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary"><Users size={14}/> Crear grupo</button>
          </div>
        </form>
      </Modal>

      {/* Join modal */}
      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Unirse con código" size="sm">
        <form onSubmit={joinGroup} className="space-y-4">
          <p className="text-sm text-gray-400">Pide el código de invitación al creador del grupo.</p>
          <input className="input text-center text-xl tracking-[0.4em] font-mono uppercase" value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())} required maxLength={8} placeholder="ABC12345"/>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary"><Hash size={14}/> Unirme</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
