import React, { useEffect, useState } from 'react'
import {
  GraduationCap, Send, Loader2, Users, BookOpen, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { salonApi } from '../utils/api'

export default function SalonPage() {
  const [info, setInfo]       = useState(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [subjectName, setSubjectName] = useState('')
  const [periodName, setPeriodName]   = useState('Lapso 1')
  const [topicName, setTopicName]     = useState('')
  const [title, setTitle]             = useState('')
  const [content, setContent]         = useState('')
  const [entryDate, setEntryDate]     = useState(new Date().toISOString().split('T')[0])
  const [pushing, setPushing]         = useState(false)

  useEffect(() => {
    salonApi.info()
      .then(setInfo)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handlePush = async (e) => {
    e.preventDefault()
    if (!subjectName || !topicName || !content) {
      toast.error('Materia, tema y contenido son requeridos')
      return
    }
    setPushing(true)
    try {
      const res = await salonApi.push({
        subject_name: subjectName,
        period_name:  periodName,
        topic_name:   topicName,
        title,
        content,
        entry_date:   entryDate,
      })
      toast.success(`¡Clase enviada a ${res.pushed_to} compañero${res.pushed_to !== 1 ? 's' : ''}!`)
      setTopicName('')
      setTitle('')
      setContent('')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setPushing(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand" /></div>
  )

  const { salon, members, subjects } = info || {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="section-title flex items-center gap-2">
          <GraduationCap size={20} className="text-green-400" />
          {salon
            ? <SubjectTitle subjects={subjects} salonName={salon.name} />
            : 'Mi Salón'
          }
        </h2>
        {!salon && (
          <p className="text-sm text-gray-500 mt-1">No estás asignado a ningún salón todavía. Espera a que el admin te asigne uno.</p>
        )}
      </div>

      {salon && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen size={15} className="text-brand" /> Pasar clase al cuaderno del salón
              </h3>
              <form onSubmit={handlePush} className="space-y-4">
                {/* Subject */}
                <div>
                  <label className="label">Materia *</label>
                  {subjects && subjects.length > 0 ? (
                    <select className="input" value={subjectName}
                      onChange={(e) => setSubjectName(e.target.value)}>
                      <option value="">Selecciona una materia</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.subject_name}>{s.subject_name}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="input" placeholder="Ej: Matemáticas"
                      value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
                  )}
                </div>

                {/* Period */}
                <div>
                  <label className="label">Lapso / Período *</label>
                  <select className="input" value={periodName} onChange={(e) => setPeriodName(e.target.value)}>
                    <option>Lapso 1</option>
                    <option>Lapso 2</option>
                    <option>Lapso 3</option>
                    <option>1er Semestre</option>
                    <option>2do Semestre</option>
                  </select>
                </div>

                {/* Topic */}
                <div>
                  <label className="label">Tema *</label>
                  <input className="input" placeholder="Ej: Las fracciones"
                    value={topicName} onChange={(e) => setTopicName(e.target.value)} />
                </div>

                {/* Title (optional) */}
                <div>
                  <label className="label">Título de la clase (opcional)</label>
                  <input className="input" placeholder="Ej: Clase del lunes 14/04"
                    value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                {/* Date */}
                <div>
                  <label className="label">Fecha de la clase</label>
                  <input className="input" type="date" value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)} />
                </div>

                {/* Content */}
                <div>
                  <label className="label">Contenido de la clase *</label>
                  <textarea className="input resize-none min-h-[160px]"
                    placeholder="Escribe aquí el contenido de la clase, fórmulas, conceptos, ejemplos..."
                    value={content} onChange={(e) => setContent(e.target.value)} />
                </div>

                <button type="submit" disabled={pushing} className="btn-primary w-full justify-center disabled:opacity-40">
                  {pushing
                    ? <><Loader2 size={15} className="animate-spin" /> Enviando al salón…</>
                    : <><Send size={15} /> Enviar clase al cuaderno de todos</>
                  }
                </button>
              </form>
            </div>
          </div>

          {/* Members */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Users size={14} className="text-green-400" />
              Compañeros del salón
              <span className="ml-auto text-xs text-gray-500">{members?.length || 0}</span>
            </h3>
            <div className="space-y-2 max-h-[480px] overflow-y-auto">
              {(members || []).map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-50 border border-gray-700/30">
                  <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand flex-shrink-0">
                    {m.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-200 truncate">{m.name}</div>
                    <div className="text-xs text-gray-600 truncate">{m.role}</div>
                  </div>
                </div>
              ))}
              {(!members || members.length === 0) && (
                <p className="text-xs text-gray-600 text-center py-4">Sin compañeros aún</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Shows subject names — if multiple, collapse with "..." tooltip
function SubjectTitle({ subjects, salonName }) {
  const [expanded, setExpanded] = useState(false)
  const names = (subjects || []).map((s) => s.subject_name)

  if (names.length === 0) return <span>Salón — {salonName}</span>
  if (names.length <= 2) return <span>{names.join(' · ')} — {salonName}</span>

  return (
    <span className="flex items-center gap-1">
      {names.slice(0, 2).join(' · ')}
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-0.5 text-gray-400 hover:text-white text-xs transition">
        <span>+{names.length - 2} más</span>
        <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <span className="absolute mt-8 ml-0 z-10 bg-[#1a2540] border border-gray-700 rounded-xl p-2 text-xs space-y-1 shadow-xl">
          {names.map((n) => <div key={n} className="text-gray-300">{n}</div>)}
        </span>
      )}
      <span className="text-gray-400">— {salonName}</span>
    </span>
  )
}
