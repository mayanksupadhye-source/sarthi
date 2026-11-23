export const FITNESS_QUOTES = [
  'Consistency creates results that motivation alone cannot.',
  'Your strongest workout is the one you actually show up for.',
  'Progress is built quietly, one disciplined day at a time.',
  'Train for the person you want to become.',
  'Small improvements compound into remarkable change.',
  'Discipline keeps promises that motivation sometimes forgets.',
  'Your body responds to what you repeatedly do.',
  'A difficult day is still an opportunity to show up.',
  'Strength grows when consistency becomes a habit.',
  'Do not chase perfection; build a repeatable routine.',
  'Every healthy choice is a vote for your future self.',
  'Patience is part of every successful transformation.',
  'The goal is not a perfect week, but a sustainable life.',
  'You do not need to feel ready to begin.',
  'Build strength without forgetting recovery.',
  'A little progress today is better than waiting for ideal conditions.',
  'Your habits shape your health more than occasional extremes.',
  'Keep your promises to yourself.',
  'Results take time; commitment starts today.',
  'Strong routines make difficult goals manageable.',
  'Train with purpose, recover with intention.',
  'The mirror may change slowly; your discipline can start immediately.',
  'Do the work even when nobody is watching.',
  'Healthy progress is built through patience, not punishment.',
  'Make movement a part of your life, not a temporary challenge.',
  'Consistency turns effort into identity.',
  'Every session is an investment in your future.',
  "Do not compare your beginning with someone else's progress.",
  'Rest is part of training, not the opposite of it.',
  'Focus on what you can repeat, not what you can endure once.',
  "Your future strength begins with today's decision.",
  'Keep moving forward, even when progress feels small.',
  'The best routine is the one you can sustain.',
  'Strong habits outlast temporary enthusiasm.',
  'Give your goals time to become reality.',
  'Train your patience alongside your muscles.',
  'Every disciplined choice moves you forward.',
  'Consistency is more powerful than occasional intensity.',
  'Make health a priority before it becomes a necessity.',
  'Build a body and routine that support the life you want.',
  'The effort you repeat becomes the progress you keep.',
  'A healthy lifestyle is built, not purchased.',
  'Keep your standards high and your expectations realistic.',
  'Do not let one missed day become a missed week.',
  'Your journey is personal; respect its pace.',
  'Strength is built through effort and protected through recovery.',
  'Show up today for the results you want tomorrow.',
  'Focus on the next healthy decision.',
  'Discipline is choosing long-term progress over short-term comfort.',
  'Every week is another opportunity to become stronger.',
  'Sustainable progress beats dramatic shortcuts.',
  'Be proud of the effort, not only the outcome.',
  'Train because your health deserves attention.',
  'You are building more than muscle; you are building resilience.',
  "Make today's choices support tomorrow's ambitions.",
  'Keep going when the excitement fades.',
  'Progress becomes visible when consistency becomes normal.',
  'Your only competition is the person you were yesterday.',
  'Strength takes time; give yourself that time.',
  'The journey gets easier when healthy habits become automatic.',
  'Protect your sleep, respect your recovery, and value your effort.',
  'Do not confuse being exhausted with making progress.',
  'Build a routine that makes your future self grateful.',
  'Every step forward counts, even when it is not dramatic.',
  'Be consistent enough to let time work in your favour.'
];

function isoWeek(date) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return {
    year: utcDate.getUTCFullYear(),
    number: Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)
  };
}

export function getWeeklyFitnessQuote(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const utcDate = new Date(Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day)));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  const week = isoWeek(utcDate);
  const weekKey = `${week.year}-W${String(week.number).padStart(2, '0')}`;
  const weekIndex = Math.floor(utcDate.getTime() / (7 * 86400000));
  return {
    quote: FITNESS_QUOTES[((weekIndex % FITNESS_QUOTES.length) + FITNESS_QUOTES.length) % FITNESS_QUOTES.length],
    author: 'SARTHI original',
    weekKey
  };
}
