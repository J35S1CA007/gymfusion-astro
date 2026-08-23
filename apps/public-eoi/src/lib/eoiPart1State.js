export const ADULT_AGE_BANDS = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
export const UNDER18_AGE_BANDS = ['16-17', '14-15', '10-13', 'Under 10'];

export const AGE_ELIGIBILITY_OPTIONS = [
  { value: '18_OR_OVER', label: 'I confirm I am 18 years or older' },
  { value: 'UNDER_18', label: 'I am under 18 years old' },
];

export const INTRO_ACKS = [
  {
    name: 'acknowledge_intro',
    label:
      'I confirm that this submission represents preliminary interest only (Part 1 of the EOI) and reflects my desire to become a member of GYMFUSION, with further steps required.',
  },
  {
    name: 'acknowledge_intro_part2',
    label:
      'I understand that submission does not guarantee placement, and that my EOI will be invalid unless Part 2 is completed within 14 days, including any required supporting evidence. If additional information is requested, extended timeframes will be provided.',
  },
];

export const PRONOUN_OPTIONS = [
  'She/Her',
  'He/Him',
  'They/Them',
  'Prefer not to say',
  'Other (Self-Describe)',
];

export const SEX_AT_BIRTH_OPTIONS = ['Female', 'Male', 'Another term', 'Prefer not to say'];

export const STATE_OPTIONS = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

export const RESIDENTIAL_SUBURBS = [
  'Shepparton',
  'Shepparton North',
  'Shepparton East',
  'Kialla',
  'Kialla Central',
  'Kialla West',
  'Kialla East',
  'Mooroopna',
  'Mooroopna North',
  'Tatura',
  'Tatura East',
  'Tallygaroopna',
  'Grahamvale',
  'Orrvale',
  'Lemnos',
  'Dookie',
  'Congupna',
  'Arcadia',
  'Pine Lodge',
  'Merrigum',
  'Toolamba',
  'Toolamba West',
  'Murchison',
  'Murchison North',
  'Murchison East',
  'Katandra',
  'Katandra West',
  'Wunghnu',
  'Numurkah',
  'Cobram',
  'Euroa',
  'Nagambie',
  'Other (Please specify)',
];

export const POSTAL_SUBURBS = [...RESIDENTIAL_SUBURBS];

export const TRAINING_TYPE_OPTIONS = ['1:1 Fitness Coaching', 'FUSION Classes', 'Both'];

export const SECOND_PREFERENCE_OPTIONS = [
  'Yes, I’m open to Fusion Classes as my second preference.',
  'No — I prefer to wait for 1:1 Coaching',
  'I’m not sure yet — please recontact me with estimated wait times and I’ll decide later',
];

export const WORK_SHIFT_OPTIONS = [
  'My shift times are consistent each week',
  'My shift times change on a rotating roster',
  'My shifts vary week to week',
  'I work casually and my shifts change frequently',
  'I am not currently employed',
  'Prefer not to say',
];

export const ONE_TO_ONE_AVAILABILITY = [
  { day: 'Monday', slots: ['9:00 AM - 10:00 AM', '10:10 AM - 11:10 AM', '11:20 AM - 12:20 PM'] },
  { day: 'Tuesday', slots: ['9:00 AM - 10:00 AM', '10:10 AM - 11:10 AM', '11:20 AM - 12:20 PM'] },
  { day: 'Wednesday', slots: ['9:00 AM - 10:00 AM', '10:10 AM - 11:10 AM', '11:20 AM - 12:20 PM'] },
  { day: 'Thursday', slots: ['9:00 AM - 10:00 AM', '10:10 AM - 11:10 AM', '11:20 AM - 12:20 PM'] },
];

export const FUSION_AVAILABILITY = [
  { day: 'Monday', slots: ['1:00 PM - 2:00 PM', '2:10 PM - 3:10 PM', '3:20 PM - 4:20 PM', '4:30 PM - 5:30 PM', '5:40 PM - 6:40 PM'] },
  { day: 'Tuesday', slots: ['1:00 PM - 2:00 PM', '2:10 PM - 3:10 PM', '3:20 PM - 4:20 PM', '4:30 PM - 5:30 PM', '5:40 PM - 6:40 PM'] },
  { day: 'Wednesday', slots: ['1:00 PM - 2:00 PM', '2:10 PM - 3:10 PM', '3:20 PM - 4:20 PM', '4:30 PM - 5:30 PM', '5:40 PM - 6:40 PM'] },
  { day: 'Thursday', slots: ['1:00 PM - 2:00 PM', '2:10 PM - 3:10 PM', '3:20 PM - 4:20 PM', '4:30 PM - 5:30 PM', '5:40 PM - 6:40 PM'] },
];

export const FUSION_FRIDAY_AVAILABILITY = ['9:00 AM - 10:00 AM', '10:10 AM - 11:10 AM', '11:20 AM - 12:20 PM'];

export const EOI_PART1_STEPS = [
  {
    id: 'intro',
    label: 'Introduction',
    title: 'Before you continue',
    fields: ['age_eligibility', 'acknowledge_intro', 'acknowledge_intro_part2'],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    title: 'Privacy Collection Notice',
    fields: ['privacy_consent'],
  },
  {
    id: 'personal',
    label: 'Details',
    title: 'Tell us a bit about yourself',
    fields: [
      'first_name',
      'preferred_name',
      'last_name',
      'pronouns',
      'pronouns_other',
      'age_band',
      'sex_at_birth',
      'sex_at_birth_other',
      'address_lookup',
      'res_address',
      'res_suburb',
      'res_suburb_other',
      'res_state',
      'res_postcode',
      'postal_address_lookup',
      'postal_same',
      'postal_address',
      'postal_suburb',
      'postal_suburb_other',
      'postal_state',
      'postal_postcode',
      'email',
      'confirm_email',
      'mobile',
      'confirm_mobile',
    ],
  },
  {
    id: 'preferences',
    label: 'Preferences',
    title: 'Select the option that best describes your interest',
    fields: ['training_type', 'second_preference', 'work_shift'],
  },
  {
    id: 'availability',
    label: 'Availability',
    title: 'Please select all days & times you are usually available',
    fields: ['one_to_one_availability', 'fusion_availability', 'fusion_friday_availability'],
  },
  {
    id: 'submitted',
    label: 'Submitted',
    title: 'Submitted',
    fields: [],
  },
];

export const FIELD_KEYS = [
  'age_eligibility',
  'under18_age_band',
  'acknowledge_intro',
  'acknowledge_intro_part2',
  'privacy_consent',
  'first_name',
  'preferred_name',
  'last_name',
  'pronouns',
  'pronouns_other',
  'age_band',
  'sex_at_birth',
  'sex_at_birth_other',
  'address_lookup',
  'res_address',
  'res_suburb',
  'res_suburb_other',
  'res_state',
  'res_postcode',
  'postal_address_lookup',
  'postal_address',
  'postal_suburb',
  'postal_suburb_other',
  'postal_state',
  'postal_postcode',
  'email',
  'confirm_email',
  'mobile',
  'confirm_mobile',
];

export const SEMANTIC_GROUP_KEYS = ['postal_same', 'training_type', 'second_preference', 'work_shift'];

export const REQUIRED_FIELD_KEYS = [
  'age_eligibility',
  'acknowledge_intro',
  'acknowledge_intro_part2',
  'privacy_consent',
  'first_name',
  'last_name',
  'age_band',
  'sex_at_birth',
  'res_address',
  'res_suburb',
  'res_state',
  'res_postcode',
  'postal_same',
  'email',
  'confirm_email',
  'mobile',
  'confirm_mobile',
  'training_type',
  'work_shift',
  'one_to_one_availability',
  'fusion_availability',
  'fusion_friday_availability',
];

export function createEoiPart1State() {
  return {
    currentStep: 'intro',
    eligible: null,
    under18AgeBand: '',
    fields: {
      age_eligibility: '',
      acknowledge_intro: false,
      acknowledge_intro_part2: false,
      privacy_consent: false,
      first_name: '',
      preferred_name: '',
      last_name: '',
      pronouns: '',
      pronouns_other: '',
      age_band: '',
      sex_at_birth: '',
      sex_at_birth_other: '',
      address_lookup: '',
      res_address: '',
      res_suburb: '',
      res_suburb_other: '',
      res_state: 'VIC',
      res_postcode: '',
      postal_address_lookup: '',
      postal_same: '',
      postal_address: '',
      postal_suburb: '',
      postal_suburb_other: '',
      postal_state: 'VIC',
      postal_postcode: '',
      email: '',
      confirm_email: '',
      mobile: '',
      confirm_mobile: '',
      training_type: '',
      second_preference: '',
      work_shift: '',
    },
    availability: {
      one_to_one: [],
      fusion: [],
      friday: [],
    },
    modals: {
      menuWarning: false,
      emailWarning: false,
      submitted: false,
    },
    accessibility: {
      contrast: false,
      spacing: false,
      font: false,
      motion: false,
      scale: 2,
    },
  };
}

export function setEligibility(state, value) {
  const eligible = value === '18_OR_OVER' ? 'adult' : value === 'UNDER_18' ? 'under18' : null;
  const next = {
    ...state,
    eligible,
    fields: {
      ...state.fields,
      age_eligibility: value,
    },
  };
  if (eligible === 'adult') {
    next.currentStep = 'privacy';
  }
  if (eligible === 'under18') {
    next.currentStep = 'intro';
  }
  return next;
}

export function setUnder18AgeBand(state, value) {
  return {
    ...state,
    under18AgeBand: UNDER18_AGE_BANDS.includes(value) ? value : '',
  };
}

export function setField(state, name, value) {
  const next = {
    ...state,
    fields: {
      ...state.fields,
      [name]: value,
    },
  };
  if (name === 'training_type') {
    next.fields.second_preference = value === '1:1 Fitness Coaching' ? next.fields.second_preference : '';
    next.availability = {
      ...next.availability,
      one_to_one: value === 'FUSION Classes' ? [] : next.availability.one_to_one,
      fusion: value === '1:1 Fitness Coaching' ? [] : next.availability.fusion,
      friday: value === '1:1 Fitness Coaching' ? [] : next.availability.friday,
    };
  }
  if (name === 'postal_same') {
    if (value === 'Yes') {
      next.fields.postal_address = '';
      next.fields.postal_address_lookup = '';
      next.fields.postal_suburb = '';
      next.fields.postal_suburb_other = '';
      next.fields.postal_state = 'VIC';
      next.fields.postal_postcode = '';
    }
  }
  return next;
}

export function setModal(state, name, value) {
  return {
    ...state,
    modals: {
      ...state.modals,
      [name]: Boolean(value),
    },
  };
}

export function toggleAvailability(state, bucket, slot) {
  const current = state.availability[bucket] || [];
  const nextList = current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot];
  return {
    ...state,
    availability: {
      ...state.availability,
      [bucket]: nextList,
    },
  };
}

export function setAccessibility(state, name, value) {
  return {
    ...state,
    accessibility: {
      ...state.accessibility,
      [name]: value,
    },
  };
}

export function getVisiblePostalFields(state) {
  return state.fields.postal_same === 'No';
}

export function getVisibleSecondPreference(state) {
  return state.fields.training_type === '1:1 Fitness Coaching';
}

export function getVisibleAvailability(state) {
  return {
    oneToOne: state.fields.training_type === '1:1 Fitness Coaching' || state.fields.training_type === 'Both',
    fusion:
      state.fields.training_type === 'FUSION Classes' ||
      state.fields.training_type === 'Both' ||
      (state.fields.training_type === '1:1 Fitness Coaching' && state.fields.second_preference && state.fields.second_preference !== 'No — I prefer to wait for 1:1 Coaching'),
  };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isMobile(value) {
  return /^\d{10}$/.test(String(value || '').replace(/\D/g, ''));
}

function isPostcode(value) {
  return /^\d{4}$/.test(String(value || '').trim());
}

export function validateStep(state, stepId) {
  const fields = state.fields;
  const errors = [];
  if (stepId === 'intro') {
    if (!fields.age_eligibility) errors.push('age_eligibility');
    if (!fields.acknowledge_intro) errors.push('acknowledge_intro');
    if (!fields.acknowledge_intro_part2) errors.push('acknowledge_intro_part2');
  }
  if (stepId === 'privacy') {
    if (!fields.privacy_consent) errors.push('privacy_consent');
  }
  if (stepId === 'personal') {
    for (const key of ['first_name', 'last_name', 'age_band', 'sex_at_birth', 'res_address', 'res_suburb', 'res_state', 'res_postcode', 'postal_same', 'email', 'confirm_email', 'mobile', 'confirm_mobile']) {
      if (!String(fields[key] || '').trim()) errors.push(key);
    }
    if (fields.pronouns === 'Other (Self-Describe)' && !String(fields.pronouns_other || '').trim()) errors.push('pronouns_other');
    if (fields.sex_at_birth === 'Another term' && !String(fields.sex_at_birth_other || '').trim()) errors.push('sex_at_birth_other');
    if (fields.res_suburb === 'Other (Please specify)' && !String(fields.res_suburb_other || '').trim()) errors.push('res_suburb_other');
    if (!isEmail(fields.email)) errors.push('email_format');
    if (!isEmail(fields.confirm_email)) errors.push('confirm_email_format');
    if (String(fields.email || '').trim().toLowerCase() !== String(fields.confirm_email || '').trim().toLowerCase()) errors.push('confirm_email_match');
    if (!isMobile(fields.mobile)) errors.push('mobile_format');
    if (!isMobile(fields.confirm_mobile)) errors.push('confirm_mobile_format');
    if (String(fields.mobile || '').replace(/\D/g, '') !== String(fields.confirm_mobile || '').replace(/\D/g, '')) errors.push('confirm_mobile_match');
    if (!isPostcode(fields.res_postcode)) errors.push('res_postcode_format');
    if (fields.postal_same === 'No') {
      for (const key of ['postal_address', 'postal_suburb', 'postal_state', 'postal_postcode']) {
        if (!String(fields[key] || '').trim()) errors.push(key);
      }
      if (fields.postal_suburb === 'Other (Please specify)' && !String(fields.postal_suburb_other || '').trim()) errors.push('postal_suburb_other');
      if (!isPostcode(fields.postal_postcode)) errors.push('postal_postcode_format');
    }
  }
  if (stepId === 'preferences') {
    if (!fields.training_type) errors.push('training_type');
    if (getVisibleSecondPreference(state) && !fields.second_preference) errors.push('second_preference');
    if (!fields.work_shift) errors.push('work_shift');
  }
  if (stepId === 'availability') {
    const visibility = getVisibleAvailability(state);
    if (visibility.oneToOne && state.availability.one_to_one.length === 0) errors.push('one_to_one_availability');
    if (visibility.fusion && state.availability.fusion.length === 0 && state.availability.friday.length === 0) errors.push('fusion_availability');
  }
  return errors;
}

export function getStepIndex(stepId) {
  return EOI_PART1_STEPS.findIndex((step) => step.id === stepId);
}
