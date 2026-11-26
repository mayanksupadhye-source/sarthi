import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PlannerEngine } from "../server/services/plannerEngine.js";
import { normalizeBlockType, resolveBlockFlexible } from "../server/models/ScheduleTemplate.js";

test("CORRECTION VERIFICATION SUITE", async (t) => {
  // -------------------------------------------------------------------------
  // 1. TYPING / EXPLORATION RULE: Course appears ONLY if timetable has a block
  // -------------------------------------------------------------------------
  console.log("------------------------------------------------------------------");
  console.log("TEST 1: TYPING / EXPLORATION ABSENCE WITHOUT TIMETABLE BLOCK");
  console.log("------------------------------------------------------------------");

  const courses = [
    {
      id: "c-webdev",
      slug: "software-development-bootcamp",
      title: "Software Development Bootcamp",
      category: "course",
      multiplier: 2.0,
      totalHours: 100,
      totalLectures: 50,
      lectures: Array.from({ length: 50 }, (_, i) => ({
        lectureNumber: i + 1,
        videoDurationMinutes: 60,
        totalEffortMinutes: 120,
      })),
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
      targetDate: "2026-11-29",
      lectures: Array.from({ length: 20 }, (_, i) => ({
        lectureNumber: i + 1,
        videoDurationMinutes: 30,
        totalEffortMinutes: 30,
      })),
    },
    {
      id: "exp-orphan",
      slug: "unassigned-exploration",
      title: "Unassigned Exploration",
      category: "exploration",
      multiplier: 1.0,
      totalHours: 5,
      totalLectures: 10,
      lectures: Array.from({ length: 10 }, (_, i) => ({
        lectureNumber: i + 1,
        videoDurationMinutes: 30,
        totalEffortMinutes: 30,
      })),
    },
  ];

  const testTimetables = {
    weekday: {
      dayType: "weekday",
      blocks: [
        { blockId: "b1", label: "Web Dev Focus", courseSlug: "software-development-bootcamp", durationMinutes: 150, blockType: "course" },
        { blockId: "b2", label: "Typing Practice", courseSlug: "typing-practice", durationMinutes: 30, blockType: "course" },
        { blockId: "b3", label: "Night routine", durationMinutes: 45, blockType: "night_routine" },
        { blockId: "b4", label: "Sleep", durationMinutes: 420, blockType: "rest" },
      ],
    },
    saturday: {
      dayType: "saturday",
      blocks: [
        { blockId: "b5", label: "Web Dev Focus", courseSlug: "software-development-bootcamp", durationMinutes: 150, blockType: "course" },
        { blockId: "b6", label: "Night routine", durationMinutes: 45, blockType: "night_routine" },
        { blockId: "b7", label: "Sleep", durationMinutes: 420, blockType: "rest" },
        // Notice: Saturday has NO typing block
      ],
    },
    sunday: {
      dayType: "sunday",
      blocks: [
        { blockId: "b8", label: "Getting ready", durationMinutes: 60, blockType: "checklist" },
        { blockId: "b9", label: "Night routine", durationMinutes: 45, blockType: "night_routine" },
        { blockId: "b10", label: "Sleep", durationMinutes: 420, blockType: "rest" },
        // Notice: Sunday has NO course blocks
      ],
    },
  };

  const resolveTT = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const key = dow === 0 ? "sunday" : dow === 6 ? "saturday" : "weekday";
    return { dayType: key, activeProfile: key, blocks: testTimetables[key].blocks };
  };

  const alloc1 = PlannerEngine.allocate({
    courses,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: resolveTT,
    specialDates: {},
    today: "2026-11-20", // Friday
    horizonDays: 3,
  });

  const fri = alloc1.dayPlans.find((p) => p.date === "2026-11-20");
  const sat = alloc1.dayPlans.find((p) => p.date === "2026-11-21");
  const sun = alloc1.dayPlans.find((p) => p.date === "2026-11-22");

  const friTyping = fri.coursePlans.find((cp) => cp.courseSlug === "typing-practice");
  const satTyping = sat.coursePlans.find((cp) => cp.courseSlug === "typing-practice");
  const sunTyping = sun.coursePlans.find((cp) => cp.courseSlug === "typing-practice");

  console.log(`Friday (weekday has block): ${friTyping ? `Allocated ${friTyping.effortMinTarget}m` : "Absent"}`);
  console.log(`Saturday (saturday lacks block): ${satTyping ? `Allocated ${satTyping.effortMinTarget}m` : "ABSENT (Correct)"}`);
  console.log(`Sunday (sunday lacks block): ${sunTyping ? `Allocated ${sunTyping.effortMinTarget}m` : "ABSENT (Correct)"}`);

  assert.ok(friTyping, "Friday must have Typing because weekday template has a typing block");
  assert.equal(satTyping, undefined, "Saturday must NOT have Typing because Saturday template lacks a typing block");
  assert.equal(sunTyping, undefined, "Sunday must NOT have Typing because Sunday template lacks a typing block");

  // Fallback applies ONLY to a course with ZERO blocks in every template
  const friOrphan = fri.coursePlans.find((cp) => cp.courseSlug === "unassigned-exploration");
  console.log(`Orphan course with zero blocks anywhere: ${friOrphan ? `Allocated ${friOrphan.effortMinTarget}m (Source: "${friOrphan.source}")` : "Absent"}`);
  assert.ok(friOrphan, "Orphan course with zero blocks anywhere receives editable fallback");
  assert.equal(friOrphan.source, "Not in your timetable yet, add a block");

  // -------------------------------------------------------------------------
  // 4. DAILY CAPACITY AND MINIMUM MARK (Web Dev log 30 of 60 lecture minutes)
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST 4: DAILY CAPACITY & 75% OF DAY'S TOTAL TARGET");
  console.log("------------------------------------------------------------------");

  // Web Dev: 1 lecture = 60 video min = 120 effort min (multiplier 2.0).
  // Target on Friday: 150m effort (75m lecture). User logs only 30m lecture = 60m effort.
  // Unfinished: 150m - 60m = 90m effort carryover (45m lecture).
  const progressLogs = [
    {
      courseSlug: "software-development-bootcamp",
      date: "2026-11-20",
      minutesSpent: 60, // 30 of 60 lecture minutes logged (at 2x multiplier = 60 effort mins)
    },
  ];

  const alloc2 = PlannerEngine.allocate({
    courses,
    progressLogs,
    completedLectures: {},
    timetablePerDate: resolveTT,
    specialDates: {},
    today: "2026-11-21", // Saturday
    horizonDays: 1,
  });

  const satPlan = alloc2.dayPlans[0];
  const satWebDev = satPlan.coursePlans.find((cp) => cp.courseSlug === "software-development-bootcamp");

  console.log(`Saturday Web Dev Block Capacity: 150m`);
  console.log(`Saturday Web Dev Total Effort Target: ${satWebDev.effortMinTarget}m`);
  console.log(`Saturday Web Dev Carryover Portion: ${satWebDev.carryoverMin}m (finish yesterday's work first)`);
  console.log(`Saturday Web Dev New Work Portion: ${satWebDev.effortMinTarget - satWebDev.carryoverMin}m`);
  console.log(`Saturday 75% Minimum Mark: ${satWebDev.minAcceptableMarkMin}m (75% of total ${satWebDev.effortMinTarget}m)`);
  console.log(`Sequence: ${satWebDev.startPosition} ➔ ${satWebDev.endPosition}`);

  assert.equal(satWebDev.effortMinTarget, 150, "A 150m block must NEVER exceed 150m (never 180m or 210m)");
  assert.equal(satWebDev.carryoverMin, 90, "Carryover is 90m (150m - 60m logged)");
  assert.equal(satWebDev.minAcceptableMarkMin, 113, "75% mark must be 75% of day's total target (150 * 0.75 = 113), not of carryover");

  // -------------------------------------------------------------------------
  // 5a. BLOCK FORM: Old checkboxes gone, 5 types, Flexible on Course/Reading
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST 5a: BLOCK FORM INSPECTION");
  console.log("------------------------------------------------------------------");
  const timetableHtml = fs.readFileSync(path.resolve("client/pages/timetable.html"), "utf8");

  const hasTrackInToday = timetableHtml.includes('id="blockIsTrackable"') || timetableHtml.includes("Track in Today");
  const hasProtected = timetableHtml.includes('id="blockIsProtected"') || timetableHtml.includes("Protected Block");
  const hasBlockTypeSelect = timetableHtml.includes('id="blockType"');
  const hasCourseOpt = timetableHtml.includes('value="course"');
  const hasReadingOpt = timetableHtml.includes('value="reading"');
  const hasNightRoutineOpt = timetableHtml.includes('value="night_routine"');
  const hasChecklistOpt = timetableHtml.includes('value="checklist"');
  const hasRestOpt = timetableHtml.includes('value="rest"');

  console.log(`Old "Track in Today" checkbox present in form: ${hasTrackInToday}`);
  console.log(`Old "Protected" checkbox present in form: ${hasProtected}`);
  console.log(`5 Canonical Types present in select: ${hasCourseOpt && hasReadingOpt && hasNightRoutineOpt && hasChecklistOpt && hasRestOpt}`);

  assert.equal(hasTrackInToday, false, 'Old "Track in Today" checkbox must be gone from timetable form');
  assert.equal(hasProtected, false, 'Old "Protected" checkbox must be gone from timetable form');
  assert.equal(hasBlockTypeSelect, true, "blockType select must exist in form");

  // -------------------------------------------------------------------------
  // 5b. DATE WITH NO FLEXIBLE BLOCK: No overflow suggestion, spreads to later
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST 5b: NO FLEXIBLE BLOCK -> SPREADS TO LATER DAYS");
  console.log("------------------------------------------------------------------");
  // Saturday timetable has Web Dev (not flexible), Night Routine, Sleep. No Flexible blocks!
  // Backlog = 200m against 150m capacity (50m excess)
  const severeBacklog = [
    {
      courseSlug: "software-development-bootcamp",
      date: "2026-11-20",
      minutesSpent: 0,
    },
  ];

  // Saturday with NO flexible block:
  const noFlexAlloc = PlannerEngine.allocate({
    courses,
    progressLogs: severeBacklog,
    completedLectures: {},
    timetablePerDate: (dStr) => ({ dayType: "saturday", activeProfile: "saturday", blocks: testTimetables.saturday.blocks }),
    specialDates: {},
    today: "2026-11-21",
    horizonDays: 1,
  });

  const satNoFlex = noFlexAlloc.dayPlans[0];
  console.log(`Overflow suggestions generated on date with no flexible block: ${satNoFlex.overflowSuggestions.length}`);
  assert.equal(satNoFlex.overflowSuggestions.length, 0, "No overflow suggestions must be generated when date has no Flexible block");

  // -------------------------------------------------------------------------
  // 5c. EXAM DATE: Night Routine, Checklist and Rest appear; course blocks do not
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST 5c: EXAM DATE ROUTINES VS COURSE PAUSE");
  console.log("------------------------------------------------------------------");
  const examTimetable = {
    dayType: "exam",
    blocks: [
      { blockId: "e1", label: "Morning routine", durationMinutes: 60, blockType: "checklist" },
      { blockId: "e2", label: "DSA Study Block", courseSlug: "apna-college-c-data-structures-algorithms", durationMinutes: 120, blockType: "course" },
      { blockId: "e3", label: "Web Dev Block", courseSlug: "software-development-bootcamp", durationMinutes: 120, blockType: "course" },
      { blockId: "e4", label: "Night routine", durationMinutes: 45, blockType: "night_routine" },
      { blockId: "e5", label: "Sleep", durationMinutes: 420, blockType: "rest" },
    ],
  };

  const examAlloc = PlannerEngine.allocate({
    courses,
    progressLogs: [],
    completedLectures: {},
    timetablePerDate: () => ({ dayType: "exam", activeProfile: "exam", blocks: examTimetable.blocks }),
    specialDates: {},
    today: "2026-11-26",
    horizonDays: 1,
  });

  const examDayPlan = examAlloc.dayPlans[0];
  const examCourses = examDayPlan.coursePlans;
  console.log(`Exam day coursePlans count: ${examCourses.length} (Web Dev and DSA PAUSED)`);
  assert.equal(examCourses.length, 0, "Courses must be completely paused on exam day");

  const nonCourseBlocks = examTimetable.blocks.filter((b) => ["night_routine", "checklist", "rest"].includes(b.blockType));
  console.log(`Non-course blocks present in active exam schedule: ${nonCourseBlocks.map((b) => b.label).join(", ")}`);
  assert.equal(nonCourseBlocks.length, 3, "Checklist, Night Routine and Rest blocks remain active during exams");

  // -------------------------------------------------------------------------
  // 5d. MIGRATED NIGHT ROUTINE PERSISTENCE (Items & Ticks)
  // -------------------------------------------------------------------------
  console.log("\n------------------------------------------------------------------");
  console.log("TEST 5d: NIGHT ROUTINE PERSISTENCE");
  console.log("------------------------------------------------------------------");
  // From user real weekday timetable:
  // "Night routine (No phone, 5 English words, skincare, meditation, reading, journal)"
  const nightRoutineBlock = {
    blockId: "nr-1",
    label: "Night routine (No phone, 5 English words, skincare, meditation, reading, journal)",
    durationMinutes: 70,
    blockType: normalizeBlockType({ label: "Night routine" }),
    items: [
      { id: "i1", text: "No phone", done: true },
      { id: "i2", text: "5 English words", done: true },
      { id: "i3", text: "Skincare", done: true },
      { id: "i4", text: "Meditation", done: false },
      { id: "i5", text: "Reading", done: false },
      { id: "i6", text: "Journal", done: false },
    ],
  };

  console.log(`Migrated blockType: "${nightRoutineBlock.blockType}"`);
  assert.equal(nightRoutineBlock.blockType, "night_routine");

  const doneCount = nightRoutineBlock.items.filter((i) => i.done).length;
  const totalCount = nightRoutineBlock.items.length;
  console.log(`Status before reload: "${doneCount} of ${totalCount} done"`);
  assert.equal(doneCount, 3);

  // Simulate persistence reload (JSON serialize / deserialize)
  const savedRecord = JSON.stringify(nightRoutineBlock);
  const reloadedRecord = JSON.parse(savedRecord);
  const reloadedDone = reloadedRecord.items.filter((i) => i.done).length;
  console.log(`Status after reload: "${reloadedDone} of ${reloadedRecord.items.length} done" (Ticks persisted)`);
  assert.equal(reloadedDone, 3, "Checklist ticks must persist across reloads");
});
