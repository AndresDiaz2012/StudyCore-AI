import axios from 'axios'

// In production (Vercel), VITE_API_URL points to the Render backend.
// In development, it's undefined and Vite's dev proxy handles /api → localhost:5000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers['X-Auth-Token'] = token
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Error de red'
    return Promise.reject(new Error(msg))
  }
)

// Auth
export const authApi = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  me:             ()     => api.get('/auth/me'),
  updateProfile:  (data) => api.put('/auth/profile', data),
  updateSettings: (data) => api.put('/auth/settings', data),
  changePassword: (data) => api.put('/auth/change-password', data),
}

// Subjects
export const subjectsApi = {
  list: () => api.get('/subjects/'),
  create: (data) => api.post('/subjects/', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
}

// Events / Calendar
export const eventsApi = {
  list: (params) => api.get('/events/', { params }),
  create: (data) => api.post('/events/', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  toggle: (id) => api.post(`/events/${id}/toggle`),
}

// Evaluations
export const evaluationsApi = {
  list: (params) => api.get('/evaluations/', { params }),
  summary: () => api.get('/evaluations/summary'),
  create: (data) => api.post('/evaluations/', data),
  update: (id, data) => api.put(`/evaluations/${id}`, data),
  delete: (id) => api.delete(`/evaluations/${id}`),
  subjectAverage: (subjectId) => api.get(`/evaluations/subject/${subjectId}/average`),
}

// Notes
export const notesApi = {
  list: (params) => api.get('/notes/', { params }),
  get: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes/', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
}

// OCR (legacy)
export const ocrApi = {
  extract: (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/ocr/', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
  },
}

// AI
export const aiApi = {
  chat: (data) => api.post('/ai/chat', data),
  conversations: {
    list: () => api.get('/ai/conversations'),
    create: (data) => api.post('/ai/conversations', data),
    update: (id, data) => api.put(`/ai/conversations/${id}`, data),
    delete: (id) => api.delete(`/ai/conversations/${id}`),
    getSources: (id) => api.get(`/ai/conversations/${id}/sources`),
    addSource: (id, data) => api.post(`/ai/conversations/${id}/sources`, data),
    deleteSource: (srcId) => api.delete(`/ai/sources/${srcId}`),
  },
}

// Notebook — jerarquía Subject → Period → Topic → Entry
export const notebookApi = {
  // Periods
  periods: {
    list: (subjectId) => api.get('/notebook/periods/', { params: { subject_id: subjectId } }),
    create: (data) => api.post('/notebook/periods/', data),
    update: (id, data) => api.put(`/notebook/periods/${id}`, data),
    delete: (id) => api.delete(`/notebook/periods/${id}`),
  },
  // Topics
  topics: {
    list: (periodId) => api.get('/notebook/topics/', { params: { period_id: periodId } }),
    create: (data) => api.post('/notebook/topics/', data),
    update: (id, data) => api.put(`/notebook/topics/${id}`, data),
    delete: (id) => api.delete(`/notebook/topics/${id}`),
  },
  // Entries (clases)
  entries: {
    list: (topicId) => api.get('/notebook/entries/', { params: { topic_id: topicId } }),
    create: (data) => api.post('/notebook/entries/', data),
    update: (id, data) => api.put(`/notebook/entries/${id}`, data),
    delete: (id) => api.delete(`/notebook/entries/${id}`),
    ocr: (file) => {
      const form = new FormData()
      form.append('image', file)
      return api.post('/notebook/entries/ocr', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
    },
  },
  // Árbol completo de una materia
  tree: (subjectId) => api.get(`/notebook/tree/${subjectId}`),
}

// Groups
export const groupsApi = {
  list:        ()           => api.get('/groups/'),
  create:      (data)       => api.post('/groups/', data),
  join:        (code)       => api.post('/groups/join', { invite_code: code }),
  get:         (id)         => api.get(`/groups/${id}`),
  update:      (id, data)   => api.put(`/groups/${id}`, data),
  delete:      (id)         => api.delete(`/groups/${id}`),
  leave:       (id)         => api.post(`/groups/${id}/leave`),
  members:     (id)         => api.get(`/groups/${id}/members`),
  kickMember:  (id, uid)    => api.delete(`/groups/${id}/members/${uid}`),
  changeRole:  (id, uid, role) => api.put(`/groups/${id}/members/${uid}/role`, { role }),
  feed:        (id)         => api.get(`/groups/${id}/feed`),
  postFeed:    (id, data)   => api.post(`/groups/${id}/feed`, data),
  deleteMsg:   (id, msgId)  => api.delete(`/groups/${id}/feed/${msgId}`),
  askAI:       (id, data)   => api.post(`/groups/${id}/ai`, data),
}

// Quiz
export const quizApi = {
  list:          ()                => api.get('/quiz/'),
  generate:      (data)            => api.post('/quiz/generate', data, { timeout: 60000 }),
  get:           (id)              => api.get(`/quiz/${id}`),
  delete:        (id)              => api.delete(`/quiz/${id}`),
  attempt:       (id, answers)     => api.post(`/quiz/${id}/attempt`, { answers }),
  getAttempt:    (id)              => api.get(`/quiz/attempts/${id}`),
  // Group sessions
  createSession: (data)            => api.post('/quiz/sessions', data),
  getSession:    (sid)             => api.get(`/quiz/sessions/${sid}`),
  startSession:  (sid)             => api.post(`/quiz/sessions/${sid}/start`),
  finishSession: (sid)             => api.post(`/quiz/sessions/${sid}/finish`),
  leaderboard:   (sid)             => api.get(`/quiz/sessions/${sid}/leaderboard`),
  sessionAttempt:(sid, answers)    => api.post(`/quiz/sessions/${sid}/attempt`, { answers }),
}

// Institutes
export const institutesApi = {
  list:   ()     => api.get('/institutes/'),
  create: (data) => api.post('/institutes/', data),
}

// Admin management
export const adminApi = {
  listCodes:       ()          => api.get('/admin/codes'),
  generateCode:    ()          => api.post('/admin/codes'),
  listStudents:    ()          => api.get('/admin/students'),
  changeRole:      (id, role)  => api.put(`/admin/students/${id}/role`, { role }),
  expel:           (id)        => api.delete(`/admin/students/${id}`),
  listSalons:      ()          => api.get('/admin/salons'),
  createSalon:     (data)      => api.post('/admin/salons', data),
  updateSalon:     (id, data)  => api.put(`/admin/salons/${id}`, data),
  deleteSalon:     (id)        => api.delete(`/admin/salons/${id}`),
  salonMembers:    (id)        => api.get(`/admin/salons/${id}/members`),
  addToSalon:      (id, uid)   => api.post(`/admin/salons/${id}/members`, { user_id: uid }),
  removeFromSalon: (id, uid)   => api.delete(`/admin/salons/${id}/members/${uid}`),
  listDelegados:   ()          => api.get('/admin/delegados'),
  assignDelegado:  (data)      => api.post('/admin/delegados', data),
  removeDelegado:  (id)        => api.delete(`/admin/delegados/${id}`),
}

// Salon (delegado)
export const salonApi = {
  info: ()     => api.get('/salon/'),
  push: (data) => api.post('/salon/push', data),
}

export default api
