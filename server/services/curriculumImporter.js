import { sanitizeCsvValue } from '../middleware/sanitize.js';
import { CurriculumActivity } from '../models/CurriculumActivity.js';
import { Course } from '../models/Course.js';

const DEFAULT_MULTIPLIER = 2;
const TYPES = ['lecture', 'problem', 'project', 'reading', 'speech', 'exercise', 'exploration', 'research', 'practical'];
const slugify = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseRows(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (cell.length || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row); }
  return rows;
}

function validDate(value) { return !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))); }
function numberOrNull(value, field, row, min = 1) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) throw new Error(`Row ${row}: '${field}' must be a number of at least ${min}.`);
  return n;
}

export class CurriculumImporter {
  static get UNIVERSAL_HEADERS() {
    return [
      'main_section_id',
      'main_section_name',
      'main_section_description',
      'main_section_order',
      'main_section_total_content_minutes',
      'main_section_total_effort_minutes',
      'subsection_id',
      'subsection_name',
      'subsection_description',
      'subsection_order',
      'subsection_total_content_minutes',
      'subsection_total_effort_minutes',
      'sub_subsection_id',
      'sub_subsection_name',
      'sub_subsection_description',
      'sub_subsection_order',
      'sub_subsection_total_content_minutes',
      'sub_subsection_total_effort_minutes',
      'serial_number',
      'activity_name',
      'description',
      'content_duration_minutes',
      'estimated_execution_minutes',
      'activity_type',
      'priority',
      'dependencies',
      'optional_deadline',
      'notes',
      'course_name',
      'activity_multiplier_override'
    ];
  }

  static generateCsvTemplate(kind = 'course') {
    if (kind === 'oratory') {
      const headers = ['week_number', 'topic', 'description', 'focus_areas', 'duration_minutes'];
      const rows = [
        ['1', 'Vocal Presence & Posture', 'Diaphragmatic breathing and physical grounding', 'voice modulation, breathing', '120'],
        ['2', 'Hook & Opening 15 Seconds', 'Crafting provocative openers and rhetorical questions', 'speech structure, delivery', '120'],
        ['3', 'The Rule of Three', 'Using triads in rhetoric and powerful argumentation', 'structure, emphasis', '120']
      ];
      return [headers.join(','), ...rows.map(row => row.map(value => `"${sanitizeCsvValue(value).replace(/"/g, '""')}"`).join(','))].join('\n');
    }

    const headers = this.UNIVERSAL_HEADERS;
    const rows = kind === 'exploration'
      ? [
          [
            'touch-typing-mastery', 'Touch Typing Mastery', 'Master touch typing with all fingers to 60+ WPM without looking at the keyboard', '1', '90', '90',
            'home-row', 'Home Row Foundations', 'Learn the correct resting position of fingers and practise home-row keys', '1', '45', '45',
            'reference-keys', 'Reference Keys (F & J)', 'Locate tactical bumps and position pointer fingers', '1', '20', '20',
            '1', 'Practise F and J Positioning', 'Learn to identify home-row reference keys without looking', '20', '20', 'exploration', 'P3', '', '2026-12-04', 'TypingClub Stage 1', 'Typing Practice', '1.0'
          ],
          [
            'touch-typing-mastery', 'Touch Typing Mastery', 'Master touch typing with all fingers to 60+ WPM without looking at the keyboard', '1', '90', '90',
            'home-row', 'Home Row Foundations', 'Learn the correct resting position of fingers and practise home-row keys', '1', '45', '45',
            'left-hand-keys', 'Left Hand Keys (A S D F)', 'Practise pinky, ring, and middle finger home-row placement', '2', '25', '25',
            '2', 'Left Hand Accuracy Drills', 'Type A S D F sequences with rhythm and zero backspacing', '25', '25', 'exploration', 'P3', '1', '2026-12-04', 'TypingClub Stage 2', 'Typing Practice', '1.0'
          ],
          [
            'touch-typing-mastery', 'Touch Typing Mastery', 'Master touch typing with all fingers to 60+ WPM without looking at the keyboard', '1', '90', '90',
            'top-row', 'Top Row Navigation', 'Finger reaches for Q W E R T Y U I O P', '2', '45', '45',
            '', '', '', '', '', '',
            '3', 'Top Row Reaches', 'Practise upward reaches from home row resting position', '45', '45', 'exploration', 'P3', '2', '2026-12-04', 'TypingClub Stage 3', 'Typing Practice', '1.0'
          ]
        ]
      : [
          [
            'foundations', 'Algorithms & Problem Solving', 'Core data structures, search mechanics and asymptotic complexity', '1', '135', '270',
            'searching', 'Searching Techniques', 'Sequential, binary, and partition-based searching', '1', '75', '150',
            'binary-search-variations', 'Binary Search Variations', 'Modified binary search and boundary finding algorithms', '1', '75', '150',
            '1', 'Binary Search Fundamentals', 'Core concept and loop invariant template', '45', '90', 'problem', 'P1', '', '2026-12-01', 'LeetCode 704', 'Example Course', ''
          ],
          [
            'foundations', 'Algorithms & Problem Solving', 'Core data structures, search mechanics and asymptotic complexity', '1', '135', '270',
            'searching', 'Searching Techniques', 'Sequential, binary, and partition-based searching', '1', '75', '150',
            'binary-search-variations', 'Binary Search Variations', 'Modified binary search and boundary finding algorithms', '1', '75', '150',
            '2', 'Search in Rotated Sorted Array', 'Modified pivot detection and monotonic half checks', '30', '60', 'problem', 'P2', '1', '2026-12-02', 'LeetCode 33', 'Example Course', ''
          ],
          [
            'foundations', 'Algorithms & Problem Solving', 'Core data structures, search mechanics and asymptotic complexity', '1', '135', '270',
            'dynamic-programming', 'Dynamic Programming', 'State representation, memoization, and optimal substructure', '2', '60', '120',
            '', '', '', '', '', '',
            '3', '1D DP Foundations', 'Fibonacci numbers and climbing stairs with tabulation', '60', '120', 'lecture', 'P1', '', '2026-12-05', 'Tabulation pattern', 'Example Course', ''
          ]
        ];

    return [headers.join(','), ...rows.map(row => row.map(value => `"${sanitizeCsvValue(value).replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  static parseCsv(csvText, defaultMultiplier = DEFAULT_MULTIPLIER, options = {}) {
    if (typeof csvText !== 'string' || !csvText.trim()) throw new Error('CSV content is empty.');
    const rows = parseRows(csvText);
    if (rows.length < 2) throw new Error('CSV must contain a header row and at least one activity record.');
    const headers = rows[0].map(h => h.trim().toLowerCase());
    if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.');
    const map = new Map(headers.map((name, i) => [name, i]));

    // Register aliases for backward compatibility
    headers.forEach((name, i) => {
      // Main section aliases
      if ((name === 'section_id' || name === 'main_section') && !map.has('main_section_id')) map.set('main_section_id', i);
      if ((name === 'section_name' || name === 'section_title' || name === 'section') && !map.has('main_section_name')) map.set('main_section_name', i);
      if ((name === 'section_description' || name === 'main_description') && !map.has('main_section_description')) map.set('main_section_description', i);
      if (name === 'section_order' && !map.has('main_section_order')) map.set('main_section_order', i);
      if ((name === 'section_total_content_minutes' || name === 'section_content_minutes') && !map.has('main_section_total_content_minutes')) map.set('main_section_total_content_minutes', i);
      if ((name === 'section_total_effort_minutes' || name === 'section_effort_minutes') && !map.has('main_section_total_effort_minutes')) map.set('main_section_total_effort_minutes', i);

      // Activity aliases
      if ((name === 'week_number' || name === 'week' || name === 'activity_id' || name === 'activity_number') && !map.has('serial_number')) map.set('serial_number', i);
      if ((name === 'topic' || name === 'speech_topic' || name === 'title') && !map.has('activity_name')) map.set('activity_name', i);
      if ((name === 'duration_minutes' || name === 'duration') && !map.has('content_duration_minutes')) map.set('content_duration_minutes', i);
      if ((name === 'focus_areas' || name === 'skill' || name === 'primary_skill') && !map.has('notes')) map.set('notes', i);
      if (name === 'activity_description' && !map.has('description')) map.set('description', i);
    });

    for (const required of ['serial_number', 'activity_name']) {
      if (!map.has(required)) throw new Error(`Missing required CSV header column: '${required}'.`);
    }

    const get = (row, name) => { const i = map.get(name); return i === undefined ? '' : String(row[i] ?? '').trim(); };
    const records = [];
    const seenSerials = new Set();
    const errors = [];
    const warnings = [];
    const discrepancies = [];
    const courseNames = new Set();

    // Hierarchy tracker maps for consistency check
    const mainSectionsMap = new Map();
    const subsectionsMap = new Map();
    const subSubsectionsMap = new Map();

    let nextAutoMainOrder = 0;
    const autoMainOrders = new Map();
    let nextAutoSubOrder = 0;
    const autoSubOrders = new Map();
    let nextAutoSubSubOrder = 0;
    const autoSubSubOrders = new Map();

    const usedMainOrders = new Map();

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNum = i + 1;
      const serialRaw = get(row, 'serial_number');
      const title = get(row, 'activity_name');

      if (!serialRaw || !title) {
        errors.push(`Row ${rowNum}: serial_number and activity_name are required.`);
        continue;
      }
      const serialNumber = Number(serialRaw);
      if (!Number.isInteger(serialNumber) || serialNumber < 1) {
        errors.push(`Row ${rowNum}: serial_number must be a positive integer.`);
        continue;
      }
      if (seenSerials.has(serialNumber)) {
        warnings.push(`Row ${rowNum}: Duplicate serial number '${serialNumber}' detected; duplicate row skipped.`);
        continue;
      }
      seenSerials.add(serialNumber);

      const courseName = sanitizeCsvValue(get(row, 'course_name'));
      if (courseName) courseNames.add(courseName);

      // Level 1: Main Section
      const rawMainName = sanitizeCsvValue(get(row, 'main_section_name'));
      const rawMainId = sanitizeCsvValue(get(row, 'main_section_id'));
      const rawMainDesc = sanitizeCsvValue(get(row, 'main_section_description'));
      const mainSectionName = rawMainName || (rawMainId ? rawMainId : 'Activities');
      const mainSectionId = rawMainId || slugify(mainSectionName) || 'general';

      if (!autoMainOrders.has(mainSectionId)) autoMainOrders.set(mainSectionId, ++nextAutoMainOrder);
      const parsedMainOrder = numberOrNull(get(row, 'main_section_order'), 'main_section_order', rowNum);
      const mainSectionOrder = parsedMainOrder || autoMainOrders.get(mainSectionId);

      if (usedMainOrders.has(mainSectionOrder) && usedMainOrders.get(mainSectionOrder) !== mainSectionId) {
        errors.push(`Row ${rowNum}: main_section_order ${mainSectionOrder} is already used by main_section_id '${usedMainOrders.get(mainSectionOrder)}'.`);
      }
      usedMainOrders.set(mainSectionOrder, mainSectionId);

      const suppliedMainContent = numberOrNull(get(row, 'main_section_total_content_minutes'), 'main_section_total_content_minutes', rowNum, 0);
      const suppliedMainEffort = numberOrNull(get(row, 'main_section_total_effort_minutes'), 'main_section_total_effort_minutes', rowNum, 0);

      if (mainSectionsMap.has(mainSectionId)) {
        const existingMain = mainSectionsMap.get(mainSectionId);
        if (existingMain.name !== mainSectionName) {
          warnings.push(`Row ${rowNum}: main_section_id '${mainSectionId}' name '${mainSectionName}' differs from earlier '${existingMain.name}'.`);
        }
      } else {
        mainSectionsMap.set(mainSectionId, {
          id: mainSectionId,
          name: mainSectionName,
          description: rawMainDesc,
          order: mainSectionOrder,
          suppliedContent: suppliedMainContent,
          suppliedEffort: suppliedMainEffort
        });
      }

      // Level 2: Subsection
      const rawSubName = sanitizeCsvValue(get(row, 'subsection_name'));
      const rawSubId = sanitizeCsvValue(get(row, 'subsection_id'));
      const rawSubDesc = sanitizeCsvValue(get(row, 'subsection_description'));
      let subsectionId = null;
      let subsectionName = null;
      let subsectionDescription = '';
      let subsectionOrder = null;
      let suppliedSubContent = null;
      let suppliedSubEffort = null;

      if (rawSubId || rawSubName) {
        subsectionName = rawSubName || rawSubId;
        subsectionId = rawSubId || slugify(subsectionName);
        subsectionDescription = rawSubDesc;
        const subKey = `${mainSectionId}/${subsectionId}`;
        if (!autoSubOrders.has(subKey)) autoSubOrders.set(subKey, ++nextAutoSubOrder);
        const parsedSubOrder = numberOrNull(get(row, 'subsection_order'), 'subsection_order', rowNum);
        subsectionOrder = parsedSubOrder || autoSubOrders.get(subKey);

        suppliedSubContent = numberOrNull(get(row, 'subsection_total_content_minutes'), 'subsection_total_content_minutes', rowNum, 0);
        suppliedSubEffort = numberOrNull(get(row, 'subsection_total_effort_minutes'), 'subsection_total_effort_minutes', rowNum, 0);

        if (!subsectionsMap.has(subKey)) {
          subsectionsMap.set(subKey, {
            id: subsectionId,
            name: subsectionName,
            description: subsectionDescription,
            order: subsectionOrder,
            mainSectionId,
            suppliedContent: suppliedSubContent,
            suppliedEffort: suppliedSubEffort
          });
        }
      }

      // Level 3: Sub-subsection
      const rawSubSubName = sanitizeCsvValue(get(row, 'sub_subsection_name'));
      const rawSubSubId = sanitizeCsvValue(get(row, 'sub_subsection_id'));
      const rawSubSubDesc = sanitizeCsvValue(get(row, 'sub_subsection_description'));
      let subSubsectionId = null;
      let subSubsectionName = null;
      let subSubsectionDescription = '';
      let subSubsectionOrder = null;
      let suppliedSubSubContent = null;
      let suppliedSubSubEffort = null;

      if (rawSubSubId || rawSubSubName) {
        // Validation: If sub-subsection exists, its parent subsection must exist
        if (!subsectionId) {
          errors.push(`Row ${rowNum}: sub_subsection '${rawSubSubName || rawSubSubId}' requires a parent subsection. A sub-subsection cannot belong directly to a main section.`);
        } else {
          subSubsectionName = rawSubSubName || rawSubSubId;
          subSubsectionId = rawSubSubId || slugify(subSubsectionName);
          subSubsectionDescription = rawSubSubDesc;
          const subSubKey = `${mainSectionId}/${subsectionId}/${subSubsectionId}`;
          if (!autoSubSubOrders.has(subSubKey)) autoSubSubOrders.set(subSubKey, ++nextAutoSubSubOrder);
          const parsedSubSubOrder = numberOrNull(get(row, 'sub_subsection_order'), 'sub_subsection_order', rowNum);
          subSubsectionOrder = parsedSubSubOrder || autoSubSubOrders.get(subSubKey);

          suppliedSubSubContent = numberOrNull(get(row, 'sub_subsection_total_content_minutes'), 'sub_subsection_total_content_minutes', rowNum, 0);
          suppliedSubSubEffort = numberOrNull(get(row, 'sub_subsection_total_effort_minutes'), 'sub_subsection_total_effort_minutes', rowNum, 0);

          if (!subSubsectionsMap.has(subSubKey)) {
            subSubsectionsMap.set(subSubKey, {
              id: subSubsectionId,
              name: subSubsectionName,
              description: subSubsectionDescription,
              order: subSubsectionOrder,
              subsectionId,
              mainSectionId,
              suppliedContent: suppliedSubSubContent,
              suppliedEffort: suppliedSubSubEffort
            });
          }
        }
      }

      // Activity Details
      const contentDurationMinutes = numberOrNull(get(row, 'content_duration_minutes'), 'content_duration_minutes', rowNum, 0) || 0;
      const rawOverride = get(row, 'activity_multiplier_override');
      const activityMultiplierOverride = numberOrNull(rawOverride, 'activity_multiplier_override', rowNum, 0.1);
      const legacyEffort = numberOrNull(get(row, 'estimated_execution_minutes'), 'estimated_execution_minutes', rowNum, 1);
      const priorityRaw = get(row, 'priority').toUpperCase();
      if (priorityRaw && !['P1', 'P2', 'P3'].includes(priorityRaw)) {
        warnings.push(`Row ${rowNum}: invalid priority '${priorityRaw}' will use P2.`);
      }
      const deadline = get(row, 'optional_deadline');
      if (!validDate(deadline)) errors.push(`Row ${rowNum}: optional_deadline must use YYYY-MM-DD.`);
      const deps = get(row, 'dependencies').split(/[;|]/).map(x => x.trim()).filter(Boolean);
      for (const dep of deps) {
        if (!/^\d+$/.test(dep) || Number(dep) === serialNumber) {
          errors.push(`Row ${rowNum}: invalid dependency reference '${dep}'.`);
        }
      }
      if (legacyEffort && !activityMultiplierOverride) {
        warnings.push(`Row ${rowNum}: legacy estimated_execution_minutes is treated as an explicit activity effort override. Remove it to use the course multiplier.`);
      }
      const type = get(row, 'activity_type').toLowerCase() || 'lecture';

      records.push({
        serialNumber,
        activityId: get(row, 'activity_id') || String(serialNumber),
        courseName,
        // Main Section
        mainSectionId,
        mainSectionName,
        mainSectionDescription: rawMainDesc || mainSectionsMap.get(mainSectionId)?.description || '',
        mainSectionOrder,
        mainSectionTotalContentMinutes: suppliedMainContent,
        mainSectionTotalEffortMinutes: suppliedMainEffort,
        // Backward-compatibility aliases
        sectionId: mainSectionId,
        sectionName: mainSectionName,
        sectionOrder: mainSectionOrder,
        // Subsection
        subsectionId,
        subsectionName,
        subsectionDescription,
        subsectionOrder,
        subsectionTotalContentMinutes: suppliedSubContent,
        subsectionTotalEffortMinutes: suppliedSubEffort,
        // Sub-subsection
        subSubsectionId,
        subSubsectionName,
        subSubsectionDescription,
        subSubsectionOrder,
        subSubsectionTotalContentMinutes: suppliedSubSubContent,
        subSubsectionTotalEffortMinutes: suppliedSubSubEffort,
        // Activity Details
        title: sanitizeCsvValue(title),
        description: sanitizeCsvValue(get(row, 'description')),
        contentDurationMinutes,
        activityType: TYPES.includes(type) ? type : 'lecture',
        priority: ['P1', 'P2', 'P3'].includes(priorityRaw) ? priorityRaw : 'P2',
        dependencies: deps,
        deadline: deadline || null,
        notes: sanitizeCsvValue(get(row, 'notes')),
        activityMultiplierOverride,
        legacyEffortOverride: legacyEffort || null
      });
    }

    if (courseNames.size > 1) {
      errors.push('All course_name values in one import must identify the same course.');
    }

    const existing = new Set((options.existingActivityNumbers || []).map(Number));
    for (const record of records) {
      for (const dep of record.dependencies) {
        if (!seenSerials.has(Number(dep)) && !existing.has(Number(dep))) {
          errors.push(`Activity ${record.serialNumber}: dependency '${dep}' is not present in this CSV or existing course.`);
        }
      }
    }

    if (errors.length) throw new Error(errors.join('\n'));

    const multiplier = Number(defaultMultiplier) > 0 ? Number(defaultMultiplier) : DEFAULT_MULTIPLIER;
    for (const rec of records) {
      const effective = rec.activityMultiplierOverride ?? multiplier;
      rec.practiceMultiplier = effective;
      const rawEffort = rec.activityMultiplierOverride != null
        ? rec.contentDurationMinutes * effective
        : rec.legacyEffortOverride ?? rec.contentDurationMinutes * effective;
      rec.estimatedExecutionMinutes = Math.round(rawEffort * 100) / 100;
      rec.effortSource = rec.activityMultiplierOverride != null
        ? 'activity-override'
        : rec.legacyEffortOverride != null
          ? 'legacy-effort-override'
          : 'course-multiplier';
    }

    // Build hierarchical tree and validate aggregate duration discrepancies
    const hierarchy = this.buildHierarchyTree(records, multiplier);

    // Verify aggregate discrepancies across every node
    for (const sec of hierarchy) {
      if (sec.suppliedContentMinutes !== null && Math.abs(sec.suppliedContentMinutes - sec.totalContentMinutes) > 0.01) {
        discrepancies.push({
          level: 'main_section',
          id: sec.id,
          name: sec.name,
          field: 'content_duration',
          supplied: sec.suppliedContentMinutes,
          calculated: sec.totalContentMinutes,
          message: `Main Section "${sec.name}" supplied ${sec.suppliedContentMinutes}m content duration, but underlying activities sum to ${sec.totalContentMinutes}m.`
        });
      }
      if (sec.suppliedEffortMinutes !== null && Math.abs(sec.suppliedEffortMinutes - sec.totalEffortMinutes) > 0.01) {
        discrepancies.push({
          level: 'main_section',
          id: sec.id,
          name: sec.name,
          field: 'effort',
          supplied: sec.suppliedEffortMinutes,
          calculated: sec.totalEffortMinutes,
          message: `Main Section "${sec.name}" supplied ${sec.suppliedEffortMinutes}m personal effort, but underlying activities sum to ${sec.totalEffortMinutes}m.`
        });
      }

      for (const sub of sec.subsections) {
        if (sub.suppliedContentMinutes !== null && Math.abs(sub.suppliedContentMinutes - sub.totalContentMinutes) > 0.01) {
          discrepancies.push({
            level: 'subsection',
            id: sub.id,
            name: sub.name,
            field: 'content_duration',
            supplied: sub.suppliedContentMinutes,
            calculated: sub.totalContentMinutes,
            message: `Subsection "${sub.name}" supplied ${sub.suppliedContentMinutes}m content duration, but underlying activities sum to ${sub.totalContentMinutes}m.`
          });
        }
        if (sub.suppliedEffortMinutes !== null && Math.abs(sub.suppliedEffortMinutes - sub.totalEffortMinutes) > 0.01) {
          discrepancies.push({
            level: 'subsection',
            id: sub.id,
            name: sub.name,
            field: 'effort',
            supplied: sub.suppliedEffortMinutes,
            calculated: sub.totalEffortMinutes,
            message: `Subsection "${sub.name}" supplied ${sub.suppliedEffortMinutes}m personal effort, but underlying activities sum to ${sub.totalEffortMinutes}m.`
          });
        }

        for (const subsub of sub.subSubsections) {
          if (subsub.suppliedContentMinutes !== null && Math.abs(subsub.suppliedContentMinutes - subsub.totalContentMinutes) > 0.01) {
            discrepancies.push({
              level: 'sub_subsection',
              id: subsub.id,
              name: subsub.name,
              field: 'content_duration',
              supplied: subsub.suppliedContentMinutes,
              calculated: subsub.totalContentMinutes,
              message: `Sub-subsection "${subsub.name}" supplied ${subsub.suppliedContentMinutes}m content duration, but underlying activities sum to ${subsub.totalContentMinutes}m.`
            });
          }
          if (subsub.suppliedEffortMinutes !== null && Math.abs(subsub.suppliedEffortMinutes - subsub.totalEffortMinutes) > 0.01) {
            discrepancies.push({
              level: 'sub_subsection',
              id: subsub.id,
              name: subsub.name,
              field: 'effort',
              supplied: subsub.suppliedEffortMinutes,
              calculated: subsub.totalEffortMinutes,
              message: `Sub-subsection "${subsub.name}" supplied ${subsub.suppliedEffortMinutes}m personal effort, but underlying activities sum to ${subsub.totalEffortMinutes}m.`
            });
          }
        }
      }
    }

    if (discrepancies.length > 0) {
      warnings.push(`Detected ${discrepancies.length} duration discrepancy(ies) between supplied totals and activity sums. Underlying activities are preserved as the ground truth.`);
    }

    return {
      success: true,
      totalRows: records.length,
      records,
      warnings,
      discrepancies,
      hierarchy,
      courseName: [...courseNames][0] || '',
      mainSectionCount: mainSectionsMap.size,
      subsectionCount: subsectionsMap.size,
      subSubsectionCount: subSubsectionsMap.size,
      sectionCount: mainSectionsMap.size, // backward compatibility
      effectiveMultiplier: multiplier
    };
  }

  static buildHierarchyTree(activitiesOrRecords = [], defaultMultiplier = DEFAULT_MULTIPLIER) {
    const mainSectionMap = new Map();

    for (const item of activitiesOrRecords) {
      const mainId = item.mainSectionId || item.sectionId || 'general';
      const mainName = item.mainSectionName || item.sectionTitle || 'Activities';
      const mainDesc = item.mainSectionDescription || '';
      const mainOrder = Number(item.mainSectionOrder || item.sectionNumber) || 1;
      const suppMainContent = item.mainSectionTotalContentMinutes ?? null;
      const suppMainEffort = item.mainSectionTotalEffortMinutes ?? null;

      if (!mainSectionMap.has(mainId)) {
        mainSectionMap.set(mainId, {
          id: mainId,
          name: mainName,
          description: mainDesc,
          order: mainOrder,
          suppliedContentMinutes: suppMainContent,
          suppliedEffortMinutes: suppMainEffort,
          totalContentMinutes: 0,
          totalEffortMinutes: 0,
          completedMinutes: 0,
          completedActivitiesCount: 0,
          totalActivitiesCount: 0,
          hasSubsections: false,
          directActivities: [],
          subsectionsMap: new Map()
        });
      }
      const mainNode = mainSectionMap.get(mainId);
      if (!mainNode.description && mainDesc) mainNode.description = mainDesc;

      const subId = item.subsectionId || null;
      const subName = item.subsectionName || '';
      const subDesc = item.subsectionDescription || '';
      const subOrder = item.subsectionOrder !== null && item.subsectionOrder !== undefined ? Number(item.subsectionOrder) : null;
      const suppSubContent = item.subsectionTotalContentMinutes ?? null;
      const suppSubEffort = item.subsectionTotalEffortMinutes ?? null;

      const subSubId = item.subSubsectionId || null;
      const subSubName = item.subSubsectionName || '';
      const subSubDesc = item.subSubsectionDescription || '';
      const subSubOrder = item.subSubsectionOrder !== null && item.subSubsectionOrder !== undefined ? Number(item.subSubsectionOrder) : null;
      const suppSubSubContent = item.subSubsectionTotalContentMinutes ?? null;
      const suppSubSubEffort = item.subSubsectionTotalEffortMinutes ?? null;

      const actContentMin = Math.round(item.contentDurationMinutes || 0);
      const mult = Number(item.activityMultiplierOverride || item.practiceMultiplier || defaultMultiplier) || DEFAULT_MULTIPLIER;
      const actEffortMin = Math.round(item.estimatedExecutionMinutes || item.totalEffortMinutes || (actContentMin ? actContentMin * mult : 45));
      const isCompleted = item.status === 'completed' || (item.isWatched && item.isCodeDone);
      const actualMin = Math.round(item.actualMinutes || (isCompleted ? actEffortMin : 0));

      // Structure A: Direct Activities under Main Section
      if (!subId && !subName) {
        mainNode.directActivities.push(item);
      } else {
        mainNode.hasSubsections = true;
        const subKey = subId || slugify(subName);
        if (!mainNode.subsectionsMap.has(subKey)) {
          mainNode.subsectionsMap.set(subKey, {
            id: subKey,
            name: subName || subKey,
            description: subDesc,
            order: subOrder || (mainNode.subsectionsMap.size + 1),
            suppliedContentMinutes: suppSubContent,
            suppliedEffortMinutes: suppSubEffort,
            totalContentMinutes: 0,
            totalEffortMinutes: 0,
            completedMinutes: 0,
            completedActivitiesCount: 0,
            totalActivitiesCount: 0,
            hasSubSubsections: false,
            directActivities: [],
            subSubsectionsMap: new Map()
          });
        }
        const subNode = mainNode.subsectionsMap.get(subKey);
        if (!subNode.description && subDesc) subNode.description = subDesc;

        // Structure B: Direct Activities under Subsection
        if (!subSubId && !subSubName) {
          subNode.directActivities.push(item);
        } else {
          // Structure C: Activities under Sub-subsection
          subNode.hasSubSubsections = true;
          const subSubKey = subSubId || slugify(subSubName);
          if (!subNode.subSubsectionsMap.has(subSubKey)) {
            subNode.subSubsectionsMap.set(subSubKey, {
              id: subSubKey,
              name: subSubName || subSubKey,
              description: subSubDesc,
              order: subSubOrder || (subNode.subSubsectionsMap.size + 1),
              suppliedContentMinutes: suppSubSubContent,
              suppliedEffortMinutes: suppSubSubEffort,
              totalContentMinutes: 0,
              totalEffortMinutes: 0,
              completedMinutes: 0,
              completedActivitiesCount: 0,
              totalActivitiesCount: 0,
              activities: []
            });
          }
          const subSubNode = subNode.subSubsectionsMap.get(subSubKey);
          if (!subSubNode.description && subSubDesc) subSubNode.description = subSubDesc;
          subSubNode.activities.push(item);

          subSubNode.totalContentMinutes += actContentMin;
          subSubNode.totalEffortMinutes += actEffortMin;
          subSubNode.totalActivitiesCount += 1;
          if (isCompleted) {
            subSubNode.completedActivitiesCount += 1;
            subSubNode.completedMinutes += actualMin;
          }
        }

        subNode.totalContentMinutes += actContentMin;
        subNode.totalEffortMinutes += actEffortMin;
        subNode.totalActivitiesCount += 1;
        if (isCompleted) {
          subNode.completedActivitiesCount += 1;
          subNode.completedMinutes += actualMin;
        }
      }

      mainNode.totalContentMinutes += actContentMin;
      mainNode.totalEffortMinutes += actEffortMin;
      mainNode.totalActivitiesCount += 1;
      if (isCompleted) {
        mainNode.completedActivitiesCount += 1;
        mainNode.completedMinutes += actualMin;
      }
    }

    // Convert Maps to sorted arrays and compute completion percentages
    const result = [];
    const sortedMain = [...mainSectionMap.values()].sort((a, b) => a.order - b.order);

    for (const m of sortedMain) {
      m.percent = m.totalActivitiesCount > 0 ? Math.round((m.completedActivitiesCount / m.totalActivitiesCount) * 100) : 0;
      m.isCompleted = m.totalActivitiesCount > 0 && m.completedActivitiesCount === m.totalActivitiesCount;

      m.subsections = [...m.subsectionsMap.values()].sort((a, b) => a.order - b.order);
      delete m.subsectionsMap;

      for (const s of m.subsections) {
        s.percent = s.totalActivitiesCount > 0 ? Math.round((s.completedActivitiesCount / s.totalActivitiesCount) * 100) : 0;
        s.isCompleted = s.totalActivitiesCount > 0 && s.completedActivitiesCount === s.totalActivitiesCount;

        s.subSubsections = [...s.subSubsectionsMap.values()].sort((a, b) => a.order - b.order);
        delete s.subSubsectionsMap;

        for (const ss of s.subSubsections) {
          ss.percent = ss.totalActivitiesCount > 0 ? Math.round((ss.completedActivitiesCount / ss.totalActivitiesCount) * 100) : 0;
          ss.isCompleted = ss.totalActivitiesCount > 0 && ss.completedActivitiesCount === ss.totalActivitiesCount;
        }
      }

      result.push(m);
    }

    return result;
  }

  static async commitImport({ userId, courseSlug, courseTitle, emoji, instructor = '', records = [], defaultMultiplier = DEFAULT_MULTIPLIER, category = 'course' }) {
    if (!userId || !courseSlug || !records.length) throw new Error('User, course slug and at least one record are required for commit.');
    let course = await Course.findOne({ userId, slug: courseSlug });
    if (!course) {
      course = await Course.create({
        userId,
        slug: courseSlug,
        title: courseTitle || courseSlug.toUpperCase(),
        emoji: emoji || (category === 'exploration' ? '🔬' : '📚'),
        instructor,
        category,
        defaultPracticeMultiplier: defaultMultiplier,
        sections: []
      });
    } else if (emoji && (!course.emoji || course.emoji === '📚')) {
      course.emoji = emoji;
    }
    const multiplier = Number(course.defaultPracticeMultiplier) > 0 ? Number(course.defaultPracticeMultiplier) : Number(defaultMultiplier) || DEFAULT_MULTIPLIER;

    // Fast batch pre-fetch
    const existingActivities = await CurriculumActivity.find({ userId, courseSlug });
    const existingMap = new Map(existingActivities.map(a => [a.activityNumber, a]));

    let createdCount = 0;
    let updatedCount = 0;
    const bulkOps = [];

    for (const rec of records) {
      const existing = existingMap.get(rec.serialNumber);
      const activityMultiplier = Number(rec.activityMultiplierOverride) > 0 ? Number(rec.activityMultiplierOverride) : multiplier;
      const rawEffort = rec.activityMultiplierOverride != null
        ? (rec.contentDurationMinutes || 0) * activityMultiplier
        : rec.legacyEffortOverride ?? (rec.contentDurationMinutes || 0) * multiplier;
      const effort = Math.round(rawEffort * 100) / 100;

      const mainSectionId = rec.mainSectionId || rec.sectionId || 'general';
      const mainSectionName = rec.mainSectionName || rec.sectionName || 'Activities';
      const mainSectionOrder = rec.mainSectionOrder || rec.sectionOrder || 1;
      const mainSectionDescription = rec.mainSectionDescription || '';

      if (existing) {
        updatedCount += 1;
        const updateFields = {
          title: rec.title,
          description: rec.description || '',
          // Level 1: Main Section
          mainSectionId,
          mainSectionName,
          mainSectionDescription,
          mainSectionOrder,
          mainSectionTotalContentMinutes: rec.mainSectionTotalContentMinutes || 0,
          mainSectionTotalEffortMinutes: rec.mainSectionTotalEffortMinutes || 0,
          // Synced legacy section fields
          sectionNumber: mainSectionOrder,
          sectionId: mainSectionId,
          sectionTitle: mainSectionName,
          // Level 2: Subsection
          subsectionId: rec.subsectionId || null,
          subsectionName: rec.subsectionName || '',
          subsectionDescription: rec.subsectionDescription || '',
          subsectionOrder: rec.subsectionOrder || null,
          subsectionTotalContentMinutes: rec.subsectionTotalContentMinutes || 0,
          subsectionTotalEffortMinutes: rec.subsectionTotalEffortMinutes || 0,
          // Level 3: Sub-subsection
          subSubsectionId: rec.subSubsectionId || null,
          subSubsectionName: rec.subSubsectionName || '',
          subSubsectionDescription: rec.subSubsectionDescription || '',
          subSubsectionOrder: rec.subSubsectionOrder || null,
          subSubsectionTotalContentMinutes: rec.subSubsectionTotalContentMinutes || 0,
          subSubsectionTotalEffortMinutes: rec.subSubsectionTotalEffortMinutes || 0,
          // Activity Details
          contentDurationMinutes: rec.contentDurationMinutes || 0,
          dependencies: rec.dependencies || [],
          activityMultiplierOverride: rec.activityMultiplierOverride || null,
          activityEffortOverrideMinutes: rec.legacyEffortOverride || null,
          practiceMultiplier: activityMultiplier,
          activityType: rec.activityType,
          priority: rec.priority,
          notes: rec.notes || '',
          updatedAt: new Date()
        };
        if (rec.deadline) updateFields.deadline = rec.deadline;
        // Preserve completed status, remaining minutes and actual minutes
        if (existing.status !== 'completed') {
          updateFields.totalEffortMinutes = effort;
          updateFields.remainingMinutes = Math.max(0, Math.round((effort - (existing.actualMinutes || 0)) * 100) / 100);
        }
        bulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: updateFields }
          }
        });
      } else {
        createdCount += 1;
        bulkOps.push({
          insertOne: {
            document: {
              userId,
              courseSlug,
              courseTitle: course.title,
              // Level 1: Main Section
              mainSectionId,
              mainSectionName,
              mainSectionDescription,
              mainSectionOrder,
              mainSectionTotalContentMinutes: rec.mainSectionTotalContentMinutes || 0,
              mainSectionTotalEffortMinutes: rec.mainSectionTotalEffortMinutes || 0,
              // Synced legacy section fields
              sectionNumber: mainSectionOrder,
              sectionId: mainSectionId,
              sectionTitle: mainSectionName,
              // Level 2: Subsection
              subsectionId: rec.subsectionId || null,
              subsectionName: rec.subsectionName || '',
              subsectionDescription: rec.subsectionDescription || '',
              subsectionOrder: rec.subsectionOrder || null,
              subsectionTotalContentMinutes: rec.subsectionTotalContentMinutes || 0,
              subsectionTotalEffortMinutes: rec.subsectionTotalEffortMinutes || 0,
              // Level 3: Sub-subsection
              subSubsectionId: rec.subSubsectionId || null,
              subSubsectionName: rec.subSubsectionName || '',
              subSubsectionDescription: rec.subSubsectionDescription || '',
              subSubsectionOrder: rec.subSubsectionOrder || null,
              subSubsectionTotalContentMinutes: rec.subSubsectionTotalContentMinutes || 0,
              subSubsectionTotalEffortMinutes: rec.subSubsectionTotalEffortMinutes || 0,
              // Activity Details
              activityNumber: rec.serialNumber,
              externalActivityId: rec.activityId || String(rec.serialNumber),
              title: rec.title,
              description: rec.description || '',
              contentDurationMinutes: rec.contentDurationMinutes || 0,
              practiceMultiplier: activityMultiplier,
              activityMultiplierOverride: rec.activityMultiplierOverride || null,
              activityEffortOverrideMinutes: rec.legacyEffortOverride || null,
              dependencies: rec.dependencies || [],
              totalEffortMinutes: effort,
              remainingMinutes: effort,
              actualMinutes: 0,
              activityType: rec.activityType,
              priority: rec.priority,
              deadline: rec.deadline || null,
              notes: rec.notes || '',
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await CurriculumActivity.bulkWrite(bulkOps, { ordered: false });
    }

    const activities = await CurriculumActivity.find({ userId, courseSlug });
    course.totalLectures = activities.length;
    course.completedLectures = activities.filter(a => a.status === 'completed').length;
    course.totalMinutes = Math.round(activities.reduce((s, a) => s + (a.totalEffortMinutes || 0), 0) * 10) / 10;
    course.completedMinutes = Math.round(activities.filter(a => a.status === 'completed').reduce((s, a) => s + (a.actualMinutes || a.totalEffortMinutes || 0), 0) * 10) / 10;
    if (course.totalLectures > 0 && course.completedLectures >= course.totalLectures) {
      course.status = 'archived';
    } else if (course.status === 'archived' && course.completedLectures < course.totalLectures) {
      course.status = 'active';
    }
    await course.save();

    const hierarchy = this.buildHierarchyTree(activities, multiplier);

    return {
      success: true,
      courseSlug,
      createdCount,
      updatedCount,
      totalActivities: records.length,
      hierarchy,
      courseProgress: {
        totalLectures: course.totalLectures,
        completedLectures: course.completedLectures,
        percent: Math.round((course.completedLectures / (course.totalLectures || 1)) * 100)
      }
    };
  }

  static async previewDiff({ userId, courseSlug, records = [] }) {
    const existingActivities = await CurriculumActivity.find({ userId, courseSlug });
    const map = new Map(existingActivities.map(a => [a.activityNumber, a]));
    const incoming = new Set();
    const newActivities = [];
    const modifiedActivities = [];
    const unchangedActivities = [];
    const protectedCompleted = [];

    const existingMainSecs = new Set(existingActivities.map(a => a.mainSectionId || a.sectionId || 'general'));
    const existingSubSecs = new Set(existingActivities.filter(a => a.subsectionId).map(a => `${a.mainSectionId || a.sectionId || 'general'}/${a.subsectionId}`));
    const existingSubSubSecs = new Set(existingActivities.filter(a => a.subSubsectionId).map(a => `${a.mainSectionId || a.sectionId || 'general'}/${a.subsectionId}/${a.subSubsectionId}`));

    const incomingMainSecs = new Set();
    const incomingSubSecs = new Set();
    const incomingSubSubSecs = new Set();

    for (const rec of records) {
      incoming.add(rec.serialNumber);
      const mainId = rec.mainSectionId || rec.sectionId || 'general';
      incomingMainSecs.add(mainId);
      if (rec.subsectionId) incomingSubSecs.add(`${mainId}/${rec.subsectionId}`);
      if (rec.subSubsectionId) incomingSubSubSecs.add(`${mainId}/${rec.subsectionId}/${rec.subSubsectionId}`);

      const old = map.get(rec.serialNumber);
      if (!old) {
        newActivities.push({
          serialNumber: rec.serialNumber,
          title: rec.title,
          effortMinutes: rec.estimatedExecutionMinutes,
          section: rec.mainSectionName || rec.sectionName,
          subsection: rec.subsectionName,
          subSubsection: rec.subSubsectionName
        });
        continue;
      }

      const changes = [];
      if (old.title !== rec.title) changes.push(`Title: "${old.title}" → "${rec.title}"`);
      if ((old.mainSectionId || old.sectionId || '') !== (mainId || '') || old.mainSectionOrder !== (rec.mainSectionOrder || 1)) {
        changes.push('Main section placement changed');
      }
      if ((old.subsectionId || '') !== (rec.subsectionId || '')) changes.push('Subsection placement changed');
      if ((old.subSubsectionId || '') !== (rec.subSubsectionId || '')) changes.push('Sub-subsection placement changed');
      if (old.status !== 'completed' && old.totalEffortMinutes !== rec.estimatedExecutionMinutes) {
        changes.push(`Effort: ${old.totalEffortMinutes}m → ${rec.estimatedExecutionMinutes}m`);
      }
      if (old.priority !== rec.priority) changes.push(`Priority: ${old.priority} → ${rec.priority}`);

      if (changes.length) {
        modifiedActivities.push({
          serialNumber: rec.serialNumber,
          title: rec.title,
          isCompleted: old.status === 'completed',
          actualMinutes: old.actualMinutes,
          changes
        });
      } else {
        unchangedActivities.push({ serialNumber: rec.serialNumber, title: rec.title });
      }

      if (old.status === 'completed') {
        protectedCompleted.push({
          serialNumber: old.activityNumber,
          title: old.title,
          completedAt: old.completedAt
        });
      }
    }

    const missingFromCsv = existingActivities
      .filter(a => !incoming.has(a.activityNumber))
      .map(a => ({ serialNumber: a.activityNumber, title: a.title, status: a.status, actualMinutes: a.actualMinutes }));

    let newSectionsCount = 0;
    for (const m of incomingMainSecs) if (!existingMainSecs.has(m)) newSectionsCount++;
    let newSubsectionsCount = 0;
    for (const s of incomingSubSecs) if (!existingSubSecs.has(s)) newSubsectionsCount++;
    let newSubSubsectionsCount = 0;
    for (const ss of incomingSubSubSecs) if (!existingSubSubSecs.has(ss)) newSubSubsectionsCount++;

    const hierarchy = this.buildHierarchyTree(records);

    return {
      success: true,
      courseSlug,
      totalIncoming: records.length,
      existingCount: existingActivities.length,
      newCount: newActivities.length,
      modifiedCount: modifiedActivities.length,
      unchangedCount: unchangedActivities.length,
      missingCount: missingFromCsv.length,
      protectedCompletedCount: protectedCompleted.length,
      newSectionsCount,
      newSubsectionsCount,
      newSubSubsectionsCount,
      hierarchy,
      diff: {
        newActivities,
        modifiedActivities,
        unchangedActivities,
        missingFromCsv,
        protectedCompleted
      }
    };
  }

  static async commitCourse(params) {
    return this.commitImport(params);
  }
}
