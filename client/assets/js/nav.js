import { getCurrentUser, logoutUser } from './auth.js';
import { api } from './api.js';

// Global application identity configuration (never hardcoded in templates)
export const APP_CONFIG = {
  name: 'SARTHI',
  tagline: 'Student OS · सारथी',
  version: '2.0.0'
};

/**
 * Returns custom-drawn SVG Flame markup with tier-based glow and color.
 * Tiers: spark (1-2), steady (3-6), strong (7-13), roaring (14-29), blaze (30+)
 */
export function getFlameSvg(tier = 'steady', width = 22, height = 26) {
  let primaryColor = '#FF5722';
  let innerColor = '#FFD54F';

  if (tier === 'blaze') {
    primaryColor = '#FF7043';
    innerColor = '#FFEE58';
  } else if (tier === 'spark') {
    primaryColor = '#F4511E';
    innerColor = '#FFB74D';
  }

  return `
    <svg class="flame-svg flame-${tier}" width="${width}" height="${height}" viewBox="0 0 24 30" fill="none" aria-hidden="true">
      <path d="M12 2C12 2 15 7 15 11C15 13 14 14.5 13 15C13 13 12 11 10 10C10 14 7 16 7 20C7 24 10 27 14 27C18.5 27 21 23.5 21 19C21 12 12 2 12 2Z" fill="${primaryColor}"/>
      <path d="M13 18C13 18 14.5 19 14.5 21C14.5 22.5 13.5 24 12 24C10.5 24 9.5 23 9.5 21.5C9.5 19.5 11.5 18 13 18Z" fill="${innerColor}"/>
    </svg>
  `;
}

/**
 * Renders the responsive application shell:
 * - Desktop side rail with grouped, purposeful hierarchy
 * - Topbar with persistent streak flame, active timer, theme switcher
 * - Mobile bottom bar with 5 primary touch destinations (>= 44px)
 */
export function renderLayout(activePageKey = 'dashboard') {
  const user = getCurrentUser() || { name: 'Student', email: 'user@sarthi.app' };

  // Initialise active theme
  initTheme();

  // 1. Sidebar HTML
  const sidebarHtml = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-brand">
        <div class="brand-monogram">S</div>
        <div class="brand-text">
          <span class="brand-title">${APP_CONFIG.name}</span>
          <span class="brand-tagline">${APP_CONFIG.tagline}</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <!-- Daily Execution -->
        <div>
          <div class="nav-section-label">Execution</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'dashboard' ? 'active' : ''}">
              <a href="dashboard.html"><span>⚡</span> Today</a>
            </li>
            <li class="nav-item ${activePageKey === 'tasks' ? 'active' : ''}">
              <a href="tasks.html"><span>📋</span> Tasks & Backlog</a>
            </li>
            <li class="nav-item ${activePageKey === 'planner' ? 'active' : ''}">
              <a href="planner.html"><span>🧠</span> Adaptive Planner</a>
            </li>
            <li class="nav-item ${activePageKey === 'timetable' ? 'active' : ''}">
              <a href="timetable.html"><span>⏱</span> Timetable</a>
            </li>
            <li class="nav-item ${activePageKey === 'calendar' ? 'active' : ''}">
              <a href="calendar.html"><span>📅</span> Calendar</a>
            </li>
            <li class="nav-item ${activePageKey === 'focus' ? 'active' : ''}">
              <a href="focus.html"><span>🎯</span> Focus Timer</a>
            </li>
          </ul>
        </div>

        <!-- Learning & Skills -->
        <div>
          <div class="nav-section-label">Learning Tracks</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'webdev' ? 'active' : ''}">
              <a href="webdev.html"><span style="color: var(--accent-web);">🌐</span> Web Development</a>
            </li>
            <li class="nav-item ${activePageKey === 'dsa' ? 'active' : ''}">
              <a href="dsa.html"><span style="color: var(--accent-dsa);">💻</span> C++ DSA (136)</a>
            </li>
            <li class="nav-item ${activePageKey === 'oratory' ? 'active' : ''}">
              <a href="oratory.html"><span style="color: var(--accent-oratory);">🎙</span> Oratory (13 Wks)</a>
            </li>
            <li class="nav-item ${activePageKey === 'explore' ? 'active' : ''}">
              <a href="explore.html"><span>🔬</span> Exploration Lab</a>
            </li>
          </ul>
        </div>

        <!-- Academics & Projects -->
        <div>
          <div class="nav-section-label">Academics & Projects</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'academics' ? 'active' : ''}">
              <a href="academics.html"><span style="color: var(--accent-academic);">🎓</span> Attendance & Exams</a>
            </li>
            <li class="nav-item ${activePageKey === 'hackathons' ? 'active' : ''}">
              <a href="hackathons.html"><span style="color: var(--accent-hackathon);">🚀</span> Hackathon Hub</a>
            </li>
          </ul>
        </div>

        <!-- Routines & Identity -->
        <div>
          <div class="nav-section-label">Routines & Mindset</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'fitness' ? 'active' : ''}">
              <a href="fitness.html"><span style="color: var(--accent-fitness);">💪</span> Gym & Weight (88→73)</a>
            </li>
            <li class="nav-item ${activePageKey === 'habits' ? 'active' : ''}">
              <a href="habits.html"><span>🌙</span> Night Routine & Habits</a>
            </li>
            <li class="nav-item ${activePageKey === 'journal' ? 'active' : ''}">
              <a href="journal.html"><span>📓</span> Journal & Notes</a>
            </li>
            <li class="nav-item ${activePageKey === 'evidence' ? 'active' : ''}">
              <a href="evidence.html"><span style="color: var(--accent-ember);">🧾</span> Evidence Locker</a>
            </li>
            <li class="nav-item ${activePageKey === 'reset-room' ? 'active' : ''}">
              <a href="reset-room.html"><span>🌿</span> Reset Room</a>
            </li>
            <li class="nav-item ${activePageKey === 'reading' ? 'active' : ''}">
              <a href="reading.html"><span>📖</span> Business Reading</a>
            </li>
            <li class="nav-item ${activePageKey === 'sharemarket' ? 'active' : ''}">
              <a href="sharemarket.html"><span>📈</span> Share Market</a>
            </li>
            <li class="nav-item ${activePageKey === 'rewards' ? 'active' : ''}">
              <a href="rewards.html"><span style="color: var(--accent-rewards);">🏔</span> Savings & Rewards</a>
            </li>
          </ul>
        </div>

        <!-- System -->
        <div>
          <div class="nav-section-label">System</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'analytics' ? 'active' : ''}">
              <a href="analytics.html"><span>📊</span> Analytics</a>
            </li>
            <li class="nav-item ${activePageKey === 'settings' ? 'active' : ''}">
              <a href="settings.html"><span>⚙</span> Settings & Voice</a>
            </li>
            <li class="nav-item ${activePageKey === 'styleguide' ? 'active' : ''}">
              <a href="styleguide.html"><span>🎨</span> Style Guide</a>
            </li>
          </ul>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-pill">
          <div class="user-avatar">${(user.name || 'S')[0].toUpperCase()}</div>
          <span class="user-name">${user.name || 'User'}</span>
        </div>
        <button id="logoutBtn" class="btn btn-outline btn-sm" title="Sign Out">✕</button>
      </div>
    </aside>
  `;

  // 2. Mobile Bottom Navigation (5 Key Touch Destinations)
  const bottomBarHtml = `
    <nav class="app-bottom-bar" aria-label="Mobile Navigation">
      <a href="dashboard.html" class="bottom-bar-item ${activePageKey === 'dashboard' ? 'active' : ''}">
        <span class="icon">⚡</span>
        <span>Today</span>
      </a>
      <a href="tasks.html" class="bottom-bar-item ${activePageKey === 'tasks' ? 'active' : ''}">
        <span class="icon">📋</span>
        <span>Tasks</span>
      </a>
      <a href="focus.html" class="bottom-bar-item ${activePageKey === 'focus' ? 'active' : ''}">
        <span class="icon">🎯</span>
        <span>Focus</span>
      </a>
      <a href="hackathons.html" class="bottom-bar-item ${activePageKey === 'hackathons' ? 'active' : ''}">
        <span class="icon">🚀</span>
        <span>Hacks</span>
      </a>
      <button class="bottom-bar-item mobile-menu-btn" style="background:transparent; border:none; cursor:pointer;" aria-label="Open Full Menu">
        <span class="icon">☰</span>
        <span>More</span>
      </button>
    </nav>
  `;

  // Insert sidebar and bottom bar
  const layoutContainer = document.querySelector('.app-layout');
  if (layoutContainer) {
    layoutContainer.insertAdjacentHTML('afterbegin', sidebarHtml);
    layoutContainer.insertAdjacentHTML('beforeend', bottomBarHtml);

    // Logout listener
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });

    // Mobile menu toggle listeners (topbar button and bottom bar "More")
    document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('appSidebar')?.classList.toggle('open');
      });
    });

    // Ambient Page Wave Backdrop
    const appMain = document.querySelector('.app-main');
    if (appMain && !document.querySelector('.page-wave-backdrop')) {
      const waveBackdrop = `
        <div class="page-wave-backdrop" aria-hidden="true">
          <svg class="sarthi-wave-layer sarthi-wave-layer-1" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,50 C250,90 500,20 750,65 C1000,110 1100,30 1200,60 L1200,120 L0,120 Z" fill="rgba(29, 78, 216, 0.04)"></path>
          </svg>
          <svg class="sarthi-wave-layer sarthi-wave-layer-2" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,65 C200,30 400,85 700,45 C950,15 1100,70 1200,55 L1200,120 L0,120 Z" fill="rgba(5, 150, 105, 0.03)"></path>
          </svg>
        </div>
      `;
      appMain.insertAdjacentHTML('beforeend', waveBackdrop);
    }
  }

  // Setup topbar flame and live focus widget
  initTopbarFlame();
  initLiveFocusBar();
}

/**
 * Initializes the persistent streak flame in the topbar header
 */
async function initTopbarFlame() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  // Check if flame container already exists
  let flameContainer = document.getElementById('topbarFlameContainer');
  if (!flameContainer) {
    flameContainer = document.createElement('div');
    flameContainer.id = 'topbarFlameContainer';
    flameContainer.style.display = 'inline-flex';
    flameContainer.style.alignItems = 'center';
    topbarRight.insertBefore(flameContainer, topbarRight.firstChild);
  }

  try {
    const res = await api.get('/planner/today');
    const streak = res.streak || 1;
    let tier = 'spark';
    if (streak >= 30) tier = 'blaze';
    else if (streak >= 14) tier = 'roaring';
    else if (streak >= 7) tier = 'strong';
    else if (streak >= 3) tier = 'steady';

    flameContainer.innerHTML = `
      <a href="dashboard.html#streak" class="flame-wrapper" title="Current streak: ${streak} days (${tier})" style="text-decoration: none; color: inherit;">
        ${getFlameSvg(tier, 22, 26)}
        <span class="text-num" style="font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--accent-ember);">${streak}</span>
      </a>
    `;
  } catch {
    // Offline / guest fallback: render spark
    flameContainer.innerHTML = `
      <div class="flame-wrapper" title="Streak Flame">
        ${getFlameSvg('spark', 22, 26)}
        <span class="text-num" style="font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--accent-ember);">1</span>
      </div>
    `;
  }
}

/**
 * Live Focus Session Indicator in topbar
 */
async function initLiveFocusBar() {
  try {
    const res = await api.get('/focus/active');
    const container = document.getElementById('topbarFocusWidget');
    if (!container) return;

    if (res.active && res.session) {
      const s = res.session;
      const statusClass = s.status === 'active' ? 'running' : 'paused';
      const statusIcon = s.status === 'active' ? '▶' : '⏸';

      container.innerHTML = `
        <a href="focus.html" class="timer-pill ${statusClass}" title="Active focus session">
          <span>${statusIcon}</span>
          <span>${s.title} (${s.actualMinutes}m)</span>
        </a>
      `;
    } else {
      container.innerHTML = `
        <a href="focus.html" class="btn btn-outline btn-sm">
          <span>⏱ Focus</span>
        </a>
      `;
    }
  } catch {
    // Silent ignore for guest / offline
  }
}

/**
 * Initializes and manages theme state
 * Defaults to the polished light theme with blueprint blue & botanical green accents.
 */
function initTheme() {
  const saved = localStorage.getItem('sarthi_theme');
  if (saved === 'dark' || saved === 'night') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('sarthi_theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('sarthi_theme', 'dark');
  }
}
