import test from "node:test";
import assert from "node:assert/strict";
import { PlannerEngine } from "../server/services/plannerEngine.js";
import { declareSlackDay, getSlackDays } from "../server/controllers/plannerController.js";

const REALISTIC_COURSES = [
  {
    id: "c-dsa",
    slug: "apna-college-c-data-structures-algorithms",
    title: "Apna College C++ DSA",
    category: "course",
    priority: "P1",
    multiplier: 2.0,
    startDate: "2026-11-26",
    targetDate: "2027-03-31",
    lectures: [
      { lectureNumber: 1, title: "Arrays & Complexity", videoDurationMinutes: 35, totalEffortMinutes: 70 },
      { lectureNumber: 2, title: "Sorting Algorithms", videoDurationMinutes: 20, totalEffortMinutes: 40 },
      { lectureNumber: 3, title: "Binary Search", videoDurationMinutes: 45, totalEffortMinutes: 90 },
      ...Array.from({ length: 25 }, (_, i) => ({
        lectureNumber: i + 4,
        title: `DSA Topic ${i + 4}`,
        videoDurationMinutes: 45,
        totalEffortMinutes: 90,
      })),
    ],
  },
  {
    id: "c-webdev",
    slug: "software-development-bootcamp",
    title: "Software Development Bootcamp",
    category: "course",
    priority: "P1",
    multiplier: 2.0,
    startDate: "2026-11-26",
    targetDate: "2027-04-24",
    lectures: [
      { lectureNumber: 1, title: "HTML & Semantic DOM", videoDurationMinutes: 30, totalEffortMinutes: 60 },
      { lectureNumber: 2, title: "CSS Grid & Flexbox", videoDurationMinutes: 45, totalEffortMinutes: 90 },
      ...Array.from({ length: 25 }, (_, i) => ({
        lectureNumber: i + 3,
        title: `Web Dev Module ${i + 3}`,
        videoDurationMinutes: 45,
        totalEffortMinutes: 90,
      })),
    ],
  },
  {
    id: "exp-typing",
    slug: "typing-practice",
    title: "Typing Practice",
    category: "exploration",
    priority: "P3",
    multiplier: 1.0,
    startDate: "2026-11-26",
    targetDate: "2026-12-29",
    lectures: Array.from({ length: 20 }, (_, i) => ({
      lectureNumber: i + 1,
      title: `Typing Drill ${i + 1}`,
      videoDurationMinutes: 30,
      totalEffortMinutes: 30,
    })),
  },
  {
    id: "exp-excel",
    slug: "learning-excel",
    title: "Learning Excel",
    category: "exploration",
    priority: "P3",
    multiplier: 1.0,
    startDate: "2026-12-14",
    targetDate: "2027-02-21",
    lectures: [
      { lectureNumber: 1, title: "Formulas & VLOOKUP", videoDurationMinutes: 60, totalEffortMinutes: 60 },
      { lectureNumber: 2, title: "Pivot Tables", videoDurationMinutes: 60, totalEffortMinutes: 60 },
    ],
  },
];

const TEMPLATES = {
  weekday: {
    dayType: "weekday",
    blocks: [
      { blockId: "w-dsa", label: "Study Session I (DSA)", courseSlug: "apna-college-c-data-structures-algorithms", durationMinutes: 130, blockType: "course" },
      { blockId: "w-web", label: "Study Session II (Web Dev)", courseSlug: "software-development-bootcamp", durationMinutes: 130, blockType: "course" },
      { blockId: "w-night", label: "Night Routine", durationMinutes: 60, blockType: "night_routine" },
    ],
  },
  saturday: {
    dayType: "saturday",
    blocks: [
      { blockId: "s-dsa", label: "Saturday DSA", courseSlug: "apna-college-c-data-structures-algorithms", durationMinutes: 130, blockType: "course" },
      { blockId: "s-web", label: "Saturday Web Dev", courseSlug: "software-development-bootcamp", durationMinutes: 150, blockType: "course" },
    ],
  },
  sunday: {
    dayType: "sunday",
    blocks: [
      { blockId: "su-web", label: "Sunday Web Intensive", courseSlug: "software-development-bootcamp", durationMinutes: 180, blockType: "course" },
      { blockId: "su-excel", label: "Excel / Exploration Lab", courseSlug: "learning-excel", durationMinutes: 120, blockType: "course", isFlexible: true },
    ],
  },
  holiday: {
    dayType: "holiday",
    blocks: [
      { blockId: "h-dsa", label: "DSA", courseSlug: "apna-college-c-data-structures-algorithms", durationMinutes: 120, blockType: "course" },
      { blockId: "h-typing", label: "Typing practice", courseSlug: "typing-practice", durationMinutes: 30, blockType: "course", isFlexible: true },
      { blockId: "h-web", label: "Web Dev", courseSlug: "software-development-bootcamp", durationMinutes: 135, blockType: "course" },
      { blockId: "h-night", label: "Night Routine", durationMinutes: 60, blockType: "night_routine" },
    ],
  },
  exam: {
    dayType: "exam",
    blocks: [
      { blockId: "e-prep", label: "Exam Revision", durationMinutes: 180, blockType: "checklist" },
      { blockId: "e-night", label: "Night Routine", durationMinutes: 60, blockType: "night_routine" },
      { blockId: "e-sleep", label: "Sleep", durationMinutes: 420, blockType: "rest" },
    ],
  },
};

test("PHASE 3 — Calendar Distribution, Dates, Lecture Breakdown & Slack Days", () => {
  // Activations: PL/Holiday 2026-11-26..2026-12-05 (10 days), Exam 2026-12-07..2026-12-12
  const activations = [
    { profileId: "holiday", startDate: "2026-11-26", endDate: "2026-12-05" },
    { profileId: "exam", startDate: "2026-12-07", endDate: "2026-12-12" },
  ];

  const resolveTimetable = (dateStr) => {
    const act = activations.find((a) => a.startDate <= dateStr && dateStr <= a.endDate);
    if (act) {
      return {
        dayType: act.profileId,
        activeProfile: act.profileId,
        isConfirmedSchedule: true,
        scheduleSource: "activation",
        blocks: TEMPLATES[act.profileId].blocks,
      };
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const key = dow === 0 ? "sunday" : dow === 6 ? "saturday" : "weekday";
    return {
      dayType: key,
      activeProfile: key,
      isConfirmedSchedule: false,
      scheduleSource: "assumed-default",
      blocks: TEMPLATES[key].blocks,
    };
  };

  // Declare 1 Slack Day on 2026-12-15 (assumed normal weekday)
  const res = PlannerEngine.allocate({
    courses: REALISTIC_COURSES,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { slackDates: ["2026-12-15"] },
    today: "2026-11-25",
    horizonDays: 30,
  });

  // 1. 2026-11-25 is BEFORE startDate (2026-11-26) for DSA, Web Dev, Typing, Excel -> ZERO courses scheduled
  const nov25 = res.dayPlans.find((d) => d.date === "2026-11-25");
  assert.equal(nov25.coursePlans.length, 0, "No course/exploration scheduled before its startDate");

  // 2. 2026-11-26 uses manual 'holiday' activation & Typing gets 30m from holiday block (not 45m assumption)
  const nov26 = res.dayPlans.find((d) => d.date === "2026-11-26");
  assert.equal(nov26.activeProfile, "holiday");
  const nov26Typing = nov26.coursePlans.find((c) => c.courseSlug === "typing-practice");
  assert.equal(nov26Typing.effortMinTarget, 30, "Manual holiday typing block (30m) overrides 45m assumption");

  // 3. Multiple lectures fit into DSA's 120m effort (60m video = Lec 1 35m + Lec 2 20m + 5m of Lec 3)
  const nov26Dsa = nov26.coursePlans.find((c) => c.courseSlug === "apna-college-c-data-structures-algorithms");
  assert.ok(nov26Dsa.lectureBreakdown.length >= 2, "Multiple lectures allocated when they fit capacity");
  assert.equal(nov26Dsa.lectureBreakdown[0].title, "Arrays & Complexity");
  assert.equal(nov26Dsa.lectureBreakdown[0].videoMinutes, 35);

  // 4. 2026-12-06 (Sunday after holiday ends, before exam starts) falls back to Sunday template
  // Excel startDate is 2026-12-14, so Excel must NOT appear on 2026-12-06
  const dec06 = res.dayPlans.find((d) => d.date === "2026-12-06");
  assert.equal(dec06.activeProfile, "sunday");
  assert.equal(dec06.coursePlans.some((c) => c.courseSlug === "learning-excel"), false, "Excel must not appear before 2026-12-14");

  // 5. 2026-12-07..12 uses manual 'exam' activation -> all courses paused
  const dec08 = res.dayPlans.find((d) => d.date === "2026-12-08");
  assert.equal(dec08.activeProfile, "exam");
  assert.equal(dec08.isExamDay, true);
  assert.equal(dec08.coursePlans.length, 0);

  // 6. 2026-12-19 (Saturday) -> NO assumed explorations on Saturday
  const dec19 = res.dayPlans.find((d) => d.date === "2026-12-19");
  assert.equal(dec19.activeProfile, "saturday");
  assert.equal(dec19.coursePlans.some((c) => c.category === "exploration"), false, "Saturday must not invent exploration allocations");

  // 7. 2026-12-20 (Sunday after Excel startDate 2026-12-14) -> Excel scheduled via Sunday block
  const dec20 = res.dayPlans.find((d) => d.date === "2026-12-20");
  assert.equal(dec20.activeProfile, "sunday");
  const dec20Excel = dec20.coursePlans.find((c) => c.courseSlug === "learning-excel");
  assert.ok(dec20Excel, "Excel scheduled on Sunday inside its date window");
  assert.equal(dec20Excel.effortMinTarget, 120);

  // 8. 2026-12-14 (assumed weekday) -> Typing Practice gets 45m weekday exploration assumption
  const dec14 = res.dayPlans.find((d) => d.date === "2026-12-14");
  assert.equal(dec14.activeProfile, "weekday");
  const dec14Typing = dec14.coursePlans.find((c) => c.courseSlug === "typing-practice");
  assert.ok(dec14Typing, "Typing gets 45m exploration assumption on assumed weekday");
  assert.equal(dec14Typing.effortMinTarget, 45);

  // 9. 2026-12-15 (Declared Slack Day) -> Lighter realistic schedule (NOT 0m total cancellation!)
  // Core P1 courses retained at 50% lighter capacity; lower-priority exploration deferred
  const dec15 = res.dayPlans.find((d) => d.date === "2026-12-15");
  assert.equal(dec15.isSlackDay, true);
  assert.ok(dec15.coursePlans.length > 0, "Slack Day must retain core/protected work at lighter capacity, not cancel the entire day");
  const dec15Typing = dec15.coursePlans.find((c) => c.courseSlug === "typing-practice");
  assert.equal(dec15Typing, undefined, "Lower-priority exploration deferred on Slack Day");

  // 10. Slack Day does not trigger automatically when misses < 3
  assert.equal(res.slackProposal.proposed, false, "Slack Day must not be consumed or proposed automatically");

  // 11. Feasibility conflict surfaced when targetDate is impossible
  const tightAlloc = PlannerEngine.allocate({
    courses: [
      {
        id: "c-tight",
        slug: "tight-course",
        title: "Impossible Course",
        category: "course",
        multiplier: 2.0,
        startDate: "2026-11-26",
        targetDate: "2026-11-27",
        lectures: [{ lectureNumber: 1, title: "Massive Lec", videoDurationMinutes: 300, totalEffortMinutes: 600 }],
      },
    ],
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: { weekday: { dayType: "weekday", blocks: [{ label: "Study", courseSlug: "tight-course", durationMinutes: 60, blockType: "course" }] } },
    today: "2026-11-26",
    horizonDays: 5,
  });
  assert.equal(tightAlloc.feasibility["tight-course"].isFeasible, false, "Must surface feasibility conflict when course cannot finish by targetDate");
  assert.ok(tightAlloc.feasibility["tight-course"].shortfallMinutes > 0);
});
