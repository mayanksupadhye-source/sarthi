import { api } from './api.js';

function navigateToLogin() {
  if (!window.location.pathname.endsWith('login.html')) {
    const target = window.location.pathname.includes('/pages/') ? 'login.html' : 'pages/login.html';
    window.location.href = target;
  }
}

export async function checkAuth() {
  const token = localStorage.getItem('sarthi_token');
  if (!token) {
    navigateToLogin();
    return null;
  }

  try {
    const res = await api.get('/auth/me');
    if (res.success && res.user) {
      localStorage.setItem('sarthi_user', JSON.stringify(res.user));
      return res.user;
    }
  } catch (err) {
    localStorage.removeItem('sarthi_token');
    localStorage.removeItem('sarthi_user');
    navigateToLogin();
    return null;
  }
}

export function getCurrentUser() {
  try {
    const u = localStorage.getItem('sarthi_user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export async function logoutUser() {
  try {
    await api.post('/auth/logout', {});
  } finally {
    localStorage.removeItem('sarthi_token');
    localStorage.removeItem('sarthi_user');
    navigateToLogin();
  }
}
