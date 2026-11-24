import { api } from "./api.js";

const RETURN_KEY = "sarthi_post_auth_target";

export function getPostAuthTarget() {
  const fallback = new URL("dashboard.html", window.location.href);
  try {
    const saved = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    if (saved) {
      const target = new URL(saved, window.location.origin);
      const path = target.pathname.toLowerCase();
      if (target.origin === window.location.origin && path.includes("/pages/") && path.endsWith(".html") && !path.endsWith("/intro.html") && !path.endsWith("/login.html")) {
        return `${target.pathname}${target.search}${target.hash}`;
      }
    }
  } catch {}
  return `${fallback.pathname}${fallback.search}${fallback.hash}`;
}

function navigateToIntro() {
  if (!window.location.pathname.endsWith("login.html")) {
    if (window.location.pathname.toLowerCase().includes("/pages/") && !window.location.pathname.toLowerCase().endsWith("/intro.html")) {
      try {
        sessionStorage.setItem(RETURN_KEY, `${window.location.pathname}${window.location.search}${window.location.hash}`);
      } catch {}
    }
    const target = window.location.pathname.includes("/pages/")
      ? "intro.html"
      : "pages/intro.html";
    window.location.replace(target);
  }
}

export async function checkAuth() {
  const token = localStorage.getItem("sarthi_token");
  if (!token) {
    navigateToIntro();
    return null;
  }

  try {
    const res = await api.get("/auth/me");
    if (res.success && res.user) {
      localStorage.setItem("sarthi_user", JSON.stringify(res.user));
      return res.user;
    }
  } catch (err) {
    localStorage.removeItem("sarthi_token");
    localStorage.removeItem("sarthi_user");
    navigateToIntro();
    return null;
  }
}

export function getCurrentUser() {
  try {
    const u = localStorage.getItem("sarthi_user");
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export async function logoutUser() {
  try {
    await api.post("/auth/logout", {});
  } finally {
    localStorage.removeItem("sarthi_token");
    localStorage.removeItem("sarthi_user");
    try {
      sessionStorage.removeItem("sarthi_session_active");
      sessionStorage.removeItem("sarthi_intro_done");
    } catch {}
    navigateToIntro();
  }
}
