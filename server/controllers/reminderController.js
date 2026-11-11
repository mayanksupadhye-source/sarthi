import { generateReminderPlan } from '../services/reminderPlanEngine.js';

export async function getReminderPlan(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to } = req.query;

    const plan = await generateReminderPlan({
      userId,
      from,
      to,
      now: new Date()
    });

    return res.json({
      success: true,
      count: plan.length,
      timezone: 'Asia/Kolkata',
      reminders: plan,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
}
