import React from 'react'
import { useLocation } from 'react-router-dom'
import { Menu, BrainCircuit } from 'lucide-react'

const TITLES = {
  '/': 'Dashboard',
  '/calendar': 'Calendario Académico',
  '/evaluations': 'Evaluaciones',
  '/notebook': 'Cuaderno Digital',
  '/ai': 'Profesor IA',
  '/groups': 'Grupos de Estudio',
  '/subjects': 'Materias',
  '/settings': 'Configuración',
}

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation()
  const title = TITLES[pathname] || 'StudyCore AI'

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60 bg-[#16213e]/50 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-base font-semibold text-gray-100">{title}</h1>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Backend conectado
      </div>
    </header>
  )
}
