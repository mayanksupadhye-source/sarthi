import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Course } from '../models/Course.js';
import { OratoryWeek } from '../models/OratoryWeek.js';
import { ScheduleTemplate } from '../models/ScheduleTemplate.js';
import { Habit } from '../models/Habit.js';
import { Reward } from '../models/Reward.js';
import { SavingsEntry } from '../models/SavingsEntry.js';
import { Setting } from '../models/Setting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

function parseDurationToMinutes(durationStr) {
  if (!durationStr) return 0;
  const s = durationStr.trim().toLowerCase();
  
  // Format: "1:25:52" or "49:13"
  if (s.includes(':')) {
    const parts = s.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      return (parts[0] * 60) + parts[1] + (parts[2] >= 30 ? 1 : 0);
    } else if (parts.length === 2) {
      return parts[0] + (parts[1] >= 30 ? 1 : 0);
    }
  }

  // Format: "1hr 1min" or "23min" or "5hr 17min"
  let totalMin = 0;
  const hrMatch = s.match(/(\d+)\s*hr/);
  if (hrMatch) totalMin += parseInt(hrMatch[1], 10) * 60;
  const minMatch = s.match(/(\d+)\s*min/);
  if (minMatch) totalMin += parseInt(minMatch[1], 10);

  return totalMin || 0;
}

export function parseWebDevMarkdown() {
  const filePath = path.join(ROOT_DIR, 'docs/source/WEB_DEVELOPMENT_COURSE_SOURCE.md');
  if (!fs.existsSync(filePath)) {
    console.warn(`[Seeder] WebDev source file not found at ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const sections = [];
  let currentSection = null;
  let currentLecture = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Section header: "## Section 1: Before web dev Journey"
    const secMatch = line.match(/^##\s*Section\s*(\d+)[:\s]*(.*)/i);
    if (secMatch) {
      if (currentLecture && currentSection) {
        currentSection.lectures.push(currentLecture);
        currentLecture = null;
      }
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        sectionNumber: parseInt(secMatch[1], 10),
        title: secMatch[2].trim(),
        lectures: []
      };
      continue;
    }

    // Lecture title: "1. Course Introduction - Roadmap"
    const lecMatch = line.match(/^(\d+)\.\s*(.*)/);
    if (lecMatch && currentSection) {
      if (currentLecture) {
        currentSection.lectures.push(currentLecture);
      }
      const lecNum = parseInt(lecMatch[1], 10);
      currentLecture = {
        lectureNumber: lecNum,
        title: lecMatch[2].trim(),
        videoDurationMinutes: 10, // fallback
        practiceMultiplier: 1.6,
        totalEffortMinutes: 16,
        isWatched: false,
        isCodeDone: false,
        notes: '',
        status: 'pending'
      };
      continue;
    }

    // Duration line following lecture: "- 11min" or "- 1hr 1min"
    if (currentLecture && line.startsWith('-')) {
      const dur = parseDurationToMinutes(line.replace('-', ''));
      if (dur > 0) {
        currentLecture.videoDurationMinutes = dur;
        currentLecture.totalEffortMinutes = Math.round(dur * 1.6);
      }
    }
  }

  if (currentLecture && currentSection) {
    currentSection.lectures.push(currentLecture);
  }
  if (currentSection) {
    sections.push(currentSection);
  }

  // Apply known initial snapshot from curriculum note:
  // Section 2: 1/1 done
  // Section 3: 3/3 done
  // Section 4: 2/7 done (lectures 11, 12)
  for (const sec of sections) {
    if (sec.sectionNumber === 2) {
      sec.lectures.forEach(l => { l.isWatched = true; l.isCodeDone = true; });
    } else if (sec.sectionNumber === 3) {
      sec.lectures.forEach(l => { l.isWatched = true; l.isCodeDone = true; });
    } else if (sec.sectionNumber === 4) {
      if (sec.lectures[0]) { sec.lectures[0].isWatched = true; sec.lectures[0].isCodeDone = true; }
      if (sec.lectures[1]) { sec.lectures[1].isWatched = true; sec.lectures[1].isCodeDone = true; }
    }
  }

  return {
    slug: 'web-dev',
    title: 'Chai aur Code — Complete Web Development (36 Sections)',
    instructor: 'Hitesh Choudhary',
    description: '36 sections covering internet fundamentals, HTML/CSS, Tailwind, JS, Backend, Node, Express, MongoDB, Aggregations, React, Next.js, Docker, AI SaaS.',
    defaultPracticeMultiplier: 1.6,
    sections
  };
}

export function parseDSAMarkdown() {
  const filePath = path.join(ROOT_DIR, 'docs/source/DSA_COURSE_SOURCE.md');
  if (!fs.existsSync(filePath)) {
    console.warn(`[Seeder] DSA source file not found at ${filePath}`);
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const lectures = [];
  let currentLecture = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Lecture header: "- **Lecture 1: Flowchart & Pseudocode + Installation | DSA Series by Shradha Khapra Ma'am | C++**"
    const match = line.match(/^-\s*\*\*Lecture\s*(\d+)[:\s]*(.*?)\*\*/i);
    if (match) {
      if (currentLecture) {
        lectures.push(currentLecture);
      }
      const num = parseInt(match[1], 10);
      currentLecture = {
        lectureNumber: num,
        title: match[2].trim(),
        videoDurationMinutes: 45,
        practiceMultiplier: 1.5,
        totalEffortMinutes: 68,
        isWatched: false,
        isCodeDone: false,
        problemsAttempted: 0,
        problemsSolved: 0,
        difficulty: 'medium',
        confidence: 3,
        notes: ''
      };
      continue;
    }

    // Duration: "- Duration: 1:25:52"
    if (currentLecture && line.toLowerCase().includes('duration:')) {
      const durText = line.split(/duration:\s*/i)[1] || '';
      const min = parseDurationToMinutes(durText);
      if (min > 0) {
        currentLecture.videoDurationMinutes = min;
        currentLecture.totalEffortMinutes = Math.round(min * 1.5);
      }
    }
  }

  if (currentLecture) {
    lectures.push(currentLecture);
  }

  // Group lectures into logical topic clusters as defined in docs/COURSE_CURRICULA.md
  const clusters = [
    { sectionNumber: 1, title: 'Basics, Loops, Functions & Bitwise (Lec 1–7)', range: [1, 7] },
    { sectionNumber: 2, title: 'Arrays, Vectors, Time/Space & Pointers (Lec 8–16)', range: [8, 16] },
    { sectionNumber: 3, title: 'Binary Search & Partition Problems (Lec 17–23)', range: [17, 23] },
    { sectionNumber: 4, title: 'Sorting Algorithms, STL & Strings (Lec 24–34)', range: [24, 34] },
    { sectionNumber: 5, title: '2D Arrays, Matrices & Hashing (Lec 35–41)', range: [35, 41] },
    { sectionNumber: 6, title: 'Recursion, Backtracking & Sorts (Lec 42–55)', range: [42, 55] },
    { sectionNumber: 7, title: 'C++ OOPs One-Shot (Lec 56)', range: [56, 56] },
    { sectionNumber: 8, title: 'Linked Lists & Cycles (Lec 57–67)', range: [57, 67] },
    { sectionNumber: 9, title: 'Stacks & Queues (Lec 68–84)', range: [68, 84] },
    { sectionNumber: 10, title: 'Binary Trees & BSTs (Lec 85–110)', range: [85, 110] },
    { sectionNumber: 11, title: 'Graphs, BFS/DFS, Shortest Paths & DSU (Lec 111–136)', range: [111, 136] }
  ];

  const sections = clusters.map(c => ({
    sectionNumber: c.sectionNumber,
    title: c.title,
    lectures: lectures.filter(l => l.lectureNumber >= c.range[0] && l.lectureNumber <= c.range[1])
  }));

  return {
    slug: 'dsa',
    title: 'Apna College — C++ Data Structures & Algorithms (136 Lectures)',
    instructor: 'Shradha Khapra',
    description: 'Complete 136-lecture C++ DSA course covering arrays, binary search, recursion, trees, graphs, and LeetCode problems.',
    defaultPracticeMultiplier: 1.5,
    sections
  };
}

export function getOratoryWeeksSeed() {
  const weeks = [
    { weekNumber: 1, topic: 'Who Am I Without Marks?', primarySkill: 'Speech structure and hooks' },
    { weekNumber: 2, topic: "Ancient India: Mauryas, Guptas, Cholas & India's Golden Age", primarySkill: 'Hand gestures — Part 1' },
    { weekNumber: 3, topic: 'Education System in India', primarySkill: 'Hand gestures — Part 2' },
    { weekNumber: 4, topic: 'Capitalism vs Socialism', primarySkill: 'Voice modulation' },
    { weekNumber: 5, topic: 'Chhatrapati Shivaji Maharaj & Sambhaji Maharaj', primarySkill: 'Pauses and silence' },
    { weekNumber: 6, topic: 'Religion in Modern Society', primarySkill: 'Storytelling' },
    { weekNumber: 7, topic: 'History of Rajasthan', primarySkill: 'Stage movement' },
    { weekNumber: 8, topic: 'Youth of India: Opportunity or Distraction?', primarySkill: 'Eye contact' },
    { weekNumber: 9, topic: 'Why Some Businesses Succeed and Others Fail', primarySkill: 'Persuasion' },
    { weekNumber: 10, topic: 'Feminism: Achievements, Challenges & Misconceptions', primarySkill: 'Explaining complex topics simply' },
    { weekNumber: 11, topic: 'Indian Independence & Post-Independence India', primarySkill: 'Counterarguments and debate' },
    { weekNumber: 12, topic: 'Arranged Marriage vs Love Marriage', primarySkill: 'Charisma and presence' },
    { weekNumber: 13, topic: 'Political Systems & Future of India', primarySkill: 'Full integration' }
  ];

  return weeks;
}

export function getDefaultTimetableTemplates(userId) {
  return [
    {
      userId,
      dayType: 'weekday',
      title: 'Monday–Friday Standard Academic & Study Schedule',
      isDefault: true,
      blocks: [
        { blockId: 'wf-1', label: 'Getting ready', startTime: '05:00', endTime: '05:30', durationMinutes: 30, category: 'routine', isProtected: true },
        { blockId: 'wf-2', label: 'Study Session I (DSA / Core Tech)', startTime: '05:30', endTime: '07:30', durationMinutes: 120, category: 'study', isProtected: false },
        { blockId: 'wf-3', label: 'College, commute, and academic sessions', startTime: '07:30', endTime: '16:30', durationMinutes: 540, category: 'college', isProtected: true },
        { blockId: 'wf-4', label: 'Remaining assignments and preparation for night study', startTime: '16:30', endTime: '17:00', durationMinutes: 30, category: 'study', isProtected: false },
        { blockId: 'wf-5', label: 'Gym & Fitness', startTime: '17:00', endTime: '18:30', durationMinutes: 90, category: 'gym', isProtected: false },
        { blockId: 'wf-6', label: 'Study Session II (Web Development)', startTime: '18:30', endTime: '20:00', durationMinutes: 90, category: 'webdev', isProtected: false },
        { blockId: 'wf-7', label: 'Dinner & rest', startTime: '20:00', endTime: '20:30', durationMinutes: 30, category: 'routine', isProtected: true },
        { blockId: 'wf-8', label: 'Study Session III (Revision / Projects)', startTime: '20:30', endTime: '22:30', durationMinutes: 120, category: 'study', isProtected: false },
        { blockId: 'wf-9', label: 'Night routine (No phone, 5 English words, skincare, meditation, reading, journal)', startTime: '22:30', endTime: '23:40', durationMinutes: 70, category: 'routine', isProtected: true },
        { blockId: 'wf-10', label: 'Protected Sleep Window', startTime: '23:40', endTime: '05:00', durationMinutes: 320, category: 'rest', isProtected: true }
      ]
    },
    {
      userId,
      dayType: 'saturday',
      title: 'Saturday Development & History Schedule',
      isDefault: false,
      blocks: [
        { blockId: 'sat-1', label: 'Getting ready', startTime: '05:00', endTime: '05:30', durationMinutes: 30, category: 'routine', isProtected: true },
        { blockId: 'sat-2', label: 'Study Session I', startTime: '05:30', endTime: '07:30', durationMinutes: 120, category: 'study', isProtected: false },
        { blockId: 'sat-3', label: 'Daytime commitment / travel / college', startTime: '07:30', endTime: '16:30', durationMinutes: 540, category: 'college', isProtected: true },
        { blockId: 'sat-4', label: 'Web Development Deep Work', startTime: '17:00', endTime: '19:30', durationMinutes: 150, category: 'webdev', isProtected: false },
        { blockId: 'sat-5', label: 'Dinner', startTime: '19:30', endTime: '20:30', durationMinutes: 60, category: 'routine', isProtected: true },
        { blockId: 'sat-6', label: 'History lecture / study notes', startTime: '20:30', endTime: '22:30', durationMinutes: 120, category: 'study', isProtected: false },
        { blockId: 'sat-7', label: 'Night routine', startTime: '22:30', endTime: '23:40', durationMinutes: 70, category: 'routine', isProtected: true },
        { blockId: 'sat-8', label: 'Protected Sleep Window', startTime: '23:40', endTime: '05:00', durationMinutes: 320, category: 'rest', isProtected: true }
      ]
    },
    {
      userId,
      dayType: 'sunday',
      title: 'Sunday Deep Work, Exploration & Oratory Schedule',
      isDefault: false,
      blocks: [
        { blockId: 'sun-1', label: 'Getting ready & breakfast', startTime: '07:00', endTime: '08:30', durationMinutes: 90, category: 'routine', isProtected: true },
        { blockId: 'sun-2', label: 'Web Development Intensive', startTime: '08:30', endTime: '11:30', durationMinutes: 180, category: 'webdev', isProtected: false },
        { blockId: 'sun-3', label: 'Brunch', startTime: '11:30', endTime: '12:30', durationMinutes: 60, category: 'routine', isProtected: true },
        { blockId: 'sun-4', label: 'Excel / PowerPoint / Exploration Lab', startTime: '12:30', endTime: '14:30', durationMinutes: 120, category: 'exploration', isProtected: false },
        { blockId: 'sun-5', label: 'Oratory Improvement Programme (2hr sequence)', startTime: '14:30', endTime: '17:00', durationMinutes: 150, category: 'oratory', isProtected: false },
        { blockId: 'sun-6', label: 'Personal Reset, Hostel organisation, Chill & Movie', startTime: '17:00', endTime: '22:30', durationMinutes: 330, category: 'personal', isProtected: false },
        { blockId: 'sun-7', label: 'Night routine & sleep prep', startTime: '22:30', endTime: '23:40', durationMinutes: 70, category: 'routine', isProtected: true },
        { blockId: 'sun-8', label: 'Protected Sleep Window', startTime: '23:40', endTime: '07:00', durationMinutes: 440, category: 'rest', isProtected: true }
      ]
    },
    {
      userId,
      dayType: 'exam',
      title: 'Exam Mode Schedule (Academic Priority)',
      isDefault: false,
      blocks: [
        { blockId: 'ex-1', label: 'Morning Revision Session I', startTime: '06:00', endTime: '09:00', durationMinutes: 180, category: 'study', isProtected: true },
        { blockId: 'ex-2', label: 'Breakfast & walk', startTime: '09:00', endTime: '10:00', durationMinutes: 60, category: 'routine', isProtected: true },
        { blockId: 'ex-3', label: 'Intensive Subject Study Session II', startTime: '10:00', endTime: '13:00', durationMinutes: 180, category: 'study', isProtected: true },
        { blockId: 'ex-4', label: 'Lunch & quick power nap', startTime: '13:00', endTime: '14:30', durationMinutes: 90, category: 'rest', isProtected: true },
        { blockId: 'ex-5', label: 'Problem Solving & Past Papers III', startTime: '14:30', endTime: '17:30', durationMinutes: 180, category: 'study', isProtected: true },
        { blockId: 'ex-6', label: 'Light exercise & dinner', startTime: '17:30', endTime: '19:30', durationMinutes: 120, category: 'routine', isProtected: true },
        { blockId: 'ex-7', label: 'Formula & Summary Recall IV', startTime: '19:30', endTime: '22:00', durationMinutes: 150, category: 'study', isProtected: true },
        { blockId: 'ex-8', label: 'Sleep & Memory Consolidation', startTime: '22:30', endTime: '06:00', durationMinutes: 450, category: 'rest', isProtected: true }
      ]
    }
  ];
}

/**
 * Seed all default modules for a new user account.
 */
export async function seedUserData(userId) {
  try {
    // 1. Settings
    const existingSetting = await Setting.findOne({ userId });
    if (!existingSetting) {
      await Setting.create({
        userId,
        timezone: 'Asia/Kolkata',
        startingWeightKg: 88,
        targetWeightKg: 73,
        monthlySlackDayAllowance: 4,
        dailyMaxWorkMinutes: 480,
        savingsTargetAmount: 4000
      });
    }

    // 2. Schedule Templates
    const existingTemplates = await ScheduleTemplate.find({ userId });
    if (existingTemplates.length === 0) {
      const templates = getDefaultTimetableTemplates(userId);
      await ScheduleTemplate.insertMany(templates);
    }

    // 3. Courses: Web Dev & DSA
    const webDevData = parseWebDevMarkdown();
    if (webDevData) {
      const existingWeb = await Course.findOne({ userId, slug: 'web-dev' });
      if (!existingWeb) {
        const c = new Course({ ...webDevData, userId });
        c.recalculateProgress();
        await c.save();
      }
    }

    const dsaData = parseDSAMarkdown();
    if (dsaData) {
      const existingDsa = await Course.findOne({ userId, slug: 'dsa' });
      if (!existingDsa) {
        const c = new Course({ ...dsaData, userId });
        c.recalculateProgress();
        await c.save();
      }
    }

    // 4. Oratory Weeks (1 to 13)
    const existingOratory = await OratoryWeek.find({ userId });
    if (existingOratory.length === 0) {
      const weeks = getOratoryWeeksSeed().map(w => ({ ...w, userId }));
      await OratoryWeek.insertMany(weeks);
    }

    // 5. Default Habits
    const existingHabits = await Habit.find({ userId });
    if (existingHabits.length === 0) {
      const defaultHabits = [
        { userId, title: 'No phone during night routine', category: 'night-routine', timeOfDay: 'night', frequency: 'daily' },
        { userId, title: 'Learn 5 new English words', category: 'night-routine', timeOfDay: 'night', frequency: 'daily' },
        { userId, title: '15-min Meditation & Mindful Breathing', category: 'night-routine', timeOfDay: 'night', frequency: 'daily' },
        { userId, title: 'Business reading (SPIN Selling / Influence)', category: 'learning', timeOfDay: 'night', frequency: 'daily' },
        { userId, title: '10-min Journal & Daily Reflection', category: 'routine', timeOfDay: 'night', frequency: 'daily' },
        { userId, title: 'No-Sugar Challenge check-in', category: 'no-sugar', timeOfDay: 'anytime', frequency: 'daily' }
      ];
      await Habit.insertMany(defaultHabits);
    }

    // 6. Savings & Rewards
    const existingSavings = await SavingsEntry.findOne({ userId });
    if (!existingSavings) {
      await SavingsEntry.create({
        userId,
        goalTitle: 'Mountain Trekking / 20th Birthday Celebration (₹4,000)',
        targetAmount: 4000,
        contributions: []
      });
    }

    const existingRewards = await Reward.find({ userId });
    if (existingRewards.length === 0) {
      const defaultRewards = [
        { userId, title: 'Marvel Movie Night', description: 'Enjoy a Marvel movie guilt-free after 5 consistent execution days.', category: 'movie', unlockCriteria: '5 days of >=80% planned task completion' },
        { userId, title: 'Mountain Trekking Expedition', description: 'Celebrate 20th birthday with a mountain trek.', category: 'trekking', unlockCriteria: 'Complete savings goal (₹4,000) and finish 50+ DSA & 100+ WebDev lectures' },
        { userId, title: 'Favourite Treat with Friends', description: 'Unwind on Sunday evening with friends.', category: 'friends', unlockCriteria: 'Complete Sunday Oratory and weekly academic assignments' }
      ];
      await Reward.insertMany(defaultRewards);
    }

    console.log(`[Seeder] Successfully seeded initial data for user: ${userId}`);
    return true;
  } catch (err) {
    console.error(`[Seeder] Error seeding user data:`, err);
    throw err;
  }
}
