import React, { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { eventsApi, subjectsApi } from '../utils/api'
import { eventTypeConfig } from '../utils/helpers'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', time: '', type: 'task', subject_id: '', description: '' })

  const monthKey = format(currentDate, 'yyyy-MM')

  const load = useCallback(async () => {
    try {
      const [evs, subs] = await Promise.all([
        eventsApi.list({ month: monthKey }),
        subjectsApi.list(),
      ])
      setEvents(evs)
      setSubjects(subs)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => { load() }, [load])

  const days = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
  const firstDayOfWeek = getDay(days[0])

  const eventsForDay = (day) =>
    events.filter((e) => {
      try { return isSameDay(parseISO(e.date), day) } catch { return false }
    })

  const openCreate = (day) => {
    setForm({ title: '', date: format(day, 'yyyy-MM-dd'), time: '', type: 'task', subject_id: '', description: '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await eventsApi.create({ ...form, subject_id: form.subject_id || null })
      toast.success('Evento creado')
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const toggleEvent = async (id) => {
    try {
      const res = await eventsApi.toggle(id)
      setEvents((prev) => prev.map((e) => e.id === id ? { ...e, status: res.status } : e))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteEvent = async (id) => {
    try {
      await eventsApi.delete(id)
      setEvents((prev) => prev.filter((e) => e.id !== id))
      toast.success('Eliminado')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : []

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-semibold text-white capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="btn-ghost p-2">
            <ChevronRight size={18} />
          </button>
        </div>
        <button onClick={() => openCreate(new Date())} className="btn-primary">
          <Plus size={16} /> Nuevo evento
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 card p-4">
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const dayEvents = eventsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`relative p-1.5 rounded-xl text-sm transition-all min-h-[52px] flex flex-col items-start
                    ${isToday ? 'bg-brand text-white font-bold' : 'hover:bg-white/5 text-gray-300'}
                    ${isSelected && !isToday ? 'bg-brand/20 border border-brand/40' : ''}
                  `}
                >
                  <span className="text-xs">{format(day, 'd')}</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg = eventTypeConfig[ev.type] || eventTypeConfig.task
                      return (
                        <div
                          key={ev.id}
                          className={`w-1.5 h-1.5 rounded-full ${cfg.color.replace('text-', 'bg-')} ${ev.status === 'done' ? 'opacity-40' : ''}`}
                        />
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-700/50">
            {Object.entries(eventTypeConfig).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`w-2 h-2 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>

        {/* Day detail */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">
              {selectedDay ? format(selectedDay, "dd 'de' MMMM", { locale: es }) : 'Selecciona un día'}
            </h3>
            {selectedDay && (
              <button onClick={() => openCreate(selectedDay)} className="btn-ghost p-1.5">
                <Plus size={16} />
              </button>
            )}
          </div>
          {!selectedDay ? (
            <p className="text-sm text-gray-500">Haz clic en un día para ver sus eventos</p>
          ) : selectedDayEvents.length === 0 ? (
            <p className="text-sm text-gray-500">Sin eventos</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((ev) => {
                const cfg = eventTypeConfig[ev.type] || eventTypeConfig.task
                return (
                  <div key={ev.id} className={`p-3 rounded-xl border ${cfg.border} ${cfg.bg} group`}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => toggleEvent(ev.id)} className="mt-0.5 flex-shrink-0">
                        {ev.status === 'done'
                          ? <CheckCircle2 size={16} className="text-green-400" />
                          : <Circle size={16} className={cfg.color} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${ev.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                          {ev.title}
                        </div>
                        {ev.subject_name && (
                          <div className="text-xs mt-0.5" style={{ color: ev.subject_color }}>{ev.subject_name}</div>
                        )}
                        {ev.description && <div className="text-xs text-gray-500 mt-1">{ev.description}</div>}
                      </div>
                      <button
                        onClick={() => deleteEvent(ev.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create event modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Evento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Título *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Nombre del evento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha *</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="label">Hora</label>
              <input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="task">Tarea</option>
                <option value="exam">Examen</option>
                <option value="reminder">Recordatorio</option>
                <option value="class">Clase</option>
              </select>
            </div>
            <div>
              <label className="label">Materia</label>
              <select className="select" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">Sin materia</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary">Crear evento</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
