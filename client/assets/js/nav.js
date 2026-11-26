import { getCurrentUser, logoutUser } from "./auth.js";
import { api } from "./api.js";
import { formatCourseDisplayTitle } from "./utils.js";

// Global application identity configuration (never hardcoded in templates)
export const APP_CONFIG = {
  name: "SARTHI",
  tagline: "Student OS · सारथी",
  version: "2.0.0",
};

const COURSE_NAV_CACHE_TTL = 20_000;
const COURSE_NAV_CHANGE_KEY = "sarthi_courses_last_change";
const prefetchedNavigationPages = new Set();

/**
 * Returns custom-drawn SVG Flame markup with tier-based glow and color.
 * Tiers: spark (1-2), steady (3-6), strong (7-13), roaring (14-29), blaze (30+)
 */
export function getFlameSvg(tier = "steady", width = 22, height = 26) {
  let primaryColor = "#FF5722";
  let innerColor = "#FFD54F";

  if (tier === "blaze") {
    primaryColor = "#FF7043";
    innerColor = "#FFEE58";
  } else if (tier === "spark") {
    primaryColor = "#F4511E";
    innerColor = "#FFB74D";
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
export function renderLayout(activePageKey = "dashboard") {
  const user = getCurrentUser() || {
    name: "Student",
    email: "user@sarthi.app",
  };
  document.body.dataset.section = activePageKey;

  // Initialise active theme
  initTheme();

  // 1. Sidebar HTML
  const sidebarHtml = `
    <aside class="app-sidebar" id="appSidebar" aria-label="Primary navigation">
      <div class="sidebar-brand">
        <img class="brand-monogram" src="../assets/sarthi-logo.jpeg" alt="SARTHI logo">
        <div class="brand-text">
          <span class="brand-title">${APP_CONFIG.name}</span>
          <span class="brand-tagline">${APP_CONFIG.tagline}</span>
        </div>
        <button id="sidebarCollapseToggle" class="sidebar-collapse-toggle" type="button" aria-label="Collapse sidebar" title="Collapse sidebar">‹</button>
      </div>

      <nav class="sidebar-nav">
        <!-- Daily Execution -->
        <div>
          <div class="nav-section-label">Execution</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === "dashboard" ? "active" : ""}">
              <a href="dashboard.html"><span>⚡</span> Today</a>
            </li>
            <li class="nav-item ${activePageKey === "tasks" ? "active" : ""}">
              <a href="tasks.html"><span>📋</span> Tasks & Backlog</a>
            </li>
            <li class="nav-item ${activePageKey === "planner" ? "active" : ""}">
              <a href="planner.html"><span>🧠</span> Adaptive Planner</a>
            </li>
            <li class="nav-item ${activePageKey === "timetable" ? "active" : ""}">
              <a href="timetable.html"><span>⏱</span> Timetable</a>
            </li>
            <li class="nav-item ${activePageKey === "calendar" ? "active" : ""}">
              <a href="calendar.html"><span>📅</span> Calendar</a>
            </li>
            <li class="nav-item ${activePageKey === "focus" ? "active" : ""}">
              <a href="focus.html"><span>🎯</span> Focus Timer</a>
            </li>
          </ul>
        </div>

        <!-- Learning & Skills -->
        <div>
          <div class="nav-section-label">Learning Tracks</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === "courses" ? "active" : ""}">
              <a href="courses.html"><span>📚</span> Courses Hub</a>
            </li>
            <li class="nav-item ${activePageKey === "explore" ? "active" : ""}">
              <a href="explore.html"><span>🔬</span> Exploration Lab</a>
            </li>
            <li class="nav-item ${activePageKey === "oratory" ? "active" : ""}">
              <a href="oratory.html"><span style="color: var(--accent-oratory);">🎙</span> Oratory</a>
            </li>
            <li class="nav-course-group" id="activeCourseNavGroup" hidden>
              <span class="nav-course-label">My Courses</span>
              <ul class="nav-list nav-course-list" id="activeCourseNav" aria-label="Active and paused courses"></ul>
            </li>
            <li class="nav-course-group" id="activeExplorationNavGroup" hidden>
              <span class="nav-course-label">My Explorations</span>
              <ul class="nav-list nav-course-list" id="activeExplorationNav" aria-label="Active explorations"></ul>
            </li>
          </ul>
        </div>

        <!-- Academics & Projects -->
        <div>
          <div class="nav-section-label">Academics & Projects</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === "academics" ? "active" : ""}">
              <a href="academics.html"><span style="color: var(--accent-academic);">🎓</span> Attendance & Exams</a>
            </li>
            <li class="nav-item ${activePageKey === "hackathons" ? "active" : ""}">
              <a href="hackathons.html"><span style="color: var(--accent-hackathon);">🚀</span> Hackathon Hub</a>
            </li>
          </ul>
        </div>

        <!-- Routines & Identity -->
        <div>
          <div class="nav-section-label">Routines & Mindset</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === "fitness" ? "active" : ""}">
              <a href="fitness.html"><span style="color: var(--accent-fitness);">💪</span> Gym & Weight (90→73)</a>
            </li>
            <li class="nav-item ${activePageKey === "habits" ? "active" : ""}">
              <a href="habits.html"><span>🌙</span> Night Routine & Habits</a>
            </li>
            <li class="nav-item ${activePageKey === "journal" ? "active" : ""}">
              <a href="journal.html"><span>📓</span> Journal & Notes</a>
            </li>
            <li class="nav-item ${activePageKey === "evidence" ? "active" : ""}">
              <a href="evidence.html"><span style="color: var(--accent-ember);">🧾</span> Evidence Locker</a>
            </li>
            <li class="nav-item ${activePageKey === "reset-room" ? "active" : ""}">
              <a href="reset-room.html"><span>🌿</span> Reset Room</a>
            </li>
            <li class="nav-item ${activePageKey === "reading" ? "active" : ""}">
              <a href="reading.html"><span>📖</span> Business Reading</a>
            </li>
            <li class="nav-item ${activePageKey === "sharemarket" ? "active" : ""}">
              <a href="sharemarket.html"><span>📈</span> Share Market</a>
            </li>
            <li class="nav-item ${activePageKey === "rewards" ? "active" : ""}">
              <a href="rewards.html"><span style="color: var(--accent-rewards);">🏔</span> Savings & Rewards</a>
            </li>
          </ul>
        </div>

        <!-- System -->
        <div>
          <div class="nav-section-label">System</div>
          <ul class="nav-list">
            <li class="nav-item ${activePageKey === "analytics" ? "active" : ""}">
              <a href="analytics.html"><span>📊</span> Analytics</a>
            </li>
            <li class="nav-item ${activePageKey === "settings" ? "active" : ""}">
              <a href="settings.html"><span>⚙</span> Settings & Voice</a>
            </li>
            <li class="nav-item ${activePageKey === "styleguide" ? "active" : ""}">
              <a href="styleguide.html"><span>🎨</span> Style Guide</a>
            </li>
          </ul>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-pill">
          <div class="user-avatar">${(user.name || "S")[0].toUpperCase()}</div>
          <span class="user-name">${user.name || "User"}</span>
        </div>
        <button id="logoutBtn" class="btn btn-outline btn-sm" title="Sign Out">✕</button>
      </div>
    </aside>
  `;

  // 2. Mobile Bottom Navigation (5 Key Touch Destinations)
  const bottomBarHtml = `
    <nav class="app-bottom-bar" aria-label="Mobile Navigation">
      <a href="dashboard.html" class="bottom-bar-item ${activePageKey === "dashboard" ? "active" : ""}">
        <span class="icon">⚡</span>
        <span>Today</span>
      </a>
      <a href="tasks.html" class="bottom-bar-item ${activePageKey === "tasks" ? "active" : ""}">
        <span class="icon">📋</span>
        <span>Tasks</span>
      </a>
      <a href="focus.html" class="bottom-bar-item ${activePageKey === "focus" ? "active" : ""}">
        <span class="icon">🎯</span>
        <span>Focus</span>
      </a>
      <a href="hackathons.html" class="bottom-bar-item ${activePageKey === "hackathons" ? "active" : ""}">
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
  const layoutContainer = document.querySelector(".app-layout");
  if (layoutContainer) {
    layoutContainer.insertAdjacentHTML("afterbegin", sidebarHtml);
    document.getElementById("appSidebar")?.insertAdjacentHTML(
      "afterend",
      '<button class="sidebar-backdrop" id="sidebarBackdrop" type="button" aria-label="Close navigation" hidden></button>',
    );
    layoutContainer.insertAdjacentHTML("beforeend", bottomBarHtml);
    layoutContainer.insertAdjacentHTML(
      "beforeend",
      `
      <button id="sidebarReopenToggle" class="sidebar-reopen-toggle" type="button" aria-label="Open navigation" title="Open navigation" hidden>
        <span aria-hidden="true">☰</span>
      </button>
    `,
    );

    // The sidebar is rebuilt on every page navigation. Restore its previous
    // scroll position so links near the bottom remain reachable across pages.
    const sidebar = document.getElementById("appSidebar");
    const sidebarBackdrop = document.getElementById("sidebarBackdrop");
    const collapsed =
      localStorage.getItem("sarthi_sidebar_collapsed") === "true";
    const reopenToggle = document.getElementById("sidebarReopenToggle");
    let menuTrigger = null;
    const setMobileNavigationState = (isOpen, restoreFocus = false) => {
      sidebar?.classList.toggle("open", isOpen);
      document.body.classList.toggle("mobile-nav-open", isOpen);
      if (sidebarBackdrop) sidebarBackdrop.hidden = !isOpen;
      const collapseToggle = document.getElementById("sidebarCollapseToggle");
      collapseToggle?.setAttribute("aria-expanded", String(isOpen));
      collapseToggle?.setAttribute("aria-controls", "appSidebar");
      if (
        collapseToggle &&
        window.matchMedia("(max-width: 768px)").matches
      ) {
        collapseToggle.setAttribute(
          "aria-label",
          isOpen ? "Close navigation" : "Open navigation",
        );
        collapseToggle.title = isOpen ? "Close navigation" : "Open navigation";
        collapseToggle.textContent = isOpen ? "×" : "☰";
      }
      document.querySelectorAll(".mobile-menu-btn").forEach((button) => {
        button.setAttribute("aria-expanded", String(isOpen));
        button.setAttribute("aria-controls", "appSidebar");
      });
      if (isOpen) sidebar?.querySelector(".nav-item a")?.focus();
      else if (restoreFocus) menuTrigger?.focus();
    };
    if (collapsed) document.body.classList.add("sidebar-collapsed");
    const isMobileViewport = () => window.matchMedia("(max-width: 768px)").matches;
    reopenToggle.hidden = !collapsed || isMobileViewport();
    window.addEventListener("resize", () => {
      if (!isMobileViewport() && sidebar?.classList.contains("open")) {
        setMobileNavigationState(false);
      }
      reopenToggle.hidden = !document.body.classList.contains("sidebar-collapsed") || isMobileViewport();
    });
    document
      .getElementById("sidebarCollapseToggle")
      ?.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 768px)").matches) {
          setMobileNavigationState(false, true);
          return;
        }
        const next = !document.body.classList.contains("sidebar-collapsed");
        document.body.classList.toggle("sidebar-collapsed", next);
        localStorage.setItem("sarthi_sidebar_collapsed", String(next));
        reopenToggle.hidden = !next;
        if (next) sidebar?.classList.remove("open");
        const toggle = document.getElementById("sidebarCollapseToggle");
        toggle.setAttribute(
          "aria-label",
          next ? "Expand sidebar" : "Collapse sidebar",
        );
        toggle.title = next ? "Expand sidebar" : "Collapse sidebar";
        toggle.setAttribute("aria-expanded", String(!next));
        toggle.textContent = next ? "›" : "‹";
      });
    const collapseToggle = document.getElementById("sidebarCollapseToggle");
    if (collapseToggle && window.matchMedia("(max-width: 768px)").matches) {
      collapseToggle.setAttribute("aria-label", "Close navigation");
      collapseToggle.title = "Close navigation";
      collapseToggle.textContent = "×";
    }
    if (collapseToggle && collapsed) {
      collapseToggle.setAttribute("aria-label", "Expand sidebar");
      collapseToggle.title = "Expand sidebar";
      collapseToggle.textContent = "›";
    }
    reopenToggle.addEventListener("click", () => {
      document.body.classList.remove("sidebar-collapsed");
      localStorage.setItem("sarthi_sidebar_collapsed", "false");
      reopenToggle.hidden = true;
      if (window.matchMedia("(max-width: 768px)").matches) {
        menuTrigger = reopenToggle;
        setMobileNavigationState(true);
        return;
      }
      collapseToggle?.setAttribute("aria-label", "Collapse sidebar");
      collapseToggle?.setAttribute("aria-expanded", "true");
      if (collapseToggle) collapseToggle.title = "Collapse sidebar";
      collapseToggle?.focus();
    });
    const sidebarScrollKey = "sarthi-sidebar-scroll-top";
    restoreSidebarScroll();

    // Logout listener
    document.getElementById("logoutBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
    });

    // Mobile menu toggle listeners (topbar button and bottom bar "More")
    document.querySelectorAll(".mobile-menu-btn").forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", "appSidebar");
      btn.addEventListener("click", () => {
        if (document.body.classList.contains("sidebar-collapsed")) {
          document.body.classList.remove("sidebar-collapsed");
          localStorage.setItem("sarthi_sidebar_collapsed", "false");
          reopenToggle.hidden = true;
        }
        menuTrigger = btn;
        setMobileNavigationState(!sidebar?.classList.contains("open"));
      });
    });
    sidebarBackdrop?.addEventListener("click", () =>
      setMobileNavigationState(false, true),
    );
    sidebar?.querySelectorAll(".nav-item a").forEach((link) => {
      link.addEventListener("click", () => setMobileNavigationState(false));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebar?.classList.contains("open")) {
        setMobileNavigationState(false, true);
      }
    });

    initNavigationPrefetch();
    initDynamicCourseNavigation(activePageKey, user);
    window.addEventListener("hashchange", updateDynamicCourseActive);

    // The Style Guide opens normally. Its transient counter survives same-tab
    // page loads so seven repeated clicks can reach the private guide.
    const hiddenGuideKey = "sarthi-styleguide-click-state";
    const clickWindowMs = 7_000;
    document.addEventListener("click", (event) => {
      const link = event.target.closest(".nav-item a");
      if (!link) return;

      try {
        sessionStorage.setItem(
          sidebarScrollKey,
          String(sidebar?.scrollTop || 0),
        );
      } catch {}

      if (link.getAttribute("href") !== "styleguide.html") {
        try {
          sessionStorage.removeItem(hiddenGuideKey);
        } catch {}
        return;
      }

      const now = Date.now();
      let previous = null;
      try {
        previous = JSON.parse(sessionStorage.getItem(hiddenGuideKey) || "null");
      } catch {}
      const count =
        previous &&
        now >= previous.lastClickAt &&
        now - previous.lastClickAt <= clickWindowMs
          ? previous.count + 1
          : 1;
      if (count >= 5) {
        try {
          sessionStorage.removeItem(hiddenGuideKey);
        } catch {}
        event.preventDefault();
        window.location.assign("Guide.html");
        return;
      }
      try {
        sessionStorage.setItem(
          hiddenGuideKey,
          JSON.stringify({ count, lastClickAt: now }),
        );
      } catch {}
    });

    // Ambient Page Wave Backdrop
    const appMain = document.querySelector(".app-main");
    if (appMain && !document.querySelector(".page-wave-backdrop")) {
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
      appMain.insertAdjacentHTML("beforeend", waveBackdrop);
    }
  }

  // Setup topbar flame and live focus widget
  initTopbarFlame();
  initLiveFocusBar();
}

export function setCourseNavigation(courses) {
  const user = getCurrentUser();
  const cacheKey = `sarthi-course-navigation:${user?.id || user?._id || "guest"}`;
  const normalized = Array.isArray(courses) ? courses : [];
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: Date.now(), courses: normalized }),
    );
  } catch {}
  renderDynamicCourseNavigation(normalized);
  restoreSidebarScroll();
}

function restoreSidebarScroll() {
  const sidebarScrollKey = "sarthi-sidebar-scroll-top";
  try {
    const savedScrollTop = Number(sessionStorage.getItem(sidebarScrollKey));
    if (!Number.isFinite(savedScrollTop) || savedScrollTop < 0) return;
    const sidebar = document.getElementById("appSidebar");
    if (!sidebar) return;
    requestAnimationFrame(() => {
      sidebar.scrollTop = savedScrollTop;
      // Dynamic course links may increase the sidebar height after the first frame.
      requestAnimationFrame(() => {
        sidebar.scrollTop = savedScrollTop;
      });
    });
  } catch {}
}

export async function notifyCourseNavigationChanged(courses) {
  let currentCourses = courses;
  // Always ensure we have the full, canonical list of courses from the backend
  if (
    !Array.isArray(currentCourses) ||
    currentCourses.some((c) => c.category === "exploration") === false
  ) {
    try {
      const response = await api.get("/courses");
      currentCourses = response.courses || [];
    } catch {
      currentCourses = Array.isArray(courses) ? courses : [];
    }
  }
  const user = getCurrentUser();
  const userId = String(user?.id || user?._id || "guest");
  const cacheKey = `sarthi-course-navigation:${userId}`;
  const now = Date.now();
  try {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({ savedAt: now, courses: currentCourses }),
    );
    localStorage.setItem(COURSE_NAV_CHANGE_KEY, `${userId}:${now}`);
  } catch {}
  setCourseNavigation(currentCourses);
  window.dispatchEvent(
    new CustomEvent("sarthi:courses-updated", {
      detail: { userId, courses: currentCourses },
    }),
  );
}

function initDynamicCourseNavigation(activePageKey, user) {
  const userId = String(user?.id || user?._id || "guest");
  const cacheKey = `sarthi-course-navigation:${userId}`;
  window.addEventListener("sarthi:courses-updated", (event) => {
    if (event.detail?.userId && event.detail.userId !== userId) return;
    if (Array.isArray(event.detail?.courses))
      setCourseNavigation(event.detail.courses);
  });
  window.addEventListener("storage", (event) => {
    if (
      event.key !== COURSE_NAV_CHANGE_KEY ||
      !event.newValue?.startsWith(`${userId}:`)
    )
      return;
    try {
      sessionStorage.removeItem(cacheKey);
    } catch {}
    loadCourseNavigation();
  });

  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    const lastChangeStr = localStorage.getItem(COURSE_NAV_CHANGE_KEY);
    const lastChangeTime = lastChangeStr
      ? Number(lastChangeStr.split(":")[1])
      : 0;
    if (
      cached &&
      (!lastChangeTime || cached.savedAt >= lastChangeTime) &&
      Date.now() - cached.savedAt < COURSE_NAV_CACHE_TTL &&
      Array.isArray(cached.courses)
    ) {
      setCourseNavigation(cached.courses);
      return;
    }
    if (cached && Array.isArray(cached.courses)) {
      // Immediate render to eliminate flicker, then refresh from server
      setCourseNavigation(cached.courses);
    }
  } catch {}
  loadCourseNavigation();
}

async function loadCourseNavigation() {
  try {
    const response = await api.get("/courses");
    if (response.success && Array.isArray(response.courses)) {
      setCourseNavigation(response.courses);
    }
  } catch {
    // Keep the existing static navigation available when offline.
  }
}

function renderDynamicCourseNavigation(courses) {
  const activeCourseList = document.getElementById("activeCourseNav");
  const activeExpList = document.getElementById("activeExplorationNav");
  if (!activeCourseList) return;

  const activeCourseGroup = document.getElementById("activeCourseNavGroup");
  const activeExpGroup = document.getElementById("activeExplorationNavGroup");

  const isExp = (c) =>
    c?.category === "exploration" ||
    c?.slug === "exploration" ||
    c?.slug === "exploration-lab";
  const isOratory = (c) => c?.category === "oratory" || c?.slug === "oratory";
  const isDone = (c) =>
    c?.status === "archived" ||
    (Number(c?.totalLectures) > 0 &&
      Number(c?.completedLectures) >= Number(c?.totalLectures));

  // Only active / in-progress courses appear in the navigation bar. Completed ones disappear.
  const activeCourses = courses.filter(
    (c) => !isExp(c) && !isOratory(c) && !isDone(c) && c?.slug && c?.title,
  );
  const activeExps = courses.filter(
    (c) => isExp(c) && !isOratory(c) && !isDone(c) && c?.slug && c?.title,
  );

  const urlParams = new URLSearchParams(window.location.search);
  const currentSlug = urlParams.get("slug");
  const currentPath = window.location.pathname.split("/").pop();

  const renderCourseItem = (course) => {
    const href = `tracker.html?slug=${encodeURIComponent(course.slug)}`;
    const isActive =
      (currentPath === "tracker.html" || currentPath === "dsa.html") &&
      currentSlug === course.slug;
    const emoji = course.emoji || "📚";
    const title = escapeNavigationText(
      formatCourseDisplayTitle(course.title, course.slug),
    );
    return `<li class="nav-item${isActive ? " active" : ""}"><a href="${href}" title="${title}"${isActive ? ' aria-current="page"' : ""}><span aria-hidden="true">${emoji}</span> ${title}</a></li>`;
  };

  const renderExpItem = (exp) => {
    const href = `tracker.html?slug=${encodeURIComponent(exp.slug)}`;
    const isActive =
      (currentPath === "tracker.html" || currentPath === "explore.html") &&
      currentSlug === exp.slug;
    const emoji = exp.emoji || "🔬";
    const title = escapeNavigationText(
      formatCourseDisplayTitle(exp.title, exp.slug),
    );
    return `<li class="nav-item${isActive ? " active" : ""}"><a href="${href}" title="${title}"${isActive ? ' aria-current="page"' : ""}><span aria-hidden="true">${emoji}</span> ${title}</a></li>`;
  };

  if (activeCourseGroup) activeCourseGroup.hidden = activeCourses.length === 0;
  if (activeExpGroup) activeExpGroup.hidden = activeExps.length === 0;

  activeCourseList.innerHTML = activeCourses.map(renderCourseItem).join("");
  if (activeExpList)
    activeExpList.innerHTML = activeExps.map(renderExpItem).join("");
}

function updateDynamicCourseActive() {
  const urlParams = new URLSearchParams(window.location.search);
  const currentSlug = urlParams.get("slug");
  const currentPath = window.location.pathname.split("/").pop();
  const currentHash = decodeURIComponentSafe(window.location.hash.slice(1));

  document
    .querySelectorAll(
      "#activeCourseNav a, #completedCourseNav a, #activeExplorationNav a, #completedExplorationNav a",
    )
    .forEach((link) => {
      try {
        const linkUrl = new URL(link.href, window.location.origin);
        const linkSlug = linkUrl.searchParams.get("slug");
        const linkPath = linkUrl.pathname.split("/").pop();
        const linkHash = decodeURIComponentSafe(linkUrl.hash.slice(1));

        const isActive =
          (linkSlug && linkSlug === currentSlug && linkPath === currentPath) ||
          (linkHash && linkHash === currentHash);
        link
          .closest(".nav-item")
          ?.classList.toggle("active", Boolean(isActive));
        if (isActive) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      } catch {
        // Ignore URL parsing errors
      }
    });
}

function escapeNavigationText(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function initNavigationPrefetch() {
  if (document.documentElement.dataset.navigationPrefetchReady === "true")
    return;
  document.documentElement.dataset.navigationPrefetchReady = "true";
  const prefetch = (event) => {
    if (
      navigator.connection?.saveData ||
      ["slow-2g", "2g"].includes(navigator.connection?.effectiveType)
    )
      return;
    const anchor = event.target.closest(".nav-item a, .bottom-bar-item[href]");
    if (!anchor) return;
    let target;
    try {
      target = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (
      target.origin !== window.location.origin ||
      !target.pathname.endsWith(".html") ||
      target.pathname === window.location.pathname
    )
      return;
    const pageUrl = `${target.pathname}${target.search}`;
    if (prefetchedNavigationPages.has(pageUrl)) return;
    prefetchedNavigationPages.add(pageUrl);
    const hint = document.createElement("link");
    hint.rel = "prefetch";
    hint.as = "document";
    hint.href = pageUrl;
    document.head.appendChild(hint);
  };
  document.addEventListener("pointerover", prefetch, true);
  document.addEventListener("focusin", prefetch, true);
}

/**
 * Initializes the persistent streak flame in the topbar header
 */
async function initTopbarFlame() {
  const topbarRight = document.querySelector(".topbar-right");
  if (!topbarRight) return;

  // Check if flame container already exists
  let flameContainer = document.getElementById("topbarFlameContainer");
  if (!flameContainer) {
    flameContainer = document.createElement("div");
    flameContainer.id = "topbarFlameContainer";
    flameContainer.style.display = "inline-flex";
    flameContainer.style.alignItems = "center";
    topbarRight.insertBefore(flameContainer, topbarRight.firstChild);
  }

  let continuityCard = document.getElementById("topbarContinuityCard");
  if (!continuityCard) {
    topbarRight.insertAdjacentHTML(
      "beforeend",
      `
      <a id="topbarContinuityCard" class="continuity-card" href="dashboard.html" aria-label="Open today's plan and keep your momentum">
        <span class="continuity-orbit" aria-hidden="true"><span>✦</span></span>
        <span class="continuity-copy"><strong>Keep showing up</strong><small>One step at a time</small></span>
        <span class="continuity-meter" aria-hidden="true"><i></i></span>
      </a>
    `,
    );
    continuityCard = document.getElementById("topbarContinuityCard");
  }

  try {
    const res = await api.get("/planner/today");
    const streak = res.streak || 1;
    let tier = "spark";
    if (streak >= 30) tier = "blaze";
    else if (streak >= 14) tier = "roaring";
    else if (streak >= 7) tier = "strong";
    else if (streak >= 3) tier = "steady";

    flameContainer.innerHTML = `
      <a href="dashboard.html#streak" class="flame-wrapper" title="Current streak: ${streak} days (${tier})" style="text-decoration: none; color: inherit;">
        ${getFlameSvg(tier, 22, 26)}
        <span class="text-num" style="font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--accent-ember);">${streak}</span>
      </a>
    `;
    const tasks = Array.isArray(res.scheduledTasks) ? res.scheduledTasks : [];
    const done = tasks.filter((task) => task.status === "completed").length;
    const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    continuityCard?.classList.toggle(
      "is-complete",
      tasks.length > 0 && done === tasks.length,
    );
    continuityCard?.style.setProperty("--continuity-progress", `${progress}%`);
    if (continuityCard) {
      continuityCard.querySelector("strong").textContent =
        tasks.length && done === tasks.length
          ? "You showed up today"
          : "Keep showing up";
      continuityCard.querySelector("small").textContent = tasks.length
        ? `${done} of ${tasks.length} planned actions complete`
        : "One step at a time";
      continuityCard.setAttribute(
        "aria-label",
        tasks.length
          ? `${done} of ${tasks.length} planned actions complete. Open today’s plan.`
          : "Open today’s plan and take one small step.",
      );
    }
  } catch {
    // Offline / guest fallback: render spark
    flameContainer.innerHTML = `
      <div class="flame-wrapper" title="Streak Flame">
        ${getFlameSvg("spark", 22, 26)}
        <span class="text-num" style="font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--accent-ember);">1</span>
      </div>
    `;
    continuityCard
      ?.querySelector("small")
      ?.replaceChildren(document.createTextNode("One step at a time"));
  }
}

/**
 * Live Focus Session Indicator in topbar
 */
async function initLiveFocusBar() {
  try {
    const res = await api.get("/focus/active");
    const container = document.getElementById("topbarFocusWidget");
    if (!container) return;

    if (res.active && res.session) {
      const s = res.session;
      const statusClass = s.status === "active" ? "running" : "paused";
      const statusIcon = s.status === "active" ? "▶" : "⏸";

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
  const saved = localStorage.getItem("sarthi_theme");
  if (saved === "dark" || saved === "night") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("sarthi_theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sarthi_theme", "dark");
  }
}
