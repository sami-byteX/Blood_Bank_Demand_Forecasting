import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Attach access token from memory (injected by AuthContext) ────────────────
// The token is stored outside React state so interceptors can always read it.
let _accessToken = null;

export function setAccessToken(token) { _accessToken = token; }
export function getAccessToken()      { return _accessToken; }
export function clearAccessToken()    { _accessToken = null; }

// ── Request interceptor — inject Bearer token ────────────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — auto-refresh on 401 ──────────────────────────────
let _isRefreshing = false;
let _failedQueue  = [];

function processQueue(error, token = null) {
  _failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  _failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't retry the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/refresh/')) {
      processQueue(error);
      // Trigger logout by dispatching a custom event that AuthContext listens to
      window.dispatchEvent(new Event('bb:session-expired'));
      return Promise.reject(error);
    }

    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _failedQueue.push({
          resolve: (token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    _isRefreshing = true;
    originalRequest._retry = true;

    try {
      const refresh = localStorage.getItem('bb_refresh');
      if (!refresh) throw new Error('No refresh token');

      const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
      const newToken = data.access;
      setAccessToken(newToken);

      // Also persist the rotated refresh token if provided
      if (data.refresh) localStorage.setItem('bb_refresh', data.refresh);

      processQueue(null, newToken);
      originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (err) {
      processQueue(err);
      window.dispatchEvent(new Event('bb:session-expired'));
      return Promise.reject(err);
    } finally {
      _isRefreshing = false;
    }
  }
);

export default api;
