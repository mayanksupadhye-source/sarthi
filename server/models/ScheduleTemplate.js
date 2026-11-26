import mongoose from "mongoose";

const scheduleBlockSchema = new mongoose.Schema(
  {
    blockId: { type: String, required: true },
    label: { type: String, required: true },
    startTime: { type: String, required: true }, // "05:00"
    endTime: { type: String, required: true }, // "07:30"
    durationMinutes: { type: Number, required: true },
    category: {
      type: String,
      enum: [
        "study",
        "academics",
        "college",
        "gym",
        "routine",
        "webdev",
        "dsa",
        "oratory",
        "exploration",
        "rest",
        "personal",
        "flexible",
      ],
      default: "study",
    },
    blockType: {
      type: String,
      enum: [
        "course",
        "reading",
        "night_routine",
        "checklist",
        "rest",
        "needs_review",
        // Legacy values retained for backward compatibility with pre-migration blocks
        "fixed_routine",
        "actionable_routine",
        "learning",
        "exploration",
        "deadline",
      ],
      default: "course",
    },
    courseSlug: { type: String, default: null }, // Optional link to a dynamic Course (e.g. 'dsa', 'web-development')
    isFlexible: { type: Boolean, default: undefined }, // Optional toggle for Course & Reading: can be shortened & host overflow
    isTrackable: { type: Boolean, default: false }, // Legacy field retained for migration
    isProtected: { type: Boolean, default: false }, // Legacy field retained for migration
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const scheduleTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  dayType: {
    type: String,
    enum: ["weekday", "saturday", "sunday", "holiday", "exam", "custom"],
    required: true,
  },
  title: { type: String, required: true },
  effectiveFrom: { type: String, default: "2026-01-01", index: true }, // "YYYY-MM-DD"
  version: { type: Number, default: 1 },
  blocks: [scheduleBlockSchema],
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

scheduleTemplateSchema.index({ userId: 1, dayType: 1, effectiveFrom: -1 });

export function normalizeBlockType(block = {}) {
  const lbl = String(block.label || "").toLowerCase();
  const cat = String(block.category || "").toLowerCase();
  const slug = String(block.courseSlug || "").toLowerCase();

  // 1. Never map night-routine to "rest." Titles or categories containing "night routine" map to night_routine.
  if (
    lbl.includes("night routine") ||
    lbl.includes("night-routine") ||
    lbl.includes("nightroutine") ||
    cat.includes("night routine") ||
    cat.includes("night-routine")
  ) {
    return "night_routine";
  }

  // 2. Only sleep maps to rest.
  if (lbl.includes("sleep") || cat === "sleep" || (lbl.includes("rest") && lbl.includes("window"))) {
    return "rest";
  }

  // 3. Reading maps to reading.
  if (cat === "reading" || slug === "reading" || lbl.includes("reading") || lbl.includes("book")) {
    return "reading";
  }

  // 4. Wake-up, meals, college, classes, practicals and oratory map to checklist.
  const checklistKeywords = [
    "wake",
    "wakeup",
    "wake-up",
    "getting ready",
    "grooming",
    "meal",
    "meals",
    "breakfast",
    "brunch",
    "lunch",
    "dinner",
    "college",
    "class",
    "classes",
    "practical",
    "practicals",
    "oratory",
    "speech",
    "gym",
    "yoga",
    "cycling",
    "exercise",
    "workout",
    "bath",
    "fresh",
    "commute",
    "travel",
    "chill",
    "movie",
    "personal",
    "tea break",
    "break",
    "hostel",
  ];
  if (checklistKeywords.some((kw) => lbl.includes(kw) || cat.includes(kw))) {
    return "checklist";
  }

  // 5. Course maps to active courses (Web Dev, DSA, Exploration). Progress tracked in minutes.
  if (
    (slug && slug !== "oratory") ||
    ["study", "webdev", "dsa", "exploration"].includes(cat) ||
    lbl.includes("dsa") ||
    lbl.includes("web dev") ||
    lbl.includes("webdev") ||
    lbl.includes("bootcamp") ||
    lbl.includes("typing") ||
    lbl.includes("excel") ||
    lbl.includes("c++") ||
    lbl.includes("lecture") ||
    lbl.includes("coding") ||
    lbl.includes("programming") ||
    lbl.includes("leetcode")
  ) {
    return "course";
  }

  // If block explicitly has a canonical blockType set (e.g. user manually selected it in UI)
  const canonical = ["course", "reading", "night_routine", "checklist", "rest"];
  if (block.blockType && canonical.includes(block.blockType) && block.blockType !== "course") {
    return block.blockType;
  }

  // 6. A block you cannot classify confidently is marked "needs review". Do not guess silently.
  return "needs_review";
}

export function resolveBlockFlexible(block = {}, courseCategory = "") {
  const canonicalType = normalizeBlockType(block);
  if (!["course", "reading"].includes(canonicalType)) return false;
  if (typeof block.isFlexible === "boolean") return block.isFlexible;
  const cat = String(block.category || courseCategory || "").toLowerCase();
  const slug = String(block.courseSlug || "").toLowerCase();
  if (canonicalType === "reading" || cat === "exploration" || slug.includes("typing") || slug.includes("excel")) {
    return true;
  }
  return false;
}

export const ScheduleTemplate =
  mongoose.models.ScheduleTemplate ||
  mongoose.model("ScheduleTemplate", scheduleTemplateSchema);
