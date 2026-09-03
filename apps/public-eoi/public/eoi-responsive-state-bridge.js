(() => {
  const STORE_KEY = '__GYMFUSION_EOI_RESPONSIVE_STATE__';
  const BRIDGE_KEY = '__GYMFUSION_EOI_RESPONSIVE_STATE_BRIDGE__';
  const RESTORING_KEY = '__GYMFUSION_EOI_RESPONSIVE_STATE_RESTORING__';
  const PRESENTATION_MODE_KEY = '__GYMFUSION_EOI_RESPONSIVE_PRESENTATION_MODE__';
  const TRANSITION_KEY = '__GYMFUSION_EOI_RESPONSIVE_TRANSITION_IN_PROGRESS__';
  const JOURNEY_KEY = '__GYMFUSION_EOI_RESPONSIVE_JOURNEY__';
  const attachedDocuments = new WeakSet();
  const publishTimers = new WeakMap();

  const getSharedRoot = () => {
    try {
      if (window.parent && window.parent !== window && window.parent.location.origin === window.location.origin) {
        return window.parent;
      }
    } catch {
      // Ignore cross-window access failures and fall back to the local window.
    }
    return window;
  };

  const sharedRoot = getSharedRoot();
  const stateStore = sharedRoot[STORE_KEY] ?? (sharedRoot[STORE_KEY] = {
    activeViewport: '',
    lastUpdatedAt: 0,
    revision: 0,
    snapshot: null,
  });

  if (sharedRoot !== window) {
    window[STORE_KEY] = stateStore;
  }

  const journeyState = stateStore.journey ?? (stateStore.journey = {
    activeViewport: '',
    accessibility: {
      contrast: false,
      font: false,
      motion: false,
      spacing: false,
      text: 'default',
    },
    current: 0,
    deckState: 'cover',
    fields: {},
    hasDirtyProgress: false,
    progress: {
      maxUnlockedProgressStep: 0,
      maxUnlockedSlideIndex: 0,
    },
    selectedAgeEligibility: '',
    selectedButtons: [],
    submissionCompleted: false,
    under18AgeBand: '',
    under18View: 'gate',
  });
  window[JOURNEY_KEY] = journeyState;

  const cloneSelectedButtons = (entries) => entries.map((entry) => ({ ...entry }));
  const cloneAccessibility = (value) => ({ ...journeyState.accessibility, ...(value || {}) });
  const cloneProgress = (value) => ({ ...journeyState.progress, ...(value || {}) });
  const setJourneyState = (patch = {}) => {
    if (!patch || typeof patch !== 'object') return journeyState;
    if (patch.fields && typeof patch.fields === 'object') {
      journeyState.fields = { ...patch.fields };
    }
    if (Array.isArray(patch.selectedButtons)) {
      journeyState.selectedButtons = cloneSelectedButtons(patch.selectedButtons);
    }
    if (patch.accessibility && typeof patch.accessibility === 'object') {
      journeyState.accessibility = cloneAccessibility(patch.accessibility);
    }
    if (patch.progress && typeof patch.progress === 'object') {
      journeyState.progress = cloneProgress(patch.progress);
    }
    Object.entries(patch).forEach(([key, value]) => {
      if (key === 'fields' || key === 'selectedButtons' || key === 'accessibility' || key === 'progress') return;
      journeyState[key] = value;
    });
    stateStore.lastUpdatedAt = Date.now();
    stateStore.revision += 1;
    window[JOURNEY_KEY] = journeyState;
    return journeyState;
  };
  const getJourneyState = () => journeyState;
  const setTransitionInProgress = (next) => {
    sharedRoot[TRANSITION_KEY] = Boolean(next);
    window[TRANSITION_KEY] = Boolean(next);
  };
  const isTransitionInProgress = () => Boolean(sharedRoot[TRANSITION_KEY] || window[TRANSITION_KEY]);

  const isRestoring = (doc) => Boolean(doc?.defaultView?.[RESTORING_KEY]);
  const setRestoring = (doc, next) => {
    if (doc?.defaultView) {
      doc.defaultView[RESTORING_KEY] = Boolean(next);
    }
  };

  const getRuntimeRoot = (doc) => doc?.defaultView ?? window;
  const isRuntimeDocument = (doc) => Boolean(doc?.defaultView);
  const getPresentationMode = () => String(sharedRoot[PRESENTATION_MODE_KEY] || window[PRESENTATION_MODE_KEY] || '');
  const isMobileRuntimeDocument = (doc) => getRuntimeRoot(doc) === window;
  const isActivePresentationDocument = (doc) => {
    const mode = getPresentationMode();
    if (mode === 'mobile') return isMobileRuntimeDocument(doc);
    if (mode === 'desktop') return !isMobileRuntimeDocument(doc);
    return true;
  };
  const getDeck = (doc) => doc?.querySelector('#preview-deck');
  const getPageRoot = (doc) => doc?.querySelector('.page');
  const getRuntimeTitle = (doc) => getDeck(doc)?.getAttribute('data-deck-state') || getPageRoot(doc)?.getAttribute('data-deck-state') || 'cover';

  const getSlideIndex = (doc) => {
    const deck = getDeck(doc);
    const raw = String(deck?.style?.getPropertyValue('--slide-index') ?? deck?.getAttribute('style') ?? '0').trim();
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getAccessibility = (doc) => {
    const body = doc?.body;
    return {
      contrast: body?.dataset.a11yContrast === 'high',
      font: body?.dataset.a11yFont === 'dyslexic',
      motion: body?.dataset.a11yMotion === 'reduced',
      spacing: body?.dataset.a11ySpacing === 'expanded',
      text: String(body?.dataset.a11yText || 'default'),
    };
  };

  const nodeSelector = (node) => {
    if (!node || node.nodeType !== 1) return '';
    if (node.id) return `#${CSS.escape(node.id)}`;
    if (node.getAttribute('name')) {
      return `${node.tagName.toLowerCase()}[name="${CSS.escape(node.getAttribute('name'))}"]`;
    }
    if (node.getAttribute('data-field')) {
      return `${node.tagName.toLowerCase()}[data-field="${CSS.escape(node.getAttribute('data-field'))}"]`;
    }
    if (node.classList.length) {
      return `${node.tagName.toLowerCase()}.${Array.from(node.classList).map((name) => CSS.escape(name)).join('.')}`;
    }
    return node.tagName.toLowerCase();
  };

  const readControlState = (control) => {
    if (control.type === 'checkbox' || control.type === 'radio') {
      return {
        checked: Boolean(control.checked),
        type: control.type,
        value: String(control.value || ''),
      };
    }
    return {
      type: control.type || control.tagName.toLowerCase(),
      value: String(control.value || ''),
    };
  };

  const collectFields = (doc) => {
    const fields = {};
    doc.querySelectorAll('input[name], select[name], textarea[name]').forEach((control) => {
      fields[control.name] = readControlState(control);
    });
    return fields;
  };

  const collectSelectedButtons = (doc) => {
    const selected = [];
    const buttons = Array.from(doc.querySelectorAll('button.is-selected'));
    buttons.forEach((button) => {
      if (button.hasAttribute('data-age-eligibility-choice')) {
        selected.push({ kind: 'age-eligibility', value: String(button.getAttribute('data-value') || '') });
        return;
      }
      if (button.hasAttribute('data-under18-age-band')) {
        selected.push({ kind: 'under18-age-band', value: String(button.getAttribute('data-value') || '') });
        return;
      }
      if (button.hasAttribute('data-option-group')) {
        selected.push({
          kind: 'option',
          group: String(button.getAttribute('data-option-group') || ''),
          value: String(button.getAttribute('data-value') || ''),
        });
        return;
      }
      if (button.hasAttribute('data-choice-group')) {
        selected.push({
          kind: 'choice',
          group: String(button.getAttribute('data-choice-group') || ''),
          value: String(button.getAttribute('data-value') || ''),
        });
        return;
      }
      if (button.hasAttribute('data-matrix-group')) {
        selected.push({
          kind: 'matrix',
          day: String(button.getAttribute('data-day') || ''),
          group: String(button.getAttribute('data-matrix-group') || ''),
          time: String(button.getAttribute('data-time') || ''),
        });
      }
    });
    return selected;
  };

  const collectInvalidNodes = (doc) =>
    Array.from(doc.querySelectorAll('.is-invalid, [aria-invalid="true"]'))
      .map((node) => nodeSelector(node))
      .filter(Boolean);

  const collectUnder18View = (doc) => {
    if (doc.querySelector('[data-under18-success]:not(.is-hidden)')) return 'success';
    if (doc.querySelector('[data-under18-failure]:not(.is-hidden)')) return 'failure';
    if (doc.querySelector('[data-under18-processing]:not(.is-hidden)')) return 'processing';
    if (doc.querySelector('[data-under18-soft-exit]:not(.is-hidden)')) return 'under18';
    return 'gate';
  };

  const collectSnapshot = (doc) => {
    if (!getDeck(doc)) return null;
    const fields = collectFields(doc);
    const selectedButtons = collectSelectedButtons(doc);
    const hasAnyFieldValue = Object.values(fields).some((entry) => {
      if (!entry) return false;
      if ('checked' in entry) return Boolean(entry.checked);
      return String(entry.value || '').trim().length > 0;
    });
    const snapshot = {
      accessibility: getAccessibility(doc),
      activeViewport: getRuntimeRoot(doc) === window ? 'mobile' : 'desktop',
      current: getSlideIndex(doc),
      deckState: getRuntimeTitle(doc),
      fields,
      hasDirtyProgress: Boolean(hasAnyFieldValue || selectedButtons.length > 0 || getSlideIndex(doc) > 0),
      invalidNodes: collectInvalidNodes(doc),
      revision: stateStore.revision + 1,
      selectedButtons,
      submissionCompleted: getRuntimeTitle(doc) === 'submitted' || collectUnder18View(doc) === 'success',
      under18View: collectUnder18View(doc),
    };
    return snapshot;
  };

  const hydrateJourneyStateFromSnapshot = (snapshot, activeViewport = '') => {
    if (!snapshot) return journeyState;
    return setJourneyState({
      accessibility: snapshot.accessibility,
      activeViewport: activeViewport || snapshot.activeViewport || journeyState.activeViewport,
      current: snapshot.current,
      deckState: snapshot.deckState,
      fields: snapshot.fields,
      hasDirtyProgress: snapshot.hasDirtyProgress,
      progress: {
        maxUnlockedProgressStep: Math.max(journeyState.progress.maxUnlockedProgressStep, Number(snapshot.current || 0) > 0 ? Number(snapshot.current || 0) - 1 : 0),
        maxUnlockedSlideIndex: Math.max(journeyState.progress.maxUnlockedSlideIndex, Number(snapshot.current || 0)),
      },
      selectedAgeEligibility:
        String(snapshot.fields?.age_eligibility_confirmation?.value || journeyState.selectedAgeEligibility || '').trim(),
      selectedButtons: snapshot.selectedButtons,
      submissionCompleted: snapshot.submissionCompleted,
      under18AgeBand: String(
        snapshot.selectedButtons?.find((entry) => entry.kind === 'under18-age-band')?.value || journeyState.under18AgeBand || ''
      ).trim(),
      under18View: snapshot.under18View,
    });
  };

  const journeyStateToSnapshot = () => ({
    accessibility: journeyState.accessibility,
    activeViewport: journeyState.activeViewport || 'desktop',
    current: journeyState.current,
    deckState: journeyState.deckState,
    fields: journeyState.fields,
    hasDirtyProgress: journeyState.hasDirtyProgress,
    invalidNodes: stateStore.snapshot?.invalidNodes || [],
    revision: stateStore.revision + 1,
    selectedButtons: journeyState.selectedButtons,
    submissionCompleted: journeyState.submissionCompleted,
    under18View: journeyState.under18View,
  });

  const findControl = (doc, name) => {
    const escaped = CSS.escape(name);
    return doc.querySelector(`input[name="${escaped}"], select[name="${escaped}"], textarea[name="${escaped}"]`);
  };

  const setControlValue = (control, payload) => {
    if (!control) return;
    const win = control.ownerDocument?.defaultView ?? window;
    if (control.type === 'checkbox' || control.type === 'radio') {
      control.checked = Boolean(payload?.checked);
    } else {
      control.value = String(payload?.value ?? '');
    }
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    win.requestAnimationFrame?.(() => {});
  };

  const findButtonByDescriptor = (doc, descriptor) => {
    const buttons = Array.from(doc.querySelectorAll('button'));
    return buttons.find((button) => {
      if (!button || button.nodeType !== 1) return false;
      if (descriptor.kind === 'age-eligibility') {
        return button.hasAttribute('data-age-eligibility-choice') && String(button.getAttribute('data-value') || '') === descriptor.value;
      }
      if (descriptor.kind === 'under18-age-band') {
        return button.hasAttribute('data-under18-age-band') && String(button.getAttribute('data-value') || '') === descriptor.value;
      }
      if (descriptor.kind === 'option') {
        return button.getAttribute('data-option-group') === descriptor.group && String(button.getAttribute('data-value') || '') === descriptor.value;
      }
      if (descriptor.kind === 'choice') {
        return button.getAttribute('data-choice-group') === descriptor.group && String(button.getAttribute('data-value') || '') === descriptor.value;
      }
      if (descriptor.kind === 'matrix') {
        return button.getAttribute('data-matrix-group') === descriptor.group &&
          String(button.getAttribute('data-day') || '') === descriptor.day &&
          String(button.getAttribute('data-time') || '') === descriptor.time;
      }
      return false;
    }) || null;
  };

  const restoreAccessibility = (doc, snapshot) => {
    const body = doc.body;
    if (!body || !snapshot?.accessibility) return;
    body.dataset.a11yText = snapshot.accessibility.text || 'default';
    if (snapshot.accessibility.contrast) body.dataset.a11yContrast = 'high';
    else delete body.dataset.a11yContrast;
    if (snapshot.accessibility.spacing) body.dataset.a11ySpacing = 'expanded';
    else delete body.dataset.a11ySpacing;
    if (snapshot.accessibility.font) body.dataset.a11yFont = 'dyslexic';
    else delete body.dataset.a11yFont;
    if (snapshot.accessibility.motion) body.dataset.a11yMotion = 'reduced';
    else delete body.dataset.a11yMotion;

    const slider = doc.getElementById('text-scale-slider');
    const toggleButtons = Array.from(doc.querySelectorAll('[data-a11y-toggle]'));
    const sliderSteps = ['smaller', 'small', 'default', 'large', 'larger'];
    if (slider) {
      const targetIndex = Math.max(0, sliderSteps.indexOf(snapshot.accessibility.text || 'default'));
      slider.value = String(targetIndex);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
    toggleButtons.forEach((button) => {
      const key = String(button.getAttribute('data-a11y-toggle') || '');
      const active =
        (key === 'contrast' && snapshot.accessibility.contrast) ||
        (key === 'spacing' && snapshot.accessibility.spacing) ||
        (key === 'font' && snapshot.accessibility.font) ||
        (key === 'motion' && snapshot.accessibility.motion);
      button.setAttribute('aria-pressed', String(Boolean(active)));
      button.setAttribute('aria-checked', String(Boolean(active)));
    });
  };

  const restoreFields = (doc, snapshot) => {
    const fields = snapshot?.fields || {};
    Object.entries(fields).forEach(([name, payload]) => {
      const control = findControl(doc, name);
      if (!control) return;
      setControlValue(control, payload);
    });
  };

  const restoreButtons = (doc, snapshot) => {
    const selectedButtons = snapshot?.selectedButtons || [];
    selectedButtons.forEach((descriptor) => {
      const button = findButtonByDescriptor(doc, descriptor);
      if (!button) return;
      if (!button.classList.contains('is-selected')) {
        button.click();
      }
    });
  };

  const restoreInvalidNodes = (doc, snapshot) => {
    const invalidSelectors = snapshot?.invalidNodes || [];
    invalidSelectors.forEach((selector) => {
      const node = doc.querySelector(selector);
      if (!node) return;
      node.classList.add('is-invalid');
      node.setAttribute('aria-invalid', 'true');
    });
  };

  const findAdvanceButton = (doc) => {
    const selectors = [
      '[data-intro-confirm]',
      '[data-privacy-confirm]',
      '[data-availability-submit]',
      '[data-action="next"]',
      '[data-action="start"]',
    ];
    for (const selector of selectors) {
      const button = Array.from(doc.querySelectorAll(selector)).find((node) => {
        if (!node || node.nodeType !== 1) return false;
        if (node.disabled) return false;
        if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
        const style = doc.defaultView?.getComputedStyle?.(node);
        return style ? style.display !== 'none' && style.visibility !== 'hidden' : true;
      });
      if (button) return button;
    }
    return null;
  };

  const waitForFrame = (doc) =>
    new Promise((resolve) => {
      const win = doc?.defaultView ?? window;
      if (typeof win.requestAnimationFrame === 'function') {
        win.requestAnimationFrame(() => resolve());
        return;
      }
      setTimeout(resolve, 0);
    });

  const advanceToSlide = async (doc, targetIndex) => {
    let attempts = 0;
    while (getSlideIndex(doc) < targetIndex && attempts < 16) {
      const button = findAdvanceButton(doc);
      if (!button) break;
      button.click();
      attempts += 1;
      await waitForFrame(doc);
    }
    attempts = 0;
    while (getSlideIndex(doc) > targetIndex && attempts < 16) {
      const button = Array.from(doc.querySelectorAll('[data-action="back"]')).find((node) => {
        if (!node || node.nodeType !== 1) return false;
        if (node.disabled || node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
        const style = doc.defaultView?.getComputedStyle?.(node);
        return style ? style.display !== 'none' && style.visibility !== 'hidden' : true;
      });
      if (!button) break;
      button.click();
      attempts += 1;
      await waitForFrame(doc);
    }
  };

  const restoreSnapshot = async (doc) => {
    const snapshot = journeyStateToSnapshot();
    if (!snapshot || !snapshot.revision || !isRuntimeDocument(doc) || !isActivePresentationDocument(doc)) return;
    let restored = false;
    setRestoring(doc, true);
    try {
      restoreAccessibility(doc, snapshot);
      restoreFields(doc, snapshot);
      restoreButtons(doc, snapshot);
      restoreInvalidNodes(doc, snapshot);
      await advanceToSlide(doc, Number(snapshot.current || 0));
      restored = true;
    } finally {
      setRestoring(doc, false);
      if (restored) {
        const activeViewport = getRuntimeRoot(doc) === window ? 'mobile' : 'desktop';
        setJourneyState({ activeViewport });
        stateStore.activeViewport = activeViewport;
      }
    }
  };

  const publishSnapshot = (doc, activeViewport = '') => {
    if (!doc || !isRuntimeDocument(doc) || isRestoring(doc) || !isActivePresentationDocument(doc)) return;
    const snapshot = collectSnapshot(doc);
    if (!snapshot) return;
    hydrateJourneyStateFromSnapshot(snapshot, activeViewport);
    stateStore.snapshot = snapshot;
    stateStore.activeViewport = activeViewport || snapshot.activeViewport;
    stateStore.lastUpdatedAt = Date.now();
  };

  const schedulePublish = (doc, activeViewport = '') => {
    if (!doc || !isRuntimeDocument(doc) || isRestoring(doc) || !isActivePresentationDocument(doc)) return;
    const win = getRuntimeRoot(doc);
    const previous = publishTimers.get(doc);
    if (previous) win.clearTimeout(previous);
    const timer = win.setTimeout(() => {
      publishTimers.delete(doc);
      publishSnapshot(doc, activeViewport);
    }, 0);
    publishTimers.set(doc, timer);
  };

  const attachDocument = (doc, activeViewport = '') => {
    if (!doc || !isRuntimeDocument(doc) || attachedDocuments.has(doc)) return;
    attachedDocuments.add(doc);

    const handler = () => schedulePublish(doc, activeViewport);
    doc.addEventListener('input', handler, true);
    doc.addEventListener('change', handler, true);
    doc.addEventListener('click', handler, true);
    doc.addEventListener('submit', handler, true);
    schedulePublish(doc, activeViewport);
  };

  const attachIframe = (iframe) => {
    if (!iframe || iframe.dataset.eoiBridgeAttached === 'true') return;
    iframe.dataset.eoiBridgeAttached = 'true';
    iframe.addEventListener('load', () => {
      const doc = iframe.contentDocument;
      if (!doc || !isRuntimeDocument(doc)) return;
      attachDocument(doc, 'desktop');
      void restoreSnapshot(doc);
    });
    const doc = iframe.contentDocument;
    if (doc && isRuntimeDocument(doc)) {
      attachDocument(doc, 'desktop');
      void restoreSnapshot(doc);
    }
  };

  const init = () => {
    attachDocument(document, 'mobile');
    const iframe = document.querySelector('[data-eoi-embed]');
    if (iframe) attachIframe(iframe);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window[BRIDGE_KEY] = {
    attachDocument,
    attachIframe,
    captureDocument: publishSnapshot,
    getJourneyState,
    isTransitionInProgress,
    setJourneyState,
    setTransitionInProgress,
    restoreDocument: restoreSnapshot,
    stateStore,
  };
})();
