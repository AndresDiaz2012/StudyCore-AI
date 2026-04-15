import React, { useState, useEffect } from 'react'
import {
  BrainCircuit, Eye, EyeOff, Mail, Lock, User, AlertCircle,
  School, KeyRound, Search, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi, institutesApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'

function InputField({ icon: Icon, type, placeholder, value, onChange, rightEl }) {
  return (
    <div className="relative">
      <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      <input
        type={type}
        className="input pl-10 pr-10"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
      />
      {rightEl && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>}
    </div>
  )
}

// ── Institute picker ───────────────────────────────────────────────────────────

function InstitutePicker({ value, onChange }) {
  const [institutes, setInstitutes] = useState([])
  const [search, setSearch]         = useState('')
  const [open, setOpen]             = useState(false)

  useEffect(() => {
    institutesApi.list().then(setInstitutes).catch(() => {})
  }, [])

  const filtered = institutes.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const select = (name) => {
    onChange(name)
    setSearch('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="relative">
        <School size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-10 pr-8 cursor-pointer"
          placeholder="Busca o escribe tu instituto *"
          value={open ? search : value}
          onChange={(e) => { setSearch(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a2540] border border-gray-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((i) => (
              <button key={i.id} type="button"
                onMouseDown={() => select(i.name)}
                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-brand/15 hover:text-white transition">
                🏫 {i.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-gray-500">
              {search ? (
                <button type="button" onMouseDown={() => select(search)}
                  className="text-brand hover:underline">
                  + Registrar "{search}" como nuevo instituto
                </button>
              ) : (
                'No hay institutos registrados'
              )}
            </div>
          )}
          {filtered.length > 0 && search && !institutes.find(i => i.name.toLowerCase() === search.toLowerCase()) && (
            <button type="button" onMouseDown={() => select(search)}
              className="w-full text-left px-3 py-2 text-xs text-brand hover:bg-brand/10 transition border-t border-gray-700">
              + Registrar "{search}" como nuevo instituto
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Login form ─────────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }) {
  const { login }                   = useAuth()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completa todos los campos'); return }
    setLoading(true)
    try {
      const user = await authApi.login({ email, password })
      login(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <InputField icon={Mail} type="email" placeholder="tucorreo@gmail.com"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <InputField icon={Lock} type={showPwd ? 'text' : 'password'} placeholder="Contraseña"
        value={password} onChange={(e) => setPassword(e.target.value)}
        rightEl={
          <button type="button" onClick={() => setShowPwd(!showPwd)} className="text-gray-500 hover:text-gray-300">
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
        {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿No tienes cuenta?{' '}
        <button type="button" onClick={onSwitch} className="text-brand hover:text-brand-light transition">
          Regístrate
        </button>
      </p>
    </form>
  )
}

// ── Register form ──────────────────────────────────────────────────────────────

function RegisterForm({ onSwitch }) {
  const { login }                         = useAuth()
  const [name, setName]                   = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [confirm, setConfirm]             = useState('')
  const [instituteName, setInstituteName] = useState('')
  const [adminCode, setAdminCode]         = useState('')
  const [showPwd, setShowPwd]             = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) { setError('Completa todos los campos'); return }
    if (!instituteName.trim()) { setError('Debes seleccionar tu instituto'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    try {
      const user = await authApi.register({
        name, email, password,
        institute_name: instituteName.trim(),
        admin_code:     adminCode.trim(),
      })
      login(user)
      toast.success(`¡Bienvenido, ${user.name}!`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <InputField icon={User} type="text" placeholder="Tu nombre completo"
        value={name} onChange={(e) => setName(e.target.value)} />
      <InputField icon={Mail} type="email" placeholder="tucorreo@gmail.com"
        value={email} onChange={(e) => setEmail(e.target.value)} />
      <InputField icon={Lock} type={showPwd ? 'text' : 'password'} placeholder="Contraseña (mín. 6 caracteres)"
        value={password} onChange={(e) => setPassword(e.target.value)}
        rightEl={
          <button type="button" onClick={() => setShowPwd(!showPwd)} className="text-gray-500 hover:text-gray-300">
            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        }
      />
      <InputField icon={Lock} type={showPwd ? 'text' : 'password'} placeholder="Confirmar contraseña"
        value={confirm} onChange={(e) => setConfirm(e.target.value)} />

      {/* Institute picker */}
      <InstitutePicker value={instituteName} onChange={setInstituteName} />

      {/* Optional admin code */}
      <div className="relative">
        <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-10"
          placeholder="Código de admin (opcional)"
          value={adminCode}
          onChange={(e) => setAdminCode(e.target.value)}
          autoComplete="off"
        />
      </div>
      <p className="text-xs text-gray-600 -mt-1 px-1">
        Sin código → eres Estudiante. Con código válido → te conviertes en Admin de tu instituto.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
        {loading ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-gray-500">
        ¿Ya tienes cuenta?{' '}
        <button type="button" onClick={onSwitch} className="text-brand hover:text-brand-light transition">
          Iniciar sesión
        </button>
      </p>
    </form>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [tab, setTab] = useState('login')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f23] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/30">
            <BrainCircuit size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">StudyCore AI</h1>
          <p className="text-sm text-gray-500 mt-1">Tu asistente educativo inteligente</p>
        </div>

        <div className="card">
          <div className="flex gap-1 mb-6 bg-gray-900/50 p-1 rounded-xl">
            {[['login', 'Iniciar sesión'], ['register', 'Crear cuenta']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                  ${tab === key ? 'bg-brand text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'login'
            ? <LoginForm onSwitch={() => setTab('register')} />
            : <RegisterForm onSwitch={() => setTab('login')} />
          }
        </div>
      </div>
    </div>
  )
}
