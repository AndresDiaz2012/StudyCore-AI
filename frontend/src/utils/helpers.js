import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'
import { es } from 'date-fns/locale'

export const formatDate = (dateStr, fmt = 'dd MMM yyyy') => {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), fmt, { locale: es })
  } catch {
    return dateStr
  }
}

export const formatDateRelative = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr)
    if (isToday(d)) return 'Hoy'
    if (isTomorrow(d)) return 'Mañana'
    return format(d, 'EEE dd MMM', { locale: es })
  } catch {
    return dateStr
  }
}

export const gradeColor = (grade, maxGrade = 20) => {
  if (grade == null) return 'text-gray-400'
  const pct = (grade / maxGrade) * 100
  if (pct >= 85) return 'text-green-400'
  if (pct >= 65) return 'text-yellow-400'
  return 'text-red-400'
}

export const gradeBg = (grade, maxGrade = 20) => {
  if (grade == null) return 'bg-gray-600/20 text-gray-400'
  const pct = (grade / maxGrade) * 100
  if (pct >= 85) return 'bg-green-500/20 text-green-400'
  if (pct >= 65) return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-red-500/20 text-red-400'
}

export const eventTypeConfig = {
  exam: { label: 'Examen', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  task: { label: 'Tarea', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  reminder: { label: 'Recordatorio', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  class: { label: 'Clase', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
}

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max)

export const initials = (name) =>
  name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

export const truncate = (text, max = 120) =>
  text?.length > max ? text.slice(0, max) + '…' : (text || '')
