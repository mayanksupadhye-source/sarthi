import { getCurrentUser, logoutUser } from './auth.js';
import { api } from './api.js';
import { formatMinutes } from './utils.js';

export function renderLayout(activePageKey = 'dashboard') {
  const user = getCurrentUser() || { name: 'Student', email: 'user@sarthi.app' };

  // 1. Sidebar HTML
  const sidebarHtml = `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-brand">
        <div class="brand-monogram">S</div>
        <div class="brand-text">
          <span class="brand-title">SARTHI</span>
          <span class="brand-tagline">Student OS · सारथी</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <!-- Daily Execution -->
        <div>
          <div class="nav-section-label">Execution</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'dashboard' ? 'active' : ''}">
              <a href="/pages/dashboard.html"><span>⚡</span> Today</a>
            </li>
            <li class="nav-item ${activePageKey === 'tasks' ? 'active' : ''}">
              <a href="/pages/tasks.html"><span>📋</span> Tasks & Backlog</a>
            </li>
            <li class="nav-item ${activePageKey === 'planner' ? 'active' : ''}">
              <a href="/pages/planner.html"><span>🧠</span> Adaptive Planner</a>
            </li>
            <li class="nav-item ${activePageKey === 'timetable' ? 'active' : ''}">
              <a href="/pages/timetable.html"><span>⏱</span> Timetable</a>
            </li>
            <li class="nav-item ${activePageKey === 'calendar' ? 'active' : ''}">
              <a href="/pages/calendar.html"><span>📅</span> Calendar</a>
            </li>
            <li class="nav-item ${activePageKey === 'focus' ? 'active' : ''}">
              <a href="/pages/focus.html"><span>🎯</span> Focus Timer</a>
            </li>
          </ul>
        </div>

        <!-- Learning & Skills -->
        <div>
          <div class="nav-section-label">Learning Tracks</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'webdev' ? 'active' : ''}">
              <a href="/pages/webdev.html"><span>🌐</span> Web Development</a>
            </li>
            <li class="nav-item ${activePageKey === 'dsa' ? 'active' : ''}">
              <a href="/pages/dsa.html"><span>💻</span> C++ DSA (136)</a>
            </li>
            <li class="nav-item ${activePageKey === 'oratory' ? 'active' : ''}">
              <a href="/pages/oratory.html"><span>🎙</span> Oratory (13 Wks)</a>
            </li>
            <li class="nav-item ${activePageKey === 'explore' ? 'active' : ''}">
              <a href="/pages/explore.html"><span>🔬</span> Exploration Lab</a>
            </li>
          </ul>
        </div>

        <!-- Academics & Projects -->
        <div>
          <div class="nav-section-label">Academics & Projects</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'academics' ? 'active' : ''}">
              <a href="/pages/academics.html"><span>🎓</span> Attendance & Exams</a>
            </li>
            <li class="nav-item ${activePageKey === 'hackathons' ? 'active' : ''}">
              <a href="/pages/hackathons.html"><span>🚀</span> Hackathon Hub</a>
            </li>
          </ul>
        </div>

        <!-- Well-being & Review -->
        <div>
          <div class="nav-section-label">Routines & Mindset</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'fitness' ? 'active' : ''}">
              <a href="/pages/fitness.html"><span>💪</span> Gym & Weight (88→73)</a>
            </li>
            <li class="nav-item ${activePageKey === 'habits' ? 'active' : ''}">
              <a href="/pages/habits.html"><span>🌙</span> Night Routine & Habits</a>
            </li>
            <li class="nav-item ${activePageKey === 'journal' ? 'active' : ''}">
              <a href="/pages/journal.html"><span>📓</span> Journal & Notes</a>
            </li>
            <li class="nav-item ${activePageKey === 'reset-room' ? 'active' : ''}">
              <a href="/pages/reset-room.html"><span>🌿</span> Reset Room</a>
            </li>
            <li class="nav-item ${activePageKey === 'reading' ? 'active' : ''}">
              <a href="/pages/reading.html"><span>📖</span> Business Reading</a>
            </li>
            <li class="nav-item ${activePageKey === 'sharemarket' ? 'active' : ''}">
              <a href="/pages/sharemarket.html"><span>📈</span> Share Market</a>
            </li>
            <li class="nav-item ${activePageKey === 'rewards' ? 'active' : ''}">
              <a href="/pages/rewards.html"><span>🏔</span> Savings & Rewards</a>
            </li>
          </ul>
        </div>

        <!-- System -->
        <div>
          <div class="nav-section-label">System</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === 'analytics' ? 'active' : ''}">
              <a href="/pages/analytics.html"><span>📊</span> Analytics</a>
            </li>
            <li class="nav-item ${activePageKey === 'settings' ? 'active' : ''}">
              <a href="/pages/settings.html"><span>⚙</span> Settings & Backup</a>
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

  // Insert sidebar
  const layoutContainer = document.querySelector('.app-layout');
  if (layoutContainer) {
    layoutContainer.insertAdjacentHTML('afterbegin', sidebarHtml);

    // Logout listener
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });

    // Mobile menu toggle listener
    document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('appSidebar')?.classList.toggle('open');
    });
  }

  // Live Focus Session Banner / Indicator in topbar
  initLiveFocusBar();
}

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
        <a href="/pages/focus.html" class="timer-pill ${statusClass}" title="Active focus session">
          <span>${statusIcon}</span>
          <span>${s.title} (${s.actualMinutes}m)</span>
        </a>
      `;
    } else {
      container.innerHTML = `
        <a href="/pages/focus.html" class="btn btn-outline btn-sm">
          <span>⏱ Start Focus</span>
        </a>
      `;
    }
  } catch (err) {
    // Silent ignore for guest / offline
  }
}
