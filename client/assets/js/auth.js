import { api } from './api.js';

export async function checkAuth() {
  const token = localStorage.getItem('sarthi_token');
  if (!token) {
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/pages/login.html';
    }
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
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = '/pages/login.html';
    }
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
    window.location.href = '/pages/login.html';
  }
}
