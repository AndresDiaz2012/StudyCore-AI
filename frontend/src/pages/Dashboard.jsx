import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, BookOpen, BarChart2, BrainCircuit, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react'
import { eventsApi, evaluationsApi, notesApi } from '../utils/api'
import { formatDateRelative, gradeColor, eventTypeConfig } from '../utils/helpers'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format } from 'date-fns'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [evalSummary, setEvalSummary] = useState([])
  const [recentNotes, setRecentNotes] = useState([])

  const today = format(new Date(), 'yyyy-MM')

  useEffect(() => {
    const load = async () => {
      try {
        const [evs, evals, notes] = await Promise.all([
          eventsApi.list({ month: today }),
          evaluationsApi.summary(),
          notesApi.list({}),
        ])
        setEvents(evs.filter(e => e.status === 'pending').slice(0, 5))
        setEvalSummary(evals.filter(e => e.weighted_avg !== null).slice(0, 4))
        setRecentNotes(notes.slice(0, 3))
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />

  const pending = events.filter(e => e.status === 'pending').length
  const exams = events.filter(e => e.type === 'exam').length

  const quickLinks = [
    { to: '/calendar', icon: Calendar, label: 'Calendario', count: pending, color: 'bg-blue-500/20 text-blue-400' },
    { to: '/evaluations', icon: BarChart2, label: 'Evaluaciones', count: evalSummary.length, color: 'bg-green-500/20 text-green-400' },
    { to: '/notebook', icon: BookOpen, label: 'Cuaderno', count: recentNotes.length, color: 'bg-purple-500/20 text-purple-400' },
    { to: '/ai', icon: BrainCircuit, label: 'Profesor IA', color: 'bg-brand/20 text-brand-light' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="card bg-gradient-to-r from-brand/20 to-purple-600/10 border-brand/20">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Bienvenido a StudyCore AI</h2>
            <p className="text-sm text-gray-400">Tu plataforma educativa inteligente. Organiza, aprende y mejora.</p>
          </div>
          <div className="text-3xl">🎓</div>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{pending}</div>
            <div className="text-xs text-gray-400">Pendientes</div>
          </div>
          <div className="w-px bg-gray-700" />
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{exams}</div>
            <div className="text-xs text-gray-400">Exámenes</div>
          </div>
          <div className="w-px bg-gray-700" />
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">{recentNotes.length}</div>
            <div className="text-xs text-gray-400">Notas</div>
          </div>
        </div>
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map(({ to, icon: Icon, label, count, color }) => (
          <Link key={to} to={to} className="card hover:border-brand/40 transition-all hover:scale-[1.02] cursor-pointer group">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
              <Icon size={20} />
            </div>
            <div className="text-sm font-medium text-gray-200 group-hover:text-white">{label}</div>
            {count !== undefined && (
              <div className="text-xs text-gray-500 mt-0.5">{count} {count === 1 ? 'elemento' : 'elementos'}</div>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming events */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Próximas Actividades</h3>
            <Link to="/calendar" className="text-xs text-brand hover:text-brand-light">Ver todo</Link>
          </div>
          {events.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No hay actividades pendientes</p>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => {
                const cfg = eventTypeConfig[ev.type] || eventTypeConfig.task
                return (
                  <div key={ev.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${cfg.color.replace('text-', 'bg-')}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">{ev.title}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">{formatDateRelative(ev.date)}</span>
                        {ev.subject_name && (
                          <span className="text-xs" style={{ color: ev.subject_color }}>{ev.subject_name}</span>
                        )}
                      </div>
                    </div>
                    <span className={`badge ${cfg.bg} ${cfg.color} border ${cfg.border}`}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Grade summary */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Rendimiento Académico</h3>
            <Link to="/evaluations" className="text-xs text-brand hover:text-brand-light">Ver todo</Link>
          </div>
          {evalSummary.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Aún no hay evaluaciones registradas</p>
          ) : (
            <div className="space-y-3">
              {evalSummary.map((s) => {
                const pct = ((s.weighted_avg || 0) / 20) * 100
                return (
                  <div key={s.subject_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.subject_color }} />
                        {s.subject_name}
                      </span>
                      <span className={`text-sm font-semibold ${gradeColor(s.weighted_avg)}`}>
                        {s.weighted_avg?.toFixed(1) ?? '—'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: s.subject_color || '#6366f1' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent notes */}
      {recentNotes.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Notas Recientes</h3>
            <Link to="/notebook" className="text-xs text-brand hover:text-brand-light">Ver cuaderno</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentNotes.map((note) => (
              <Link key={note.id} to="/notebook" className="p-3 rounded-xl bg-surface-200 border border-gray-700/30 hover:border-brand/30 transition">
                <div className="flex items-center gap-2 mb-1.5">
                  {note.subject_color && (
                    <div className="w-2 h-2 rounded-full" style={{ background: note.subject_color }} />
                  )}
                  <span className="text-xs text-gray-400">{note.subject_name || 'General'}</span>
                </div>
                <div className="text-sm font-medium text-gray-200 truncate">{note.title || 'Sin título'}</div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-2">{note.content?.slice(0, 80) || ''}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
