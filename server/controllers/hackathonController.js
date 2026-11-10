import { Hackathon } from '../models/Hackathon.js';

export async function getHackathons(req, res, next) {
  try {
    const hackathons = await Hackathon.find({ userId: req.user.id }).sort({ startDate: 1 });
    return res.json({ success: true, count: hackathons.length, hackathons });
  } catch (err) {
    next(err);
  }
}

export async function createHackathon(req, res, next) {
  try {
    const {
      title,
      tagline = '',
      theme = '',
      startDate,
      endDate,
      registrationDeadline,
      currentStage = 'registered',
      teamMembers = [],
      stages = [],
      weeklyEffortBudgetHours = 10,
      repoUrl = '',
      liveDemoUrl = '',
      pitchDeckUrl = '',
      notes = ''
    } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Title, start date, and end date are required.' });
    }

    const defaultStages = stages.length > 0 ? stages : [
      { name: 'Ideation & Problem Statement', deadline: startDate, status: 'completed' },
      { name: 'System Architecture & Prototype', deadline: endDate, status: 'in-progress' },
      { name: 'Final Demo & Pitch Deck', deadline: endDate, status: 'pending' }
    ];

    const hackathon = await Hackathon.create({
      userId: req.user.id,
      title: title.trim(),
      tagline,
      theme,
      startDate,
      endDate,
      registrationDeadline,
      currentStage,
      teamMembers,
      stages: defaultStages,
      weeklyEffortBudgetHours: Number(weeklyEffortBudgetHours) || 10,
      repoUrl,
      liveDemoUrl,
      pitchDeckUrl,
      notes
    });

    return res.status(201).json({ success: true, hackathon });
  } catch (err) {
    next(err);
  }
}

export async function updateHackathon(req, res, next) {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.userId;

    const hackathon = await Hackathon.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { $set: updates },
      { new: true }
    );

    if (!hackathon) {
      return res.status(404).json({ success: false, error: 'Hackathon not found.' });
    }

    return res.json({ success: true, hackathon });
  } catch (err) {
    next(err);
  }
}

export async function deleteHackathon(req, res, next) {
  try {
    const { id } = req.params;
    const hackathon = await Hackathon.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!hackathon) {
      return res.status(404).json({ success: false, error: 'Hackathon not found.' });
    }
    return res.json({ success: true, message: 'Hackathon removed.' });
  } catch (err) {
    next(err);
  }
}
