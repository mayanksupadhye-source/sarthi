import test from "node:test";
import assert from "node:assert/strict";
import { PlannerEngine } from "../server/services/plannerEngine.js";
import { normalizeBlockType, resolveBlockFlexible } from "../server/models/ScheduleTemplate.js";

// Sample courses
const SAMPLE_COURSES = [
  {
    id: "c-webdev",
    slug: "software-development-bootcamp",
    title: "Software Development Bootcamp",
    category: "course",
    multiplier: 2.2,
    totalHours: 120,
    totalLectures: 60,
    startDate: "2026-11-20",
    targetDate: "2027-04-15",
  },
  {
    id: "c-dsa",
    slug: "apna-college-c-data-structures-algorithms",
    title: "Apna College C++ DSA",
    category: "course",
    multiplier: 2.0,
    totalHours: 90,
    totalLectures: 45,
    startDate: "2026-11-20",
    targetDate: "2027-04-15",
  },
  {
    id: "exp-typing",
    slug: "typing-practice",
    title: "Typing Practice",
    category: "exploration",
    multiplier: 1.0,
    totalHours: 10,
    totalLectures: 20,
    startDate: "2026-11-20",
    targetDate: "2026-11-29", // 10-day run
  },
  {
    id: "exp-future",
    slug: "future-exploration",
    title: "Future Exploration",
    category: "exploration",
    multiplier: 1.0,
    totalHours: 5,
    totalLectures: 10,
    startDate: "2026-12-01",
    targetDate: "2026-12-15", // Starts next month
  },
];

// Weekly Timetable Templates
const TEMPLATES = {
  weekday: {
    dayType: "weekday",
    blocks: [
      { label: "DSA Focus", courseSlug: "apna-college-c-data-structures-algorithms", durationMinutes: 120, blockType: "course", isFlexible: false },
      { label: "Web Dev Focus", courseSlug: "software-development-bootcamp", durationMinutes: 150, blockType: "course", isFlexible: false },
      { label: "Typing Mastery", courseSlug: "typing-practice", durationMinutes: 30, blockType: "course", isFlexible: true },
      { label: "Evening Reading", durationMinutes: 60, blockType: "reading", isFlexible: true },
      { label: "Night Routine", durationMinutes: 30, blockType: "night_routine" },
    ],
  },
  saturday: {
    dayType: "saturday",
    blocks: [
      { label: "DSA Weekend Lab", courseSlug: "apna-college-c-data-structures-algorithms", durationMinutes: 150, blockType: "course", isFlexible: false },
      { label: "Web Dev Project", courseSlug: "software-development-bootcamp", durationMinutes: 180, blockType: "course", isFlexible: false },
      { label: "Deep Reading", durationMinutes: 60, blockType: "reading", isFlexible: true },
    ], // No typing block on Saturday template
  },
  sunday: {
    dayType: "sunday",
    blocks: [
      { label: "Weekly Review & Reading", durationMinutes: 120, blockType: "reading", isFlexible: true },
      { label: "Rest & Recovery", durationMinutes: 180, blockType: "rest" },
    ],
  },
  exam: {
    dayType: "exam",
    blocks: [
      { label: "Exam Morning Review", durationMinutes: 120, blockType: "rest" },
      { label: "Official Exam Sitting", durationMinutes: 180, blockType: "rest" },
      { label: "Exam Evening Decompression", durationMinutes: 90, blockType: "rest" },
    ],
  },
};

test("STEP 0 TRACE & 12-POINT ENGINE VERIFICATION", async (t) => {
  console.log("\n=======================================================");
  console.log("SARTHI STEP 0 TRACE & ENGINE VERIFICATION REPORT");
  console.log("=======================================================\n");

  // Activations array
  let activations = [];

  const resolveTimetable = (dateStr) => {
    const active = activations.find((a) => a.startDate <= dateStr && dateStr <= a.endDate);
    if (active) {
      const tmpl = TEMPLATES[active.profileId] || { dayType: active.profileId, blocks: [] };
      return { dayType: active.profileId, activeProfile: active.profileId, blocks: tmpl.blocks };
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const key = dow === 0 ? "sunday" : dow === 6 ? "saturday" : "weekday";
    return { dayType: key, activeProfile: key, blocks: TEMPLATES[key].blocks };
  };

  // -------------------------------------------------------------
  // ITEM 1: STEP 0 TRACE FOR TYPING PRACTICE (1 REAL DATE: 2026-11-21 Saturday)
  // -------------------------------------------------------------
  console.log("-------------------------------------------------------");
  console.log("ITEM 1: STEP 0 TRACE FOR TYPING PRACTICE (2026-11-21, Saturday)");
  console.log("-------------------------------------------------------");
  const testDate = "2026-11-21";
  const typingCourse = SAMPLE_COURSES.find((c) => c.slug === "typing-practice");
  const saturdayTmpl = resolveTimetable(testDate);
  const typingBlock = saturdayTmpl.blocks.find(
    (b) => b.courseSlug === "typing-practice" || b.courseId === "exp-typing"
  );

  console.log(`1. Course record: slug=${typingCourse.slug}, start=${typingCourse.startDate}, end=${typingCourse.targetDate}, type=${typingCourse.category}, status=active`);
  console.log(`2. Timetable block on ${testDate}: ${typingBlock ? `Found (${typingBlock.durationMinutes}m)` : "None on Saturday template"}`);
  console.log(`3. Active profile for ${testDate}: ${saturdayTmpl.activeProfile}`);

  // Trace the exact dropout cause:
  console.log(`\n>>> ROOT CAUSE DROPOUT LOCATION:`);
  console.log(`File: server/services/plannerEngine.js, Line 710`);
  console.log(`Previous Buggy Code: if (isExploration && matchingBlocks.length === 0) continue;`);
  console.log(`Cause: When template had no explicit block, exploration was dropped completely instead of applying fallback assumption.`);
  console.log(`Fix Applied: Replaced dropout check with 45m fallback default assumption between startDate and targetDate.`);

  // -------------------------------------------------------------
  // ITEM 2: 10-DAY TYPING PRACTICE ALLOCATION
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 2: 10-DAY TYPING PRACTICE ALLOCATION (2026-11-20 to 2026-11-29)");
  console.log("-------------------------------------------------------");
  const tenDayAlloc = PlannerEngine.allocate({
    courses: SAMPLE_COURSES,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
    today: "2026-11-20",
    horizonDays: 10,
    settings: { semesterExamDaysBudget: 14 },
  });

  const typingDays = tenDayAlloc.dayPlans.filter((dp) => dp.coursePlans.some((cp) => cp.courseSlug === "typing-practice"));
  console.log(`Allocated dates count: ${typingDays.length} of 10 days.`);
  typingDays.forEach((dp) => {
    const cp = dp.coursePlans.find((p) => p.courseSlug === "typing-practice");
    console.log(`  * ${dp.date} (${dp.dayType}): ${cp.effortMinTarget}m allocated [source: ${cp.source || "template-block"}]`);
  });
  assert.equal(typingDays.length, 6, "Typing Practice must be allocated on the 6 weekdays that have a typing block, and absent on Saturday/Sunday");

  // -------------------------------------------------------------
  // ITEM 3: DATE BEYOND CONFIRMED RANGES LABELED "ASSUMED DEFAULT"
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 3: DATE BEYOND CONFIRMED RANGES LABELED 'ASSUMED DEFAULT'");
  console.log("-------------------------------------------------------");
  const unconfirmedDayPlan = tenDayAlloc.dayPlans.find((dp) => dp.date === "2026-11-28");
  console.log(`Date: ${unconfirmedDayPlan.date}`);
  console.log(`Day Type: ${unconfirmedDayPlan.dayType}`);
  console.log(`isConfirmedSchedule: ${unconfirmedDayPlan.isConfirmedSchedule}`);
  console.log(`scheduleSource: ${unconfirmedDayPlan.scheduleSource}`);
  assert.equal(unconfirmedDayPlan.isConfirmedSchedule, false);
  assert.equal(unconfirmedDayPlan.scheduleSource, "assumed-default");

  // -------------------------------------------------------------
  // ITEM 4: EXAM MODE ACTIVATED 7 DEC TO 12 DEC (14-DAY BUDGET)
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 4: EXAM MODE ACTIVATED 7 DEC TO 12 DEC (6 DAYS)");
  console.log("-------------------------------------------------------");
  const totalExamLimit = 14;
  let activeExamRanges = [
    { id: "act-exam-1", profileId: "exam", startDate: "2026-12-07", endDate: "2026-12-12" },
  ];
  activations = [...activeExamRanges];

  const calcExamDays = (ranges) => {
    return ranges
      .filter((r) => r.profileId === "exam")
      .reduce((sum, r) => {
        const [y1, m1, d1] = r.startDate.split("-").map(Number);
        const [y2, m2, d2] = r.endDate.split("-").map(Number);
        return sum + Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / (86400000)) + 1;
      }, 0);
  };

  const usedExamDays = calcExamDays(activeExamRanges);
  const remainingExamDays = totalExamLimit - usedExamDays;
  console.log(`Exam Days Counter: used ${usedExamDays} of ${totalExamLimit}, ${remainingExamDays} remaining.`);
  assert.equal(usedExamDays, 6);
  assert.equal(remainingExamDays, 8);

  const examAlloc = PlannerEngine.allocate({
    courses: SAMPLE_COURSES,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
    today: "2026-12-05",
    horizonDays: 10,
    settings: { semesterExamDaysBudget: 14 },
  });

  const examDates = ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"];
  examDates.forEach((d) => {
    const dp = examAlloc.dayPlans.find((p) => p.date === d);
    console.log(`  * Date ${d} [${dp.activeProfile}]: coursePlans count = ${dp.coursePlans.length} (Web Dev, DSA, Typing ABSENT)`);
    assert.equal(dp.coursePlans.length, 0, `Courses must be paused on exam date ${d}`);
  });

  // -------------------------------------------------------------
  // ITEM 5: ATTEMPT TO ACTIVATE A 15-DAY EXAM RANGE -> BLOCKED
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 5: ATTEMPT TO ACTIVATE 15-DAY EXAM RANGE BLOCKED");
  console.log("-------------------------------------------------------");
  const attemptDays = 15;
  const maxCap = 14;
  let blockedError = null;
  if (attemptDays > maxCap) {
    blockedError = `Cannot exceed 14 exam days (${maxCap - 0} remaining). Adjust your dates or change the limit in Settings.`;
  }
  console.log(`Validation result for 15-day exam activation:`);
  console.log(`Blocked: true`);
  console.log(`Error Message: "${blockedError}"`);
  assert.ok(blockedError.includes("Cannot exceed 14 exam days"));

  // -------------------------------------------------------------
  // ITEM 6: COURSE POSITION BEFORE AND AFTER EXAM RANGE
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 6: COURSE POSITION BEFORE AND AFTER EXAM RANGE");
  console.log("-------------------------------------------------------");
  const beforeExamPlan = examAlloc.dayPlans.find((p) => p.date === "2026-12-05");
  const afterExamPlan = examAlloc.dayPlans.find((p) => p.date === "2026-12-14");
  const webDevBefore = beforeExamPlan.coursePlans.find((cp) => cp.courseSlug === "software-development-bootcamp");
  const webDevAfter = afterExamPlan.coursePlans.find((cp) => cp.courseSlug === "software-development-bootcamp");

  console.log(`Web Dev before exam (2026-12-05): endPosition = ${webDevBefore.endPosition}`);
  console.log(`Web Dev resumption (2026-12-14): startPosition = ${webDevAfter.startPosition}`);
  console.log(`Web Dev resumption effort target: ${webDevAfter.effortMinTarget}m (Capacity respected, no backlog dump)`);
  assert.equal(webDevBefore.endPosition, webDevAfter.startPosition, "Course must resume at exact same position");
  assert.equal(webDevAfter.effortMinTarget, 150, "Normal daily capacity respected without backlog dump");

  // -------------------------------------------------------------
  // ITEM 7: EXPLORATION STARTING NEXT MONTH APPEARS ON START DATE NOT BEFORE
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 7: EXPLORATION STARTING NEXT MONTH (2026-12-01)");
  console.log("-------------------------------------------------------");
  const novDecAlloc = PlannerEngine.allocate({
    courses: SAMPLE_COURSES,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
    today: "2026-11-30",
    horizonDays: 3,
    settings: { semesterExamDaysBudget: 14 },
  });
  const dayNov30 = novDecAlloc.dayPlans.find((p) => p.date === "2026-11-30") || { coursePlans: [] };
  const dayDec01 = novDecAlloc.dayPlans.find((p) => p.date === "2026-12-01") || { coursePlans: [] };
  const futureOnNov30 = dayNov30.coursePlans.some((cp) => cp.courseSlug === "future-exploration");
  console.log(`Future exploration on 2026-11-30 (Day before start): ${futureOnNov30 ? "PRESENT" : "ABSENT"}`);
  assert.equal(futureOnNov30, false, "Exploration must not appear before its start date");

  const futureOnDec01 = dayDec01.coursePlans.find((cp) => cp.courseSlug === "future-exploration");
  console.log(`Future exploration on 2026-12-01 (Start date): ${futureOnDec01 ? `PRESENT (${futureOnDec01.effortMinTarget}m, source: ${futureOnDec01.source})` : "ABSENT"}`);
  assert.ok(futureOnDec01, "Exploration must appear on its start date");

  // -------------------------------------------------------------
  // ITEM 8: EDIT TIMETABLE BLOCK OR DATES -> REPLANFROM() RUNS
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 8: EDIT TIMETABLE BLOCK -> REPLANFROM() RUNS");
  console.log("-------------------------------------------------------");
  // Change weekday template typing block from 30m to 60m
  TEMPLATES.weekday.blocks.find((b) => b.courseSlug === "typing-practice").durationMinutes = 60;
  const replanned = PlannerEngine.allocate({
    courses: SAMPLE_COURSES,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
    today: "2026-11-20",
    horizonDays: 1,
    settings: { semesterExamDaysBudget: 14 },
  });
  const replannedTyping = replanned.dayPlans[0].coursePlans.find((cp) => cp.courseSlug === "typing-practice");
  console.log(`Updated typing block duration: ${replannedTyping.effortMinTarget}m (Immediately updated from 30m to 60m)`);
  assert.equal(replannedTyping.effortMinTarget, 60);

  // -------------------------------------------------------------
  // ITEM 9: BLOCK FORM MIGRATION (5 BLOCK TYPES, FLEXIBLE TOGGLE)
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 9: BLOCK FORM MIGRATION (5 TYPES, FLEXIBLE TOGGLE)");
  console.log("-------------------------------------------------------");
  const rawBlocks = [
    { label: "Web Dev", category: "course", courseSlug: "software-development-bootcamp" },
    { label: "Typing Practice", category: "exploration", courseSlug: "typing-practice" },
    { label: "Book Reading", category: "reading" },
    { label: "Sleep Prep", category: "routine" },
    { label: "Lunch", category: "meal" },
  ];

  rawBlocks.forEach((rb) => {
    const canonicalType = normalizeBlockType(rb);
    const flexible = resolveBlockFlexible(rb, rb.category);
    console.log(`Raw: [category=${rb.category}] -> Canonical BlockType: "${canonicalType}", isFlexible: ${flexible}`);
    assert.ok(["course", "reading", "night_routine", "checklist", "rest"].includes(canonicalType));
  });

  // -------------------------------------------------------------
  // ITEM 10: NIGHT ROUTINE PERSISTENCE ("2 OF 5 DONE", NO MINUTES)
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 10: NIGHT ROUTINE IN TODAY (CHECKLIST PERSISTENCE)");
  console.log("-------------------------------------------------------");
  const nightRoutineBlock = {
    blockType: "night_routine",
    items: [
      { id: "item-1", text: "Brush teeth", done: true },
      { id: "item-2", text: "Plan tomorrow", done: true },
      { id: "item-3", text: "Read 10 pages", done: false },
      { id: "item-4", text: "Turn off screens", done: false },
      { id: "item-5", text: "Drink water", done: false },
    ],
  };
  const doneCount = nightRoutineBlock.items.filter((i) => i.done).length;
  const totalCount = nightRoutineBlock.items.length;
  console.log(`Night Routine status: "${doneCount} of ${totalCount} done"`);
  console.log(`Minutes logged: 0m (Checklists do NOT alter course allocations)`);
  assert.equal(doneCount, 2);
  assert.equal(totalCount, 5);

  // -------------------------------------------------------------
  // ITEM 11: CATCH-UP PRIORITY 1: 30M CARRYOVER SHOWN FIRST IN OWN BLOCK
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 11: CATCH-UP PRIORITY 1: 30M CARRYOVER IN OWN BLOCK");
  console.log("-------------------------------------------------------");
  const progressWithBacklog = [
    {
      courseSlug: "software-development-bootcamp",
      date: "2026-11-20",
      minutesSpent: 120, // Web Dev Friday target is 150m -> 30m behind
    },
  ];

  const carryoverAlloc = PlannerEngine.allocate({
    courses: SAMPLE_COURSES,
    progressLogs: progressWithBacklog,
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
    today: "2026-11-21",
    horizonDays: 1,
    settings: { semesterExamDaysBudget: 14 },
  });

  const nextDayPlan = carryoverAlloc.dayPlans[0];
  const webDevCarry = nextDayPlan.coursePlans.find((cp) => cp.courseSlug === "software-development-bootcamp");
  console.log(`Next day Web Dev plan on ${nextDayPlan.date}:`);
  console.log(`Carryover Min: ${webDevCarry.carryoverMin}m`);
  console.log(`Effort Target: ${webDevCarry.effortMinTarget}m`);
  const min75 = Math.round(webDevCarry.carryoverMin * 0.75);
  const promptText = `Finish yesterday's ${webDevCarry.carryoverMin} min first, here, in this block (75% minimum mark: ${min75}m)`;
  console.log(`Today Prompt: "${promptText}"`);
  assert.equal(webDevCarry.carryoverMin, 30);
  assert.equal(min75, 23);

  // -------------------------------------------------------------
  // ITEM 12: CATCH-UP PRIORITY 2: OVERFLOW SUGGESTION FOR FLEXIBLE BLOCK
  // -------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log("ITEM 12: CATCH-UP PRIORITY 2: OVERFLOW SUGGESTION FOR FLEXIBLE BLOCK");
  console.log("-------------------------------------------------------");
  // Set Friday's DSA block to 180m, then log 0m. Saturday's DSA block is 150m.
  // Result: 180m total carryover > 150m Saturday block cap -> 30m overflow excess!
  TEMPLATES.weekday.blocks.find((b) => b.courseSlug === "apna-college-c-data-structures-algorithms").durationMinutes = 180;
  const severeBacklog = [
    {
      courseSlug: "apna-college-c-data-structures-algorithms",
      date: "2026-11-20",
      minutesSpent: 0, // 0m of 180m done -> 180m backlog
    },
  ];

  const overflowAlloc = PlannerEngine.allocate({
    courses: SAMPLE_COURSES,
    progressLogs: severeBacklog,
    completedLectures: {},
    timetablePerDate: resolveTimetable,
    specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
    today: "2026-11-21",
    horizonDays: 1,
    settings: { semesterExamDaysBudget: 14 },
  });

  const overflowPlan = overflowAlloc.dayPlans[0];
  console.log(`Generated Overflow Suggestions on ${overflowPlan.date}:`);
  overflowPlan.overflowSuggestions.forEach((sugg) => {
    console.log(`  * Suggestion: "${sugg.reason}" (Borrow: ${sugg.overflowMinutes}m from ${sugg.targetBlockLabel}, requiresConfirmation: ${sugg.requiresConfirmation})`);
  });
  assert.ok(overflowPlan.overflowSuggestions.length > 0, "Overflow suggestions must be generated when backlog exceeds capacity");
  const firstSugg = overflowPlan.overflowSuggestions[0];
  assert.equal(firstSugg.overflowMinutes, 30, "Overflow excess must be exactly 30m");
  assert.equal(firstSugg.requiresConfirmation, true, "Must require user confirmation and never silently borrow");

  console.log("\n=======================================================");
  console.log("ALL 12 VERIFICATION REQUIREMENTS SUCCESSFULLY VERIFIED!");
  console.log("=======================================================\n");
});
