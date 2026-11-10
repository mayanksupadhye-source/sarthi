# Shloki — Default Timetable Reference

Timezone: Asia/Kolkata. All items below are editable seed values taken from the owner's handwritten schedule. Do not treat this as a validated health or sleep plan.

## Monday–Friday

| Start | End | Activity | Duration |
|---|---|---|---:|
| 05:00 | 05:30 | Getting ready | 30 min |
| 05:30 | 07:30 | Study Session I | 120 min |
| 07:30 | 16:30 | College, commute, college-related work | 9 hr |
| 16:30 | 17:00 | Remaining assignments and preparation for night study | 30 min |
| 17:00 | 18:30 | Gym | 90 min |
| 18:30 | 20:00 | Study Session II | 90 min |
| 20:00 | 20:30 | Dinner | 30 min |
| 20:30 | 22:30 | Study Session III | 120 min |
| 22:30 | 23:40 | Night routine | 70 min |

Night routine components from the note:

- No phone (duration not specified; configure as a rule rather than inventing a duration).
- Five new English words (about five minutes is implied by the handwritten notation; editable).
- Brush teeth / skincare (the note mentions Niacinamide; about five minutes is implied; editable).
- Meditation (15 minutes).
- Business book reading (about 35 minutes).
- Journaling (10 minutes).

The weekday timetable creates a possible sleep window of only 5 hours 20 minutes between 23:40 and 05:00. Shloki must flag this before activating recurring schedules and ask the owner to set a protected sleep window. Never schedule tasks inside sleep time.

## Saturday

| Start | End | Activity | Duration |
|---|---|---|---:|
| 05:00 | 05:30 | Getting ready | 30 min |
| 05:30 | 07:30 | Study Session I | 120 min |
| 07:30 | 16:30 | Daytime commitment — handwritten phrase is unclear (appears to say “running home on W.E + college”); keep as an editable placeholder | 9 hr |
| 17:00 | 19:30 | Web Development | 150 min |
| 19:30 | 20:30 | Dinner | 60 min |
| 20:30 | 22:30 | History lecture / study (label to be confirmed by owner) | 120 min |
| 22:30 | 23:40 | Night routine | 70 min |

## Sunday

| Start | End | Activity | Duration |
|---|---|---|---:|
| 07:00 | 08:30 | Getting ready | 90 min |
| 08:30 | 11:30 | Web Development | 180 min |
| 11:30 | 12:30 | Brunch | 60 min |
| 12:30 | 14:30 | Excel / PowerPoint / exploration | 120 min |
| 14:30 | 17:00 | Oratory improvement | 150 min |
| Evening | Flexible | Organise hostel, personal reset, chill; movie if possible/earned | Flexible |

## Oratory scheduling conflict

The separate 13-Week Oratory Program specifies a fixed two-hour Sunday session from 12:30–14:30. The handwritten timetable allocates 12:30–14:30 to Excel/PowerPoint/exploration and 14:30–17:00 to oratory. The application must detect this overlap and ask the owner which timetable should be active. It must not create both activities at the same time. Preserve the source program's two-hour internal activity sequence regardless of which slot is selected.

## Schedule modes to support

- Weekdays (Monday–Friday)
- Saturday
- Sunday
- College holiday
- Exam mode
- One-off custom day

All blocks, labels, durations, recurrence rules, priorities, and linked modules must be editable in the app. A template change must not rewrite completed historical records.
