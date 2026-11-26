import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { normalizeBlockType, resolveBlockFlexible } from "../server/models/ScheduleTemplate.js";
import { PlannerEngine } from "../server/services/plannerEngine.js";

async function run() {
  console.log("Connecting to Live Database (READ-ONLY)...");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log("\n=======================================================");
  console.log("REAL DATABASE TIMETABLE & BLOCKS REPORT (READ-ONLY)");
  console.log("=======================================================");

  const templates = await db.collection("scheduletemplates").find({}).toArray();
  console.log(`Found ${templates.length} ScheduleTemplate(s).\n`);

  let nightRoutineItems = [];

  for (const t of templates) {
    console.log(`\n-------------------------------------------------------`);
    console.log(`Template: [${t.dayType}] "${t.title}" (Version: ${t.version}, Default: ${t.isDefault})`);
    console.log(`-------------------------------------------------------`);
    const blocks = t.blocks || [];
    for (const b of blocks) {
      const canonicalType = normalizeBlockType(b);
      const isFlex = resolveBlockFlexible(b);
      console.log(`  * [${b.startTime} - ${b.endTime}] "${b.label}" (Cat: ${b.category || "none"}, Slug: ${b.courseSlug || "none"}) -> Assigned Type: "${canonicalType}" | Flexible: ${isFlex}`);
      if (canonicalType === "night_routine" && b.items) {
        nightRoutineItems = b.items;
      }
    }
  }

  // Also check if any execution records or day plans have night routine checklist items
  const executionRecords = await db.collection("executionrecords").find({ "activityPayload.checklist": { $exists: true } }).toArray();
  if (executionRecords.length > 0) {
    console.log(`\nExecution Records with Checklist: ${executionRecords.length}`);
  }

  // Check Courses
  const courses = await db.collection("courses").find({}).toArray();
  console.log(`\nFound ${courses.length} Course(s) in Live Database:`);
  courses.forEach(c => {
    console.log(`  * ${c.title} (slug: ${c.slug}, type: ${c.category}, start: ${c.startDate || "none"}, end: ${c.targetDate || c.endDate || "none"}, status: ${c.status || "active"})`);
  });

  // Check Activations
  const activations = await db.collection("timetableactivations").find({}).toArray();
  console.log(`\nFound ${activations.length} Timetable Activation(s):`);
  activations.forEach(a => {
    console.log(`  * Profile: ${a.profileId} | ${a.startDate} to ${a.endDate}`);
  });

  // 10-Day Typing Practice Trace for the user's real course
  const typingCourse = courses.find(c => c.slug === "typing-practice" || c.title?.toLowerCase().includes("typing"));
  if (typingCourse) {
    console.log("\n=======================================================");
    console.log(`10-DAY TYPING PRACTICE TRACE FOR REAL COURSE: "${typingCourse.title}"`);
    console.log("=======================================================");

    // Build timetable resolver from live templates and activations
    const templatesMap = {};
    templates.forEach(t => { templatesMap[t.dayType] = t; });

    const resolveTimetable = (dateStr) => {
      const act = activations.find(a => a.startDate <= dateStr && dateStr <= a.endDate);
      if (act) {
        const tmpl = templatesMap[act.profileId] || { dayType: act.profileId, blocks: [] };
        return { dayType: act.profileId, activeProfile: act.profileId, blocks: tmpl.blocks || [] };
      }
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const key = dow === 0 ? "sunday" : dow === 6 ? "saturday" : "weekday";
      const tmpl = templatesMap[key] || { dayType: key, blocks: [] };
      return { dayType: key, activeProfile: key, blocks: tmpl.blocks || [] };
    };

    // Trace dates 2026-11-20 to 2026-11-29
    const testStartDate = typingCourse.startDate || "2026-11-20";
    const [sy, sm, sd] = testStartDate.split("-").map(Number);
    const dateList = [];
    const cur = new Date(Date.UTC(sy, sm - 1, sd));
    for (let i = 0; i < 10; i++) {
      dateList.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    console.log(`Tracing real typing allocation across 10 dates (${dateList[0]} to ${dateList[dateList.length - 1]}):`);

    // Run PlannerEngine allocate on real courses and templates
    const alloc = PlannerEngine.allocate({
      courses: courses.map(c => ({
        ...c,
        id: c._id.toString(),
        slug: c.slug,
        multiplier: c.defaultPracticeMultiplier || c.multiplier || 2.0,
      })),
      progressLogs: [],
      completedLectures: {},
      timetablePerDate: resolveTimetable,
      specialDates: { examDates: [], hackathonDates: [], slackDates: [] },
      today: dateList[0],
      horizonDays: 10,
    });

    dateList.forEach(dateStr => {
      const tt = resolveTimetable(dateStr);
      const hasBlock = (tt.blocks || []).some(b => b.courseSlug === typingCourse.slug || b.label?.toLowerCase().includes("typing"));
      const dp = alloc.dayPlans.find(p => p.date === dateStr);
      const cp = dp?.coursePlans?.find(p => p.courseSlug === typingCourse.slug);
      const mins = cp ? `${cp.effortMinTarget}m` : "none";
      console.log(`  Date: ${dateStr} | Active Profile: ${tt.activeProfile.padEnd(9)} | Typing Block: ${hasBlock ? "YES" : "NO "} | Allocated: ${cp ? `${mins} (${cp.startPosition} ➔ ${cp.endPosition})` : "[ABSENT — NO BLOCK]"}`);
    });
  }

  await mongoose.disconnect();
  console.log("\nDisconnected cleanly from Live DB.");
}

run().catch(err => {
  console.error("Error reading live DB:", err);
  process.exit(1);
});
