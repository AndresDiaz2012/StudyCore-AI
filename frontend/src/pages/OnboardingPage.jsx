import React, { useState } from 'react'
import { BrainCircuit, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../utils/api'
import { useAuth } from '../context/AuthContext'

// ── Step indicator ────────────────────────────────────────────────────────────

function Steps({ current, total }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${i < current ? 'bg-brand text-white' : i === current ? 'bg-brand/20 border-2 border-brand text-brand' : 'bg-gray-800 text-gray-600'}`}>
            {i < current ? <Check size={14} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-0.5 w-8 transition-all ${i < current ? 'bg-brand' : 'bg-gray-800'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ── Toggle pill buttons ────────────────────────────────────────────────────────

function Pill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all
        ${active ? 'bg-brand/20 border-brand text-brand' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
    >
      {label}
    </button>
  )
}

function MultiPill({ options, selected, onChange }) {
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o} label={o} active={selected.includes(o)} onClick={() => toggle(o)} />
      ))}
    </div>
  )
}

function SinglePill({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Pill key={o.value || o} label={o.label || o} active={value === (o.value || o)} onClick={() => onChange(o.value || o)} />
      ))}
    </div>
  )
}

// ── Grade visual picker ────────────────────────────────────────────────────────

const GRADE_OPTIONS = [
  { value: 'struggling', range: '1 – 8',  label: 'Me cuesta',   color: 'border-red-500/40 bg-red-500/10 text-red-400',    desc: 'Necesito explicaciones desde lo más básico' },
  { value: 'average',    range: '9 – 12', label: 'Regular',     color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400', desc: 'Entiendo lo esencial, pero hay lagunas' },
  { value: 'good',       range: '13 – 16',label: 'Bien',        color: 'border-green-500/40 bg-green-500/10 text-green-400',  desc: 'Entiendo bien, busco mejorar' },
  { value: 'excellent',  range: '17 – 20',label: 'Excelente',   color: 'border-brand/40 bg-brand/10 text-brand',            desc: 'Domino el contenido, quiero profundizar' },
]

function GradePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {GRADE_OPTIONS.map((g) => (
        <button
          key={g.value}
          type="button"
          onClick={() => onChange(g.value)}
          className={`p-3 rounded-xl border text-left transition-all ${g.color}
            ${value === g.value ? 'ring-2 ring-offset-2 ring-offset-surface-50 ring-brand/50 scale-[1.02]' : 'opacity-70 hover:opacity-100'}`}
        >
          <div className="text-lg font-bold">{g.range}</div>
          <div className="text-sm font-medium">{g.label}</div>
          <div className="text-xs mt-0.5 opacity-80 leading-tight">{g.desc}</div>
        </button>
      ))}
    </div>
  )
}

// ── Steps content ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    title: '¿Cómo eres como lector?',
    subtitle: 'El profesor usará esto para hacer sus explicaciones más interesantes para ti.',
    fields: ({ p, set }) => (
      <div className="space-y-5">
        <div>
          <label className="label">¿Cuánto sueles leer?</label>
          <SinglePill
            options={[{ value: 'poco', label: 'Poco' }, { value: 'algo', label: 'Algo' }, { value: 'mucho', label: 'Mucho' }]}
            value={p.reading_level} onChange={(v) => set('reading_level', v)}
          />
        </div>
        <div>
          <label className="label">¿Qué tipo de contenido lees? (elige los que quieras)</label>
          <MultiPill
            options={['Novelas', 'Manga / Cómics', 'Noticias', 'Ciencia ficción', 'Historia real', 'Tecnología', 'No leo casi']}
            selected={p.reading_types || []}
            onChange={(v) => set('reading_types', v)}
          />
        </div>
        <div>
          <label className="label">¿Cuál es tu libro, serie o historia favorita? (opcional)</label>
          <input className="input" placeholder="Ej: Harry Potter, One Piece, Game of Thrones…"
            value={p.fav_story || ''} onChange={(e) => set('fav_story', e.target.value)} />
        </div>
      </div>
    ),
  },
  {
    title: '¿Qué te gusta hacer?',
    subtitle: 'El profesor usará analogías de lo que te apasiona para explicar mejor.',
    fields: ({ p, set }) => (
      <div className="space-y-5">
        <div>
          <label className="label">¿Juegas videojuegos?</label>
          <SinglePill
            options={[{ value: true, label: 'Sí' }, { value: false, label: 'No' }]}
            value={p.plays_games} onChange={(v) => set('plays_games', v)}
          />
        </div>
        {p.plays_games === true && (
          <div>
            <label className="label">¿Qué tipo de juegos? (puedes elegir varios)</label>
            <MultiPill
              options={['Acción / FPS', 'RPG / Aventura', 'Estrategia', 'Deportes', 'Sandbox / Survival', 'MOBA / Online', 'Indie']}
              selected={p.game_types || []}
              onChange={(v) => set('game_types', v)}
            />
          </div>
        )}
        <div>
          <label className="label">¿Te gustan los deportes?</label>
          <SinglePill
            options={[{ value: true, label: 'Sí' }, { value: false, label: 'No' }]}
            value={p.likes_sports} onChange={(v) => set('likes_sports', v)}
          />
        </div>
        {p.likes_sports === true && (
          <>
            <div>
              <label className="label">¿Cuáles son tus deportes favoritos?</label>
              <input className="input" placeholder="Ej: fútbol, baloncesto, natación…"
                value={p.fav_sports || ''} onChange={(e) => set('fav_sports', e.target.value)} />
            </div>
            <div>
              <label className="label">¿Cuánto sabes de ellos?</label>
              <SinglePill
                options={[{ value: 'poco', label: 'Lo básico' }, { value: 'algo', label: 'Bastante' }, { value: 'mucho', label: 'Soy fanático' }]}
                value={p.sports_knowledge} onChange={(v) => set('sports_knowledge', v)}
              />
            </div>
          </>
        )}
        <div>
          <label className="label">¿Hay algo más que te apasione? (música, cocina, arte, etc.)</label>
          <input className="input" placeholder="Escribe lo que quieras…"
            value={p.other_interests || ''} onChange={(e) => set('other_interests', e.target.value)} />
        </div>
      </div>
    ),
  },
  {
    title: '¿Cómo van tus notas?',
    subtitle: 'Esto le dice al Profesor IA con qué nivel de detalle explicarte las cosas.',
    fields: ({ p, set }) => (
      <div className="space-y-5">
        <GradePicker value={p.grade_level} onChange={(v) => set('grade_level', v)} />
        <div>
          <label className="label">¿Cuál es tu promedio actual? (opcional, más exacto)</label>
          <input
            className="input" type="number" min={1} max={20} step={0.1}
            placeholder="Ej: 14.5"
            value={p.current_average || ''}
            onChange={(e) => set('current_average', parseFloat(e.target.value) || '')}
          />
          <p className="text-xs text-gray-600 mt-1">Escala 1 – 20</p>
        </div>
      </div>
    ),
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, updateUser } = useAuth()
  const [step, setStep]   = useState(0)
  const [saving, setSaving] = useState(false)

  const [profile, setProfile] = useState({
    reading_level:   '',
    reading_types:   [],
    fav_story:       '',
    plays_games:     null,
    game_types:      [],
    likes_sports:    null,
    fav_sports:      '',
    sports_knowledge:'',
    other_interests: '',
    grade_level:     '',
    current_average: '',
  })

  const set = (key, val) => setProfile((p) => ({ ...p, [key]: val }))

  const next = () => {
    if (step < STEPS.length - 1) { setStep(step + 1); return }
    finish()
  }

  const finish = async () => {
    setSaving(true)
    try {
      const updated = await authApi.updateProfile({
        profile,
        onboarding_done: 1,
      })
      updateUser(updated)
      toast.success('¡Todo listo! Tu profesor ya te conoce.')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const Current = STEPS[step]

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f23] p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center mx-auto mb-3">
            <BrainCircuit size={22} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {step === 0 ? `¡Hola, ${user?.name}!` : Current.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {step === 0
              ? 'Antes de empezar, cuéntanos un poco sobre ti para que el Profesor IA se adapte exactamente a cómo aprendes.'
              : Current.subtitle}
          </p>
        </div>

        <Steps current={step} total={STEPS.length} />

        {/* Step card */}
        <div className="card">
          {step === 0
            ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 leading-relaxed">
                  Te haremos <strong className="text-white">3 preguntas rápidas</strong> sobre tus gustos,
                  tu nivel académico y cómo aprendes mejor. Con esa información, el Profesor IA:
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  {[
                    'Usará ejemplos de cosas que ya conoces y te gustan',
                    'Calibrará el nivel de sus explicaciones a tu promedio',
                    'Se expresará en tu mismo lenguaje',
                    'Celebrará tus logros y te ayudará sin hacer el trabajo por ti',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <Check size={14} className="text-brand mt-0.5 flex-shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-600 italic">
                  Podrás modificar todo esto después en Configuración.
                </p>
              </div>
            )
            : <Current.fields p={profile} set={set} />
          }
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          {step > 0
            ? <button onClick={() => setStep(step - 1)} className="btn-ghost">
                <ChevronLeft size={16} /> Atrás
              </button>
            : <div />
          }
          <button
            onClick={next}
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving
              ? 'Guardando…'
              : step === STEPS.length - 1
                ? 'Comenzar'
                : <>Siguiente <ChevronRight size={16} /></>
            }
          </button>
        </div>

        {/* Skip */}
        <p className="text-center text-xs text-gray-600 mt-4">
          <button onClick={finish} disabled={saving} className="hover:text-gray-400 transition">
            Omitir por ahora
          </button>
        </p>
      </div>
    </div>
  )
}
