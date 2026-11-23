import { ScheduleTemplate } from '../models/ScheduleTemplate.js';

const HISTORY_BLOCK = { blockId: 'sat-6', startTime: '20:30', endTime: '22:30' };

/** Remove only the legacy Saturday history block seeded for the Journal area. */
export async function removeJournalHistorySchedule(userId) {
  const legacyTitle = 'Saturday Development & History Schedule';
  const templates = await ScheduleTemplate.find({
    userId,
    dayType: 'saturday',
    $or: [
      { blocks: { $elemMatch: HISTORY_BLOCK } },
      { title: legacyTitle }
    ]
  }).select('_id title blocks').lean();

  for (const template of templates) {
    const hasHistoryBlock = (template.blocks || []).some(block => (
      block.blockId === HISTORY_BLOCK.blockId
      && block.startTime === HISTORY_BLOCK.startTime
      && block.endTime === HISTORY_BLOCK.endTime
    ));
    const filter = { _id: template._id, userId };
    if (hasHistoryBlock) {
      await ScheduleTemplate.updateOne(filter, {
        $pull: { blocks: HISTORY_BLOCK },
        $set: { updatedAt: new Date() }
      });
    }
    if (template.title === legacyTitle) {
      await ScheduleTemplate.updateOne(filter, {
        $set: { title: 'Saturday Development Schedule', updatedAt: new Date() }
      });
    }
  }
}
