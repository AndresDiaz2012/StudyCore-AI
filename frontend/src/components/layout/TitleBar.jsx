import React from 'react'
import { Minus, Square, X, BrainCircuit } from 'lucide-react'

export default function TitleBar() {
  const isElectron = window.electronAPI?.isElectron

  if (!isElectron) return null

  return (
    <div
      className="flex items-center justify-between h-9 px-4 bg-[#0d0d1e] border-b border-gray-800/60 select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-2">
        <BrainCircuit size={13} className="text-brand" />
        <span className="text-xs text-gray-500 font-medium">StudyCore AI</span>
      </div>
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        <button
          onClick={() => window.electronAPI.minimize()}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.electronAPI.maximize()}
          className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-500 hover:text-white transition"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.electronAPI.close()}
          className="w-7 h-7 rounded-lg hover:bg-red-500/80 flex items-center justify-center text-gray-500 hover:text-white transition"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
