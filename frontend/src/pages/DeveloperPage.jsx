import React, { useEffect, useState } from 'react'
import { Code2, Plus, Copy, Check, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../utils/api'

export default function DeveloperPage() {
  const [codes, setCodes]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied]     = useState(null)

  const load = async () => {
    try { setCodes(await adminApi.listCodes()) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const generate = async () => {
    setGenerating(true)
    try {
      const code = await adminApi.generateCode()
      setCodes((prev) => [code, ...prev])
      toast.success('Código generado')
    } catch (e) { toast.error(e.message) }
    finally { setGenerating(false) }
  }

  const copy = (code) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copiado al portapapeles')
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Code2 size={20} className="text-purple-400" /> Developer
        </h2>
        <button onClick={generate} disabled={generating} className="btn-primary disabled:opacity-40">
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Generar código de admin
        </button>
      </div>

      <div className="card p-4 bg-purple-500/5 border-purple-500/20">
        <p className="text-sm text-gray-300">
          Los códigos de admin son de <strong className="text-white">un solo uso</strong>.
          Quien los ingrese al registrarse se convierte en <strong className="text-brand">Admin</strong> de su instituto.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-brand" /></div>
      ) : codes.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <Code2 size={28} className="mx-auto mb-2 text-gray-700" />
          <p>No has generado ningún código aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {codes.map((c) => (
            <div key={c.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition
                ${c.used ? 'bg-gray-900/30 border-gray-800 opacity-60' : 'bg-surface-50 border-gray-700'}`}>
              <div className={`px-3 py-1.5 rounded-lg font-mono text-sm font-bold tracking-widest
                ${c.used ? 'bg-gray-800 text-gray-500' : 'bg-brand/10 text-brand'}`}>
                {c.code}
              </div>
              <div className="flex-1 text-xs text-gray-500">
                {c.used
                  ? <span className="text-gray-600">Usado por <span className="text-gray-400">{c.used_by_name || `#${c.used_by}`}</span></span>
                  : <span className="text-green-400">Disponible</span>
                }
                <span className="ml-3">{new Date(c.created_at).toLocaleDateString('es')}</span>
              </div>
              {!c.used && (
                <button onClick={() => copy(c.code)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-brand hover:bg-brand/10 transition">
                  {copied === c.code ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
