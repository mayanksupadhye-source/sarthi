/**
 * SARTHI — Unified API Client
 */

/**
 * SARTHI — Unified API Client
 * Compatible with Express server (port 5000), VS Code Live Server (port 5500), and static deployments.
 */

// Auto-detect API base URL when running via VS Code Live Server or external frontend dev server
function getApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  const port = window.location.port;
  // If port is 5500 (Live Server) or anything other than 5000 / empty (production 80/443)
  if (port && port !== '5000' && window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    if (port !== '5000') {
      return 'http://localhost:5000';
    }
  }
  return '';
}

export async function apiRequest(endpoint, options = {}) {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const path = cleanEndpoint.startsWith('/api') ? cleanEndpoint : `/api${cleanEndpoint}`;
  const url = `${base}${path}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const token = localStorage.getItem('sarthi_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include' // sends cookies
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        localStorage.removeItem('sarthi_token');
        localStorage.removeItem('sarthi_user');
        if (!window.location.pathname.endsWith('login.html')) {
          const target = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
          window.location.href = target;
        }
        return;
      }
      throw new Error(data.error || `HTTP error ${response.status}`);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] [${options.method || 'GET'} ${url}]:`, err.message);
    throw err;
  }
}

export const api = {
  get: (url, params) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiRequest(`${url}${query}`, { method: 'GET' });
  },
  post: (url, body) => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiRequest(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => apiRequest(url, { method: 'DELETE' })
};
