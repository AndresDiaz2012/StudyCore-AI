import React, { useEffect, useState, useRef } from 'react'
import {
  Target, Plus, Clock, CheckCircle2, XCircle, Share2, Trophy,
  Loader2, CheckSquare, X, FileText, Trash2, RotateCcw,
  FolderOpen, Folder, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { quizApi, groupsApi, subjectsApi, notebookApi } from '../utils/api'

// ── Inline folder tree (same as AIPage but self-contained) ──────────────────

function FolderTree({ onSelectTopic }) {
  const [subjects, setSubjects]     = useState([])
  const [openSubj, setOpenSubj]     = useState(null)
  const [periods, setPeriods]       = useState({})
  const [openPeriod, setOpenPeriod] = useState(null)
  const [topics, setTopics]         = useState({})
  const [busy, setBusy]             = useState(false)

  useEffect(() => { subjectsApi.list().then(setSubjects).catch(() => {}) }, [])

  const toggleSubj = async (s) => {
    if (openSubj === s.id) { setOpenSubj(null); return }
    setOpenSubj(s.id)
    if (!periods[s.id]) {
      setBusy(true)
      try { setPeriods((p) => ({ ...p, [s.id]: [] }));
        const ps = await notebookApi.periods.list(s.id)
        setPeriods((p) => ({ ...p, [s.id]: ps }))
      } finally { setBusy(false) }
    }
  }

  const togglePeriod = async (p) => {
    if (openPeriod === p.id) { setOpenPeriod(null); return }
    setOpenPeriod(p.id)
    if (!topics[p.id]) {
      setBusy(true)
      try { setTopics((t) => ({ ...t, [p.id]: [] }));
        const ts = await notebookApi.topics.list(p.id)
        setTopics((t) => ({ ...t, [p.id]: ts }))
      } finally { setBusy(false) }
    }
  }

  if (!subjects.length) return <p className="text-xs text-gray-600 py-3 text-center">Sin materias</p>

  return (
    <div className="space-y-0.5 text-xs">
      {subjects.map((s) => (
        <div key={s.id}>
          <button onClick={() => toggleSubj(s)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-gray-300 transition">
            {openSubj === s.id
              ? <FolderOpen size={13} style={{ color: s.color }} />
              : <Folder size={13} style={{ color: s.color }} />}
            <span className="flex-1 text-left truncate">{s.icon} {s.name}</span>
            <ChevronDown size={11} className={`transition-transform ${openSubj === s.id ? 'rotate-180' : ''}`} />
          </button>
          {openSubj === s.id && (
            <div className="ml-4 space-y-0.5">
              {(periods[s.id] || []).map((p) => (
                <div key={p.id}>
                  <button onClick={() => togglePeriod(p)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition">
                    <Folder size={12} className="text-gray-500" />
                    <span className="flex-1 text-left truncate">{p.name}</span>
                    <ChevronDown size={10} className={`transition-transform ${openPeriod === p.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openPeriod === p.id && (
                    <div className="ml-4 space-y-0.5">
                      {(topics[p.id] || []).map((t) => (
                        <button key={t.id} onClick={() => onSelectTopic(t, p, s)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand/10 hover:text-brand text-gray-500 transition">
                          <FileText size={11} />
                          <span className="flex-1 text-left truncate">{t.name}</span>
                          <Plus size={10} />
                        </button>
                      ))}
                      {(topics[p.id] || []).length === 0 && !busy && (
                        <p className="text-gray-600 px-2 py-1 italic">Sin temas</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {(periods[s.id] || []).length === 0 && !busy && (
                <p className="text-gray-600 px-2 py-1 italic">Sin períodos</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Quiz Page ─────────────────────────────────────────────────────────

export default function QuizPage() {
  const [step, setStep]               = useState('list')   // list | config | taking | results
  const [quizzes, setQuizzes]         = useState([])
  const [loadingList, setLoadingList] = useState(true)

  // Config
  const [topic, setTopic]             = useState(null)  // {id,name,subjectName,subjectId}
  const [showTree, setShowTree]       = useState(false)
  const [numQ, setNumQ]               = useState(10)
  const [types, setTypes]             = useState(['multiple_choice', 'true_false'])
  const [duration, setDuration]       = useState(null)
  const [generating, setGenerating]   = useState(false)

  // Taking
  const [quiz, setQuiz]               = useState(null)
  const [answers, setAnswers]         = useState({})
  const [timeLeft, setTimeLeft]       = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const timerRef = useRef(null)

  // Results
  const [results, setResults]         = useState(null)
  const [groups, setGroups]           = useState([])
  const [selGroup, setSelGroup]       = useState(null)
  const [sharing, setSharing]         = useState(false)
  const [showShare, setShowShare]     = useState(false)

  const loadList = async () => {
    setLoadingList(true)
    try { setQuizzes(await quizApi.list()) } catch (e) { toast.error(e.message) }
    finally { setLoadingList(false) }
  }

  useEffect(() => { loadList() }, [])

  // Timer
  useEffect(() => {
    if (step === 'taking' && timeLeft !== null) {
      if (timeLeft <= 0) { submitQuiz(); return }
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000)
    }
    return () => clearTimeout(timerRef.current)
  })

  useEffect(() => {
    if (step === 'results') groupsApi.list().then(setGroups).catch(() => {})
  }, [step])

  const toggleType = (t) =>
    setTypes((prev) =>
      prev.includes(t)
        ? prev.length > 1 ? prev.filter((x) => x !== t) : prev
        : [...prev, t]
    )

  const handleGenerate = async () => {
    if (!topic) { toast.error('Selecciona un tema del cuaderno'); return }
    setGenerating(true)
    try {
      const entries = await notebookApi.entries.list(topic.id)
      const content = entries.map((e) => `${e.title}\n${e.content}`).join('\n\n')
      if (!content) { toast.error('El tema no tiene contenido'); return }

      const q = await quizApi.generate({
        content,
        num_questions:   numQ,
        question_types:  types,
        subject_name:    topic.subjectName,
        subject_id:      topic.subjectId,
        topic_id:        topic.id,
        duration_minutes: duration,
      })
      setQuiz(q)
      setAnswers({})
      if (duration) setTimeLeft(duration * 60)
      setStep('taking')
      loadList()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const submitQuiz = async () => {
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

  const retakeQuiz = async (q) => {
    setQuiz(q)
    setAnswers({})
    const duration = q.duration_minutes
    if (duration) setTimeLeft(duration * 60)
    setResults(null)
    setStep('taking')
  }

  const deleteQuiz = async (id) => {
    try {
      await quizApi.delete(id)
      setQuizzes((prev) => prev.filter((q) => q.id !== id))
      toast.success('Quiz eliminado')
    } catch (e) { toast.error(e.message) }
  }

  const handleShare = async () => {
    if (!selGroup || !results) return
    setSharing(true)
    try {
      const emoji = results.score >= 16 ? '🏆' : results.score >= 12 ? '✅' : results.score >= 8 ? '📊' : '📉'
      const msg   = `${emoji} Quiz completado — ${quiz?.title || 'Quiz'}\n📊 Resultado: ${results.score}/20\n✅ ${results.correct_count}/${results.total_questions} preguntas correctas`
      await groupsApi.postFeed(selGroup.id, { type: 'text', content: msg })
      toast.success(`Resultado compartido en "${selGroup.name}"`)
      setShowShare(false)
    } catch (e) { toast.error(e.message) }
    finally { setSharing(false) }
  }

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const questions = quiz?.questions || []

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (step === 'list') return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Target size={20} className="text-brand" /> Mis Quizzes
        </h2>
        <button onClick={() => setStep('config')} className="btn-primary">
          <Plus size={16} /> Nuevo quiz
        </button>
      </div>

      {loadingList ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-brand" /></div>
      ) : quizzes.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Target size={28} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-white">Sin quizzes aún</p>
            <p className="text-sm text-gray-500 mt-1">Crea tu primer quiz para probar tus conocimientos antes de un examen</p>
          </div>
          <button onClick={() => setStep('config')} className="btn-primary">
            <Plus size={16} /> Crear primer quiz
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((q) => (
            <div key={q.id} className="card group hover:border-brand/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Target size={18} className="text-brand" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => retakeQuiz(q)} title="Repetir"
                    className="p-1.5 text-gray-500 hover:text-brand rounded-lg hover:bg-brand/10 transition">
                    <RotateCcw size={13} />
                  </button>
                  <button onClick={() => deleteQuiz(q.id)} title="Eliminar"
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-200 truncate">{q.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {q.subject_name && <span className="mr-2">📚 {q.subject_name}</span>}
                <span>{q.num_questions} preguntas</span>
                {q.duration_minutes && <span className="ml-2">⏱ {q.duration_minutes} min</span>}
              </div>
              <div className="mt-3 text-xs text-gray-600">
                {new Date(q.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <button onClick={() => retakeQuiz(q)} className="mt-3 w-full btn-ghost text-xs py-1.5">
                <RotateCcw size={12} /> Hacer quiz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── CONFIG ────────────────────────────────────────────────────────────────
  if (step === 'config') return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep('list')} className="btn-ghost text-sm">← Volver</button>
        <h2 className="section-title flex items-center gap-2">
          <Target size={18} className="text-brand" /> Nuevo Quiz
        </h2>
      </div>

      <div className="card space-y-5">
        {/* Topic picker */}
        <div>
          <label className="label">Tema del cuaderno *</label>
          {topic ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand/10 border border-brand/30 text-sm text-brand">
              <FileText size={14} />
              <span className="flex-1 truncate">{topic.subjectName} › {topic.name}</span>
              <button onClick={() => setTopic(null)} className="hover:text-red-400 transition"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setShowTree(!showTree)}
              className="w-full text-sm py-2.5 rounded-xl border border-dashed border-gray-600 text-gray-400 hover:border-brand/40 hover:text-brand transition">
              {showTree ? '▲ Cerrar' : '+ Seleccionar tema del cuaderno'}
            </button>
          )}
          {showTree && !topic && (
            <div className="mt-2 border border-gray-700 rounded-xl bg-gray-900/60 p-2 max-h-52 overflow-y-auto">
              <FolderTree onSelectTopic={(t, p, s) => {
                setTopic({ id: t.id, name: t.name, subjectName: s.name, subjectId: s.id })
                setShowTree(false)
              }} />
            </div>
          )}
        </div>

        {/* Number of questions */}
        <div>
          <label className="label">Número de preguntas</label>
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((n) => (
              <button key={n} onClick={() => setNumQ(n)}
                className={`flex-1 py-2.5 rounded-xl text-sm border transition
                  ${numQ === n ? 'border-brand/50 bg-brand/15 text-brand font-semibold' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Question types */}
        <div>
          <label className="label">Tipos de preguntas</label>
          <div className="space-y-2">
            {[
              { key: 'multiple_choice', label: 'Opción múltiple (A/B/C/D)' },
              { key: 'true_false',      label: 'Verdadero / Falso' },
              { key: 'fill_blank',      label: 'Completar el espacio' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <div onClick={() => toggleType(key)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition flex-shrink-0
                    ${types.includes(key) ? 'border-brand bg-brand' : 'border-gray-600 group-hover:border-gray-500'}`}>
                  {types.includes(key) && <CheckCircle2 size={11} className="text-white" />}
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
              <button key={d ?? 'none'} onClick={() => setDuration(d)}
                className={`text-xs px-3 py-1.5 rounded-full border transition
                  ${duration === d ? 'border-brand/50 bg-brand/15 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                {d === null ? 'Sin límite' : `${d} min`}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleGenerate} disabled={generating || !topic}
          className="btn-primary w-full justify-center disabled:opacity-40">
          {generating
            ? <><Loader2 size={15} className="animate-spin" /> Generando con IA…</>
            : <><Target size={15} /> Generar quiz</>
          }
        </button>
      </div>
    </div>
  )

  // ── TAKING ────────────────────────────────────────────────────────────────
  if (step === 'taking') return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">{quiz?.title}</h2>
          <p className="text-xs text-gray-500">{Object.keys(answers).length}/{questions.length} respondidas</p>
        </div>
        <div className="flex items-center gap-3">
          {timeLeft !== null && (
            <div className={`flex items-center gap-1.5 text-sm font-mono font-bold px-3 py-1.5 rounded-lg
              ${timeLeft <= 60 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-surface-50 border border-gray-700 text-gray-300'}`}>
              <Clock size={14} /> {fmtTime(timeLeft)}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all"
          style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }} />
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-sm text-gray-200 leading-relaxed pt-0.5">{q.question}</p>
            </div>

            {q.type === 'multiple_choice' && (
              <div className="ml-10 space-y-2">
                {(q.options || []).map((opt, oi) => {
                  const letter = ['A', 'B', 'C', 'D'][oi]
                  return (
                    <button key={oi} onClick={() => setAnswers((a) => ({ ...a, [i]: letter }))}
                      className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border transition
                        ${answers[i] === letter ? 'border-brand/50 bg-brand/15 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {q.type === 'true_false' && (
              <div className="ml-10 flex gap-2">
                {['Verdadero', 'Falso'].map((val) => (
                  <button key={val} onClick={() => setAnswers((a) => ({ ...a, [i]: val }))}
                    className={`flex-1 py-2.5 text-sm rounded-xl border transition
                      ${answers[i] === val ? 'border-brand/50 bg-brand/15 text-brand font-semibold' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {val === 'Verdadero' ? '✅ Verdadero' : '❌ Falso'}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'fill_blank' && (
              <div className="ml-10">
                <input className="input text-sm" placeholder="Escribe tu respuesta…"
                  value={answers[i] || ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center py-2">
        <span className="text-xs text-gray-500">{Object.keys(answers).length} de {questions.length} respondidas</span>
        <button onClick={submitQuiz} disabled={submitting} className="btn-primary disabled:opacity-40">
          {submitting
            ? <><Loader2 size={14} className="animate-spin" /> Calificando…</>
            : <><CheckSquare size={14} /> Entregar</>
          }
        </button>
      </div>
    </div>
  )

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (step === 'results' && results) {
    const pct   = results.score / 20
    const color = pct >= 0.8 ? 'text-green-400' : pct >= 0.6 ? 'text-yellow-400' : 'text-red-400'
    const bg    = pct >= 0.8 ? 'bg-green-500/10 border-green-500/30' : pct >= 0.6 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'
    const label = pct >= 0.9 ? '¡Excelente!' : pct >= 0.7 ? '¡Bien!' : pct >= 0.5 ? 'Aprobado' : 'A repasar'

    return (
      <div className="max-w-2xl mx-auto animate-fade-in space-y-5">
        {/* Score card */}
        <div className={`card text-center p-6 border ${bg}`}>
          <Trophy size={32} className={`${color} mx-auto mb-2`} />
          <div className={`text-6xl font-black ${color}`}>
            {results.score}<span className="text-2xl text-gray-500">/20</span>
          </div>
          <div className={`text-sm font-bold mt-1 ${color}`}>{label}</div>
          <div className="text-sm text-gray-400 mt-2">
            {results.correct_count} de {results.total_questions} preguntas correctas
          </div>

          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => { setStep('config'); setQuiz(null); setResults(null) }} className="btn-ghost text-sm">
              Nuevo quiz
            </button>
            <button onClick={() => setStep('list')} className="btn-ghost text-sm">
              Ver lista
            </button>
            <button onClick={() => setShowShare(!showShare)} className="btn-primary text-sm">
              <Share2 size={14} /> Compartir en grupo
            </button>
          </div>

          {showShare && (
            <div className="mt-4 p-3 bg-gray-900/60 border border-gray-700 rounded-xl text-left space-y-2">
              <p className="text-xs text-gray-400 font-medium">Selecciona un grupo:</p>
              {groups.length === 0
                ? <p className="text-xs text-gray-600 italic">No perteneces a ningún grupo.</p>
                : groups.map((g) => (
                  <button key={g.id} onClick={() => setSelGroup(g)}
                    className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition
                      ${selGroup?.id === g.id ? 'border-brand/40 bg-brand/10 text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                    {g.image || '👥'} {g.name}
                  </button>
                ))
              }
              {selGroup && (
                <button onClick={handleShare} disabled={sharing} className="btn-primary w-full text-sm disabled:opacity-40">
                  {sharing ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
                  Compartir en {selGroup.name}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Desglose pregunta por pregunta</p>
          {(results.results || []).map((r, i) => (
            <div key={i} className={`card p-4 border ${r.is_correct ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-start gap-3">
                {r.is_correct
                  ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                  : <XCircle      size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 leading-snug">{r.question}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-gray-500">Tu resp:&nbsp;
                      <span className={r.is_correct ? 'text-green-300' : 'text-red-300'}>{r.user_answer || '—'}</span>
                    </span>
                    {!r.is_correct && <span className="text-gray-500">Correcta:&nbsp;<span className="text-green-300">{r.correct_answer}</span></span>}
                  </div>
                  {r.explanation && (
                    <p className="mt-2 text-xs text-gray-500 italic leading-snug border-t border-gray-700/50 pt-2">{r.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
