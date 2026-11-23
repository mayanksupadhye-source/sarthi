import express from "express";
import {
  getSubjects,
  createSubject,
  archiveSubject,
  markAttendance,
  getAttendanceHistory,
  getAssignments,
  createAssignment,
  updateAssignment,
  getExaminations,
  createExamination,
  updateExamination,
  deleteExamination,
  toggleExamMode,
  getExamPrepSummary,
  addExamPrepDate,
  removeExamPrepDate,
} from "../controllers/academicController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticate);

router.get("/subjects", getSubjects);
router.post("/subjects", createSubject);
router.delete("/subjects/:id", archiveSubject);
router.post("/attendance", markAttendance);
router.get("/attendance/history", getAttendanceHistory);
router.get("/assignments", getAssignments);
router.post("/assignments", createAssignment);
router.put("/assignments/:id", updateAssignment);
router.get("/exams", getExaminations);
router.post("/exams", createExamination);
router.put("/exams/:id", updateExamination);
router.delete("/exams/:id", deleteExamination);
router.post("/exam-mode", toggleExamMode);
router.get("/exams/prep-summary", getExamPrepSummary);
router.post("/exams/:id/prep-dates", addExamPrepDate);
router.delete("/exams/:id/prep-dates/:date", removeExamPrepDate);

export default router;
