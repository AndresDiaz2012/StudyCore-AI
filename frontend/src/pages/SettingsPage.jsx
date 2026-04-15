import React, { useState, useEffect } from 'react'
import {
  User, Palette, Lock, LogOut, Save, Eye, EyeOff,
  AlertCircle, Check, RefreshCw, Image, Type,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../utils/api'
import { useAuth, applyTheme } from '../context/AuthContext'

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }) {
  return (
    <div className="card space-y-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-white border-b border-gray-700/50 pb-3">
        <Icon size={18} className="text-brand" /> {title}
      </h2>
      {children}
    </div>
  )
}

// ── Color swatch picker ────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#a855f7', '#f43f5e',
]

function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110
                ${value === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg border border-gray-700" style={{ background: value || '#6366f1' }} />
          <input
            type="text"
            className="input w-28 text-xs font-mono"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#6366f1"
            maxLength={7}
          />
        </div>
      </div>
    </div>
  )
}

// ── PIN input ─────────────────────────────────────────────────────────────────

function PinInput({ value, onChange, placeholder }) {
  return (
    <input
      type="password"
      inputMode="numeric"
      maxLength={6}
      className="input w-32 text-center tracking-[0.5em] text-lg"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
      placeholder={placeholder || '••••'}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth()

  // Profile
  const [name, setName] = useState(user?.name || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Appearance
  const rawSettings = typeof user?.settings === 'string' ? JSON.parse(user?.settings || '{}') : (user?.settings || {})
  const [settings, setSettings] = useState({
    brand_color: rawSettings.brand_color || '#6366f1',
    bg_color:    rawSettings.bg_color    || '',
    bg_image:    rawSettings.bg_image    || '',
    font_size:   rawSettings.font_size   || 14,
    app_pin:     rawSettings.app_pin     || '',
  })
  const [savingAppearance, setSavingAppearance] = useState(false)

  // PIN
  const [newPin, setNewPin]     = useState('')
  const [confirmPin, setConfirm] = useState('')
  const [pinMsg, setPinMsg]     = useState(null)

  // Password
  const [curPwd, setCurPwd]   = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [conPwd, setConPwd]   = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [pwdMsg, setPwdMsg]   = useState(null)
  const [savingPwd, setSavingPwd] = useState(false)

  // Live preview as user changes colors/fonts
  const setSetting = (key, val) => {
    const next = { ...settings, [key]: val }
    setSettings(next)
    applyTheme(next)
  }

  // ── Save profile ──

  const saveProfile = async () => {
    if (!name.trim()) { toast.error('El nombre no puede estar vacío'); return }
    setSavingProfile(true)
    try {
      const updated = await authApi.updateProfile({ name, onboarding_done: user?.onboarding_done })
      updateUser(updated)
      toast.success('Perfil actualizado')
    } catch (e) { toast.error(e.message) }
    finally { setSavingProfile(false) }
  }

  // ── Save appearance ──

  const saveAppearance = async () => {
    setSavingAppearance(true)
    try {
      const updated = await authApi.updateSettings({ settings })
      updateUser(updated)
      applyTheme(settings)
      toast.success('Apariencia guardada')
    } catch (e) { toast.error(e.message) }
    finally { setSavingAppearance(false) }
  }

  const resetAppearance = () => {
    const defaults = { brand_color: '#6366f1', bg_color: '', bg_image: '', font_size: 14, app_pin: settings.app_pin }
    setSettings(defaults)
    applyTheme(defaults)
  }

  // ── Save PIN ──

  const savePin = async () => {
    setPinMsg(null)
    if (newPin && newPin.length < 4) { setPinMsg({ type: 'error', text: 'El PIN debe tener al menos 4 dígitos' }); return }
    if (newPin !== confirmPin) { setPinMsg({ type: 'error', text: 'Los PINs no coinciden' }); return }
    const next = { ...settings, app_pin: newPin }
    setSettings(next)
    try {
      const updated = await authApi.updateSettings({ settings: next })
      updateUser(updated)
      setPinMsg({ type: 'success', text: newPin ? 'PIN configurado correctamente' : 'PIN eliminado' })
      setNewPin(''); setConfirm('')
    } catch (e) { setPinMsg({ type: 'error', text: e.message }) }
  }

  // ── Change password ──

  const changePassword = async () => {
    setPwdMsg(null)
    if (!curPwd || !newPwd) { setPwdMsg({ type: 'error', text: 'Completa todos los campos' }); return }
    if (newPwd !== conPwd)  { setPwdMsg({ type: 'error', text: 'Las contraseñas no coinciden' }); return }
    if (newPwd.length < 6)  { setPwdMsg({ type: 'error', text: 'Mínimo 6 caracteres' }); return }
    setSavingPwd(true)
    try {
      await authApi.changePassword({ current_password: curPwd, new_password: newPwd })
      setPwdMsg({ type: 'success', text: 'Contraseña cambiada correctamente' })
      setCurPwd(''); setNewPwd(''); setConPwd('')
    } catch (e) { setPwdMsg({ type: 'error', text: e.message }) }
    finally { setSavingPwd(false) }
  }

  const initial = (user?.name || 'U').charAt(0).toUpperCase()

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <h1 className="text-xl font-bold text-white">Configuración</h1>

      {/* ── Perfil ── */}
      <Section title="Perfil" icon={User}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">{user?.email}</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
        </div>
        <button onClick={saveProfile} disabled={savingProfile} className="btn-primary w-fit disabled:opacity-50">
          <Save size={15} /> {savingProfile ? 'Guardando…' : 'Guardar nombre'}
        </button>
      </Section>

      {/* ── Apariencia ── */}
      <Section title="Personalización" icon={Palette}>

        <ColorPicker label="Color de acento (botones, íconos activos)"
          value={settings.brand_color} onChange={(v) => setSetting('brand_color', v)} />

        <ColorPicker label="Color de fondo de la app"
          value={settings.bg_color} onChange={(v) => setSetting('bg_color', v)} />

        <div>
          <label className="label flex items-center gap-1.5"><Image size={13} /> Imagen de fondo (URL o ruta local)</label>
          <input
            className="input text-sm"
            placeholder="https://… o C:\Users\…\fondo.jpg"
            value={settings.bg_image || ''}
            onChange={(e) => setSetting('bg_image', e.target.value)}
          />
          <p className="text-xs text-gray-600 mt-1">Deja en blanco para quitar la imagen</p>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            <Type size={13} /> Tamaño de texto: <span className="text-white">{settings.font_size}px</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">12px</span>
            <input
              type="range" min={12} max={22} step={1}
              value={settings.font_size || 14}
              onChange={(e) => setSetting('font_size', parseInt(e.target.value))}
              className="flex-1 accent-brand"
            />
            <span className="text-xs text-gray-600">22px</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">Mínimo 12px para mantener legibilidad</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={saveAppearance} disabled={savingAppearance} className="btn-primary disabled:opacity-50">
            <Save size={15} /> {savingAppearance ? 'Guardando…' : 'Guardar apariencia'}
          </button>
          <button onClick={resetAppearance} className="btn-ghost">
            <RefreshCw size={14} /> Restablecer
          </button>
        </div>
      </Section>

      {/* ── PIN ── */}
      <Section title="PIN de bloqueo" icon={Lock}>
        <p className="text-sm text-gray-400">
          Si configuras un PIN, la app pedirá ese código cada vez que se abra.
          Déjalo vacío para desactivarlo.
        </p>
        <div className="flex items-end gap-4">
          <div>
            <label className="label">Nuevo PIN (4–6 dígitos)</label>
            <PinInput value={newPin} onChange={setNewPin} placeholder="••••" />
          </div>
          <div>
            <label className="label">Confirmar PIN</label>
            <PinInput value={confirmPin} onChange={setConfirm} placeholder="••••" />
          </div>
          <button onClick={savePin} className="btn-primary mb-0.5">
            <Save size={15} /> Guardar PIN
          </button>
        </div>
        {settings.app_pin && (
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <Check size={12} /> PIN activo — {settings.app_pin.length} dígitos
          </p>
        )}
        {pinMsg && (
          <p className={`text-sm flex items-center gap-1.5 ${pinMsg.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {pinMsg.type === 'error' ? <AlertCircle size={13} /> : <Check size={13} />} {pinMsg.text}
          </p>
        )}
      </Section>

      {/* ── Contraseña ── */}
      <Section title="Cambiar contraseña" icon={Lock}>
        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'} className="input pr-10"
              placeholder="Contraseña actual"
              value={curPwd} onChange={(e) => setCurPwd(e.target.value)}
            />
            <button onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <input type={showPwd ? 'text' : 'password'} className="input"
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <input type={showPwd ? 'text' : 'password'} className="input"
            placeholder="Confirmar nueva contraseña"
            value={conPwd} onChange={(e) => setConPwd(e.target.value)} />
        </div>
        {pwdMsg && (
          <p className={`text-sm flex items-center gap-1.5 ${pwdMsg.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {pwdMsg.type === 'error' ? <AlertCircle size={13} /> : <Check size={13} />} {pwdMsg.text}
          </p>
        )}
        <button onClick={changePassword} disabled={savingPwd} className="btn-primary w-fit disabled:opacity-50">
          <Save size={15} /> {savingPwd ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </Section>

      {/* ── Sesión ── */}
      <Section title="Sesión" icon={LogOut}>
        <p className="text-sm text-gray-400">Cerrar sesión eliminará el acceso desde este dispositivo.</p>
        <button onClick={logout} className="btn-danger w-fit">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </Section>
    </div>
  )
}
