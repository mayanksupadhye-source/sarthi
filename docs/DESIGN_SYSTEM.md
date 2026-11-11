# SARTHI — Design System Specification
**Version:** 2.1 (Polished Execution & Wave Motion System)  
**Philosophy:** Disciplined, high-contrast, tactile, and calm personal execution operating system.

---

## 1. Primary Light Theme Palette & Surface Tokens

Depth is achieved through layered solid surfaces, architectural hairline borders (`#E2E8F0`), high-contrast typography, and atmospheric organic wave geometry. High-contrast Light Theme is the default appearance across all 23 application views.

### Base Canvas & Surfaces
| Token | Hex | Role | Contrast Ratio vs Ink |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F8FAFC` | Primary application canvas backdrop (Slate 50) | 14.5:1 (AAA) |
| `--bg-surface` | `#FFFFFF` | Standard container and card surface (Pure White) | 16.2:1 (AAA) |
| `--bg-elevated` | `#FFFFFF` | Modal dialogs, elevated dropdown menus, popovers | 16.2:1 (AAA) |
| `--bg-subtle` | `#F1F5F9` | Recessed wells, table headers, flat ledger strips | 13.2:1 (AAA) |
| `--border-hairline`| `#E2E8F0` | Structural dividers and card outlines (1px solid) | N/A |
| `--border-focus` | `#1D4ED8` | Visible keyboard focus indicator outline | High |

### Typography Tokens
| Token | Hex | Role | Contrast vs `#FFFFFF` |
| :--- | :--- | :--- | :--- |
| `--text-ink` | `#0F172A` | Primary body prose, section titles, metrics (Slate 900) | 16.2:1 (AAA) |
| `--text-muted` | `#475569` | Secondary captions, subheadings, timetable titles (Slate 600) | 6.2:1 (AA) |
| `--text-subtle`| `#64748B` | Metadata, timestamps, inactive categories (Slate 500) | 4.6:1 (AA) |
| `--text-on-accent`| `#FFFFFF` | Text on blueprint blue or botanical green buttons | High (AAA) |

### Signature Brand Accents
| Accent | Hex | Token | Usage |
| :--- | :--- | :--- | :--- |
| **Blueprint Blue** | `#1D4ED8` | `--accent-blue` | Primary buttons, active nav indicators, hero highlights |
| **Blueprint Hover**| `#1E40AF` | `--accent-blue-hover` | Hover/active states for primary interactive controls |
| **Botanical Green**| `#059669` | `--accent-green` | Success alerts, completed tasks, attendance safe zones |
| **Solar Amber** | `#D97706` | `--accent-ember` / warning | Disruption banners, Slack Day indicators, near-deadline tasks |
| **Crimson Alert** | `#DC2626` | `--accent-danger` | Critical bunk warnings, destructive action modals |

### Domain Module Accents
Each functional domain carries a distinct, restrained signal token to distinguish workspaces:
- **Web Development**: `--accent-web: #2563EB` (Cobalt Blueprint)
- **C++ DSA (136)**: `--accent-dsa: #0D9488` (Teal Logic)
- **Oratory Program**: `--accent-oratory: #D97706` (Amber Resonance)
- **Academics & Exams**: `--accent-academic: #4F46E5` (Indigo Scholar)
- **Hackathon Command**: `--accent-hackathon: #EA580C` (Ember Sprint)
- **Gym & Fitness**: `--accent-fitness: #059669` (Emerald Vitality)
- **Trek & Rewards**: `--accent-rewards: #B45309` (Summit Ochre)
- **Reset Room**: `--accent-reset: #475569` (Slate Grounding)

---

## 2. Atmospheric SVG Wave System & Expressive Motion

SARTHI incorporates purposeful, fluid SVG wave forms representing flow state and daily rhythm. Waves are mathematically smooth multi-layered vector paths rendered in Blueprint Blue (`rgba(29, 78, 216, 0.08)`) and Botanical Green (`rgba(5, 150, 105, 0.06)`).

### Wave Components & Specialized Families
1. **`.card-hero-wave`**:
   - Hero container with layered animated SVG wave backdrop.
   - Tailored domain motifs:
     - **`.wave-motif-horizon`**: Wide, expansive swell for Today Dashboard and general heroes.
     - **`.wave-motif-surge`**: High-energy dual-peak crests for Focus Timer, Tasks, and Hackathon Command.
     - **`.wave-motif-logic`**: Harmonic frequency wave for C++ DSA, Web Development, Academics, and Analytics.
     - **`.wave-motif-calm`**: Low-amplitude grounding drift for Reset Room, Habits, Fitness, and Journal.
     - **`.wave-motif-summit`**: Upward-sloping celebratory crest for Rewards & Mountain Trek Fund.
2. **`.page-wave-backdrop`**:
   - Hardware-accelerated ambient fluid canvas injected dynamically into the layout shell, creating unified organic depth across all views.
3. **`.wave-empty-state`**:
   - Calm, low-amplitude wave lines indicating a clear horizon when no tasks or deadlines are pending.
4. **`.wave-divider`**:
   - Clean horizontal SVG wave boundary providing seamless transitions between hero banners and content matrices.
5. **`.wave-water-gauge`**:
   - Dynamic liquid progress fill with proportional color coding (`safe`, `warning`, `danger`) for attendance safe bunks and capacity allocations.
6. **`.skeleton-wave`**:
   - Shimmering gradient wave placeholder for loading states.
7. **`.breathing-wave-guide`**:
   - Circular breathing rhythm guide (4s inhale, 7s hold, 8s exhale) for mindfulness in the Reset Room.
8. **Signature Moment 1: Daily Plan Completion Wave Crest (`.wave-completion-crest`)**:
   - Celebratory wave crest banner triggered when all planned tasks for today are checked off.
   - Copy: *"Day's planned execution complete. The horizon is clear."*
9. **Signature Moment 2: Focus Session Completion Ripple (`.focus-completion-ripple`)**:
   - Concentric expanding botanical green ripple originating from the timer clock upon session completion.

### Micro-Interaction Motion Rules
- **Tactile Buttons (`.btn`):**
  - Hover sheen sweep (`.btn-primary::after`) with 550ms ease.
  - Active press compression (`transform: translateY(1px) scale(0.99)`).
  - Focus ring with matching accent glow.
- **Card Elevation (`.card`):**
  - Smooth hover elevation (`transform: translateY(-2px); box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.06); border-color: #CBD5E1;`).
- **Sidebar Nav (`.nav-item a`):**
  - Hover translation (`transform: translateX(3px)`) with active border highlight.
- **Modals & Drawers (`.modal-box`):**
  - Scale-spring entrance (`scale(0.96) -> scale(1)`) with smooth backdrop blur.
- **Staggered Reveals (`.stagger-grid`):**
  - Sub-element entry delay ladder (30ms, 60ms, 90ms, 120ms...).

### Motion Keyframes
- `@keyframes wave-drift-slow`: 18s ease-in-out infinite alternate horizontal and subtle vertical translation.
- `@keyframes wave-drift-reverse`: 14s ease-in-out infinite alternate translation.
- `@keyframes crest-emerge`: 600ms cubic-bezier(0.16, 1, 0.3, 1) entrance animation.
- `@keyframes ripple-pulse`: 1800ms smooth expanding circle with progressive opacity decay.

### Strict Reduced Motion Policy
When `prefers-reduced-motion: reduce` is detected:
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
All wave keyframe drifts and ripples stop immediately; static, serene vector paths remain visible without movement.

---

## 3. Time Display & Boundary Standards

1. **12-Hour AM/PM Standard**:
   - Every visible clock, timetable block, task duration, and journal timestamp uses 12-hour format with uppercase AM/PM (e.g., `2:30 PM`, `11:45 AM`).
   - Midnight is rendered strictly as `12:00 AM`.
   - Noon is rendered strictly as `12:00 PM`.
   - Time ranges use en-dash formatting: `6:00 PM – 7:30 PM`.
   - Midnight crossover ranges (e.g. `11:40 PM – 5:00 AM`) format accurately without negative durations.
2. **Timezone Standardization**:
   - All calendar date boundaries use `Intl.DateTimeFormat('en-CA', { timeZone })` (default: `Asia/Kolkata`) to avoid UTC midnight shifts where `new Date().toISOString().split('T')[0]` returns yesterday.
3. **Data Isolation**:
   - Internal database storage and API payloads retain standard ISO 8601 timestamps or `HH:mm` 24-hour strings; formatting is applied strictly at the UI presentation boundary via `formatTime12()` and `formatTimeRange()`.

---

## 4. Typography Scale & Fonts

- **Display Face:** `Syne`, sans-serif (Architectural geometry, tabular numerals)
- **Body & Dense Content:** `Plus Jakarta Sans`, sans-serif (High legibility, tall x-height)
- **Devanagari Fallback:** `Noto Sans Devanagari` (Authentic rendering of SARTHI quotes)
- **Offline Readiness:** All WOFF2 font files are served locally from `client/assets/fonts/`.

### Modular Type Scale
| Token | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| `--type-display-xl`| `3.25rem` (52px) | `1.1` | Big Timer countdown, capacity metrics |
| `--type-display-lg`| `2.0rem` (32px)  | `1.2` | Page headline hero titles |
| `--type-title`     | `1.25rem` (20px) | `1.3` | Section cards, module headers |
| `--type-body`      | `0.9375rem` (15px)| `1.55`| Primary prose, descriptions |
| `--type-caption`   | `0.8125rem` (13px)| `1.4` | Badges, metadata, timetable chips |
| `--type-mono`      | `0.875rem` (14px) | `1.4` | Financial calculations, time ranges |

---

## 5. Interaction & Accessibility Standards

1. **Touch Targets**: All interactive elements (buttons, inputs, checkboxes, timetable chips) maintain a minimum **44×44px hitbox** for mobile usability.
2. **Visible Keyboard Focus**: `:focus-visible` renders a 2px solid outline in Blueprint Blue (`#1D4ED8`) with 2px offset.
3. **Anti-Shame Design**: No guilt-inducing messages, red streak resets, or fabricated penalties. Missed work is managed through capacity-aware rebalancing and Slack Days.
4. **Honest System Diagnostics**: External integrations (Google Calendar, Web Push) are explicitly labeled as scaffolding/status-only when external sync is inactive. Core operating system workflows run autonomously on the local database.
