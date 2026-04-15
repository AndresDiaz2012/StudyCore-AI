import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Edit2, BookMarked, Palette, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { subjectsApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/common/Modal'
import EmptyState from '../components/common/EmptyState'
import LoadingSpinner from '../components/common/LoadingSpinner'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#ec4899', '#14b8a6', '#84cc16', '#f59e0b',
]

const PRESET_ICONS = ['📚', '🔢', '⚡', '🧪', '🧬', '🏛️', '📖', '🌍',
  '🎨', '💻', '🎵', '🌱', '⚗️', '🔭', '📐', '🗺️']

const EMPTY_FORM = { name: '', color: '#6366f1', icon: '📚' }

export default function SubjectsPage() {
  const { user }  = useAuth()
  const canEdit   = ['admin', 'developer'].includes(user?.role)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    try {
      const s = await subjectsApi.list()
      setSubjects(s)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (s) => {
    setEditItem(s)
    setForm({ name: s.name, color: s.color, icon: s.icon })
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editItem) {
        await subjectsApi.update(editItem.id, form)
        toast.success('Materia actualizada')
      } else {
        await subjectsApi.create(form)
        toast.success('Materia creada')
      }
      setShowModal(false)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const deleteSubject = async (id) => {
    try {
      await subjectsApi.delete(id)
      toast.success('Materia eliminada')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Mis Materias</h2>
        {canEdit
          ? <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Nueva materia</button>
          : <div className="flex items-center gap-1.5 text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-700">
              <Lock size={12} /> Gestionadas por el admin
            </div>
        }
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="Sin materias"
          description="Agrega tus materias para organizar notas, evaluaciones y el calendario"
          action={<button onClick={openCreate} className="btn-primary">Agregar materia</button>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="card group hover:border-opacity-60 transition-all hover:scale-[1.02]"
              style={{ borderColor: `${s.color}40` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: `${s.color}20` }}
                >
                  {s.icon}
                </div>
                {canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-500 hover:text-gray-200 rounded-lg hover:bg-white/5 transition">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => deleteSubject(s.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold text-gray-200">{s.name}</div>
              <div className="mt-2 h-0.5 rounded-full w-8" style={{ background: s.color }} />
            </div>
          ))}

          {/* Add new card — admin only */}
          {canEdit && (
            <button onClick={openCreate}
              className="card border-dashed border-gray-700 hover:border-brand/40 text-gray-600 hover:text-brand transition-all flex flex-col items-center justify-center gap-2 min-h-[120px]">
              <Plus size={24} />
              <span className="text-xs font-medium">Nueva materia</span>
            </button>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Editar Materia' : 'Nueva Materia'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Nombre *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej: Matemáticas"
            />
          </div>

          <div>
            <label className="label">Ícono</label>
            <div className="flex flex-wrap gap-2 p-3 bg-surface-200 rounded-xl border border-gray-700">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm({ ...form, icon })}
                  className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition
                    ${form.icon === icon ? 'bg-brand/20 ring-2 ring-brand/50' : 'hover:bg-white/5'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-2">
              <Palette size={13} /> Color
            </label>
            <div className="flex flex-wrap gap-2 p-3 bg-surface-200 rounded-xl border border-gray-700">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-7 h-7 rounded-full transition-transform
                    ${form.color === color ? 'scale-125 ring-2 ring-white/30' : 'hover:scale-110'}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200 border border-gray-700">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: `${form.color}20` }}>
              {form.icon}
            </div>
            <span className="text-sm font-medium text-gray-200">{form.name || 'Vista previa'}</span>
            <div className="ml-auto h-0.5 w-8 rounded-full" style={{ background: form.color }} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancelar</button>
            <button type="submit" className="btn-primary">{editItem ? 'Guardar' : 'Crear materia'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
