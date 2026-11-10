import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebDevMarkdown, parseDSAMarkdown, getOratoryWeeksSeed } from '../server/services/courseSeeder.js';

describe('SARTHI Course & Curricula Parser', () => {

  it('1. Web Development Parser: Extracts all 36 sections with accurate lectures', () => {
    const webdev = parseWebDevMarkdown();
    assert.ok(webdev, 'Web dev parsed data should not be null');
    assert.equal(webdev.slug, 'web-dev');
    assert.equal(webdev.sections.length, 36, 'Should extract exactly 36 sections');

    const totalLectures = webdev.sections.reduce((acc, s) => acc + s.lectures.length, 0);
    assert.ok(totalLectures >= 300, `Total lectures should be around 331, found ${totalLectures}`);

    // Check imported snapshot: Section 2 (1/1 done), Section 3 (3/3 done)
    const sec2 = webdev.sections.find(s => s.sectionNumber === 2);
    assert.ok(sec2 && sec2.lectures[0].isWatched, 'Section 2 should be marked done');

    const sec3 = webdev.sections.find(s => s.sectionNumber === 3);
    assert.ok(sec3 && sec3.lectures.every(l => l.isWatched), 'Section 3 should be marked done');
  });

  it('2. DSA Course Parser: Extracts all 136 lectures across 11 topic clusters', () => {
    const dsa = parseDSAMarkdown();
    assert.ok(dsa, 'DSA parsed data should not be null');
    assert.equal(dsa.slug, 'dsa');
    assert.equal(dsa.sections.length, 11, 'Should have 11 topic clusters');

    const totalLectures = dsa.sections.reduce((acc, s) => acc + s.lectures.length, 0);
    assert.equal(totalLectures, 136, 'Should extract exactly 136 lectures');

    // First lecture
    const lec1 = dsa.sections[0].lectures[0];
    assert.equal(lec1.lectureNumber, 1);
    assert.ok(lec1.videoDurationMinutes > 0, 'Lecture 1 should have parsed duration');
  });

  it('3. Oratory Program Seed: Provides all 13 weeks of progressive topics', () => {
    const weeks = getOratoryWeeksSeed();
    assert.equal(weeks.length, 13, 'Should have exactly 13 weeks');
    assert.equal(weeks[0].weekNumber, 1);
    assert.equal(weeks[0].topic, 'Who Am I Without Marks?');
    assert.equal(weeks[12].weekNumber, 13);
  });

});
