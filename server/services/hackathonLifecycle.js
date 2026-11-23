export const HACKATHON_STAGES = [
  { key: 'registered', name: 'Registered', optional: false },
  { key: 'ideation', name: 'Ideation', optional: true },
  { key: 'proposal', name: 'Proposal / PPT', optional: true },
  { key: 'prototype', name: 'Prototype / Coding', optional: true },
  { key: 'demo', name: 'Demo / Video', optional: true },
  { key: 'pitch', name: 'Pitch / Presentation', optional: false }
];

export function getHackathonToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

export function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateHackathonDates(startDate, endDate) {
  if (!isDateOnly(startDate) || !isDateOnly(endDate)) return 'Valid overall start and end dates are required.';
  if (endDate < startDate) return 'The overall end date cannot be before the start date.';
  return null;
}

export function normalizeHackathonStages(stages, startDate, endDate) {
  if (!Array.isArray(stages) || stages.length !== HACKATHON_STAGES.length) {
    return { error: 'Configure all six hackathon stages.' };
  }
  const byKey = new Map(stages.map(stage => [stage?.key, stage]));
  if (byKey.size !== HACKATHON_STAGES.length || HACKATHON_STAGES.some(stage => !byKey.has(stage.key))) {
    return { error: 'Each of the six standard stages must be included exactly once.' };
  }

  const normalized = [];
  let previousEnd = startDate;
  for (const definition of HACKATHON_STAGES) {
    const stage = byKey.get(definition.key) || {};
    const availability = stage.availability ?? 'scheduled';
    if (!['scheduled', 'none'].includes(availability)) return { error: `${definition.name} availability must be Scheduled or None.` };
    if (!definition.optional && availability === 'none') {
      return { error: `${definition.name} is a required lifecycle stage.` };
    }
    if (availability === 'none') {
      normalized.push({ ...definition, availability, startDate: '', endDate: '', status: 'pending', deliverable: '' });
      continue;
    }

    const stageStart = definition.key === 'registered' ? startDate : stage.startDate;
    const stageEnd = definition.key === 'pitch' ? endDate : stage.endDate;
    if (!isDateOnly(stageStart) || !isDateOnly(stageEnd)) {
      return { error: `${definition.name} needs a valid start and end date.` };
    }
    if (stageEnd < stageStart) return { error: `${definition.name} end date cannot be before its start date.` };
    if (stageStart < startDate || stageEnd > endDate) {
      return { error: `${definition.name} dates must fall within the overall hackathon dates.` };
    }
    if (stageStart < previousEnd) {
      return { error: `${definition.name} must start on or after the previous scheduled stage ends.` };
    }
    normalized.push({
      ...definition,
      availability,
      startDate: stageStart,
      endDate: stageEnd,
      status: ['pending', 'in-progress', 'completed'].includes(stage.status) ? stage.status : 'pending',
      deliverable: typeof stage.deliverable === 'string' ? stage.deliverable : ''
    });
    previousEnd = stageEnd;
  }
  return { stages: normalized };
}

export function migrateLegacyStages(legacyStages, startDate, endDate, registrationDeadline) {
  const mapped = Object.fromEntries(HACKATHON_STAGES.map(stage => [stage.key, {
    key: stage.key,
    name: stage.name,
    availability: stage.optional ? 'none' : 'scheduled',
    startDate: stage.key === 'registered' ? startDate : stage.key === 'pitch' ? endDate : '',
    endDate: stage.key === 'registered' ? (registrationDeadline || startDate) : stage.key === 'pitch' ? endDate : '',
    status: 'pending',
    deliverable: ''
  }]));
  mapped.registered.endDate = registrationDeadline && registrationDeadline >= startDate ? registrationDeadline : startDate;

  for (const legacy of legacyStages || []) {
    const label = `${legacy.key || ''} ${legacy.name || ''}`.toLowerCase();
    const key = label.includes('ideat') ? 'ideation'
      : label.includes('proposal') || label.includes('ppt') ? 'proposal'
        : label.includes('prototype') || label.includes('coding') || label.includes('architecture') ? 'prototype'
          : label.includes('pitch') || label.includes('presentation') ? 'pitch'
            : label.includes('demo') || label.includes('video') ? 'demo' : null;
    if (!key || !legacy.deadline || !isDateOnly(legacy.deadline)) continue;
    const stage = mapped[key];
    const deadline = legacy.deadline < startDate ? startDate : legacy.deadline > endDate ? endDate : legacy.deadline;
    stage.availability = 'scheduled';
    stage.endDate = key === 'pitch' ? endDate : deadline;
    stage.startDate = key === 'pitch' ? (deadline > startDate ? deadline : startDate) : startDate;
    stage.status = legacy.status || 'pending';
    stage.deliverable = legacy.deliverable || '';
  }
  let previousEnd = mapped.registered.endDate;
  for (const definition of HACKATHON_STAGES.slice(1)) {
    const stage = mapped[definition.key];
    if (stage.availability !== 'scheduled') continue;
    if (stage.startDate < previousEnd) stage.startDate = previousEnd;
    if (stage.endDate < stage.startDate) stage.endDate = stage.startDate;
    previousEnd = stage.endDate;
  }
  return HACKATHON_STAGES.map(stage => mapped[stage.key]);
}

export function getHackathonLifecycle(hackathon, today = getHackathonToday()) {
  if (hackathon.submissionStatus === 'submitted' || hackathon.submittedAt) return { status: 'submitted', currentStage: 'completed', nextStage: null };
  if (hackathon.submissionStatus === 'completed' || hackathon.completedAt) return { status: 'completed', currentStage: 'completed', nextStage: null };

  let currentStage = null;
  let nextStage = null;
  const scheduled = (hackathon.stages || []).filter(stage => stage.availability !== 'none' && stage.startDate && stage.endDate);
  for (const stage of scheduled) {
    if (today >= stage.startDate && today <= stage.endDate) currentStage = stage.key;
    if (!nextStage && stage.startDate > today) nextStage = stage.key;
  }
  const status = today < hackathon.startDate ? 'upcoming'
    : today === hackathon.endDate ? 'submission-due'
      : today > hackathon.endDate ? 'expired' : 'active';
  if (!currentStage && status === 'active') {
    currentStage = scheduled.filter(stage => stage.startDate <= today).at(-1)?.key || null;
  }
  if (!currentStage && status === 'expired') currentStage = scheduled.at(-1)?.key || null;
  return { status, currentStage: currentStage || nextStage || 'registered', nextStage };
}

export function sortHackathons(hackathons) {
  const statusOrder = { upcoming: 0, active: 0, 'submission-due': 0, expired: 1, submitted: 2, completed: 3 };
  return [...hackathons].sort((a, b) => {
    const aStatus = getHackathonLifecycle(a).status;
    const bStatus = getHackathonLifecycle(b).status;
    return statusOrder[aStatus] - statusOrder[bStatus]
      || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      || String(a._id).localeCompare(String(b._id));
  });
}
