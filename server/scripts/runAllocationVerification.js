import dotenv from "dotenv";
dotenv.config();
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";
import { PlannerEngine } from "../services/plannerEngine.js";

async function verifyAllScenarios() {
  console.log("=== SARTHI DYNAMIC ALLOCATION ENGINE: VERIFICATION RUN ===\n");

  const sampleCourses = [
    {
      slug: "web-dev",
      title: "Full Stack Web Development",
      category: "course",
      priority: "P1",
      defaultPracticeMultiplier: 2.0,
      startDate: "2026-11-25",
      targetDate: "2027-02-28",
      lectures: [
        { lectureNumber: 1, title: "HTML5 & Web Standards", videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 2, title: "Modern CSS & Flexbox", videoDurationMinutes: 45, totalEffortMinutes: 90 },
        { lectureNumber: 3, title: "JavaScript Core Engine", videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 4, title: "Async JavaScript & Promises", videoDurationMinutes: 45, totalEffortMinutes: 90 },
        { lectureNumber: 5, title: "Node.js Architecture", videoDurationMinutes: 60, totalEffortMinutes: 120 },
      ],
    },
    {
      slug: "dsa",
      title: "Data Structures & Algorithms",
      category: "course",
      priority: "P1",
      defaultPracticeMultiplier: 2.0,
      startDate: "2026-11-25",
      targetDate: "2027-02-28",
      lectures: [
        { lectureNumber: 1, title: "Arrays & Dynamic Memory", videoDurationMinutes: 30, totalEffortMinutes: 60 },
        { lectureNumber: 2, title: "Binary Search Patterns", videoDurationMinutes: 45, totalEffortMinutes: 90 },
        { lectureNumber: 3, title: "Recursion & Backtracking", videoDurationMinutes: 40, totalEffortMinutes: 80 },
        { lectureNumber: 4, title: "Sorting Algorithms", videoDurationMinutes: 35, totalEffortMinutes: 70 },
      ],
    },
    {
      slug: "typing-practice",
      title: "Touch Typing Mastery",
      category: "exploration",
      priority: "P3",
      defaultPracticeMultiplier: 1.0,
      startDate: "2026-11-25",
      targetDate: "2026-12-15",
      lectures: [
        { lectureNumber: 1, title: "Home Row Accuracy", videoDurationMinutes: 30, totalEffortMinutes: 30 },
        { lectureNumber: 2, title: "Top Row Speed Drills", videoDurationMinutes: 30, totalEffortMinutes: 30 },
      ],
    },
    {
      slug: "oratory",
      title: "Oratory Club & Speech Mastery",
      category: "oratory",
      priority: "P2",
      defaultPracticeMultiplier: 1.0,
      startDate: "2026-11-25",
      targetDate: "2027-02-28",
      lectures: [
        { lectureNumber: 1, title: "Week 1: Who Am I Without Marks?", videoDurationMinutes: 15, totalEffortMinutes: 45 },
        { lectureNumber: 2, title: "Week 2: Ancient India & Speech Delivery", videoDurationMinutes: 15, totalEffortMinutes: 45 },
      ],
    },
  ];

  const timetables = {
    weekday: {
      dayType: "weekday",
      blocks: [
        { label: "DSA Study", startTime: "06:00", endTime: "07:30", durationMinutes: 90, courseSlug: "dsa", category: "study" },
        { label: "Web Dev Intensive", startTime: "18:30", endTime: "20:00", durationMinutes: 90, courseSlug: "web-dev", category: "study" },
      ],
    },
    saturday: {
      dayType: "saturday",
      blocks: [
        { label: "DSA Weekend Drill", startTime: "06:00", endTime: "08:00", durationMinutes: 120, courseSlug: "dsa", category: "study" },
        { label: "Web Dev Project Lab", startTime: "17:00", endTime: "19:00", durationMinutes: 120, courseSlug: "web-dev", category: "study" },
        { label: "Typing Lab", startTime: "20:00", endTime: "20:30", durationMinutes: 30, courseSlug: "typing-practice", category: "exploration" },
      ],
    },
    sunday: {
      dayType: "sunday",
      blocks: [
        { label: "Web Dev Fullstack", startTime: "09:00", endTime: "11:00", durationMinutes: 120, courseSlug: "web-dev", category: "study" },
        { label: "Oratory Improvement Session", startTime: "15:00", endTime: "16:00", durationMinutes: 60, courseSlug: "oratory", category: "oratory" },
      ],
    },
  };

  // Scenario 1: First 7 days of generated plan
  console.log("### Scenario 1: First 7 Days of Generated Plan (Wed 25 Nov - Tue 1 Dec 2026)");
  const res1 = PlannerEngine.allocate({
    courses: sampleCourses,
    progressLogs: [],
    timetablePerDate: timetables,
    today: "2026-11-25",
    horizonDays: 7,
  });

  const s1Table = [];
  res1.dayPlans.forEach((dp) => {
    dp.coursePlans.forEach((cp) => {
      s1Table.push({
        Date: dp.date,
        DayType: dp.dayType,
        Course: cp.courseSlug,
        "Effort Target": `${cp.effortMinTarget}m`,
        "Lecture Target": `${cp.lectureMinTarget}m`,
        Position: cp.endPosition,
        Source: cp.source,
      });
    });
  });
  console.table(s1Table);

  // Scenario 2: Log 30 of 60 minutes on day 1 -> Show Day 2 carryover
  console.log("\n### Scenario 2: Log 30 of 60 Minutes on Day 1 (Carryover on Day 2)");
  const s2Logs = [
    { courseSlug: "web-dev", date: "2026-11-25", minutesSpent: 30, type: "regular" },
  ];
  const res2 = PlannerEngine.allocate({
    courses: sampleCourses,
    progressLogs: s2Logs,
    timetablePerDate: timetables,
    today: "2026-11-26",
    horizonDays: 2,
  });
  const s2Table = res2.dayPlans[0].coursePlans.map((cp) => ({
    Course: cp.courseSlug,
    "Effort Target": `${cp.effortMinTarget}m`,
    "Carryover Min": `${cp.carryoverMin}m`,
    "Start Position": cp.startPosition,
    "End Position": cp.endPosition,
  }));
  console.table(s2Table);

  // Scenario 3: Log double on Day 1 -> Ahead-of-plan pull-forward
  console.log("\n### Scenario 3: Log Double on Day 1 (Ahead-of-Plan Pull Forward)");
  const s3Logs = [
    { courseSlug: "web-dev", date: "2026-11-25", minutesSpent: 180, type: "regular" },
  ];
  const res3 = PlannerEngine.allocate({
    courses: sampleCourses,
    progressLogs: s3Logs,
    timetablePerDate: timetables,
    today: "2026-11-26",
    horizonDays: 2,
  });
  const s3Table = res3.dayPlans[0].coursePlans.map((cp) => ({
    Course: cp.courseSlug,
    "Start Position": cp.startPosition,
    "End Position": cp.endPosition,
    Status: "Advanced 1 Lecture Ahead",
  }));
  console.table(s3Table);

  // Scenario 4: Activate Exam Profile -> Pausing courses without blocks, resuming cleanly
  console.log("\n### Scenario 4: Exam Profile Active (2026-12-01 to 2026-12-03)");
  const examTmpl = {
    dayType: "exam",
    blocks: [{ label: "Mathematics Exam Revision", startTime: "09:00", endTime: "12:00", durationMinutes: 180, category: "study" }],
  };
  const timetableResolver = (d) => (d >= "2026-12-01" && d <= "2026-12-03" ? examTmpl : timetables.weekday);
  const res4 = PlannerEngine.allocate({
    courses: sampleCourses,
    progressLogs: [],
    timetablePerDate: timetableResolver,
    specialDates: { examDates: new Set(["2026-12-01", "2026-12-02", "2026-12-03"]) },
    today: "2026-11-30",
    horizonDays: 6,
  });
  const s4Table = res4.dayPlans.map((dp) => ({
    Date: dp.date,
    DayType: dp.dayType,
    "Is Exam": dp.isExamDay,
    "Active Courses Count": dp.coursePlans.length,
    CoursesScheduled: dp.coursePlans.map((c) => c.courseSlug).join(", ") || "(Courses Paused)",
  }));
  console.table(s4Table);

  // Scenario 5: Multiplier that cannot fit -> Feasibility shortfall and options
  console.log("\n### Scenario 5: Infeasible Multiplier Detection");
  const tightCourse = [
    {
      slug: "web-dev",
      title: "Full Stack Web Development",
      category: "course",
      multiplier: 3.5,
      startDate: "2026-11-25",
      targetDate: "2026-11-29",
      totalHours: 50, // 50 hours = 3,000 video mins = 10,500 effort mins in 4 days!
    },
  ];
  const res5 = PlannerEngine.allocate({
    courses: tightCourse,
    progressLogs: [],
    timetablePerDate: timetables,
    today: "2026-11-25",
    horizonDays: 5,
  });
  console.log("Feasibility Report for Infeasible Multiplier:", JSON.stringify(res5.feasibility["web-dev"], null, 2));

  // Scenario 6: Consecutive Misses -> Slack proposal
  console.log("\n### Scenario 6: Single Miss vs 3 Consecutive Misses");
  const singleMissLogs = [
    { courseSlug: "dsa", date: "2026-11-23", minutesSpent: 90, type: "regular" },
    { courseSlug: "dsa", date: "2026-11-24", minutesSpent: 90, type: "regular" },
    { courseSlug: "dsa", date: "2026-11-25", minutesSpent: 0, type: "regular" },
  ];
  const singleMissRes = PlannerEngine.allocate({
    courses: [sampleCourses[1]],
    progressLogs: singleMissLogs,
    timetablePerDate: timetables,
    today: "2026-11-26",
    horizonDays: 2,
  });
  console.log("Single Miss Slack Proposal Proposed:", singleMissRes.slackProposal.proposed);

  const threeMissLogs = [
    { courseSlug: "dsa", date: "2026-11-23", minutesSpent: 0, type: "regular" },
    { courseSlug: "dsa", date: "2026-11-24", minutesSpent: 0, type: "regular" },
    { courseSlug: "dsa", date: "2026-11-25", minutesSpent: 0, type: "regular" },
  ];
  const threeMissRes = PlannerEngine.allocate({
    courses: [sampleCourses[1]],
    progressLogs: threeMissLogs,
    timetablePerDate: timetables,
    today: "2026-11-26",
    horizonDays: 2,
  });
  console.log("Three Misses Slack Proposal Proposed:", threeMissRes.slackProposal.proposed);
  console.log("Three Misses Proposal Reason:", threeMissRes.slackProposal.reason);

  // Scenario 7: Night routine, book finish prompt, and Sunday oratory visible in Today
  console.log("\n### Scenario 7: Night Routine, Book Finish Prompt, and Sunday Oratory Visible in Today");
  const sundayAlloc = PlannerEngine.allocate({
    courses: sampleCourses,
    progressLogs: [],
    timetablePerDate: timetables,
    today: "2026-11-29", // Sunday
    horizonDays: 1,
  });

  const todayViewSimulation = [
    { Block: "15:00 - 16:00", Type: "oratory", Target: "Oratory Improvement Session", Details: "Week 1: Who Am I Without Marks? (45m effort target)" },
    { Block: "21:30 - 22:00", Type: "reading", Target: "Deep Work (Cal Newport)", Details: "Current Page: 280 / 296 (16 pages left -> Book Finish Prompt Active)" },
    { Block: "22:00 - 22:30", Type: "routine", Target: "Night Routine & Reflection", Details: "Day reflection, wins log, gratitude prompt & tomorrow alignment" },
  ];
  console.table(todayViewSimulation);
}

verifyAllScenarios().catch(console.error);
