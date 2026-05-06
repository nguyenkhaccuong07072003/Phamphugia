import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

/** Chỉ gọi API public (không Bearer, không refresh token) — giảm overhead so với `api`. */
export const publicApi = axios.create({
  baseURL: '/api',
})

// Decode JWT payload without verification (browser-side)
function parseJwt(token: string): { exp?: number } | null {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return null
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

// Proactive token refresh: if token expires within 5 minutes, refresh before sending request
let proactiveRefreshPromise: Promise<string | null> | null = null

async function ensureFreshToken(): Promise<string | null> {
  const token = localStorage.getItem('admin_token')
  if (!token) return null

  const payload = parseJwt(token)
  if (!payload?.exp) return token

  const nowSec = Math.floor(Date.now() / 1000)
  const remainingSec = payload.exp - nowSec

  // If more than 5 minutes left, token is still fresh
  if (remainingSec > 300) return token

  // Deduplicate: if already refreshing proactively, wait for that result
  if (proactiveRefreshPromise) return proactiveRefreshPromise

  const refreshToken = localStorage.getItem('admin_refresh_token')
  if (!refreshToken) return token

  proactiveRefreshPromise = (async () => {
    try {
      const { data } = await axios.post('/api/auth/refresh', { refreshToken })
      const newToken = data.data.token
      localStorage.setItem('admin_token', newToken)
      return newToken
    } catch {
      return token
    } finally {
      proactiveRefreshPromise = null
    }
  })()

  return proactiveRefreshPromise
}

// Attach token for admin requests (with proactive refresh)
api.interceptors.request.use(async (config) => {
  const token = await ensureFreshToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh token on 401
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('admin_refresh_token')
      if (!refreshToken) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_refresh_token')
        window.location.href = '/admin/login'
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        const newToken = data.data.token
        localStorage.setItem('admin_token', newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_refresh_token')
        window.location.href = '/admin/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
