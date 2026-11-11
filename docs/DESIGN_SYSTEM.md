# SARTHI — Design System Specification
**Version:** 2.0 (Phase 2: Visual Identity & Emotional Layer)  
**Philosophy:** "Night Workshop" — Disciplined, tactile, confident, and calm.

---

## 1. Palette & Surface Tokens

Depth comes from layered solid surfaces, architectural hairline borders, crisp typography, and purposeful light—not generic linear gradients or glassmorphism.

### Base Canvas & Surfaces
| Token | Hex | Role | Contrast Ratio vs Text |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#080D1A` | Canvas backdrop (Night Obsidian) | 13.8:1 (AAA) |
| `--bg-surface` | `#10182B` | Standard container surface (Slate) | 11.2:1 (AAA) |
| `--bg-elevated` | `#16223B` | Interactive elements, modal cards | 9.1:1 (AAA) |
| `--bg-subtle` | `#0D1424` | Recessed areas, secondary wells | 12.5:1 (AAA) |
| `--border-hairline`| `#1D2A45` | Structural dividers (1px solid) | N/A |
| `--border-focus` | `#FF5722` | Visible keyboard focus indicator | High |

### Typography Tokens
| Token | Hex | Role |
| :--- | :--- | :--- |
| `--text-ink` | `#EDE8DF` | High-contrast body, primary titles (Warm Linen) |
| `--text-muted` | `#9BA7B9` | Secondary captions, subheadings |
| `--text-subtle`| `#637287` | Inactive states, metadata, timestamps |

### Signature Brand Accent: The Pilot Light (Ember)
| Token | Hex | Role |
| :--- | :--- | :--- |
| `--accent-ember` | `#FF5722` | Hot Ember: Streak flame, live timers, focal actions |
| `--accent-ember-glow` | `rgba(255, 87, 34, 0.25)` | Radial glow for the active flame & focus states |
| `--accent-ember-subtle`| `rgba(255, 87, 34, 0.12)` | Active pill badge background |

### Per-Module Color Accents
Each functional domain carries a distinct, purposeful signal token:
- **Web Development**: `--accent-web: #2563EB` (Cobalt Blueprint)
- **C++ DSA (136)**: `--accent-dsa: #0D9488` (Teal Logic)
- **Oratory Program**: `--accent-oratory: #D97706` (Amber Resonance)
- **Academics & Exams**: `--accent-academic: #6366F1` (Indigo Scholar)
- **Hackathon Command**: `--accent-hackathon: #EA580C` (Ember Sprint)
- **Gym & Fitness**: `--accent-fitness: #059669` (Emerald Vitality)
- **Trek & Rewards**: `--accent-rewards: #CA8A04` (Ochre Summit)
- **Reset Room**: `--accent-reset: #475569` (Slate Grounding)

---

## 2. Gradient Policy (Strict Rules)

Linear-gradient backgrounds, page washes, and gradient text are strictly prohibited.  
Only **three (3) functional gradients** are permitted across the entire application:

1. **Streak Ignition Flame Burst**:
   - `radial-gradient(circle at 50% 50%, rgba(255, 87, 34, 0.35) 0%, rgba(255, 87, 34, 0) 70%)`
   - *Reason:* Simulates physical light emission from the custom SVG flame.
2. **Reward Vault & Focus Progress Rings**:
   - `conic-gradient(var(--accent-ember) var(--progress), var(--border-hairline) 0deg)`
   - *Reason:* Mathematical visual encoding of percentage completion.
3. **The Mountain Trek Summit Dawn (Milestone only)**:
   - `linear-gradient(180deg, rgba(202, 138, 4, 0.18) 0%, rgba(8, 13, 26, 0) 100%)`
   - *Reason:* Visual celebration when savings reach the ₹4,000 mountain trek goal.

---

## 3. Typography Scale & Fonts

- **Display Face:** `Syne`, sans-serif (High character, strong geometry, tabular numerals)
- **Body & Dense Content:** `Plus Jakarta Sans`, sans-serif (Engineered for high readability, 4.5:1 contrast minimum)
- **Devanagari Fallback:** `Noto Sans Devanagari` (for authentic rendering of bilingual quotes)
- **Font Hosting:** All WOFF2 files are served locally from `client/assets/fonts/` for 100% offline PWA readiness.

### Modular Type Scale
| Token | Size | Line Height | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `--type-display-xl`| `3.25rem` (52px) | `1.1` | `-0.03em` | Streak count, Big Timer countdown |
| `--type-display-lg`| `2.25rem` (36px) | `1.15` | `-0.02em` | Main page hero titles |
| `--type-title` | `1.375rem` (22px)| `1.25` | `-0.01em` | Section headers, module cards |
| `--type-body` | `0.9375rem`(15px)| `1.55` | `0` | Standard body prose (<75ch max-width) |
| `--type-caption` | `0.8125rem`(13px)| `1.4` | `+0.01em` | Metadata, badges, timestamps |
| `--type-mono` | `0.875rem` (14px)| `1.4` | `0` | Timetable clocks, attendance math |

---

## 4. Spacing, Geometry & Components

### Spatial Grid (4px / 8px Base)
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `24px`
- `--space-6`: `32px`
- `--space-8`: `48px`

### Border Radii with Purpose
- **Controls & Buttons:** `var(--radius-sm: 4px)` (Tight, mechanical, tactile)
- **Cards & Panes:** `var(--radius-md: 8px)` (Disciplined bounds)
- **Progress Rings & Flame Core:** `var(--radius-full: 9999px)` (Circular geometry)

---

## 5. Motion & Accessibility

1. **Motion Rule**: Motion exists only to indicate state change (task completion, ring filling, drawer expansion) or for the single signature ignition moment (<2.5s). No floating, bouncing, or decorative animation loops.
2. **`prefers-reduced-motion`**: Movement is replaced with instantaneous opacity swaps.
3. **Touch Targets**: Minimum 44×44px interactive hitbox on all controls.
4. **Visible Keyboard Focus**: 2px solid `--accent-ember` with 2px offset on `:focus-visible`.
