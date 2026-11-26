import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { ScheduleTemplate, normalizeBlockType, resolveBlockFlexible } from "../server/models/ScheduleTemplate.js";
import { TimetableActivation } from "../server/models/TimetableActivation.js";
import { AllocationService } from "../server/services/allocationService.js";
import { getTodayString } from "../server/utils/timeFormat.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas.");

  const examTmpl = await ScheduleTemplate.findOne({ dayType: "exam" });
  const holidayTmpl = await ScheduleTemplate.findOne({ dayType: "holiday" });

  if (!examTmpl) {
    console.log("No exam template found. Exiting.");
    await mongoose.disconnect();
    return;
  }

  const userId = examTmpl.userId;

  // 1. Copy the user's pasted Preparation Leave / Holiday schedule blocks into the `holiday` template
  const pastedBlocks = (examTmpl.blocks || []).map((b) => {
    const raw = typeof b.toObject === "function" ? b.toObject() : { ...b };
    const normType = normalizeBlockType(raw);
    return {
      ...raw,
      blockType: normType === "needs_review" && /intensive subject study/i.test(raw.label) ? "checklist" : normType,
      isFlexible: resolveBlockFlexible({ ...raw, blockType: normType }),
    };
  });

  if (holidayTmpl) {
    holidayTmpl.title = "Preparation Leave / Holiday Timetable";
    holidayTmpl.blocks = pastedBlocks;
    holidayTmpl.updatedAt = new Date();
    await holidayTmpl.save();
    console.log(`Updated [holiday] template ("${holidayTmpl.title}") with ${pastedBlocks.length} blocks.`);
  } else {
    await ScheduleTemplate.create({
      userId,
      dayType: "holiday",
      title: "Preparation Leave / Holiday Timetable",
      blocks: pastedBlocks,
      isDefault: false,
    });
    console.log(`Created [holiday] template with ${pastedBlocks.length} blocks.`);
  }

  // 2. Reset `exam` template to a clean editable Exam Mode template (preserving user's ability to edit it)
  examTmpl.title = "Exam Mode Schedule (Editable)";
  examTmpl.blocks = [
    { blockId: "exam-morning", label: "Morning Routine & Breakfast", startTime: "07:00", endTime: "08:30", durationMinutes: 90, category: "routine", blockType: "checklist", isFlexible: false },
    { blockId: "exam-prep-1", label: "Exam Revision Session I", startTime: "09:00", endTime: "12:00", durationMinutes: 180, category: "academics", blockType: "checklist", isFlexible: false },
    { blockId: "exam-lunch", label: "Lunch & Rest", startTime: "12:00", endTime: "13:30", durationMinutes: 90, category: "routine", blockType: "checklist", isFlexible: false },
    { blockId: "exam-sitting", label: "Official Exam / Intensive Prep II", startTime: "14:00", endTime: "17:00", durationMinutes: 180, category: "academics", blockType: "checklist", isFlexible: false },
    { blockId: "exam-dinner", label: "Dinner & Decompression", startTime: "19:30", endTime: "21:00", durationMinutes: 90, category: "routine", blockType: "checklist", isFlexible: false },
    { blockId: "exam-night", label: "Night Routine", startTime: "22:30", endTime: "23:30", durationMinutes: 60, category: "routine", blockType: "night_routine", isFlexible: false },
    { blockId: "exam-sleep", label: "Protected Sleep Window", startTime: "23:30", endTime: "07:00", durationMinutes: 450, category: "rest", blockType: "rest", isFlexible: false },
  ];
  examTmpl.updatedAt = new Date();
  await examTmpl.save();
  console.log("Reset [exam] template to clean editable Exam Mode blocks.");

  // 3. Remove the bogus auto-assumed `exam` activation (2026-11-26 to 2026-12-06)
  const deleted = await TimetableActivation.deleteMany({ userId, profileId: "exam", startDate: "2026-11-26", endDate: "2026-12-06" });
  console.log(`Removed ${deleted.deletedCount} incorrect auto-assumed exam activation(s).`);

  // 4. Replan from today across the 5-month horizon so Calendar & Today reflect real data immediately
  const today = getTodayString();
  const res = await AllocationService.replanFrom(userId, today, 150);
  console.log(`Replanned ${res.dayPlans.length} days starting from ${today}.`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
