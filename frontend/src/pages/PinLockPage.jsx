import React, { useState } from 'react'
import { Lock, Delete } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export default function PinLockPage() {
  const { user, unlockPin } = useAuth()
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const settings = typeof user?.settings === 'string' ? JSON.parse(user?.settings || '{}') : (user?.settings || {})
  const correctPin = settings.app_pin || ''

  const press = (k) => {
    if (k === '⌫') { setInput((p) => p.slice(0, -1)); setError(false); return }
    if (k === '') return
    const next = input + k
    setInput(next)
    if (next.length === correctPin.length) {
      if (next === correctPin) {
        unlockPin()
      } else {
        setError(true)
        setTimeout(() => { setInput(''); setError(false) }, 600)
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f23] gap-8">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors
          ${error ? 'bg-red-500/20 border border-red-500/40' : 'bg-brand/10 border border-brand/30'}`}>
          <Lock size={28} className={error ? 'text-red-400' : 'text-brand'} />
        </div>
        <h2 className="text-xl font-bold text-white">StudyCore AI</h2>
        <p className="text-sm text-gray-500 mt-1">Hola, {user?.name}. Ingresa tu PIN.</p>
      </div>

      {/* Dots */}
      <div className="flex gap-4">
        {Array.from({ length: correctPin.length }).map((_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all
            ${error ? 'border-red-400 bg-red-400' : i < input.length ? 'border-brand bg-brand' : 'border-gray-600'}`} />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={k === ''}
            className={`w-16 h-16 rounded-2xl text-xl font-semibold transition-all
              ${k === '' ? 'invisible' : 'bg-gray-800 hover:bg-gray-700 active:scale-95 text-white border border-gray-700/50'}`}
          >
            {k}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400 animate-shake">PIN incorrecto</p>}
    </div>
  )
}
