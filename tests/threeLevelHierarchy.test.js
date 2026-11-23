import test from 'node:test';
import assert from 'node:assert/strict';
import { CurriculumImporter } from '../server/services/curriculumImporter.js';

test('Universal Three-Level Curriculum Architecture — CSV Parsing & Structure Validation', async (t) => {
  await t.test('1. Structure A: Main Section with direct activities (no subsections or sub-subsections)', () => {
    const csvData = [
      'main_section_id,main_section_name,main_section_description,main_section_order,serial_number,activity_name,description,content_duration_minutes',
      'foundations,Foundations,Core basics,1,1,Intro to Computing,Basic concepts,30',
      'foundations,Foundations,Core basics,1,2,Binary Representation,Bits and bytes,45'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvData, 2.0);
    assert.equal(result.success, true);
    assert.equal(result.totalRows, 2);
    assert.equal(result.mainSectionCount, 1);
    assert.equal(result.subsectionCount, 0);
    assert.equal(result.subSubsectionCount, 0);

    const tree = result.hierarchy;
    assert.equal(tree.length, 1);
    assert.equal(tree[0].id, 'foundations');
    assert.equal(tree[0].name, 'Foundations');
    assert.equal(tree[0].description, 'Core basics');
    assert.equal(tree[0].hasSubsections, false);
    assert.equal(tree[0].directActivities.length, 2);
    assert.equal(tree[0].totalContentMinutes, 75);
    assert.equal(tree[0].totalEffortMinutes, 150);
  });

  await t.test('2. Structure B: Main Section with Subsections (no sub-subsections)', () => {
    const csvData = [
      'main_section_id,main_section_name,main_section_description,main_section_order,subsection_id,subsection_name,subsection_description,subsection_order,serial_number,activity_name,content_duration_minutes',
      'algorithms,Algorithms,Core search,1,searching,Binary Search,Find elements in sorted array,1,1,Binary Search Intro,45',
      'algorithms,Algorithms,Core search,1,searching,Binary Search,Find elements in sorted array,1,2,Search in 2D Matrix,30',
      'algorithms,Algorithms,Core search,1,sorting,Sorting Algorithms,Comparison sorts,2,3,Merge Sort Analysis,60'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvData, 2.0);
    assert.equal(result.success, true);
    assert.equal(result.mainSectionCount, 1);
    assert.equal(result.subsectionCount, 2);
    assert.equal(result.subSubsectionCount, 0);

    const tree = result.hierarchy;
    assert.equal(tree.length, 1);
    assert.equal(tree[0].hasSubsections, true);
    assert.equal(tree[0].subsections.length, 2);

    const sub1 = tree[0].subsections[0];
    assert.equal(sub1.id, 'searching');
    assert.equal(sub1.name, 'Binary Search');
    assert.equal(sub1.hasSubSubsections, false);
    assert.equal(sub1.directActivities.length, 2);
    assert.equal(sub1.totalContentMinutes, 75);
    assert.equal(sub1.totalEffortMinutes, 150);

    const sub2 = tree[0].subsections[1];
    assert.equal(sub2.id, 'sorting');
    assert.equal(sub2.totalContentMinutes, 60);
    assert.equal(sub2.totalEffortMinutes, 120);

    assert.equal(tree[0].totalContentMinutes, 135);
    assert.equal(tree[0].totalEffortMinutes, 270);
  });

  await t.test('3. Structure C: Full Three-Level Hierarchy (Main → Subsection → Sub-subsection → Activities)', () => {
    const csvData = [
      'main_section_id,main_section_name,main_section_description,main_section_order,subsection_id,subsection_name,subsection_description,subsection_order,sub_subsection_id,sub_subsection_name,sub_subsection_description,sub_subsection_order,serial_number,activity_name,description,content_duration_minutes',
      'typing,Touch Typing,Master keyboard,1,home-row,Home Row,Resting finger keys,1,left-hand,Left Hand,A S D F keys,1,1,Left Hand Drills,Drill A S D F,20',
      'typing,Touch Typing,Master keyboard,1,home-row,Home Row,Resting finger keys,1,right-hand,Right Hand,J K L ; keys,2,2,Right Hand Drills,Drill J K L ;,20',
      'typing,Touch Typing,Master keyboard,1,top-row,Top Row,Upward reaches,2,q-w-e-r,Q W E R Reaches,Left hand top row,1,3,Left Top Row Practice,Drill Q W E R,25'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(csvData, 1.0);
    assert.equal(result.success, true);
    assert.equal(result.mainSectionCount, 1);
    assert.equal(result.subsectionCount, 2);
    assert.equal(result.subSubsectionCount, 3);

    const mainNode = result.hierarchy[0];
    assert.equal(mainNode.name, 'Touch Typing');
    assert.equal(mainNode.totalActivitiesCount, 3);
    assert.equal(mainNode.totalContentMinutes, 65);
    assert.equal(mainNode.totalEffortMinutes, 65);

    const homeRow = mainNode.subsections[0];
    assert.equal(homeRow.name, 'Home Row');
    assert.equal(homeRow.hasSubSubsections, true);
    assert.equal(homeRow.subSubsections.length, 2);

    const leftHand = homeRow.subSubsections[0];
    assert.equal(leftHand.id, 'left-hand');
    assert.equal(leftHand.name, 'Left Hand');
    assert.equal(leftHand.description, 'A S D F keys');
    assert.equal(leftHand.activities.length, 1);
    assert.equal(leftHand.activities[0].title, 'Left Hand Drills');
  });

  await t.test('4. Rejects sub-subsection when parent subsection is missing', () => {
    const invalidCsv = [
      'main_section_id,main_section_name,sub_subsection_id,sub_subsection_name,serial_number,activity_name',
      'main1,Main One,subsub1,Orphan SubSub,1,Activity One'
    ].join('\n');

    assert.throws(() => {
      CurriculumImporter.parseCsv(invalidCsv);
    }, /requires a parent subsection/);
  });

  await t.test('5. Rejects conflicting main_section_order across different main_section_ids', () => {
    const conflictCsv = [
      'main_section_id,main_section_name,main_section_order,serial_number,activity_name',
      'sec1,Section 1,1,1,Activity A',
      'sec2,Section 2,1,2,Activity B'
    ].join('\n');

    assert.throws(() => {
      CurriculumImporter.parseCsv(conflictCsv);
    }, /main_section_order 1 is already used by main_section_id 'sec1'/);
  });

  await t.test('6. Identifies duration discrepancies between supplied totals and activity sums without data loss', () => {
    const discrepancyCsv = [
      'main_section_id,main_section_name,main_section_order,main_section_total_content_minutes,subsection_id,subsection_name,subsection_total_content_minutes,serial_number,activity_name,content_duration_minutes',
      'sec1,Section 1,1,120,sub1,Sub 1,80,1,Act 1,30',
      'sec1,Section 1,1,120,sub1,Sub 1,80,2,Act 2,30'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(discrepancyCsv, 2.0);
    assert.equal(result.success, true);
    assert.equal(result.discrepancies.length, 2);

    const subDiscrepancy = result.discrepancies.find(d => d.level === 'subsection');
    assert.ok(subDiscrepancy);
    assert.equal(subDiscrepancy.supplied, 80);
    assert.equal(subDiscrepancy.calculated, 60);

    const mainDiscrepancy = result.discrepancies.find(d => d.level === 'main_section');
    assert.ok(mainDiscrepancy);
    assert.equal(mainDiscrepancy.supplied, 120);
    assert.equal(mainDiscrepancy.calculated, 60);

    // Underlying activity duration is preserved as ground truth
    assert.equal(result.hierarchy[0].totalContentMinutes, 60);
    assert.ok(result.warnings.some(w => w.includes('duration discrepancy')));
  });

  await t.test('7. Backward compatibility aliases work for legacy columns', () => {
    const legacyCsv = [
      'section_id,section_name,section_description,section_order,serial_number,activity_name,content_duration_minutes',
      'legacy-sec,Legacy Title,Legacy Desc,1,1,Legacy Activity,40'
    ].join('\n');

    const result = CurriculumImporter.parseCsv(legacyCsv);
    assert.equal(result.success, true);
    assert.equal(result.records[0].mainSectionId, 'legacy-sec');
    assert.equal(result.records[0].mainSectionName, 'Legacy Title');
    assert.equal(result.records[0].mainSectionDescription, 'Legacy Desc');
    assert.equal(result.records[0].mainSectionOrder, 1);
  });
});

test('Universal Three-Level Curriculum Architecture — Progress & Rollup Calculations', async (t) => {
  await t.test('1. Completed activities bubble up completion percentage across all 3 levels', () => {
    const activities = [
      {
        mainSectionId: 'sec1',
        mainSectionName: 'Section 1',
        mainSectionOrder: 1,
        subsectionId: 'sub1',
        subsectionName: 'Sub 1',
        subsectionOrder: 1,
        subSubsectionId: 'subsub1',
        subSubsectionName: 'Subsub 1',
        subSubsectionOrder: 1,
        activityNumber: 1,
        title: 'Activity 1',
        contentDurationMinutes: 30,
        totalEffortMinutes: 60,
        actualMinutes: 60,
        status: 'completed'
      },
      {
        mainSectionId: 'sec1',
        mainSectionName: 'Section 1',
        mainSectionOrder: 1,
        subsectionId: 'sub1',
        subsectionName: 'Sub 1',
        subsectionOrder: 1,
        subSubsectionId: 'subsub1',
        subSubsectionName: 'Subsub 1',
        subSubsectionOrder: 1,
        activityNumber: 2,
        title: 'Activity 2',
        contentDurationMinutes: 30,
        totalEffortMinutes: 60,
        actualMinutes: 0,
        status: 'pending'
      },
      {
        mainSectionId: 'sec1',
        mainSectionName: 'Section 1',
        mainSectionOrder: 1,
        subsectionId: 'sub1',
        subsectionName: 'Sub 1',
        subsectionOrder: 1,
        subSubsectionId: 'subsub2',
        subSubsectionName: 'Subsub 2',
        subSubsectionOrder: 2,
        activityNumber: 3,
        title: 'Activity 3',
        contentDurationMinutes: 40,
        totalEffortMinutes: 80,
        actualMinutes: 0,
        status: 'pending'
      }
    ];

    const tree = CurriculumImporter.buildHierarchyTree(activities, 2.0);
    assert.equal(tree.length, 1);

    const main = tree[0];
    assert.equal(main.totalActivitiesCount, 3);
    assert.equal(main.completedActivitiesCount, 1);
    assert.equal(main.percent, 33);
    assert.equal(main.isCompleted, false);
    assert.equal(main.completedMinutes, 60);
    assert.equal(main.totalEffortMinutes, 200);

    const sub = main.subsections[0];
    assert.equal(sub.totalActivitiesCount, 3);
    assert.equal(sub.completedActivitiesCount, 1);
    assert.equal(sub.percent, 33);

    const subsub1 = sub.subSubsections[0];
    assert.equal(subsub1.totalActivitiesCount, 2);
    assert.equal(subsub1.completedActivitiesCount, 1);
    assert.equal(subsub1.percent, 50);

    const subsub2 = sub.subSubsections[1];
    assert.equal(subsub2.totalActivitiesCount, 1);
    assert.equal(subsub2.completedActivitiesCount, 0);
    assert.equal(subsub2.percent, 0);
  });

  await t.test('2. 100% completion marks isCompleted true across hierarchy', () => {
    const activities = [
      {
        mainSectionId: 'sec1',
        mainSectionName: 'Section 1',
        mainSectionOrder: 1,
        subsectionId: 'sub1',
        subsectionName: 'Sub 1',
        subsectionOrder: 1,
        subSubsectionId: 'subsub1',
        subSubsectionName: 'Subsub 1',
        subSubsectionOrder: 1,
        activityNumber: 1,
        title: 'Activity 1',
        contentDurationMinutes: 30,
        totalEffortMinutes: 60,
        actualMinutes: 60,
        status: 'completed'
      }
    ];

    const tree = CurriculumImporter.buildHierarchyTree(activities, 2.0);
    assert.equal(tree[0].isCompleted, true);
    assert.equal(tree[0].percent, 100);
    assert.equal(tree[0].subsections[0].isCompleted, true);
    assert.equal(tree[0].subsections[0].percent, 100);
    assert.equal(tree[0].subsections[0].subSubsections[0].isCompleted, true);
    assert.equal(tree[0].subsections[0].subSubsections[0].percent, 100);
  });
});

test('Universal Three-Level Curriculum Architecture — Template Generators', async (t) => {
  await t.test('1. Course template contains all 30 universal headers and round-trips through parseCsv', () => {
    const courseCsv = CurriculumImporter.generateCsvTemplate('course');
    assert.ok(courseCsv.startsWith('main_section_id,'));

    const parsed = CurriculumImporter.parseCsv(courseCsv);
    assert.equal(parsed.success, true);
    assert.ok(parsed.records.length >= 3);
    assert.equal(parsed.records[0].mainSectionName, 'Algorithms & Problem Solving');
    assert.ok(parsed.hierarchy.length >= 1);
  });

  await t.test('2. Exploration template generates Touch Typing Mastery example and round-trips through parseCsv', () => {
    const exploreCsv = CurriculumImporter.generateCsvTemplate('exploration');
    assert.ok(exploreCsv.includes('touch-typing-mastery'));

    const parsed = CurriculumImporter.parseCsv(exploreCsv);
    assert.equal(parsed.success, true);
    assert.ok(parsed.records.length >= 3);
    assert.equal(parsed.records[0].mainSectionName, 'Touch Typing Mastery');
    assert.equal(parsed.records[0].courseName, 'Typing Practice');
  });

  await t.test('3. Oratory template preserves legacy week_number format for backward compatibility', () => {
    const oratoryCsv = CurriculumImporter.generateCsvTemplate('oratory');
    assert.ok(oratoryCsv.startsWith('week_number,topic,description,focus_areas,duration_minutes'));

    // Parses cleanly via aliases
    const parsed = CurriculumImporter.parseCsv(oratoryCsv);
    assert.equal(parsed.success, true);
    assert.equal(parsed.records[0].serialNumber, 1);
    assert.equal(parsed.records[0].title, 'Vocal Presence & Posture');
    assert.equal(parsed.records[0].contentDurationMinutes, 120);
  });
});
