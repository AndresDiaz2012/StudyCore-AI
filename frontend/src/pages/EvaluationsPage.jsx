import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Edit2, TrendingUp, Award } from 'lucide-react'
import toast from 'react-hot-toast'
import { evaluationsApi, subjectsApi } from '../utils/api'
import { gradeBg, gradeColor, formatDate } from '../utils/helpers'
import Modal from '../components/common/Modal'
import LoadingSpinner from '../components/common/LoadingSpinner'
import EmptyState from '../components/common/EmptyState'

const PERIODS = ['Lapso 1', 'Lapso 2', 'Lapso 3', 'Semestre 1', 'Semestre 2', 'Anual']

const EMPTY_FORM = { subject_id: '', title: '', percentage: '', grade: '', max_grade: '20', date: '', period: '' }

export default function EvaluationsPage() {
  const [evaluations, setEvaluations] = useState([])
  const [summary, setSummary] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterSubject, setFilterSubject] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    try {
      const [evs, sum, subs] = await Promise.all([
        evaluationsApi.list(filterSubject ? { subject_id: filterSubject } : {}),
        evaluationsApi.summary(),
        subjectsApi.list(),
      ])
      setEvaluations(evs)
      setSummary(sum)
      setSubjects(subs)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [filterSubject])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (ev) => {
    setEditItem(ev)
    setForm({ subject_id: ev.subject_id, title: ev.title, percentage: ev.percentage, grade: ev.grade ?? '', max_grade: ev.max_grade, date: ev.date || '', period: ev.period || '' })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      subject_id: Number(form.subject_id),
      percentage: Number(form.percentage),
      grade: form.grade !== '' ? Number(form.grade) : null,
      max_grade: Number(form.max_grade) || 20,
    }
    try {
      if (editItem) {
        await evaluationsApi.update(editItem.id, payload)
        toast.success('Evaluación actualizada')
      } else {
        await evaluationsApi.create(payload)
        toast.success('Evaluación creada')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteEval = async (id) => {
    try {
      await evaluationsApi.delete(id)
      toast.success('Eliminado')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Evaluaciones</h2>
        <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nueva</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.filter(s => s.weighted_avg !== null).map((s) => (
          <div key={s.subject_id} className="card hover:border-brand/40 transition">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{ background: s.subject_color }} />
              <span className="text-xs text-gray-400 truncate">{s.subject_name}</span>
            </div>
            <div className={`text-2xl font-bold ${gradeColor(s.weighted_avg)}`}>
              {s.weighted_avg?.toFixed(1) ?? '—'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">/ 20 · {s.total_percentage}% evaluado</div>
            <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(s.weighted_avg / 20) * 100}%`, background: s.subject_color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select className="select max-w-xs" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">Todas las materias</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {evaluations.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Sin evaluaciones"
          description="Registra tus notas para ver tu promedio automáticamente"
          action={<button onClick={openCreate} className="btn-primary">Agregar evaluación</button>}
        />
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Evaluación</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Materia</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-400">%</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-400">Nota</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Lapso</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {evaluations.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/3 transition group">
                    <td className="px-4 py-3 font-medium text-gray-200">{ev.title}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: ev.subject_color }} />
                        <span className="text-gray-400">{ev.subject_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">{ev.percentage}%</td>
                    <td className="px-4 py-3 text-center">
                      {ev.grade != null ? (
                        <span className={`badge ${gradeBg(ev.grade, ev.max_grade)}`}>
                          {ev.grade}/{ev.max_grade}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">Pendiente</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{ev.period || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(ev.date) || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(ev)} className="btn-ghost p-1.5"><Edit2 size={14} /></button>
                        <button onClick={() => deleteEval(ev.id)} className="btn-ghost p-1.5 text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar Evaluación' : 'Nueva Evaluación'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Materia *</label>
            <select className="select" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required>
              <option value="">Seleccionar...</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nombre de la evaluación *</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ej: Examen Parcial 1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Peso (%)*</label>
              <input type="number" className="input" min="0" max="100" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} required placeholder="30" />
            </div>
            <div>
              <label className="label">Nota obtenida</label>
              <input type="number" className="input" min="0" step="0.1" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="16" />
            </div>
            <div>
              <label className="label">Nota máxima</label>
              <input type="number" className="input" min="1" value={form.max_grade} onChange={(e) => setForm({ ...form, max_grade: e.target.value })} placeholder="20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Lapso / Período</label>
              <select className="select" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}>
                <option value="">Sin período</option>
                {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary">{editItem ? 'Guardar cambios' : 'Crear evaluación'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
