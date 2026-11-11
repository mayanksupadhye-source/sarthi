import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Message } from '../models/Message.js';
import { UserProfile } from '../models/UserProfile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SEED_DIR = path.resolve(__dirname, '../seed');

/**
 * Idempotently seeds the master Message collection from messages.seed.json
 */
export async function seedMessages() {
  const filePath = path.join(SEED_DIR, 'messages.seed.json');
  if (!fs.existsSync(filePath)) {
    console.warn(`[CopySeeder] messages.seed.json not found at ${filePath}`);
    return 0;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const messages = parsed.messages || [];

  let count = 0;
  for (const msg of messages) {
    await Message.findOneAndUpdate(
      { id: msg.id },
      {
        $setOnInsert: {
          id: msg.id,
          text: msg.text,
          contexts: msg.contexts || [],
          tone: msg.tone || 'calm',
          patternTags: msg.patternTags || [],
          surfaces: msg.surfaces || [],
          cooldownDays: msg.cooldownDays ?? 3,
          maxPerWeek: msg.maxPerWeek ?? 3,
          conditions: msg.conditions || [],
          weight: msg.weight ?? 1.0
        }
      },
      { upsert: true, new: true }
    );
    count++;
  }

  return count;
}

/**
 * Idempotently seeds a user's initial UserProfile from profile.seed.json or profile.seed.example.json.
 * NEVER overwrites user-edited profile data.
 */
export async function seedUserProfile(userId) {
  if (!userId) return null;

  const existing = await UserProfile.findOne({ userId });
  if (existing) {
    return existing; // Preserve existing user customizations
  }

  const realPath = path.join(SEED_DIR, 'profile.seed.json');
  const examplePath = path.join(SEED_DIR, 'profile.seed.example.json');
  const targetPath = fs.existsSync(realPath) ? realPath : examplePath;

  if (!fs.existsSync(targetPath)) {
    console.warn(`[CopySeeder] No profile seed file found at ${targetPath}`);
    return null;
  }

  const raw = fs.readFileSync(targetPath, 'utf8');
  const data = JSON.parse(raw);

  const profile = await UserProfile.create({
    userId,
    challenge: data.challenge,
    patterns: data.patterns || [],
    strengths: data.strengths || [],
    evidence: data.evidence || [],
    streakRecords: data.streakRecords || [],
    voice: data.voice,
    why: data.why || '',
    streakRules: data.streakRules,
    rewardPrefs: data.rewardPrefs,
    blockGuardRules: data.blockGuardRules,
    hackathonRules: data.hackathonRules,
    fitness: data.fitness
  });

  return profile;
}
