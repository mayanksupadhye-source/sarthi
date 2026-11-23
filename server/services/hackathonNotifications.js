import { HackathonNotification } from '../models/HackathonNotification.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LEAD_MS = [7, 3, 1].map(days => days * DAY_MS);

function kolkataDateString(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function atKolkataMorning(dateString) {
  return new Date(`${dateString}T09:00:00.000+05:30`);
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildHackathonNotifications(hackathon, now = new Date()) {
  if (['submitted', 'completed'].includes(hackathon.submissionStatus)
      || hackathon.submittedAt || hackathon.completedAt) return [];
  const today = kolkataDateString(now);
  const events = [];
  const add = (stage, type, date, title, body) => {
    if (!date) return;
    const scheduledFor = atKolkataMorning(date);
    if (scheduledFor < new Date(now.getTime() - 7 * DAY_MS)
        || scheduledFor > new Date(now.getTime() + 30 * DAY_MS)) return;
    const key = `${hackathon._id}:${stage.key}:${type}:${date}`;
    events.push({
      userId: hackathon.userId,
      hackathonId: hackathon._id,
      key,
      type,
      stageKey: stage.key,
      stageName: stage.name,
      title,
      body,
      scheduledFor
    });
  };

  for (const stage of hackathon.stages || []) {
    if (stage.availability !== 'scheduled' || !stage.startDate || !stage.endDate) continue;
    add(stage, 'stage-start', stage.startDate,
      `${hackathon.title}: ${stage.name} starts`, `${stage.name} is scheduled to begin today.`);
    const deadlineDate = shiftDate(stage.endDate, -3);
    if (deadlineDate >= today) {
      add(stage, 'stage-deadline', deadlineDate,
        `${hackathon.title}: ${stage.name} deadline soon`, `${stage.name} is due in three days, on ${stage.endDate}.`);
    }
    if (stage.key !== 'pitch') {
      add(stage, 'stage-end', stage.endDate,
        `${hackathon.title}: ${stage.name} ends`, `${stage.name} reaches its scheduled end date today.`);
    }
  }

  const finalStage = { key: 'final-deadline', name: 'Final submission' };
  for (const days of [7, 3, 1, 0]) {
    const reminderDate = shiftDate(hackathon.endDate, -days);
    if (reminderDate < today) continue;
    const type = days === 0 ? 'final-deadline' : 'final-deadline';
    const when = days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
    add(finalStage, type, reminderDate,
      `${hackathon.title}: final submission ${days === 0 ? 'due today' : 'approaching'}`,
      `The final hackathon submission is due ${when} (${hackathon.endDate}).`);
  }
  return events;
}

export async function syncHackathonNotifications(hackathon, now = new Date()) {
  const events = buildHackathonNotifications(hackathon, now);
  const keys = events.map(event => event.key);
  if (events.length) {
    await HackathonNotification.bulkWrite(events.map(event => ({
      updateOne: {
        filter: { userId: event.userId, key: event.key },
        update: {
          $set: {
            hackathonId: event.hackathonId,
            type: event.type,
            stageKey: event.stageKey,
            stageName: event.stageName,
            title: event.title,
            body: event.body,
            scheduledFor: event.scheduledFor
          },
          $setOnInsert: { readAt: null }
        },
        upsert: true
      }
    })), { ordered: false });
  }
  await HackathonNotification.deleteMany({
    userId: hackathon.userId,
    hackathonId: hackathon._id,
    ...(keys.length ? { key: { $nin: keys } } : {})
  });
  return events.length;
}
