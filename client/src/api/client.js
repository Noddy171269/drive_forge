import axios from 'axios';

// If VITE_API_URL is set, prefix it; otherwise use relative /api (Vite proxy).
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({ baseURL });

// Attach the JWT from localStorage on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401: clear storage and bounce to /login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      const onAuthPage = ['/login', '/register'].includes(window.location.pathname);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!onAuthPage) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

/** Build an absolute URL to a backend endpoint (for <video>/<img> src etc.). */
export function apiUrl(path) {
  const base = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
    : '/api';
  return `${base}${path}`;
}

/**
 * Build a download/stream URL for a file, carrying the JWT as a query param so
 * that <video>/<img>/<a download> elements (which cannot set headers) work and
 * still benefit from HTTP Range streaming on the server.
 */
export function downloadUrl(fileId) {
  const token = localStorage.getItem('token');
  const q = token ? `?token=${encodeURIComponent(token)}` : '';
  return apiUrl(`/files/${fileId}/download${q}`);
}

/** Download/stream URL authorized by a public share token (no login needed). */
export function publicDownloadUrl(fileId, shareToken) {
  return apiUrl(`/files/${fileId}/download?share=${encodeURIComponent(shareToken)}`);
}

export default api;
