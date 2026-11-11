import { Message } from '../models/Message.js';
import { UserProfile } from '../models/UserProfile.js';

/**
 * Checks whether current local time falls in user's quiet hours
 */
function isQuietHours(quietHours, currentTimeString) {
  if (!quietHours || !quietHours.start || !quietHours.end) return false;
  const current = currentTimeString || new Date().toTimeString().substring(0, 5); // "HH:MM"
  if (quietHours.start > quietHours.end) {
    // Overnight window, e.g. 23:30 to 05:00
    return current >= quietHours.start || current <= quietHours.end;
  }
  return current >= quietHours.start && current <= quietHours.end;
}

/**
 * Injects real mathematical and execution tokens into template strings.
 * Never invents numbers or placeholders.
 */
export function interpolateTokens(template, tokens = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return tokens[key] !== undefined ? String(tokens[key]) : match;
  });
}

/**
 * Central Selection Engine:
 * Selects exactly one context-appropriate message adhering to cooldowns,
 * quiet hours, and content rules.
 */
export async function getContextualMessage({
  userId,
  dayState = 'fresh',
  surface = 'today',
  tokens = {},
  currentTime = null
}) {
  try {
    // 1. Fetch user profile for voice rules and quiet hours
    let userProfile = null;
    if (userId) {
      userProfile = await UserProfile.findOne({ userId });
    }

    if (userProfile?.voice?.quietHours) {
      if (isQuietHours(userProfile.voice.quietHours, currentTime)) {
        return null; // Respect quiet hours
      }
    }

    // 2. Query eligible messages matching current dayState and surface
    const now = new Date();
    const candidates = await Message.find({
      contexts: dayState,
      surfaces: surface
    });

    if (!candidates || candidates.length === 0) {
      return null;
    }

    // 3. Filter candidates by cooldown
    const eligible = candidates.filter(msg => {
      if (!msg.lastShownAt) return true;
      const cooldownMs = (msg.cooldownDays || 3) * 24 * 60 * 60 * 1000;
      const elapsed = now.getTime() - new Date(msg.lastShownAt).getTime();
      return elapsed >= cooldownMs;
    });

    const pool = eligible.length > 0 ? eligible : candidates;

    // 4. Weighted random selection
    const totalWeight = pool.reduce((sum, m) => sum + (m.weight || 1.0), 0);
    let randomVal = Math.random() * totalWeight;
    let selected = pool[0];

    for (const msg of pool) {
      randomVal -= (msg.weight || 1.0);
      if (randomVal <= 0) {
        selected = msg;
        break;
      }
    }

    // 5. Update lastShownAt timestamp
    selected.lastShownAt = now;
    await selected.save().catch(() => {});

    // 6. Token interpolation
    const renderedText = interpolateTokens(selected.text, tokens);

    return {
      id: selected.id,
      text: renderedText,
      tone: selected.tone,
      dayState,
      surface
    };
  } catch (err) {
    console.error('[CopyEngine Error]:', err.message);
    return null;
  }
}

/**
 * Records user feedback (thumbs up / thumbs down) to dynamically adjust message weight.
 */
export async function recordFeedback(messageId, feedbackType) {
  if (!messageId) return null;
  const isUp = feedbackType === 'thumbs_up';
  
  const update = isUp
    ? { $inc: { 'userFeedback.thumbsUp': 1, weight: 0.2 } }
    : { $inc: { 'userFeedback.thumbsDown': 1 }, $set: { weight: 0.3 } }; // Lower weight for "not for me"

  return Message.findOneAndUpdate({ id: messageId }, update, { new: true });
}
