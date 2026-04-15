import React, { useEffect, useState } from 'react'
import {
  Crown, Users, School, GraduationCap, Plus, Trash2, Loader2,
  UserCheck, UserX, ChevronDown, BookMarked,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi, subjectsApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'
import Modal from '../components/common/Modal'

// ── Role badge ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }) {
  const map = {
    student:  'bg-gray-700/50 text-gray-400',
    delegado: 'bg-green-500/20 text-green-400',
    admin:    'bg-brand/20 text-brand',
  }
  const labels = { student: 'Estudiante', delegado: 'Delegado', admin: 'Admin' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${map[role] || map.student}`}>
      {labels[role] || role}
    </span>
  )
}

// ── Students tab ───────────────────────────────────────────────────────────────
function StudentsTab({ salons }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)  // for role change

  const load = async () => {
    try { setStudents(await adminApi.listStudents()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const changeRole = async (uid, role) => {
    try {
      await adminApi.changeRole(uid, role)
      setStudents((prev) => prev.map((s) => s.id === uid ? { ...s, role } : s))
      toast.success(role === 'delegado' ? '👑 Ascendido a Delegado' : role === 'admin' ? '🔑 Ascendido a Admin' : 'Degradado a Estudiante')
    } catch (e) { toast.error(e.message) }
  }

  const expel = async (uid, name) => {
    if (!window.confirm(`¿Expulsar a ${name} del instituto?`)) return
    try {
      await adminApi.expel(uid)
      setStudents((prev) => prev.filter((s) => s.id !== uid))
      toast.success('Estudiante expulsado')
    } catch (e) { toast.error(e.message) }
  }

  const assignSalon = async (uid, salonId) => {
    try {
      await adminApi.addToSalon(salonId, uid)
      setStudents((prev) => prev.map((s) => s.id === uid ? { ...s, salon_id: salonId } : s))
      toast.success('Asignado al salón')
    } catch (e) { toast.error(e.message) }
  }

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Buscar estudiante..."
        value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          {search ? 'Sin resultados' : 'No hay estudiantes registrados aún'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-gray-700/40">
              <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center text-sm font-bold text-brand flex-shrink-0">
                {s.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-200 truncate">{s.name}</span>
                  <RoleBadge role={s.role} />
                  {s.salon_name && (
                    <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      📚 {s.salon_name}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 truncate">{s.email}</div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Assign salon */}
                {salons.length > 0 && (
                  <select
                    value={s.salon_id || ''}
                    onChange={(e) => e.target.value && assignSalon(s.id, parseInt(e.target.value))}
                    className="text-xs bg-surface-50 border border-gray-700 rounded-lg px-2 py-1 text-gray-400"
                  >
                    <option value="">Salón...</option>
                    {salons.map((sl) => (
                      <option key={sl.id} value={sl.id}>{sl.name}</option>
                    ))}
                  </select>
                )}

                {/* Role change */}
                <select
                  value={s.role}
                  onChange={(e) => changeRole(s.id, e.target.value)}
                  className="text-xs bg-surface-50 border border-gray-700 rounded-lg px-2 py-1 text-gray-400"
                >
                  <option value="student">Estudiante</option>
                  <option value="delegado">Delegado</option>
                  <option value="admin">Admin</option>
                </select>

                {/* Expel */}
                <button onClick={() => expel(s.id, s.name)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition">
                  <UserX size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Salons tab ────────────────────────────────────────────────────────────────
function SalonsTab({ salons, setSalons }) {
  const [name, setName]         = useState('')
  const [creating, setCreating] = useState(false)

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const s = await adminApi.createSalon({ name: name.trim(), order_num: salons.length })
      setSalons((prev) => [...prev, s])
      setName('')
      toast.success('Salón creado')
    } catch (e) { toast.error(e.message) }
    finally { setCreating(false) }
  }

  const deleteSalon = async (id, name) => {
    if (!window.confirm(`¿Eliminar salón "${name}"?`)) return
    try {
      await adminApi.deleteSalon(id)
      setSalons((prev) => prev.filter((s) => s.id !== id))
      toast.success('Salón eliminado')
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex gap-2">
        <input className="input flex-1" placeholder="Nombre del salón (ej: 3er año A)"
          value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={creating || !name.trim()} className="btn-primary disabled:opacity-40">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Crear
        </button>
      </form>

      {salons.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">No hay salones creados</div>
      ) : (
        <div className="space-y-2">
          {salons.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-gray-700/40">
              <School size={16} className="text-brand flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-200">{s.name}</span>
              <span className="text-xs text-gray-500">{s.member_count || 0} miembros</span>
              <button onClick={() => deleteSalon(s.id, s.name)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Delegados tab ─────────────────────────────────────────────────────────────
function DelegadosTab() {
  const [delegados, setDelegados] = useState([])
  const [students, setStudents]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [uid, setUid]             = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [assigning, setAssigning] = useState(false)

  const load = async () => {
    try {
      const [d, s] = await Promise.all([adminApi.listDelegados(), adminApi.listStudents()])
      setDelegados(d)
      setStudents(s)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const assign = async (e) => {
    e.preventDefault()
    if (!uid || !subjectName.trim()) return
    setAssigning(true)
    try {
      const d = await adminApi.assignDelegado({ user_id: parseInt(uid), subject_name: subjectName.trim() })
      setDelegados((prev) => [...prev, d])
      setUid(''); setSubjectName('')
      toast.success('Delegado asignado')
    } catch (e) { toast.error(e.message) }
    finally { setAssigning(false) }
  }

  const remove = async (id) => {
    try {
      await adminApi.removeDelegado(id)
      setDelegados((prev) => prev.filter((d) => d.id !== id))
      toast.success('Asignación eliminada')
    } catch (e) { toast.error(e.message) }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>

  return (
    <div className="space-y-4">
      <form onSubmit={assign} className="flex gap-2 flex-wrap">
        <select className="input flex-1 min-w-[180px]" value={uid} onChange={(e) => setUid(e.target.value)}>
          <option value="">Selecciona delegado...</option>
          {students.filter((s) => s.role === 'delegado').map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input className="input flex-1 min-w-[160px]" placeholder="Materia (ej: Matemáticas)"
          value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
        <button type="submit" disabled={assigning || !uid || !subjectName} className="btn-primary disabled:opacity-40">
          {assigning ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Asignar
        </button>
      </form>

      {delegados.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">Sin asignaciones</div>
      ) : (
        <div className="space-y-2">
          {delegados.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-gray-700/40">
              <GraduationCap size={15} className="text-green-400 flex-shrink-0" />
              <span className="text-sm text-gray-200 flex-1">{d.user_name}</span>
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{d.subject_name}</span>
              <button onClick={() => remove(d.id)}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user }            = useAuth()
  const [tab, setTab]       = useState('students')
  const [salons, setSalons] = useState([])

  useEffect(() => {
    adminApi.listSalons().then(setSalons).catch(() => {})
  }, [])

  const TABS = [
    { key: 'students',  label: '👥 Estudiantes', icon: Users },
    { key: 'salons',    label: '🏫 Salones',     icon: School },
    { key: 'delegados', label: '🎓 Delegados',   icon: GraduationCap },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Crown size={20} className="text-brand" />
        <div>
          <h2 className="section-title">Panel Admin</h2>
          <p className="text-xs text-gray-500 -mt-1">
            {user?.institute_id ? `Instituto ID: ${user.institute_id}` : 'Sin instituto asociado'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700/50">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition border-b-2
              ${tab === key ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'students'  && <StudentsTab salons={salons} />}
        {tab === 'salons'    && <SalonsTab salons={salons} setSalons={setSalons} />}
        {tab === 'delegados' && <DelegadosTab />}
      </div>
    </div>
  )
}
