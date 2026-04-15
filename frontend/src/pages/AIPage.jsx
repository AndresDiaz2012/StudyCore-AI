import React, { useEffect, useState, useRef, useCallback } from 'react'
import {
  Send, Plus, Trash2, BrainCircuit, Loader2, ChevronRight,
  FolderOpen, Folder, FileText, Link, Youtube, X,
  BookOpen, Lightbulb, Map, CheckSquare, ChevronDown,
  Target, Clock, CheckCircle2, XCircle, Share2, Trophy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, subjectsApi, notebookApi, quizApi, groupsApi } from '../utils/api'

const USER_ROLE = 'user'
const AI_ROLE   = 'assistant'

// ── Markdown renderer ──────────────────────────────────────────────────────

function formatMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="bg-gray-800 px-1 rounded text-brand text-xs">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-white mt-3 mb-1 text-sm">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-white mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-white mt-4 mb-2 text-lg">$1</h1>')
    .replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc text-gray-200">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-200">$2</li>')
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class="my-1 space-y-0.5">${m}</ul>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-brand underline">$1</a>')
    .replace(/\n{2,}/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')
}

// ── Message bubble ─────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === USER_ROLE
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold
        ${isUser ? 'bg-brand text-white' : 'bg-purple-600/20 text-purple-400 border border-purple-600/30'}`}>
        {isUser ? 'Tú' : 'IA'}
      </div>
      <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed
        ${isUser
          ? 'bg-brand/20 border border-brand/30 text-gray-100 rounded-tr-sm'
          : 'bg-surface-50 border border-gray-700/50 text-gray-200 rounded-tl-sm'}`}>
        {isUser
          ? <p>{msg.content}</p>
          : <div className="ai-prose" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
        }
        {msg.timestamp && (
          <div className="text-xs text-gray-600 mt-1.5">
            {new Date(msg.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Source chip ────────────────────────────────────────────────────────────

function SourceChip({ src, onRemove }) {
  const icons = { topic: FileText, url: Link, video: Youtube }
  const colors = { topic: 'text-brand', url: 'text-green-400', video: 'text-red-400' }
  const Icon = icons[src.type] || FileText
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-700
                     bg-surface-50 text-xs ${colors[src.type]}`}>
      <Icon size={11} />
      <span className="truncate max-w-[140px] text-gray-300">{src.label || src.url}</span>
      <button onClick={onRemove} className="ml-0.5 hover:text-red-400 transition">
        <X size={11} />
      </button>
    </div>
  )
}

// ── Notebook folder tree for source picker ─────────────────────────────────

function FolderTree({ onSelectTopic }) {
  const [subjects, setSubjects]     = useState([])
  const [openSubj, setOpenSubj]     = useState(null)
  const [periods, setPeriods]       = useState({})
  const [openPeriod, setOpenPeriod] = useState(null)
  const [topics, setTopics]         = useState({})
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    subjectsApi.list().then(setSubjects).catch(() => {})
  }, [])

  const toggleSubject = async (s) => {
    if (openSubj === s.id) { setOpenSubj(null); return }
    setOpenSubj(s.id)
    if (!periods[s.id]) {
      setLoading(true)
      try {
        const ps = await notebookApi.periods.list(s.id)
        setPeriods((prev) => ({ ...prev, [s.id]: ps }))
      } finally { setLoading(false) }
    }
  }

  const togglePeriod = async (p) => {
    if (openPeriod === p.id) { setOpenPeriod(null); return }
    setOpenPeriod(p.id)
    if (!topics[p.id]) {
      setLoading(true)
      try {
        const ts = await notebookApi.topics.list(p.id)
        setTopics((prev) => ({ ...prev, [p.id]: ts }))
      } finally { setLoading(false) }
    }
  }

  if (!subjects.length) return <p className="text-xs text-gray-600 px-2 py-3 text-center">Sin materias</p>

  return (
    <div className="space-y-0.5 text-xs">
      {subjects.map((s) => (
        <div key={s.id}>
          <button
            onClick={() => toggleSubject(s)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-gray-300 transition"
          >
            {openSubj === s.id ? <FolderOpen size={13} style={{ color: s.color }} /> : <Folder size={13} style={{ color: s.color }} />}
            <span className="flex-1 text-left truncate">{s.icon} {s.name}</span>
            <ChevronDown size={11} className={`transition-transform ${openSubj === s.id ? 'rotate-180' : ''}`} />
          </button>

          {openSubj === s.id && (
            <div className="ml-4 space-y-0.5">
              {loading && !periods[s.id] && <p className="text-gray-600 px-2 py-1">Cargando…</p>}
              {(periods[s.id] || []).map((p) => (
                <div key={p.id}>
                  <button
                    onClick={() => togglePeriod(p)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition"
                  >
                    <Folder size={12} className="text-gray-500" />
                    <span className="flex-1 text-left truncate">{p.name}</span>
                    <ChevronDown size={10} className={`transition-transform ${openPeriod === p.id ? 'rotate-180' : ''}`} />
                  </button>

                  {openPeriod === p.id && (
                    <div className="ml-4 space-y-0.5">
                      {loading && !topics[p.id] && <p className="text-gray-600 px-2 py-1">Cargando…</p>}
                      {(topics[p.id] || []).length === 0 && !loading && (
                        <p className="text-gray-600 px-2 py-1 italic">Sin temas</p>
                      )}
                      {(topics[p.id] || []).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onSelectTopic(t, p, s)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                                     hover:bg-brand/10 hover:text-brand text-gray-500 transition"
                        >
                          <FileText size={11} />
                          <span className="flex-1 text-left truncate">{t.name}</span>
                          <Plus size={10} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(periods[s.id] || []).length === 0 && !loading && (
                <p className="text-gray-600 px-2 py-1 italic">Sin períodos</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Sources panel ──────────────────────────────────────────────────────────

function SourcesPanel({ sources, onAddTopic, onAddUrl, onRemove }) {
  const [showTree, setShowTree]   = useState(false)
  const [urlInput, setUrlInput]   = useState('')
  const [urlLabel, setUrlLabel]   = useState('')
  const [urlType, setUrlType]     = useState('url')
  const [showUrlForm, setShowUrlForm] = useState(false)

  const submitUrl = () => {
    if (!urlInput.trim()) { toast.error('Escribe una URL'); return }
    onAddUrl({ type: urlType, url: urlInput.trim(), label: urlLabel.trim() || urlInput.trim() })
    setUrlInput(''); setUrlLabel(''); setShowUrlForm(false)
  }

  return (
    <div className="space-y-2">
      {/* Current sources */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <SourceChip key={i} src={s} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => { setShowTree(!showTree); setShowUrlForm(false) }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-700
                     hover:border-brand/40 hover:bg-brand/10 text-gray-400 hover:text-brand transition"
        >
          <BookOpen size={11} /> Del cuaderno
        </button>
        <button
          onClick={() => { setShowUrlForm(!showUrlForm); setShowTree(false) }}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-700
                     hover:border-green-500/40 hover:bg-green-500/10 text-gray-400 hover:text-green-400 transition"
        >
          <Link size={11} /> Página / Video
        </button>
      </div>

      {/* Folder tree */}
      {showTree && (
        <div className="border border-gray-700 rounded-xl bg-gray-900/50 p-2 max-h-52 overflow-y-auto">
          <p className="text-xs text-gray-500 mb-2 px-2">Selecciona un tema del cuaderno:</p>
          <FolderTree onSelectTopic={(t, p, s) => {
            onAddTopic(t, p, s)
            setShowTree(false)
          }} />
        </div>
      )}

      {/* URL / Video form */}
      {showUrlForm && (
        <div className="border border-gray-700 rounded-xl bg-gray-900/50 p-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setUrlType('url')}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition
                ${urlType === 'url' ? 'border-brand/40 bg-brand/10 text-brand' : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}
            >
              <Link size={11} className="inline mr-1" /> Página web
            </button>
            <button
              onClick={() => setUrlType('video')}
              className={`flex-1 text-xs py-1.5 rounded-lg border transition
                ${urlType === 'video' ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}
            >
              <Youtube size={11} className="inline mr-1" /> Video
            </button>
          </div>
          <input
            className="input text-xs py-1.5"
            placeholder={urlType === 'video' ? 'URL del video (YouTube, etc.)' : 'https://...'}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <input
            className="input text-xs py-1.5"
            placeholder="Nombre o descripción (opcional)"
            value={urlLabel}
            onChange={(e) => setUrlLabel(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUrlForm(false)} className="text-xs text-gray-500 hover:text-white transition">Cancelar</button>
            <button onClick={submitUrl} className="btn-primary text-xs py-1.5">Agregar</button>
          </div>
        </div>
      )}

      {sources.length === 0 && !showTree && !showUrlForm && (
        <p className="text-xs text-gray-600 italic">
          Sin fuentes — el profesor responderá con conocimiento general.
        </p>
      )}
    </div>
  )
}

// ── Personal Quiz Modal ────────────────────────────────────────────────────

function PersonalQuizModal({ messages, selectedSubject, onClose }) {
  const [step, setStep]               = useState('config')    // config | taking | results
  const [contentMode, setContentMode] = useState('conversation') // conversation | notebook
  const [notebookTopic, setNotebookTopic] = useState(null)    // {id,name,subjectName,subjectId}
  const [showTree, setShowTree]       = useState(false)
  const [numQ, setNumQ]               = useState(10)
  const [types, setTypes]             = useState(['multiple_choice', 'true_false'])
  const [duration, setDuration]       = useState(null)
  const [generating, setGenerating]   = useState(false)
  const [quiz, setQuiz]               = useState(null)
  const [answers, setAnswers]         = useState({})
  const [timeLeft, setTimeLeft]       = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [results, setResults]         = useState(null)
  const [groups, setGroups]           = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [sharing, setSharing]         = useState(false)
  const [showShare, setShowShare]     = useState(false)
  const timerRef = useRef(null)

  // Timer countdown
  useEffect(() => {
    if (step === 'taking' && timeLeft !== null) {
      if (timeLeft <= 0) { handleSubmit(); return }
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  })

  // Load groups when results are shown
  useEffect(() => {
    if (step === 'results') groupsApi.list().then(setGroups).catch(() => {})
  }, [step])

  const toggleType = (t) => {
    setTypes((prev) =>
      prev.includes(t)
        ? prev.length > 1 ? prev.filter((x) => x !== t) : prev
        : [...prev, t]
    )
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      let content      = ''
      let subjectName  = selectedSubject?.name || 'General'
      let subjectId    = selectedSubject?.id    || null
      let topicId      = null

      if (contentMode === 'conversation') {
        content = messages
          .filter((m) => m.role === 'assistant')
          .map((m) => m.content)
          .join('\n\n')
        if (!content) {
          toast.error('No hay respuestas del profesor en esta conversación')
          return
        }
      } else {
        if (!notebookTopic) { toast.error('Selecciona un tema del cuaderno'); return }
        const entries = await notebookApi.entries.list(notebookTopic.id)
        content = entries.map((e) => `${e.title}\n${e.content}`).join('\n\n')
        if (!content) { toast.error('El tema seleccionado no tiene contenido'); return }
        subjectName = notebookTopic.subjectName || subjectName
        subjectId   = notebookTopic.subjectId   || subjectId
        topicId     = notebookTopic.id
      }

      const q = await quizApi.generate({
        content,
        num_questions:   numQ,
        question_types:  types,
        subject_name:    subjectName,
        subject_id:      subjectId,
        topic_id:        topicId,
        duration_minutes: duration,
      })

      setQuiz(q)
      setAnswers({})
      if (duration) setTimeLeft(duration * 60)
      setStep('taking')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!quiz || submitting) return
    clearTimeout(timerRef.current)
    setSubmitting(true)
    try {
      const res = await quizApi.attempt(quiz.id, answers)
      setResults(res)
      setStep('results')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleShare = async () => {
    if (!selectedGroup || !results) return
    setSharing(true)
    try {
      const emoji = results.score >= 16 ? '🏆' : results.score >= 12 ? '✅' : results.score >= 8 ? '📊' : '📉'
      const msg   = `${emoji} Quiz completado — ${quiz?.title || 'Quiz'}\n📊 Resultado: ${results.score}/20\n✅ ${results.correct_count}/${results.total_questions} preguntas correctas`
      await groupsApi.postFeed(selectedGroup.id, { type: 'text', content: msg })
      toast.success(`Resultado compartido en "${selectedGroup.name}"`)
      setShowShare(false)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSharing(false)
    }
  }

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const questions = quiz?.questions || []

  // ── CONFIG STEP ────────────────────────────────────────────────────────────
  if (step === 'config') return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-surface-100 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-brand" />
            <span className="font-semibold text-white">Probar conocimientos</span>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Content source */}
          <div>
            <label className="label">Contenido fuente</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setContentMode('conversation'); setNotebookTopic(null) }}
                className={`flex-1 text-xs py-2 rounded-xl border transition
                  ${contentMode === 'conversation' ? 'border-brand/40 bg-brand/10 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                💬 Esta conversación
              </button>
              <button
                onClick={() => setContentMode('notebook')}
                className={`flex-1 text-xs py-2 rounded-xl border transition
                  ${contentMode === 'notebook' ? 'border-brand/40 bg-brand/10 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                📓 Del cuaderno
              </button>
            </div>
          </div>

          {/* Notebook topic picker */}
          {contentMode === 'notebook' && (
            <div>
              {notebookTopic ? (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand/10 border border-brand/30 text-sm text-brand">
                  <FileText size={14} />
                  <span className="flex-1 truncate">{notebookTopic.subjectName} › {notebookTopic.name}</span>
                  <button onClick={() => setNotebookTopic(null)} className="hover:text-red-400 transition"><X size={13} /></button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTree(!showTree)}
                  className="w-full text-xs py-2 rounded-xl border border-dashed border-gray-600 text-gray-400 hover:border-brand/40 hover:text-brand transition"
                >
                  {showTree ? '▲ Cerrar árbol' : '+ Seleccionar tema del cuaderno'}
                </button>
              )}
              {showTree && !notebookTopic && (
                <div className="mt-2 border border-gray-700 rounded-xl bg-gray-900/60 p-2 max-h-48 overflow-y-auto">
                  <FolderTree
                    onSelectTopic={(t, p, s) => {
                      setNotebookTopic({ id: t.id, name: t.name, subjectName: s.name, subjectId: s.id })
                      setShowTree(false)
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Number of questions */}
          <div>
            <label className="label">Número de preguntas</label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setNumQ(n)}
                  className={`flex-1 py-2 rounded-xl text-sm border transition
                    ${numQ === n ? 'border-brand/50 bg-brand/15 text-brand font-semibold' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Question types */}
          <div>
            <label className="label">Tipos de preguntas</label>
            <div className="space-y-1.5">
              {[
                { key: 'multiple_choice', label: 'Opción múltiple (A/B/C/D)' },
                { key: 'true_false',      label: 'Verdadero / Falso' },
                { key: 'fill_blank',      label: 'Completar el espacio' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => toggleType(key)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition flex-shrink-0
                      ${types.includes(key) ? 'border-brand bg-brand' : 'border-gray-600 group-hover:border-gray-500'}`}
                  >
                    {types.includes(key) && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className="text-sm text-gray-300" onClick={() => toggleType(key)}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label flex items-center gap-1.5"><Clock size={13} /> Tiempo límite (opcional)</label>
            <div className="flex gap-2 flex-wrap">
              {[null, 5, 10, 15, 20, 30].map((d) => (
                <button
                  key={d ?? 'none'}
                  onClick={() => setDuration(d)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition
                    ${duration === d ? 'border-brand/50 bg-brand/15 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  {d === null ? 'Sin límite' : `${d} min`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button
            onClick={handleGenerate}
            disabled={generating || (contentMode === 'notebook' && !notebookTopic)}
            className="btn-primary disabled:opacity-40"
          >
            {generating
              ? <><Loader2 size={14} className="animate-spin" /> Generando…</>
              : <><Target size={14} /> Generar quiz</>
            }
          </button>
        </div>
      </div>
    </div>
  )

  // ── TAKING STEP ────────────────────────────────────────────────────────────
  if (step === 'taking') return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-surface-100 border border-gray-700 rounded-2xl shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 sticky top-0 bg-surface-100 z-10">
          <div>
            <div className="text-sm font-semibold text-white">{quiz?.title}</div>
            <div className="text-xs text-gray-500">
              {Object.keys(answers).length}/{questions.length} respondidas
            </div>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-3 py-1 rounded-lg
                ${timeLeft <= 60 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800 text-gray-300'}`}>
                <Clock size={13} />
                {fmtTime(timeLeft)}
              </div>
            )}
          </div>
        </div>

        {/* Questions */}
        <div className="p-5 space-y-5">
          {questions.map((q, i) => (
            <div key={i} className="p-4 bg-surface-50 border border-gray-700 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-200 leading-relaxed">{q.question}</p>
              </div>

              {/* Multiple choice */}
              {q.type === 'multiple_choice' && (
                <div className="ml-9 space-y-2">
                  {(q.options || []).map((opt, oi) => {
                    const letter = ['A', 'B', 'C', 'D'][oi]
                    const selected = answers[i] === letter
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: letter }))}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition
                          ${selected ? 'border-brand/50 bg-brand/15 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* True/False */}
              {q.type === 'true_false' && (
                <div className="ml-9 flex gap-2">
                  {['Verdadero', 'Falso'].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAnswers((a) => ({ ...a, [i]: val }))}
                      className={`flex-1 py-2 text-sm rounded-xl border transition
                        ${answers[i] === val ? 'border-brand/50 bg-brand/15 text-brand font-semibold' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                    >
                      {val === 'Verdadero' ? '✅ Verdadero' : '❌ Falso'}
                    </button>
                  ))}
                </div>
              )}

              {/* Fill blank */}
              {q.type === 'fill_blank' && (
                <div className="ml-9">
                  <input
                    className="input text-sm"
                    placeholder="Escribe tu respuesta…"
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-700 flex justify-between items-center">
          <span className="text-xs text-gray-500">
            {Object.keys(answers).length} de {questions.length} respondidas
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary disabled:opacity-40"
          >
            {submitting
              ? <><Loader2 size={14} className="animate-spin" /> Calificando…</>
              : <><CheckSquare size={14} /> Entregar quiz</>
            }
          </button>
        </div>
      </div>
    </div>
  )

  // ── RESULTS STEP ───────────────────────────────────────────────────────────
  if (step === 'results' && results) {
    const pct  = results.score / 20
    const color = pct >= 0.8 ? 'text-green-400' : pct >= 0.6 ? 'text-yellow-400' : 'text-red-400'
    const bg    = pct >= 0.8 ? 'bg-green-500/10 border-green-500/30' : pct >= 0.6 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'
    const label = pct >= 0.9 ? '¡Excelente!' : pct >= 0.7 ? '¡Bien!' : pct >= 0.5 ? 'Aprobado' : 'A repasar'

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <div className="w-full max-w-2xl bg-surface-100 border border-gray-700 rounded-2xl shadow-2xl mb-8">
          {/* Score header */}
          <div className="p-6 text-center border-b border-gray-700">
            <div className={`inline-flex flex-col items-center gap-1 px-8 py-5 rounded-2xl border ${bg}`}>
              <Trophy size={28} className={color} />
              <div className={`text-5xl font-black ${color}`}>{results.score}<span className="text-2xl text-gray-500">/20</span></div>
              <div className={`text-sm font-bold ${color}`}>{label}</div>
            </div>
            <div className="mt-3 text-sm text-gray-400">
              {results.correct_count} de {results.total_questions} preguntas correctas
            </div>
            <div className="mt-3 flex justify-center gap-2">
              <button
                onClick={() => { setStep('config'); setQuiz(null); setResults(null); setAnswers({}) }}
                className="btn-ghost text-sm"
              >
                Nuevo quiz
              </button>
              <button onClick={() => setShowShare(!showShare)} className="btn-primary text-sm">
                <Share2 size={14} /> Compartir en grupo
              </button>
            </div>

            {/* Share panel */}
            {showShare && (
              <div className="mt-3 p-3 bg-gray-900/60 border border-gray-700 rounded-xl text-left space-y-2">
                <p className="text-xs text-gray-400 font-medium">Selecciona un grupo:</p>
                {groups.length === 0
                  ? <p className="text-xs text-gray-600 italic">No perteneces a ningún grupo.</p>
                  : groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGroup(g)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition
                        ${selectedGroup?.id === g.id ? 'border-brand/40 bg-brand/10 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
                    >
                      {g.image || '👥'} {g.name}
                    </button>
                  ))
                }
                {selectedGroup && (
                  <button
                    onClick={handleShare}
                    disabled={sharing}
                    className="btn-primary w-full text-sm disabled:opacity-40"
                  >
                    {sharing ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                    Compartir en {selectedGroup.name}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results breakdown */}
          <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Desglose</p>
            {(results.results || []).map((r, i) => (
              <div key={i} className={`p-3 rounded-xl border text-sm ${r.is_correct ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className="flex items-start gap-2">
                  {r.is_correct
                    ? <CheckCircle2 size={15} className="text-green-400 flex-shrink-0 mt-0.5" />
                    : <XCircle      size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 leading-snug">{r.question}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                      <span className="text-gray-500">Tu resp: <span className={r.is_correct ? 'text-green-300' : 'text-red-300'}>{r.user_answer || '—'}</span></span>
                      {!r.is_correct && <span className="text-gray-500">Correcta: <span className="text-green-300">{r.correct_answer}</span></span>}
                    </div>
                    {r.explanation && (
                      <p className="mt-1.5 text-xs text-gray-500 italic leading-snug">{r.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-4 border-t border-gray-700 flex justify-end">
            <button onClick={onClose} className="btn-ghost">Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ── Quick actions ──────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Lightbulb, label: 'Explicar',       prompt: 'Explícame este tema de forma clara, con ejemplos cotidianos y sin tecnicismos innecesarios.' },
  { icon: Map,       label: 'Mapa mental',    prompt: 'Crea un mapa mental de este tema en formato texto con ramas y sub-ramas.' },
  { icon: BookOpen,  label: 'Resumen',        prompt: 'Hazme un resumen conciso del tema con los puntos más importantes.' },
  { icon: CheckSquare, label: 'Corregir',     prompt: 'Revisa este trabajo/ejercicio, señala los errores y explícame cómo corregirlos sin darme la respuesta directa.' },
]

// ── Main page ──────────────────────────────────────────────────────────────

export default function AIPage() {
  const [subjects, setSubjects]             = useState([])
  const [conversations, setConversations]   = useState([])
  const [activeConv, setActiveConv]         = useState(null)
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [sending, setSending]               = useState(false)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [sources, setSources]               = useState([])   // [{type,topic_id?,url?,label}]
  const [showSources, setShowSources]       = useState(false)
  const [showQuizModal, setShowQuizModal]   = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [subs, convs] = await Promise.all([subjectsApi.list(), aiApi.conversations.list()])
        setSubjects(subs)
        setConversations(convs)
      } catch (e) { toast.error(e.message) }
    }
    load()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Conversation management ──

  const newConversation = async (subject) => {
    try {
      const conv = await aiApi.conversations.create({
        subject_id: subject?.id || null,
        title: subject ? `Preguntas sobre ${subject.name}` : 'Nueva conversación',
        messages: [],
      })
      setConversations((prev) => [conv, ...prev])
      setActiveConv(conv)
      setMessages([])
      setSelectedSubject(subject || null)
      setSources([])
      setShowSources(false)
      inputRef.current?.focus()
    } catch (e) { toast.error(e.message) }
  }

  const loadConversation = (conv) => {
    setActiveConv(conv)
    setMessages(Array.isArray(conv.messages) ? conv.messages : [])
    const sub = subjects.find((s) => s.id === conv.subject_id)
    setSelectedSubject(sub || null)
    setSources([])
    inputRef.current?.focus()
  }

  const deleteConv = async (id, e) => {
    e.stopPropagation()
    try {
      await aiApi.conversations.delete(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConv?.id === id) { setActiveConv(null); setMessages([]) }
    } catch (e) { toast.error(e.message) }
  }

  // ── Sources management ──

  const addTopicSource = (topic, period, subject) => {
    const label = `${subject.icon} ${subject.name} › ${period.name} › ${topic.name}`
    if (sources.some((s) => s.type === 'topic' && s.topic_id === topic.id)) {
      toast('Ya está agregado', { icon: 'ℹ️' }); return
    }
    setSources((prev) => [...prev, { type: 'topic', topic_id: topic.id, label }])
    toast.success('Tema agregado como fuente')
  }

  const addUrlSource = (src) => {
    setSources((prev) => [...prev, src])
    toast.success('Fuente agregada')
  }

  const removeSource = (idx) => {
    setSources((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── Send message ──

  const sendMessage = async (question) => {
    question = (question || input).trim()
    if (!question || sending) return

    const userMsg = { role: USER_ROLE, content: question, timestamp: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setSending(true)

    try {
      const res = await aiApi.chat({
        question,
        subject_id:   selectedSubject?.id || null,
        subject_name: selectedSubject?.name || 'General',
        sources,
        messages: messages.slice(-8),
      })

      const aiMsg = { role: AI_ROLE, content: res.answer, timestamp: new Date().toISOString() }
      const finalMessages = [...newMessages, aiMsg]
      setMessages(finalMessages)

      if (activeConv) {
        const updated = await aiApi.conversations.update(activeConv.id, {
          messages: finalMessages,
          title: activeConv.title === 'Nueva conversación' ? question.slice(0, 50) : activeConv.title,
        })
        setConversations((prev) => prev.map((c) => c.id === updated.id ? updated : c))
        setActiveConv(updated)
      }
    } catch (err) {
      toast.error(err.message)
      setMessages(newMessages)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Render ──

  return (
    <div className="flex gap-4 h-[calc(100vh-12rem)] animate-fade-in">

      {/* ── Left panel: conversations + subjects ── */}
      <div className="w-60 flex flex-col gap-3 flex-shrink-0">
        <button onClick={() => newConversation(null)} className="btn-primary w-full justify-center text-sm">
          <Plus size={15} /> Nueva conversación
        </button>

        {/* Quick start by subject */}
        <div className="card p-3">
          <p className="text-xs text-gray-500 mb-2 font-medium">Preguntar sobre materia…</p>
          <div className="flex flex-wrap gap-1.5">
            {subjects.slice(0, 6).map((s) => (
              <button
                key={s.id}
                onClick={() => newConversation(s)}
                className="text-xs px-2.5 py-1 rounded-full border hover:bg-brand/10 hover:text-white transition text-gray-400"
                style={{ borderColor: `${s.color}40` }}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-4">Sin conversaciones</p>
          ) : conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv)}
              className={`w-full text-left p-2.5 rounded-xl border transition group flex items-center gap-2
                ${activeConv?.id === conv.id
                  ? 'bg-brand/15 border-brand/30 text-white'
                  : 'border-transparent hover:bg-white/5 text-gray-400'}`}
            >
              <BrainCircuit size={13} className="flex-shrink-0" />
              <span className="text-xs truncate flex-1">{conv.title}</span>
              <button
                onClick={(e) => deleteConv(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-0.5 transition"
              >
                <Trash2 size={11} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 card flex flex-col overflow-hidden">
        {!activeConv ? (

          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
              <BrainCircuit size={36} className="text-brand" />
            </div>
            <div className="max-w-sm">
              <h3 className="text-lg font-bold text-white mb-2">Profesor IA</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Tu profesor personal que se adapta a cómo aprendes tú.
                Explica con ejemplos de lo que te gusta, usa diagramas y mapas mentales.
              </p>
              <div className="mt-3 text-xs text-gray-600 bg-gray-800/50 rounded-xl p-3 text-left space-y-1">
                <p className="text-gray-500 font-medium mb-1">Lo que puede hacer:</p>
                <p>✅ Explicar temas paso a paso</p>
                <p>✅ Hacer resúmenes y mapas mentales</p>
                <p>✅ Corregir tu trabajo y explicar errores</p>
                <p>✅ Usar tus apuntes del cuaderno como contexto</p>
                <p>🚫 No hace tareas por ti</p>
              </div>
            </div>
            <button onClick={() => newConversation(null)} className="btn-primary">
              <Plus size={16} /> Iniciar conversación
            </button>
          </div>

        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-700/50 mb-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-600/30 flex items-center justify-center">
                {selectedSubject
                  ? <span className="text-base">{selectedSubject.icon}</span>
                  : <BrainCircuit size={16} className="text-purple-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">
                  {selectedSubject ? `Profesor de ${selectedSubject.name}` : 'Asistente General'}
                </div>
                <div className="text-xs text-gray-500">
                  {sources.length > 0
                    ? `${sources.length} fuente${sources.length > 1 ? 's' : ''} activa${sources.length > 1 ? 's' : ''}`
                    : 'Sin fuentes — conocimiento general'
                  }
                </div>
              </div>
              <button
                onClick={() => setShowQuizModal(true)}
                className="text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5
                           border-gray-700 text-gray-400 hover:border-brand/40 hover:bg-brand/10 hover:text-brand"
              >
                <Target size={12} />
                Probar conocimientos
              </button>
              <button
                onClick={() => setShowSources(!showSources)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5
                  ${showSources
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >
                <BookOpen size={12} />
                Fuentes
                {sources.length > 0 && (
                  <span className="bg-brand text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {sources.length}
                  </span>
                )}
              </button>
            </div>

            {/* Sources panel (collapsible) */}
            {showSources && (
              <div className="mb-3 p-3 bg-gray-900/50 border border-gray-700/50 rounded-xl">
                <p className="text-xs font-medium text-gray-400 mb-2">
                  Fuentes de contexto para el profesor:
                </p>
                <SourcesPanel
                  sources={sources}
                  onAddTopic={addTopicSource}
                  onAddUrl={addUrlSource}
                  onRemove={removeSource}
                />
              </div>
            )}

            {/* Quick actions */}
            {messages.length === 0 && (
              <div className="mb-3">
                <p className="text-xs text-gray-600 mb-2">Acciones rápidas:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => sendMessage(a.prompt)}
                      disabled={sending}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border
                                 border-gray-700 hover:border-brand/40 hover:bg-brand/10
                                 text-gray-400 hover:text-brand transition disabled:opacity-40"
                    >
                      <a.icon size={12} /> {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    Haz una pregunta o usa una acción rápida.
                  </p>
                  {sources.length > 0 && (
                    <p className="text-xs text-brand mt-1">
                      El profesor usará tus fuentes seleccionadas como contexto.
                    </p>
                  )}
                </div>
              )}
              {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-600/30 flex items-center justify-center">
                    <BrainCircuit size={14} className="text-purple-400" />
                  </div>
                  <div className="bg-surface-50 border border-gray-700/50 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-xs">Pensando…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage() }}
              className="flex gap-2 pt-3 border-t border-gray-700/50 mt-3"
            >
              <input
                ref={inputRef}
                className="input flex-1 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Pregunta al profesor${selectedSubject ? ` de ${selectedSubject.name}` : ''}…`}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="btn-primary px-4 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Personal quiz modal */}
      {showQuizModal && (
        <PersonalQuizModal
          messages={messages}
          selectedSubject={selectedSubject}
          onClose={() => setShowQuizModal(false)}
        />
      )}
    </div>
  )
}
