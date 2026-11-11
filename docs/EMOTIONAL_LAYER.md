# SARTHI — Emotional Intelligence Layer Specification
**Architecture:** State Machine, Content Verification & Behavioral Safeguards

---

## 1. Day State Machine (`dayState`)

The server computes a single deterministic `dayState` for the authenticated student for the current date. Frontend pages, headers, and the Copy Engine adapt their tone and layout based on this state.

| State | Condition Trigger | Visual & Behavioral Adaptation |
| :--- | :--- | :--- |
| `fresh` | Morning / Day not started. No check-in or focus session yet. | Deep calm. Displays **Single Next Action** with its starting time. Future plan collapsed under Horizon Fog. |
| `in_flow` | Focus session active or completed within past 15 mins. | Quiet mode. Zero push notifications or microcopy banners. Protect focus. |
| `on_track` | P1 tasks being completed as planned during the day. | Light confirmation. Get out of the way. |
| `late_start` | Block start time passed by >3 min with no active session. | **Block Rescue**: Shows non-alarming bar: *"Block started {n} min ago. {remaining} min are still yours."* One button: *"Start the smallest slice"*. |
| `partial` | Some P1 items done, but subsequent blocks disrupted. | Acknowledges completed work as banked progress. Recalculates remaining effort without dumping the rest of the day. |
| `disrupted` | Full day derailed by external obligation or emergency. | Replan workflow without guilt. Offers Slack Day shield if available. |
| `low_energy` | User tapped "Not at my best today". | Minimum day mode. P1 essentials only, shortened durations, optional tasks quietly hidden. Gym swapped for walk or rest. |
| `rest_approved` | Intentional rest / recovery logged. | Warm acknowledgement. Counts as a valid show-up. Streak preserved. |
| `exam_mode` | University examination window active in settings. | Academic focus lock. Non-academic tracks paused (not failed). |
| `returning` | Returning after ≥1 day gap without check-in. | **Return Protocol**: Hides cumulative backlog. Shows honest arithmetic (*"Real backlog: {m} min. Free capacity this week: {h} h"*). Single 10-minute entry action. |
| `milestone` | Challenge or streak milestone achieved (7, 14, 21, 36, 50, etc.). | Tasteful ignition moment and link to Reward Vault. |

---

## 2. Hard Content Rules (Enforced by Automated CI Lint)

The copy engine, seeded messages, and UI templates are constrained by strict psychological guardrails:

1. **Anti-Shame & No Red Screens**: Words such as `"failed"`, `"lazy"`, `"behind schedule"`, `"wasted"`, and `"no excuses"` are strictly banned from automated messages.
2. **No Toxic Positivity or Failure Celebration**: Never tell the student that *"failing is fine"* or that *"you win even if you fail"*. Frame interventions as: *"You can still do the next small thing"*.
3. **Strict Privacy on Personal Topics**: Never reference family bereavement, parental sacrifice, relationship history, or past depression in auto-generated messages. These belong solely to private journal entries.
4. **No Backlog Flooding on Today**: Never display the cumulative backlog or future days' tasks on the Today view. Focus is strictly on the immediate next action.
5. **Neutral Dropping of Optional Work**: Optional (P2/P3) tasks that are omitted are never labeled as *"missed"*, *"incomplete"*, or *"failed"*. They quietly roll forward or defer.
6. **Mathematical Honesty**: Real arithmetic only. Never fabricate or inflate minutes, hours, or percentages.
