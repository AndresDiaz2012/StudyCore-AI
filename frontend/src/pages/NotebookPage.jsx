import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  BookOpen, Plus, ChevronRight, Trash2, Edit2, Camera,
  FileText, Calendar, ArrowLeft, FolderOpen, Folder,
  AlertCircle, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { subjectsApi, notebookApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const today = () => new Date().toISOString().split('T')[0]

// ── Level constants ────────────────────────────────────────────────────────
const LVL_SUBJECTS = 'subjects'
const LVL_PERIODS  = 'periods'
const LVL_TOPICS   = 'topics'
const LVL_ENTRIES  = 'entries'

// ── Small reusable row ─────────────────────────────────────────────────────

function Row({ icon: Icon, iconColor, label, sub, badge, onClick, onEdit, onDelete }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl
                 bg-surface-50 border border-gray-700/40 hover:border-brand/40
                 hover:bg-brand/5 transition-all group"
    >
      <div className="flex-shrink-0" style={{ color: iconColor || '#6366f1' }}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{label}</div>
        {sub && <div className="text-xs text-gray-500 truncate mt-0.5">{sub}</div>}
      </div>
      {badge != null && (
        <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full flex-shrink-0">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        {onEdit && (
          <span
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <Edit2 size={13} />
          </span>
        )}
        {onDelete && (
          <span
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
          >
            <Trash2 size={13} />
          </span>
        )}
        <ChevronRight size={14} className="text-gray-600 ml-1" />
      </div>
    </button>
  )
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function Breadcrumb({ crumbs, onNav }) {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} className="text-gray-600" />}
          <button
            onClick={() => onNav(i)}
            className={`hover:text-white transition truncate max-w-[120px] ${i === crumbs.length - 1 ? 'text-white font-medium' : 'hover:text-brand'}`}
          >
            {c.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Entry Editor (inline) ──────────────────────────────────────────────────

function EntryEditor({ entry, topicId, onSave, onCancel }) {
  const [title, setTitle]     = useState(entry?.title || '')
  const [content, setContent] = useState(entry?.content || '')
  const [date, setDate]       = useState(entry?.entry_date || today())
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileRef = useRef()

  const handleOCR = async (file) => {
    setOcrLoading(true)
    try {
      const res = await notebookApi.entries.ocr(file)
      if (res.error && !res.text) { toast.error(`OCR: ${res.error}`); return }
      if (!res.text?.trim()) { toast.error('No se detectó texto en la imagen'); return }
      setContent((c) => c + (c ? '\n\n' : '') + res.text)
      const labels = { 'gemini-vision': 'Gemini Vision', 'easyocr': 'EasyOCR', 'tesseract': 'Tesseract' }
      toast.success(`${labels[res.engine] || res.engine} — ${res.word_count} palabras`)
    } catch (e) {
      toast.error('Error OCR: ' + e.message)
    } finally {
      setOcrLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = () => {
    if (!content.trim() && !title.trim()) { toast.error('Escribe algo primero'); return }
    onSave({ title: title.trim() || null, content, entry_date: date, topic_id: topicId })
  }

  return (
    <div className="card space-y-3 animate-fade-in">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="label">Título (opcional)</label>
          <input
            className="input text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Clase del lunes, Repaso de…"
          />
        </div>
        <div>
          <label className="label">Fecha de clase</label>
          <input
            type="date"
            className="input text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Apuntes</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ocrLoading}
            className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-light transition disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {ocrLoading ? 'Procesando imagen…' : 'Importar foto (OCR)'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files[0] && handleOCR(e.target.files[0])} />
        <textarea
          className="input resize-none text-sm font-mono"
          rows={9}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escribe tus apuntes aquí, o usa el botón para importar desde foto…"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost text-sm">Cancelar</button>
        <button onClick={submit} className="btn-primary text-sm">
          {entry ? 'Guardar cambios' : 'Agregar clase'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function NotebookPage() {
  const { user } = useAuth()
  // Students can read and edit, but not add new items
  const canAdd = ['delegado', 'admin', 'developer'].includes(user?.role)

  const [level, setLevel]         = useState(LVL_SUBJECTS)
  const [subjects, setSubjects]   = useState([])
  const [periods, setPeriods]     = useState([])
  const [topics, setTopics]       = useState([])
  const [entries, setEntries]     = useState([])
  const [activeSubject, setActiveSubject] = useState(null)
  const [activePeriod, setActivePeriod]   = useState(null)
  const [activeTopic, setActiveTopic]     = useState(null)
  const [loading, setLoading]     = useState(true)

  // Modal state
  const [modal, setModal] = useState(null)  // { type: 'period'|'topic', edit?: obj }
  const [modalName, setModalName] = useState('')
  const [modalDesc, setModalDesc] = useState('')

  // Entry editor
  const [showEntryEditor, setShowEntryEditor] = useState(false)
  const [editEntry, setEditEntry]             = useState(null)

  // ── Loaders ──

  const loadSubjects = useCallback(async () => {
    setLoading(true)
    try { setSubjects(await subjectsApi.list()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  const loadPeriods = useCallback(async (subjectId) => {
    setLoading(true)
    try { setPeriods(await notebookApi.periods.list(subjectId)) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  const loadTopics = useCallback(async (periodId) => {
    setLoading(true)
    try { setTopics(await notebookApi.topics.list(periodId)) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  const loadEntries = useCallback(async (topicId) => {
    setLoading(true)
    try { setEntries(await notebookApi.entries.list(topicId)) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSubjects() }, [loadSubjects])

  // ── Navigation ──

  const goSubject = (s) => {
    setActiveSubject(s); setActivePeriod(null); setActiveTopic(null)
    setLevel(LVL_PERIODS); loadPeriods(s.id)
  }
  const goPeriod = (p) => {
    setActivePeriod(p); setActiveTopic(null)
    setLevel(LVL_TOPICS); loadTopics(p.id)
  }
  const goTopic = (t) => {
    setActiveTopic(t)
    setLevel(LVL_ENTRIES); loadEntries(t.id)
  }

  const navTo = (idx) => {
    if (idx === 0) { setLevel(LVL_SUBJECTS); loadSubjects() }
    if (idx === 1) { setLevel(LVL_PERIODS); loadPeriods(activeSubject.id) }
    if (idx === 2) { setLevel(LVL_TOPICS); loadTopics(activePeriod.id) }
  }

  // ── Breadcrumbs ──

  const crumbs = [{ label: 'Materias' }]
  if (activeSubject) crumbs.push({ label: `${activeSubject.icon} ${activeSubject.name}` })
  if (activePeriod) crumbs.push({ label: activePeriod.name })
  if (activeTopic) crumbs.push({ label: activeTopic.name })

  // ── Modal CRUD ──

  const openCreate = (type) => {
    setModal({ type }); setModalName(''); setModalDesc('')
  }
  const openEdit = (type, obj) => {
    setModal({ type, edit: obj }); setModalName(obj.name); setModalDesc(obj.description || '')
  }
  const closeModal = () => setModal(null)

  const handleModalSubmit = async () => {
    if (!modalName.trim()) { toast.error('El nombre es requerido'); return }
    try {
      if (modal.type === 'period') {
        if (modal.edit) {
          await notebookApi.periods.update(modal.edit.id, { name: modalName })
          toast.success('Período actualizado')
          loadPeriods(activeSubject.id)
        } else {
          await notebookApi.periods.create({ subject_id: activeSubject.id, name: modalName, order_num: periods.length })
          toast.success('Período creado')
          loadPeriods(activeSubject.id)
        }
      } else if (modal.type === 'topic') {
        if (modal.edit) {
          await notebookApi.topics.update(modal.edit.id, { name: modalName, description: modalDesc })
          toast.success('Tema actualizado')
          loadTopics(activePeriod.id)
        } else {
          await notebookApi.topics.create({ period_id: activePeriod.id, name: modalName, description: modalDesc, order_num: topics.length })
          toast.success('Tema creado')
          loadTopics(activePeriod.id)
        }
      }
      closeModal()
    } catch (e) { toast.error(e.message) }
  }

  const deletePeriod = async (id) => {
    if (!confirm('¿Eliminar este período y todos sus temas?')) return
    await notebookApi.periods.delete(id)
    toast.success('Período eliminado')
    loadPeriods(activeSubject.id)
  }
  const deleteTopic = async (id) => {
    if (!confirm('¿Eliminar este tema y todos sus apuntes?')) return
    await notebookApi.topics.delete(id)
    toast.success('Tema eliminado')
    loadTopics(activePeriod.id)
  }
  const deleteEntry = async (id) => {
    if (!confirm('¿Eliminar esta clase?')) return
    await notebookApi.entries.delete(id)
    toast.success('Clase eliminada')
    loadEntries(activeTopic.id)
  }

  const saveEntry = async (data) => {
    try {
      if (editEntry) {
        await notebookApi.entries.update(editEntry.id, data)
        toast.success('Apunte guardado')
      } else {
        await notebookApi.entries.create(data)
        toast.success('Clase agregada')
      }
      setShowEntryEditor(false); setEditEntry(null)
      loadEntries(activeTopic.id)
    } catch (e) { toast.error(e.message) }
  }

  // ── Render ──

  if (loading && level === LVL_SUBJECTS) return <LoadingSpinner />

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {level !== LVL_SUBJECTS && (
            <button onClick={() => navTo(crumbs.length - 2)} className="btn-ghost p-2">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen size={22} className="text-brand" />
              Cuaderno Digital
            </h1>
            <Breadcrumb crumbs={crumbs} onNav={navTo} />
          </div>
        </div>

        {/* Action button */}
        {canAdd && level === LVL_PERIODS && (
          <button onClick={() => openCreate('period')} className="btn-primary text-sm">
            <Plus size={15} /> Nuevo período
          </button>
        )}
        {canAdd && level === LVL_TOPICS && (
          <button onClick={() => openCreate('topic')} className="btn-primary text-sm">
            <Plus size={15} /> Nuevo tema
          </button>
        )}
        {canAdd && level === LVL_ENTRIES && !showEntryEditor && (
          <button onClick={() => { setEditEntry(null); setShowEntryEditor(true) }} className="btn-primary text-sm">
            <Plus size={15} /> Agregar clase
          </button>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">

        {/* LEVEL: Subjects */}
        {level === LVL_SUBJECTS && (
          subjects.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              <BookOpen size={32} className="mx-auto mb-3 text-gray-700" />
              <p>No hay materias. Crea una en Materias primero.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => goSubject(s)}
                  className="card hover:border-brand/40 hover:bg-brand/5 transition-all text-left p-4 flex flex-col gap-2"
                >
                  <div className="text-3xl">{s.icon}</div>
                  <div className="text-sm font-semibold text-white">{s.name}</div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FolderOpen size={11} /> Abrir cuaderno
                  </div>
                  <div className="h-1 rounded-full mt-1" style={{ background: s.color }} />
                </button>
              ))}
            </div>
          )
        )}

        {/* LEVEL: Periods */}
        {level === LVL_PERIODS && (
          loading ? <LoadingSpinner /> :
          periods.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              <Folder size={32} className="mx-auto mb-3 text-gray-700" />
              <p className="mb-3">No hay períodos en {activeSubject?.name}.</p>
              {canAdd && (
                <button onClick={() => openCreate('period')} className="btn-primary text-sm">
                  <Plus size={15} /> Crear primer período
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {periods.map((p) => (
                <Row
                  key={p.id}
                  icon={Folder}
                  iconColor={activeSubject?.color}
                  label={p.name}
                  sub={`Lapso / Período`}
                  onClick={() => goPeriod(p)}
                  onEdit={() => openEdit('period', p)}
                  onDelete={() => deletePeriod(p.id)}
                />
              ))}
            </div>
          )
        )}

        {/* LEVEL: Topics */}
        {level === LVL_TOPICS && (
          loading ? <LoadingSpinner /> :
          topics.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              <FileText size={32} className="mx-auto mb-3 text-gray-700" />
              <p className="mb-3">No hay temas en {activePeriod?.name}.</p>
              {canAdd && (
                <button onClick={() => openCreate('topic')} className="btn-primary text-sm">
                  <Plus size={15} /> Crear primer tema
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {topics.map((t) => (
                <Row
                  key={t.id}
                  icon={FileText}
                  iconColor={activeSubject?.color}
                  label={t.name}
                  sub={t.description || 'Sin descripción'}
                  onClick={() => goTopic(t)}
                  onEdit={() => openEdit('topic', t)}
                  onDelete={() => deleteTopic(t.id)}
                />
              ))}
            </div>
          )
        )}

        {/* LEVEL: Entries */}
        {level === LVL_ENTRIES && (
          <div className="space-y-4">
            {/* Entry editor at top — new entries only for canAdd, edits for everyone */}
            {showEntryEditor && (editEntry || canAdd) && (
              <EntryEditor
                entry={editEntry}
                topicId={activeTopic?.id}
                onSave={saveEntry}
                onCancel={() => { setShowEntryEditor(false); setEditEntry(null) }}
              />
            )}

            {loading ? <LoadingSpinner /> :
              entries.length === 0 && !showEntryEditor ? (
                <div className="card text-center py-12 text-gray-500">
                  <Calendar size={32} className="mx-auto mb-3 text-gray-700" />
                  <p className="mb-3">No hay clases en "{activeTopic?.name}" todavía.</p>
                  {canAdd && (
                    <button onClick={() => setShowEntryEditor(true)} className="btn-primary text-sm">
                      <Plus size={15} /> Agregar primera clase
                    </button>
                  )}
                </div>
              ) : (
                entries.map((e) => (
                  editEntry?.id === e.id ? null :
                  <div key={e.id} className="card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-brand flex-shrink-0" />
                          <span className="text-sm font-semibold text-white">
                            {e.title || `Clase del ${fmt(e.entry_date)}`}
                          </span>
                          {e.source === 'ocr' && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 rounded-full">OCR</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 ml-5">{fmt(e.entry_date)}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => { setEditEntry(e); setShowEntryEditor(true); window.scrollTo(0,0) }}
                          className="btn-ghost p-1.5 text-gray-400 hover:text-white"
                        ><Edit2 size={13} /></button>
                        <button
                          onClick={() => deleteEntry(e.id)}
                          className="btn-ghost p-1.5 text-gray-400 hover:text-red-400"
                        ><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed
                                    bg-gray-900/30 rounded-lg p-3 border border-gray-700/30">
                      {e.content || <span className="text-gray-600 italic">Sin contenido</span>}
                    </pre>
                  </div>
                ))
              )
            }
          </div>
        )}
      </div>

      {/* Period / Topic modal */}
      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal?.edit
          ? `Editar ${modal?.type === 'period' ? 'período' : 'tema'}`
          : `Nuevo ${modal?.type === 'period' ? 'período' : 'tema'}`
        }
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="label">
              {modal?.type === 'period' ? 'Nombre del período' : 'Nombre del tema'}
            </label>
            <input
              className="input"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder={modal?.type === 'period' ? 'Ej: Lapso 1, 1er Semestre…' : 'Ej: Los Biomas, Funciones…'}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
            />
          </div>
          {modal?.type === 'topic' && (
            <div>
              <label className="label">Descripción (opcional)</label>
              <input
                className="input"
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                placeholder="Breve descripción del tema…"
              />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeModal} className="btn-ghost text-sm">Cancelar</button>
            <button onClick={handleModalSubmit} className="btn-primary text-sm">
              {modal?.edit ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
