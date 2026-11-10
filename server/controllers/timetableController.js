import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
import { Setting } from '../models/Setting.js';

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + (m || 0);
}

export async function getTemplates(req, res, next) {
  try {
    const templates = await ScheduleTemplate.find({ userId: req.user.id });
    return res.json({ success: true, count: templates.length, templates });
  } catch (err) {
    next(err);
  }
}

export async function getTemplateByDayType(req, res, next) {
  try {
    const { dayType } = req.params;
    const template = await ScheduleTemplate.findOne({ userId: req.user.id, dayType });
    if (!template) {
      return res.status(404).json({ success: false, error: `Template for day type "${dayType}" not found.` });
    }
    return res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const { title, blocks } = req.body;

    const template = await ScheduleTemplate.findOne({ _id: id, userId: req.user.id });
    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found.' });
    }

    if (title) template.title = title;
    if (blocks) template.blocks = blocks;
    template.updatedAt = new Date();
    await template.save();

    return res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
}

export async function detectConflicts(req, res, next) {
  try {
    const { dayType = 'sunday' } = req.query;
    const template = await ScheduleTemplate.findOne({ userId: req.user.id, dayType });
    const settings = await Setting.findOne({ userId: req.user.id });

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found.' });
    }

    const blocks = template.blocks || [];
    const conflicts = [];
    const warnings = [];

    // 1. Time overlap checks between blocks
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const b1 = blocks[i];
        const b2 = blocks[j];
        const s1 = timeToMinutes(b1.startTime);
        const e1 = timeToMinutes(b1.endTime);
        const s2 = timeToMinutes(b2.startTime);
        const e2 = timeToMinutes(b2.endTime);

        // Check overlap (handling non-cross-midnight standard blocks)
        if (s1 < e2 && s2 < e1) {
          conflicts.push({
            type: 'time_overlap',
            block1: b1.label,
            block2: b2.label,
            time1: `${b1.startTime}-${b1.endTime}`,
            time2: `${b2.startTime}-${b2.endTime}`,
            message: `Overlap detected between "${b1.label}" and "${b2.label}".`
          });
        }
      }
    }

    // 2. Specific Sunday Oratory vs Excel/Exploration conflict check (documented in DEFAULT_TIMETABLE.md)
    if (dayType === 'sunday') {
      const oratoryBlock = blocks.find(b => b.category === 'oratory' || b.label.toLowerCase().includes('oratory'));
      const excelBlock = blocks.find(b => b.label.toLowerCase().includes('excel') || b.label.toLowerCase().includes('exploration'));
      
      if (oratoryBlock && excelBlock) {
        warnings.push({
          type: 'oratory_schedule_preference',
          message: 'The 13-Week Oratory Program specifies a 2-hour practice slot (default 12:30–14:30 or 14:30–17:00). Current timetable slots Excel at 12:30–14:30 and Oratory at 14:30–17:00. This is balanced; choose your active preference in Timetable settings.'
        });
      }
    }

    // 3. Sleep window check (Monday-Friday 23:40 to 05:00 is 5h 20m)
    if (dayType === 'weekday') {
      const sleepStart = timeToMinutes(settings?.sleepWindowStart || '23:40');
      const sleepEnd = timeToMinutes(settings?.sleepWindowEnd || '05:00');
      // Across midnight
      const sleepDuration = ((24 * 60) - sleepStart) + sleepEnd;
      if (sleepDuration < 360) {
        warnings.push({
          type: 'short_sleep_window',
          durationMinutes: sleepDuration,
          hours: (sleepDuration / 60).toFixed(1),
          message: `The weekday schedule allocates ${sleepDuration} min (${(sleepDuration / 60).toFixed(1)} hrs) for sleep between ${settings?.sleepWindowStart || '23:40'} and ${settings?.sleepWindowEnd || '05:00'}. Consider setting protected sleep to at least 6.5–7 hours.`
        });
      }
    }

    return res.json({
      success: true,
      dayType,
      conflictsCount: conflicts.length,
      conflicts,
      warningsCount: warnings.length,
      warnings
    });
  } catch (err) {
    next(err);
  }
}
