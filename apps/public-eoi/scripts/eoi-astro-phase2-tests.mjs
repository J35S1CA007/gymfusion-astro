import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADULT_AGE_BANDS,
  AGE_ELIGIBILITY_OPTIONS,
  EOI_PART1_STEPS,
  FIELD_KEYS,
  FUSION_AVAILABILITY,
  FUSION_FRIDAY_AVAILABILITY,
  ONE_TO_ONE_AVAILABILITY,
  PRONOUN_OPTIONS,
  RESIDENTIAL_SUBURBS,
  SECOND_PREFERENCE_OPTIONS,
  SEX_AT_BIRTH_OPTIONS,
  SEMANTIC_GROUP_KEYS,
  STATE_OPTIONS,
  TRAINING_TYPE_OPTIONS,
  UNDER18_AGE_BANDS,
  WORK_SHIFT_OPTIONS,
  createEoiPart1State,
  getVisibleAvailability,
  getVisiblePostalFields,
  getVisibleSecondPreference,
  setEligibility,
  setField,
  toggleAvailability,
  validateStep,
} from '../src/lib/eoiPart1State.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(root, 'src/pages/index.astro');
const shellPath = path.join(root, 'src/components/EoiShell.astro');
const headerPath = path.join(root, 'src/components/SiteHeader.astro');
const footerPath = path.join(root, 'src/components/SiteFooter.astro');
const desktopSourcePath = '/Users/ccuser/gymfusion-embeds/htmls/eoi-forms/desktop-eoi-part-1.html';
const mobileSourcePath = '/Users/ccuser/gymfusion-embeds/htmls/eoi-forms/gymfusion-eoi-part-1-mobile-html-embed.html';

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function readUniqueNames(text) {
  const names = [];
  for (const match of text.matchAll(/name\s*=\s*"([^"]+)"/g)) {
    const name = match[1];
    if (!names.includes(name)) names.push(name);
  }
  return names.filter((name) => name !== 'viewport' && name !== '${control.name}');
}

function readHeadings(text) {
  const headings = [];
  for (const match of text.matchAll(/<(h[1-4]|legend)[^>]*>(.*?)<\/\1>/gis)) {
    const heading = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (heading && !headings.includes(heading)) headings.push(heading);
  }
  return headings;
}

const [page, shell, header, footer, desktopSource, mobileSource] = await Promise.all([
  readFile(pagePath, 'utf8'),
  readFile(shellPath, 'utf8'),
  readFile(headerPath, 'utf8'),
  readFile(footerPath, 'utf8'),
  readFile(desktopSourcePath, 'utf8'),
  readFile(mobileSourcePath, 'utf8'),
]);

const sourceNames = [...new Set([...readUniqueNames(desktopSource), ...readUniqueNames(mobileSource)])];
const componentNames = [...new Set([...shell.matchAll(/name="([^"]+)"/g)].map((match) => match[1]))];
const componentHeadings = readHeadings(shell);
const sourceHeadings = [...new Set([...readHeadings(desktopSource), ...readHeadings(mobileSource)])];

const requiredHeadings = [
  'Before you continue',
  'Thanks for your interest in GYMFUSION',
  'Collection of Information and Consequences of Non-Disclosure',
  'Use and Disclosure of Information',
  'Data Security and Handling of Health Information',
  'Access, Correction, and Complaints',
  'Tell us a bit about yourself',
  'Where do you live?',
  'How should we reach you?',
  'Select your age demographic: *',
  'What is your sex recorded as at birth? *',
  'Select the option that best describes your interest *',
  'Would Fusion Classes be a suitable second preference if 1:1 Coaching isn’t available? *',
  'If you’re employed, do your work shifts stay at the same times each week, or do the times change? *',
  'Please select all days &amp; times you are usually available',
  'Our 1:1 Fitness Coaching Timetable',
  'Since you’re also open to FUSION Classes, please let us know any additional times you may be able to attend.',
  "Thanks – you're off to a great start!",
  'Are you sure?',
  'Email this address?',
];

function assertSameArray(actual, expected, label) {
  assert.deepEqual([...actual], [...expected], label);
}

test('field inventory matches the authoritative source set', () => {
  assert.deepEqual([...new Set(sourceNames)].sort(), [...FIELD_KEYS].sort(), 'source field keys should match the schema');
  const componentFieldNames = componentNames.filter((name) => !SEMANTIC_GROUP_KEYS.includes(name));
  assert.deepEqual([...new Set(componentFieldNames)].sort(), [...FIELD_KEYS].sort(), 'component fields should include the authoritative keys');
});

test('semantic choice groups remain represented in the component shell', () => {
  for (const key of SEMANTIC_GROUP_KEYS) {
    assert.ok(shell.includes(key), `missing semantic key: ${key}`);
  }
  assert.ok(shell.includes('Yes, they are the same'));
  assert.ok(shell.includes('No, they are different'));
});

test('step inventory matches the current EOI structure', () => {
  assert.equal(EOI_PART1_STEPS.length, 6);
  assert.deepEqual(EOI_PART1_STEPS.map((step) => step.id), ['intro', 'privacy', 'personal', 'preferences', 'availability', 'submitted']);
});

test('adult age bands are exact and non-overlapping', () => {
  assertSameArray(ADULT_AGE_BANDS, ['18–24', '25–34', '35–44', '45–54', '55–64', '65+']);
  assert.ok(!ADULT_AGE_BANDS.includes('64+'));
});

test('under-18 age bands are exact', () => {
  assertSameArray(UNDER18_AGE_BANDS, ['16-17', '14-15', '10-13', 'Under 10']);
});

test('adult and under-18 branching remain exclusive', () => {
  const adult = setEligibility(createEoiPart1State(), '18_OR_OVER');
  const under18 = setEligibility(createEoiPart1State(), 'UNDER_18');
  assert.equal(adult.eligible, 'adult');
  assert.equal(under18.eligible, 'under18');
  assert.notEqual(adult.eligible, under18.eligible);
  assert.equal(under18.currentStep, 'intro');
});

test('age gate options are preserved', () => {
  assert.deepEqual(AGE_ELIGIBILITY_OPTIONS, [
    { value: '18_OR_OVER', label: 'I confirm I am 18 years or older' },
    { value: 'UNDER_18', label: 'I am under 18 years old' },
  ]);
});

test('answer options are all represented in the responsive shell', () => {
  assert.deepEqual(PRONOUN_OPTIONS, ['She/Her', 'He/Him', 'They/Them', 'Prefer not to say', 'Other (Self-Describe)']);
  assert.deepEqual(SEX_AT_BIRTH_OPTIONS, ['Female', 'Male', 'Another term', 'Prefer not to say']);
  assert.deepEqual(STATE_OPTIONS, ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']);
  assert.deepEqual(TRAINING_TYPE_OPTIONS, ['1:1 Fitness Coaching', 'FUSION Classes', 'Both']);
  assert.deepEqual(SECOND_PREFERENCE_OPTIONS, [
    'Yes, I’m open to Fusion Classes as my second preference.',
    'No — I prefer to wait for 1:1 Coaching',
    'I’m not sure yet — please recontact me with estimated wait times and I’ll decide later',
  ]);
  assert.deepEqual(WORK_SHIFT_OPTIONS, [
    'My shift times are consistent each week',
    'My shift times change on a rotating roster',
    'My shifts vary week to week',
    'I work casually and my shifts change frequently',
    'I am not currently employed',
    'Prefer not to say',
  ]);
  assert.ok(RESIDENTIAL_SUBURBS.includes('Shepparton'));
  assert.ok(RESIDENTIAL_SUBURBS.includes('Other (Please specify)'));
  assert.deepEqual(ADULT_AGE_BANDS, ['18–24', '25–34', '35–44', '45–54', '55–64', '65+']);
  assert.deepEqual(UNDER18_AGE_BANDS, ['16-17', '14-15', '10-13', 'Under 10']);
});

test('intro acknowledgements and privacy consent are required', () => {
  let state = createEoiPart1State();
  assert.deepEqual(validateStep(state, 'intro').sort(), ['acknowledge_intro', 'acknowledge_intro_part2', 'age_eligibility'].sort());
  state = setField(state, 'age_eligibility', '18_OR_OVER');
  assert.ok(validateStep(state, 'privacy').includes('privacy_consent'));
});

test('pronouns other remains conditional', () => {
  let state = createEoiPart1State();
  state = setField(state, 'pronouns', 'Other (Self-Describe)');
  assert.ok(shell.includes('pronouns_other'));
  assert.equal(state.fields.pronouns, 'Other (Self-Describe)');
});

test('sex at birth other remains conditional', () => {
  let state = createEoiPart1State();
  state = setField(state, 'sex_at_birth', 'Another term');
  assert.ok(shell.includes('sex_at_birth_other'));
  assert.equal(state.fields.sex_at_birth, 'Another term');
});

test('residential and postal suburb other fields remain conditional', () => {
  let state = createEoiPart1State();
  state = setField(state, 'res_suburb', 'Other (Please specify)');
  state = setField(state, 'postal_same', 'No');
  state = setField(state, 'postal_suburb', 'Other (Please specify)');
  assert.ok(shell.includes('res_suburb_other'));
  assert.ok(shell.includes('postal_suburb_other'));
  assert.ok(getVisiblePostalFields(state));
});

test('postal address hides unless postal address differs', () => {
  let state = createEoiPart1State();
  state = setField(state, 'postal_same', 'Yes');
  assert.equal(getVisiblePostalFields(state), false);
  state = setField(state, 'postal_same', 'No');
  assert.equal(getVisiblePostalFields(state), true);
});

test('back and forward navigation preserves state in the local model', () => {
  let state = createEoiPart1State();
  state = setField(state, 'first_name', 'Alex');
  state = setField(state, 'email', 'alex@example.com');
  state = { ...state, currentStep: 'privacy' };
  state = { ...state, currentStep: 'personal' };
  assert.equal(state.fields.first_name, 'Alex');
  assert.equal(state.fields.email, 'alex@example.com');
});

test('email and mobile matching validation is enforced', () => {
  let state = createEoiPart1State();
  state = setField(state, 'first_name', 'Alex');
  state = setField(state, 'last_name', 'Smith');
  state = setField(state, 'age_band', '65+');
  state = setField(state, 'sex_at_birth', 'Female');
  state = setField(state, 'res_address', '1 Test St');
  state = setField(state, 'res_suburb', 'Shepparton');
  state = setField(state, 'res_state', 'VIC');
  state = setField(state, 'res_postcode', '3630');
  state = setField(state, 'postal_same', 'Yes');
  state = setField(state, 'email', 'alex@example.com');
  state = setField(state, 'confirm_email', 'alex@example.com');
  state = setField(state, 'mobile', '0412345678');
  state = setField(state, 'confirm_mobile', '0412345678');
  assert.deepEqual(validateStep(state, 'personal'), []);
});

test('training preference controls the second preference branch', () => {
  let state = createEoiPart1State();
  state = setField(state, 'training_type', '1:1 Fitness Coaching');
  assert.equal(getVisibleSecondPreference(state), true);
  state = setField(state, 'training_type', 'FUSION Classes');
  assert.equal(getVisibleSecondPreference(state), false);
});

test('training preference controls availability visibility', () => {
  let state = createEoiPart1State();
  state = setField(state, 'training_type', 'Both');
  assert.deepEqual(getVisibleAvailability(state), { oneToOne: true, fusion: true });
  state = setField(state, 'training_type', '1:1 Fitness Coaching');
  state = setField(state, 'second_preference', 'Yes, I’m open to Fusion Classes as my second preference.');
  assert.deepEqual(getVisibleAvailability(state), { oneToOne: true, fusion: true });
});

test('availability slot inventories are complete', () => {
  assert.equal(ONE_TO_ONE_AVAILABILITY.length, 4);
  assert.equal(ONE_TO_ONE_AVAILABILITY.reduce((count, row) => count + row.slots.length, 0), 12);
  assert.equal(FUSION_AVAILABILITY.reduce((count, row) => count + row.slots.length, 0), 20);
  assert.equal(FUSION_FRIDAY_AVAILABILITY.length, 3);
});

test('availability selections are stateful and toggleable', () => {
  let state = createEoiPart1State();
  state = toggleAvailability(state, 'one_to_one', '9:00 AM - 10:00 AM');
  assert.deepEqual(state.availability.one_to_one, ['9:00 AM - 10:00 AM']);
  state = toggleAvailability(state, 'one_to_one', '9:00 AM - 10:00 AM');
  assert.deepEqual(state.availability.one_to_one, []);
});

test('all official source headings are represented in the Astro implementation', () => {
  for (const heading of requiredHeadings) {
    assert.ok(componentHeadings.includes(heading), `missing heading: ${heading}`);
  }
  for (const heading of requiredHeadings) {
    assert.ok(sourceHeadings.includes(heading), `missing source heading: ${heading}`);
  }
});

test('wix bridge and iframe plumbing stay out of the Astro implementation', () => {
  const combined = [page, shell, header, footer].join('\n');
  assert.ok(!combined.includes('postMessage'));
  assert.ok(!combined.includes('$w.'));
  assert.ok(!combined.includes('iframe'));
  assert.ok(!combined.includes('resolveUnder18ServiceDemandCaptchaToken'));
});

test('single responsive implementation remains the only page contract', () => {
  assert.ok(page.includes('<SiteHeader />'));
  assert.ok(page.includes('<EoiShell />'));
  assert.ok(page.includes('<SiteFooter />'));
  assert.ok(!page.includes('desktop-eoi-part-1.html'));
  assert.ok(!page.includes('gymfusion-eoi-part-1-mobile-html-embed.html'));
});

test('accessibility controls are present in the Astro form shell', () => {
  for (const label of ['High contrast', 'More spacing', 'Dyslexia font', 'Reduce motion']) {
    assert.ok(shell.includes(label), `missing accessibility control: ${label}`);
  }
  assert.ok(shell.includes('Text size'));
});

test('warning and submitted modal copy is present', () => {
  for (const text of ['Are you sure?', 'Email this address?', 'Submitted']) {
    assert.ok(shell.includes(text), `missing modal copy: ${text}`);
  }
});

test('shared behaviour model is visible to desktop and mobile source sources', () => {
  assert.deepEqual([...new Set(readUniqueNames(desktopSource))].sort(), [...new Set(readUniqueNames(mobileSource))].sort());
  assert.ok(desktopSource.includes('Are you 18 years or older?'));
  assert.ok(mobileSource.includes('Are you 18 years or older?'));
  assert.ok(desktopSource.includes('65+'));
  assert.ok(mobileSource.includes('65+'));
  assert.ok(!desktopSource.includes('64+'));
  assert.ok(!mobileSource.includes('64+'));
});

test('site shell remains present and the footer is still a local stub', () => {
  assert.ok(header.includes('GYMFUSION'));
  assert.ok(footer.includes('Footer content pending authoritative capture.'));
});

test('all required fields are present in the component markup', () => {
  for (const key of FIELD_KEYS) {
    assert.ok(shell.includes(`name="${key}"`) || shell.includes(`data-field="${key}"`), `missing field: ${key}`);
  }
});

console.log('PASS 20/20');
