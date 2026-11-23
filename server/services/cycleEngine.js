const DAY_MS = 24 * 60 * 60 * 1000;
const PHASES = [
  { key: 'menstrual', label: 'Menstrual phase', summary: 'The uterine lining sheds. Bleeding and cramps can happen; comfort and energy needs vary from person to person.' },
  { key: 'follicular', label: 'Follicular phase', summary: 'Follicles develop and estrogen generally rises. Some people notice more energy; others notice little change.' },
  { key: 'ovulation', label: 'Ovulation window', summary: 'Ovulation may occur near this window. Timing varies and cannot be confirmed by calendar dates.' },
  { key: 'luteal', label: 'Luteal phase', summary: 'Progesterone changes after ovulation. PMS symptoms are possible, but experiences differ across people and cycles.' }
];

export function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(dateOnly, days) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function differenceInDays(from, to) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS);
}

export function dateInTimezone(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const result = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(result);
}

export function estimateCycleLength(records, fallback = 28) {
  const ordered = [...records].sort((a, b) => a.actualPeriodStartDate.localeCompare(b.actualPeriodStartDate));
  const intervals = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const interval = differenceInDays(ordered[i - 1].actualPeriodStartDate, ordered[i].actualPeriodStartDate);
    if (interval >= 15 && interval <= 60) intervals.push(interval);
  }
  return median(intervals.slice(-6)) ?? fallback;
}

export function getPhaseRanges(cycleLength, periodLength) {
  const ovulationDay = Math.max(periodLength + 2, Math.min(cycleLength - 1, cycleLength - 14));
  const ovulationStart = Math.max(periodLength + 1, ovulationDay - 2);
  const ovulationEnd = Math.min(cycleLength - 1, Math.max(ovulationStart, ovulationDay + 1));
  return [
    { ...PHASES[0], startDay: 1, endDay: periodLength },
    { ...PHASES[1], startDay: periodLength + 1, endDay: Math.max(periodLength, ovulationStart - 1) },
    { ...PHASES[2], startDay: ovulationStart, endDay: ovulationEnd },
    { ...PHASES[3], startDay: ovulationEnd + 1, endDay: cycleLength }
  ];
}

export function calculateCycleIntelligence({ records, cycleLengthPreference = 28, periodLength = 5, asOfDate }) {
  const ordered = [...records].sort((a, b) => a.actualPeriodStartDate.localeCompare(b.actualPeriodStartDate));
  const cycleLength = estimateCycleLength(ordered, cycleLengthPreference);
  const phaseRanges = getPhaseRanges(cycleLength, periodLength);
  if (!ordered.length) return { cycleLength, phaseRanges, currentCycle: null, prediction: null, intervals: [] };

  const latest = ordered[ordered.length - 1];
  const elapsed = Math.max(0, differenceInDays(latest.actualPeriodStartDate, asOfDate));
  const currentCycleNumberOffset = Math.floor(elapsed / cycleLength);
  const currentCycleStart = addDays(latest.actualPeriodStartDate, currentCycleNumberOffset * cycleLength);
  const cycleDay = differenceInDays(currentCycleStart, asOfDate) + 1;
  const nextPeriodStart = addDays(currentCycleStart, cycleLength);
  const estimatedOvulationDay = Math.max(periodLength + 2, Math.min(cycleLength - 1, cycleLength - 14));
  const estimatedFertileStart = Math.max(periodLength + 1, estimatedOvulationDay - 5);
  const estimatedFertileEnd = Math.min(cycleLength, estimatedOvulationDay + 1);
  const ovulationPhase = phaseRanges.find(phase => phase.key === 'ovulation');
  const activeIndex = Math.max(0, phaseRanges.findIndex(phase => cycleDay >= phase.startDay && cycleDay <= phase.endDay));
  const phaseDates = phaseRanges.map(phase => ({
    key: phase.key,
    label: phase.label,
    startDate: addDays(currentCycleStart, phase.startDay - 1),
    endDate: addDays(currentCycleStart, phase.endDay - 1)
  }));
  const intervals = ordered.slice(1).map((record, index) => ({
    from: ordered[index].actualPeriodStartDate,
    to: record.actualPeriodStartDate,
    days: differenceInDays(ordered[index].actualPeriodStartDate, record.actualPeriodStartDate)
  }));

  return {
    cycleLength,
    periodLength,
    phaseRanges,
    phaseDates,
    currentCycle: {
      startDate: currentCycleStart,
      cycleDay,
      cycleNumber: ordered.length + currentCycleNumberOffset,
      isProjectedCycleStart: currentCycleNumberOffset > 0,
      previousPhase: phaseRanges[(activeIndex + phaseRanges.length - 1) % phaseRanges.length],
      currentPhase: phaseRanges[activeIndex],
      nextPhase: phaseRanges[(activeIndex + 1) % phaseRanges.length],
      phaseStartDate: phaseDates[activeIndex].startDate,
      phaseEndDate: phaseDates[activeIndex].endDate,
      nextPhaseStartDate: activeIndex === phaseRanges.length - 1
        ? addDays(nextPeriodStart, 0)
        : phaseDates[activeIndex + 1].startDate
    },
    prediction: {
      basedOnPeriodRecordId: latest._id,
      estimatedCycleLengthDays: cycleLength,
      predictedNextPeriodStart: nextPeriodStart,
      currentCycleStart,
      phaseDates,
      ovulationWindow: {
        startDate: addDays(currentCycleStart, ovulationPhase.startDay - 1),
        endDate: addDays(currentCycleStart, ovulationPhase.endDay - 1)
      },
      fertileWindow: {
        startDate: addDays(currentCycleStart, estimatedFertileStart - 1),
        endDate: addDays(currentCycleStart, estimatedFertileEnd - 1)
      }
    },
    intervals
  };
}

export function getCalendarDay({ date, latestActualStart, cycleLength, periodLength, records, predictedStarts }) {
  const ordered = [...records].sort((a, b) => a.actualPeriodStartDate.localeCompare(b.actualPeriodStartDate));
  const actualRecord = ordered.find(record => record.actualPeriodStartDate === date);
  const actualPeriod = ordered.some(record => record.actualPeriodEndDate
    && date >= record.actualPeriodStartDate && date <= record.actualPeriodEndDate);
  const predictedPeriod = predictedStarts.some(start => date >= start && date < addDays(start, periodLength));
  const anchorIndex = ordered.findLastIndex(record => record.actualPeriodStartDate <= date);
  if (anchorIndex < 0) {
    return { date, cycleDay: null, phase: null, actualPeriodStart: Boolean(actualRecord), actualPeriod, predictedPeriod: false, fertileWindow: false, predictedOvulation: false };
  }
  let cycleStart = ordered[anchorIndex].actualPeriodStartDate;
  let effectiveCycleLength = cycleLength;
  if (anchorIndex < ordered.length - 1) {
    const observedInterval = differenceInDays(cycleStart, ordered[anchorIndex + 1].actualPeriodStartDate);
    if (observedInterval > 0) effectiveCycleLength = observedInterval;
  } else {
    const elapsed = Math.max(0, differenceInDays(cycleStart, date));
    cycleStart = addDays(cycleStart, Math.floor(elapsed / cycleLength) * cycleLength);
  }
  const cycleDay = differenceInDays(cycleStart, date) + 1;
  const ranges = getPhaseRanges(effectiveCycleLength, periodLength);
  const phase = ranges.find(item => cycleDay >= item.startDay && cycleDay <= item.endDay) || null;
  const ovulationDay = Math.max(periodLength + 2, Math.min(effectiveCycleLength - 1, effectiveCycleLength - 14));
  const fertileStart = Math.max(periodLength + 1, ovulationDay - 5);
  const fertileEnd = Math.min(effectiveCycleLength, ovulationDay + 1);
  return {
    date,
    cycleDay,
    phase: phase?.key ?? null,
    actualPeriodStart: Boolean(actualRecord),
    actualPeriod,
    predictedPeriod: !actualRecord && !actualPeriod && predictedPeriod,
    fertileWindow: cycleDay >= fertileStart && cycleDay <= fertileEnd,
    predictedOvulation: cycleDay === ovulationDay
  };
}
