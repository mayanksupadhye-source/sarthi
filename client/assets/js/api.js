/**
 * SARTHI — Unified API Client
 */

export async function apiRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
  
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
        window.location.href = '/pages/login.html';
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
