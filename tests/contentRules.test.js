import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FORBIDDEN_PHRASES = [
  'you failed',
  'failed again',
  'even if you fail',
  'failure is fine',
  'failure is okay',
  'it\'s okay to fail',
  'wasted your life',
  'days wasted',
  'days behind',
  'behind schedule',
  'you are behind',
  'lazy',
  'no excuses',
  'you should be ashamed'
];

test('SARTHI Content Rule Enforcement — Copy Engine Verification', async (t) => {
  await t.test('1. messages.seed.json adheres strictly to anti-shame and psychological guardrails', () => {
    const messagesPath = path.join(ROOT_DIR, 'server', 'seed', 'messages.seed.json');
    assert.ok(fs.existsSync(messagesPath), 'messages.seed.json must exist');

    const content = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
    assert.ok(Array.isArray(content.messages), 'messages must be an array');

    for (const msg of content.messages) {
      const lowerText = msg.text.toLowerCase();
      for (const phrase of FORBIDDEN_PHRASES) {
        assert.ok(
          !lowerText.includes(phrase),
          `Message [${msg.id}] violates content rules with forbidden phrase "${phrase}": "${msg.text}"`
        );
      }
      
      // Ensure messages are concise (< 22 words)
      const wordCount = msg.text.split(/\s+/).length;
      assert.ok(
        wordCount <= 22,
        `Message [${msg.id}] exceeds target length (${wordCount} words): "${msg.text}"`
      );
    }
  });

  await t.test('2. Profile seed voice rules enforce forbidden topics and forbidden phrases', () => {
    const profilePath = path.join(ROOT_DIR, 'server', 'seed', 'profile.seed.json');
    const examplePath = path.join(ROOT_DIR, 'server', 'seed', 'profile.seed.example.json');
    const targetPath = fs.existsSync(profilePath) ? profilePath : examplePath;

    assert.ok(fs.existsSync(targetPath), 'Profile seed must exist');
    const profile = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    
    assert.ok(profile.voice, 'voice configuration must exist in profile');
    assert.ok(Array.isArray(profile.voice.forbiddenPhrases), 'forbiddenPhrases must be defined');
    assert.ok(profile.voice.forbiddenPhrases.length >= 10, 'must define comprehensive forbidden phrases');
    assert.ok(Array.isArray(profile.voice.forbiddenTopicsForAutoMessages), 'forbidden topics must be defined');
  });
});
