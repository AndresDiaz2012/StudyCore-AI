import React from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, BarChart2, BookOpen,
  BrainCircuit, Users, BookMarked, X, Settings, LogOut, Target,
  Crown, Code2, GraduationCap,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../context/AuthContext'

const BASE_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/calendar', icon: Calendar, label: 'Calendario' },
  { to: '/evaluations', icon: BarChart2, label: 'Evaluaciones' },
  { to: '/notebook', icon: BookOpen, label: 'Cuaderno Digital' },
  { to: '/ai', icon: BrainCircuit, label: 'Profesor IA' },
  { to: '/groups', icon: Users, label: 'Grupos' },
  { to: '/quiz', icon: Target, label: 'Quiz Personal' },
  { to: '/subjects', icon: BookMarked, label: 'Materias' },
]

const ROLE_EXTRAS = {
  delegado:  [{ to: '/salon',     icon: GraduationCap, label: 'Mi Salón' }],
  admin:     [{ to: '/admin',     icon: Crown,         label: 'Panel Admin' }],
  developer: [{ to: '/developer', icon: Code2,         label: 'Developer' }],
}

const ROLE_BADGE = {
  admin:     { label: 'Admin',     cls: 'bg-brand/20 text-brand border-brand/30' },
  delegado:  { label: 'Delegado',  cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  developer: { label: 'Developer', cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
}

export default function Sidebar({ open, onClose }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const initial = (user?.name || 'U').charAt(0).toUpperCase()
  const role    = user?.role || 'student'
  const extras  = ROLE_EXTRAS[role] || []
  const badge   = ROLE_BADGE[role]

  const navItems = [...BASE_ITEMS, ...extras]

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={clsx(
          'fixed lg:relative z-30 flex flex-col h-full w-64 bg-[#16213e] border-r border-gray-800/60 transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand to-purple-600 flex items-center justify-center">
              <BrainCircuit size={16} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-none">StudyCore</div>
              <div className="text-xs text-brand-light leading-none mt-0.5">AI</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              className={clsx(
                'nav-link',
                (exact ? location.pathname === to : location.pathname.startsWith(to) && (to !== '/' || location.pathname === '/')) && 'active'
              )}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div className="px-3 pb-2">
          <NavLink to="/settings"
            className={clsx('nav-link', location.pathname === '/settings' && 'active')}>
            <Settings size={18} /> <span>Configuración</span>
          </NavLink>
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-800/60">
          <button onClick={() => navigate('/settings')}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 w-full transition text-left">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-purple-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-gray-200 truncate">{user?.name || 'Usuario'}</span>
                {badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${badge.cls}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 truncate">{user?.email || ''}</div>
            </div>
          </button>
          <button onClick={logout}
            className="mt-1 flex items-center gap-2 px-2 py-1.5 w-full rounded-lg text-xs text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition">
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
