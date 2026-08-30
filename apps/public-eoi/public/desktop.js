
// @ts-nocheck
    (() => {
      const contextParams = new URLSearchParams(window.location.search);
      window.__eoiContext = {
        episodeId: contextParams.get("episode_id") || "",
        wixMemberId: contextParams.get("wix_member_id") || "",
        memberEmail: contextParams.get("member_email") || "",
      };
      const deck = document.getElementById("preview-deck");
      if (!deck) return;
      const accessibilityTools = document.getElementById("accessibility-tools");
      const accessibilityToggle = document.getElementById("accessibility-toggle");
      const accessibilityTriggerIcon = document.getElementById("accessibility-trigger-icon");
      const accessibilityPanel = document.getElementById("accessibility-panel");
      const accessibilityReset = document.getElementById("a11y-reset");
      const accessibilityTextSlider = document.getElementById("text-scale-slider");
      const accessibilityTextValue = document.getElementById("text-scale-value");
      const accessibilityToggleButtons = document.querySelectorAll("[data-a11y-toggle]");
      const siteMenuTemplate = document.querySelector("[data-menu-template]");
      let siteMenuButtons = [];
      const siteMenu = document.getElementById("desktop-site-menu");
      const menuWarningModal = document.getElementById("menu-warning-modal");
      const menuWarningDestination = document.getElementById("menu-warning-destination");
      const menuWarningStay = document.querySelector("[data-menu-warning-stay]");
      const menuWarningLeave = document.querySelector("[data-menu-warning-leave]");
      const emailWarningModal = document.getElementById("email-warning-modal");
      const emailWarningAddress = document.getElementById("email-warning-address");
      const emailWarningStay = document.querySelector("[data-email-warning-stay]");
      const emailWarningCopy = document.querySelector("[data-email-warning-copy]");
      const emailWarningOpen = document.querySelector("[data-email-warning-open]");
      const brandIcon = document.querySelector("[data-brand-icon]");
      const brandIconImage = document.querySelector("[data-brand-icon-img]");
      const iconResolutionCache = new Map();
      const ICON_SOURCE_MAP = Object.freeze({
        "accessibility-support-outline": {
          primary: "https://static.wixstatic.com/shapes/f190ff_7eed619bcf3a42a094f4a0974ff9f264.svg",
          backup: "https://i.ibb.co/0Vqzhkvj/accessibility-support-outline.jpg"
        },
        "accessibility-support": {
          primary: "https://static.wixstatic.com/shapes/f190ff_f6504a91a37e4dffb7f39c76006ea7bc.svg",
          backup: "https://i.ibb.co/PvL33dMG/accessibility-support.jpg"
        },
        "details-person": {
          primary: "https://static.wixstatic.com/media/f190ff_d13860367e19415691b39b85f1654b31~mv2.png",
          backup: "https://i.ibb.co/WbHDVnw/privacy-sheild-graident-02.png"
        },
        "privacy-shield": {
          primary: "https://static.wixstatic.com/media/f190ff_bf643654b5c644f39e71cbf22c7d6a63~mv2.png",
          backup: "https://i.ibb.co/WbHDVnw/privacy-sheild-graident-02.png"
        },
        "preferences-icon": {
          primary: "https://static.wixstatic.com/media/f190ff_6c7575f77891403ea93e9b5f3d2cd481~mv2.png",
          backup: "https://i.ibb.co/Xr3sSB0h/preferences-graident-01.png"
        },
        "availability-calendar": {
          primary: "wix:image://v1/f190ff_90b1edf5634840239b6226e633c8a655~mv2.png/event-date-and-time-symbol-svgrepo-com.png#originWidth=800&originHeight=800",
          backup: "https://i.ibb.co/rRvxnZHp/event-date-and-time-symbol-svgrepo-com.png"
        },
        "thank-you": {
          primary: "https://static.wixstatic.com/shapes/f190ff_d3609fbdc4a040dc86ac52943903ac37.svg",
          backup: "https://i.ibb.co/XZVByDgg/thankyou-icon.png"
        },
        "menu-gradient": {
          primary: "wix:image://v1/f190ff_13af7084cf044d788591fd478fce6d1d~mv2.png/menu-icon-graident.png#originWidth=800&originHeight=800",
          backup: "https://i.ibb.co/LhkK3KR3/menu-icon-graident.png"
        }
      });
      const BRAND_ICON_SOURCES = Object.freeze({
        animated: {
          primary: "https://static.wixstatic.com/media/f190ff_39dcaaaf6805463f9731fec4f8b7f5a0~mv2.gif",
          backup: "https://i.ibb.co/20Vc05Xg/wobble-gif.gif"
        },
        static: {
          primary: "https://static.wixstatic.com/media/f190ff_43b866ebee26445aab34780da9b07548~mv2.png",
          backup: "https://i.ibb.co/Ndgmj3h7/waving-hand-2d.png"
        }
      });
      const accessibilityStorageKey = "gymfusion-eoi-wix-shell:display-preferences:v3-default-1208";
      const accessibilityTextSteps = Object.freeze(["smaller", "small", "default", "large", "larger"]);
      const accessibilityTextLabels = Object.freeze({
        smaller: "Much smaller",
        small: "Smaller",
        default: "Default",
        large: "Larger",
        larger: "Much larger"
      });
      const defaultAccessibilityPrefs = Object.freeze({
        text: "default",
        contrast: false,
        spacing: false,
        font: false,
        motion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
      });

      let accessibilityPrefs = { ...defaultAccessibilityPrefs };
      let brandAnimationTimer = null;
      let hasPlayedBrandAnimation = false;

      const loadImageSource = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          image.onload = () => resolve(src);
          image.onerror = reject;
          image.src = src;
        });

      const resolveIconSource = (iconKey) => {
        const iconConfig = ICON_SOURCE_MAP[iconKey];
        if (!iconConfig) return Promise.resolve(null);
        if (iconResolutionCache.has(iconKey)) return iconResolutionCache.get(iconKey);
        const resolution = loadImageSource(iconConfig.primary)
          .then(() => ({ src: iconConfig.primary, state: "loaded" }))
          .catch(() => loadImageSource(iconConfig.backup).then(() => ({ src: iconConfig.backup, state: "backup" })).catch(() => null));
        iconResolutionCache.set(iconKey, resolution);
        return resolution;
      };

      const resolveBrandIconSource = (type) => {
        const sourceSet = BRAND_ICON_SOURCES[type];
        if (!sourceSet) return Promise.resolve(null);
        return loadImageSource(sourceSet.primary)
          .then(() => sourceSet.primary)
          .catch(() => loadImageSource(sourceSet.backup).then(() => sourceSet.backup).catch(() => null));
      };

      const showBrandFallback = () => {
        if (!brandIcon) return;
        brandIcon.dataset.brandIconState = "dot";
      };

      const showBrandStaticIcon = () => {
        if (!brandIcon || !brandIconImage) return;
        window.clearTimeout(brandAnimationTimer);
        resolveBrandIconSource("static").then((src) => {
          if (!src) {
            showBrandFallback();
            return;
          }
          brandIconImage.onerror = () => {
            brandIcon.dataset.brandIconState = "dot";
          };
          brandIconImage.src = src;
          brandIcon.dataset.brandIconState = "image";
        });
      };

      const syncBrandIcon = () => {
        if (!brandIcon || !brandIconImage) return;
        if (deck.getAttribute("data-deck-state") !== "form") return;
        window.clearTimeout(brandAnimationTimer);

        if (accessibilityPrefs.motion || hasPlayedBrandAnimation) {
          showBrandStaticIcon();
          return;
        }

        resolveBrandIconSource("animated").then((src) => {
          if (deck.getAttribute("data-deck-state") !== "form" || accessibilityPrefs.motion) {
            showBrandStaticIcon();
            return;
          }
          if (!src) {
            showBrandStaticIcon();
            return;
          }
          const replayToken = Date.now();
          brandIconImage.onerror = () => showBrandStaticIcon();
          brandIconImage.src = `${src}?replay=${replayToken}`;
          brandIcon.dataset.brandIconState = "image";
          brandAnimationTimer = window.setTimeout(() => {
            hasPlayedBrandAnimation = true;
            showBrandStaticIcon();
          }, 1800);
        });
      };

      const initializeIconFallbacks = () => {
        document.querySelectorAll(".icon-host[data-icon-key]").forEach((host) => {
          const iconKey = host.getAttribute("data-icon-key");
          host.dataset.iconState = "dot";
          if (!iconKey) return;
          const image = document.createElement("img");
          image.className = "icon-image";
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          host.appendChild(image);
          resolveIconSource(iconKey)
            .then((result) => {
              if (!result) return;
              image.src = result.src;
              host.dataset.iconState = result.state;
            })
            .catch(() => {
              host.dataset.iconState = "dot";
            });
        });
      };

      const initializeMenuIcon = () => {
        resolveIconSource("menu-gradient").then((result) => {
          if (!result?.src) return;
          document.documentElement.style.setProperty("--menu-icon-url", `url("${result.src}")`);
        });
      };

      const installToolbarMenus = () => {
        if (!siteMenuTemplate) return;
        document.querySelectorAll(".toolbar").forEach((toolbar, index) => {
          if (toolbar.querySelector("[data-site-menu-toggle]")) return;
          const brand = toolbar.querySelector(".brand");
          if (!brand) return;
          let leftGroup = toolbar.querySelector(".toolbar-left");
          if (!leftGroup) {
            leftGroup = document.createElement("div");
            leftGroup.className = "toolbar-left";
            toolbar.insertBefore(leftGroup, brand);
            leftGroup.appendChild(brand);
          }
          const clone = siteMenuTemplate.cloneNode(true);
          clone.hidden = false;
          clone.removeAttribute("data-menu-template");
          clone.setAttribute("aria-controls", "desktop-site-menu");
          clone.dataset.menuButtonIndex = String(index);
          leftGroup.insertBefore(clone, leftGroup.firstElementChild);
        });
        siteMenuTemplate.remove();
        siteMenuButtons = Array.from(document.querySelectorAll("[data-site-menu-toggle]"));
        initializeIconFallbacks();
      };

      const applyAccessibilityTriggerIcon = (isActive) => {
        if (!accessibilityTriggerIcon) return;
        const iconKey = isActive ? "accessibility-support" : "accessibility-support-outline";
        const image = accessibilityTriggerIcon.querySelector(".icon-image");
        accessibilityTriggerIcon.setAttribute("data-icon-key", iconKey);
        if (!image) return;
        resolveIconSource(iconKey)
          .then((result) => {
            if (!result) {
              accessibilityTriggerIcon.dataset.iconState = "dot";
              return;
            }
            image.src = result.src;
            accessibilityTriggerIcon.dataset.iconState = result.state;
          })
          .catch(() => {
            accessibilityTriggerIcon.dataset.iconState = "dot";
          });
      };

      const initializeCoverImageFallbacks = () => {
        document.querySelectorAll(".cover-image[data-fallback-src]").forEach((image) => {
          const fallbackSrc = image.getAttribute("data-fallback-src");
          if (!fallbackSrc) return;
          image.addEventListener(
            "error",
            () => {
              if (image.src === fallbackSrc) return;
              image.src = fallbackSrc;
            },
            { once: true }
          );
        });
      };

      const syncAccessibilityButtons = () => {
        const index = Math.max(0, accessibilityTextSteps.indexOf(accessibilityPrefs.text));
        if (accessibilityTextSlider) {
          accessibilityTextSlider.value = String(index);
          accessibilityTextSlider.setAttribute("aria-valuetext", accessibilityTextLabels[accessibilityPrefs.text] || accessibilityTextLabels.default);
        }
        if (accessibilityTextValue) {
          accessibilityTextValue.textContent = accessibilityTextLabels[accessibilityPrefs.text] || accessibilityTextLabels.default;
        }
        accessibilityToggleButtons.forEach((button) => {
          const key = button.getAttribute("data-a11y-toggle");
          const active =
            key === "contrast" ? accessibilityPrefs.contrast :
            key === "spacing" ? accessibilityPrefs.spacing :
            key === "font" ? accessibilityPrefs.font :
            key === "motion" ? accessibilityPrefs.motion :
            false;
          button.setAttribute("aria-pressed", String(active));
          button.setAttribute("aria-checked", String(active));
        });
      };

      const applyAccessibilityPrefs = () => {
        document.body.dataset.a11yText = accessibilityPrefs.text;
        accessibilityPrefs.contrast ? (document.body.dataset.a11yContrast = "high") : delete document.body.dataset.a11yContrast;
        accessibilityPrefs.spacing ? (document.body.dataset.a11ySpacing = "expanded") : delete document.body.dataset.a11ySpacing;
        accessibilityPrefs.font ? (document.body.dataset.a11yFont = "dyslexic") : delete document.body.dataset.a11yFont;
        accessibilityPrefs.motion ? (document.body.dataset.a11yMotion = "reduced") : delete document.body.dataset.a11yMotion;
        syncAccessibilityButtons();
        syncBrandIcon();
      };

      const toggleAccessibilityPanel = (forceOpen) => {
        if (!accessibilityToggle || !accessibilityPanel) return;
        const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : accessibilityPanel.hidden;
        accessibilityPanel.hidden = !shouldOpen;
        accessibilityToggle.setAttribute("aria-expanded", String(shouldOpen));
        applyAccessibilityTriggerIcon(shouldOpen);
      };

      const readAccessibilityPrefs = () => {
        try {
          const raw = window.localStorage.getItem(accessibilityStorageKey);
          if (!raw) return { ...defaultAccessibilityPrefs };
          const parsed = JSON.parse(raw);
          return {
            text: accessibilityTextSteps.includes(parsed?.text) ? parsed.text : defaultAccessibilityPrefs.text,
            contrast: Boolean(parsed?.contrast),
            spacing: Boolean(parsed?.spacing),
            font: Boolean(parsed?.font),
            motion: typeof parsed?.motion === "boolean" ? parsed.motion : defaultAccessibilityPrefs.motion
          };
        } catch {
          return { ...defaultAccessibilityPrefs };
        }
      };

      const writeAccessibilityPrefs = () => {
        try {
          window.localStorage.setItem(accessibilityStorageKey, JSON.stringify(accessibilityPrefs));
        } catch {
          // Ignore storage failures.
        }
      };

      accessibilityPrefs = readAccessibilityPrefs();
      applyAccessibilityPrefs();
      initializeIconFallbacks();
      initializeMenuIcon();
      installToolbarMenus();
      initializeCoverImageFallbacks();
      applyAccessibilityTriggerIcon(false);

      accessibilityToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleAccessibilityPanel();
      });

      accessibilityTextSlider?.addEventListener("input", () => {
        const index = Number(accessibilityTextSlider.value);
        accessibilityPrefs.text = accessibilityTextSteps[index] || defaultAccessibilityPrefs.text;
        applyAccessibilityPrefs();
        writeAccessibilityPrefs();
      });

      accessibilityToggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.getAttribute("data-a11y-toggle");
          if (key === "contrast") accessibilityPrefs.contrast = !accessibilityPrefs.contrast;
          if (key === "spacing") accessibilityPrefs.spacing = !accessibilityPrefs.spacing;
          if (key === "font") accessibilityPrefs.font = !accessibilityPrefs.font;
          if (key === "motion") accessibilityPrefs.motion = !accessibilityPrefs.motion;
          applyAccessibilityPrefs();
          writeAccessibilityPrefs();
        });
      });

      accessibilityReset?.addEventListener("click", () => {
        accessibilityPrefs = { ...defaultAccessibilityPrefs };
        applyAccessibilityPrefs();
        writeAccessibilityPrefs();
      });

      document.addEventListener("click", (event) => {
        if (
          accessibilityPanel &&
          !accessibilityPanel.hidden &&
          event.target instanceof Node &&
          accessibilityTools &&
          !accessibilityTools.contains(event.target)
        ) {
          toggleAccessibilityPanel(false);
        }
        if (
          siteMenu &&
          !siteMenu.hidden &&
          event.target instanceof Node &&
          !siteMenu.contains(event.target) &&
          !event.target.closest?.("[data-site-menu-toggle]")
        ) {
          closeSiteMenu();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        toggleAccessibilityPanel(false);
        closeSiteMenu();
        closeMenuWarning();
        closeEmailWarning();
      });

      let pendingMenuDestinationUrl = "";
      let pendingEmailAddress = "";

      const closeSiteMenu = () => {
        if (!siteMenu) return;
        siteMenu.hidden = true;
        siteMenuButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
      };

      const toggleSiteMenu = (button) => {
        if (!siteMenu || !button) return;
        const open = siteMenu.hidden;
        siteMenu.hidden = !open;
        siteMenuButtons.forEach((item) => item.setAttribute("aria-expanded", String(open && item === button)));
        if (open) {
          const toolbar = button.closest(".toolbar");
          const rect = toolbar?.getBoundingClientRect?.() || button.getBoundingClientRect();
          siteMenu.style.left = `${Math.round(rect.left)}px`;
          siteMenu.style.top = `${Math.round(rect.bottom + 8)}px`;
        }
        if (open) toggleAccessibilityPanel(false);
      };

      const closeMenuWarning = () => {
        if (!menuWarningModal) return;
        menuWarningModal.hidden = true;
        pendingMenuDestinationUrl = "";
      };

      const closeEmailWarning = () => {
        if (!emailWarningModal) return;
        emailWarningModal.hidden = true;
        pendingEmailAddress = "";
      };

      const openEmailWarning = (address) => {
        if (!emailWarningModal || !emailWarningAddress) return;
        pendingEmailAddress = String(address || "").trim();
        emailWarningAddress.textContent = pendingEmailAddress;
        closeSiteMenu();
        emailWarningModal.hidden = false;
        emailWarningStay?.focus();
      };

      const copyTextToClipboard = async (text) => {
        if (!text) return false;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {}
        return false;
      };

      const openMenuWarning = (label, url) => {
        if (!menuWarningModal || !menuWarningDestination) return;
        pendingMenuDestinationUrl = url;
        menuWarningDestination.textContent = label || "this page";
        closeSiteMenu();
        menuWarningModal.hidden = false;
        menuWarningStay?.focus();
      };

      siteMenuButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleSiteMenu(button);
        });
      });

      siteMenu?.querySelectorAll(".site-menu-link").forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          openMenuWarning(link.getAttribute("data-menu-link-label") || link.textContent.trim(), link.href);
        });
      });

      menuWarningStay?.addEventListener("click", closeMenuWarning);
      menuWarningLeave?.addEventListener("click", () => {
        const url = pendingMenuDestinationUrl;
        closeMenuWarning();
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      });

      emailWarningStay?.addEventListener("click", closeEmailWarning);
      emailWarningCopy?.addEventListener("click", async () => {
        await copyTextToClipboard(pendingEmailAddress);
        closeEmailWarning();
      });
      emailWarningOpen?.addEventListener("click", () => {
        const address = pendingEmailAddress;
        closeEmailWarning();
        if (address) window.location.href = `mailto:${address}`;
      });

      document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          const address = link.href.replace(/^mailto:/i, "").split("?")[0].trim();
          openEmailWarning(address);
        });
      });

      const pages = Array.from(deck.querySelectorAll(".deck-page"));
      const pageRoot = document.querySelector(".page");
      let current = 0;
      let firstInvalidTarget = null;
      let maxUnlockedProgressStep = 0;
      let maxUnlockedSlideIndex = 0;
      const recompletedProgressSteps = new Set();
      let hasDirtyProgress = false;
      let submissionCompleted = false;
      const ensureBottomAccessibilityToolbar = (page) => {
        if (!page) return null;
        let host = page.querySelector(".bottom-accessibility-toolbar");
        if (!host) {
          host = document.createElement("div");
          host.className = "bottom-accessibility-toolbar";
          host.setAttribute("aria-label", "Accessibility toolbar");
          page.appendChild(host);
        }
        return host;
      };

      const moveAccessibilityToolsForSlide = () => {
        if (!accessibilityTools || !pageRoot) return;
        const activePage = current > 0 ? pages[current] : null;
        const bottomToolbar = activePage ? ensureBottomAccessibilityToolbar(activePage) : null;
        if (bottomToolbar) {
          bottomToolbar.appendChild(accessibilityTools);
          accessibilityTools.setAttribute("data-bottom-toolbar-placement", "true");
          accessibilityTools.removeAttribute("data-toolbar-placement");
        } else {
          const coverPage = pages[0];
          if (coverPage) {
            coverPage.appendChild(accessibilityTools);
          } else {
            pageRoot.insertBefore(accessibilityTools, pageRoot.firstElementChild);
          }
          accessibilityTools.removeAttribute("data-toolbar-placement");
          accessibilityTools.removeAttribute("data-bottom-toolbar-placement");
        }
      };

      const scrollActivePreviewStepIntoView = () => {
        const page = pages[current];
        const stepper = page?.querySelector(".preview-stepper");
        const activeStep = stepper?.querySelector(".preview-step.is-active");
        if (!stepper || !activeStep) return;
        window.requestAnimationFrame(() => {
          const targetLeft = activeStep.offsetLeft - ((stepper.clientWidth - activeStep.offsetWidth) / 2);
          stepper.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
        });
      };

      const getPreviewStepIndex = (step) => {
        const label = step.querySelector("strong")?.textContent || "";
        return Number.parseInt(label, 10);
      };

      const getProgressStepForSlide = (slideIndex) => Math.min(Math.max(slideIndex, 1), 6);

      const getPreviewStepTargetIndex = (stepIndex) => stepIndex;

      const canNavigateByPreviewStep = (targetIndex) => {
        if (current === 2 && targetIndex === 1) return true;
        return current >= 3 && targetIndex <= maxUnlockedSlideIndex;
      };

      const syncPreviewSteps = () => {
        const activeProgressStep = getProgressStepForSlide(current);
        const hasReachedStepThree = maxUnlockedSlideIndex >= 3;
        const showStartReturnLocks = hasReachedStepThree && current === 1;
        const showRevisitUnlocks = hasReachedStepThree && current < maxUnlockedSlideIndex;
        deck.querySelectorAll(".preview-step").forEach((step) => {
          const stepIndex = getPreviewStepIndex(step);
          if (!Number.isFinite(stepIndex)) return;
          step.classList.remove("is-active", "is-complete", "is-future", "is-revisit-unlock", "is-return-start-lock");
          if (stepIndex === activeProgressStep) {
            step.classList.add("is-active");
          } else if (stepIndex <= maxUnlockedProgressStep) {
            step.classList.add("is-complete");
          } else {
            step.classList.add("is-future");
          }
          const isRecompleted = recompletedProgressSteps.has(stepIndex);
          if (!isRecompleted && showStartReturnLocks && (stepIndex === 1 || stepIndex === 2)) {
            step.classList.add("is-return-start-lock");
          } else if (!isRecompleted && showRevisitUnlocks && step.classList.contains("is-complete") && stepIndex < activeProgressStep) {
            step.classList.add("is-revisit-unlock");
          }
          if (step.classList.contains("is-complete") && canNavigateByPreviewStep(getPreviewStepTargetIndex(stepIndex))) {
            step.setAttribute("role", "button");
            step.setAttribute("tabindex", "0");
          } else {
            step.removeAttribute("role");
            step.removeAttribute("tabindex");
          }
        });
      };

      const setSlide = (index) => {
        current = Math.max(0, Math.min(index, pages.length - 1));
        if (current === 0) {
          maxUnlockedProgressStep = 0;
          maxUnlockedSlideIndex = 0;
        } else {
          maxUnlockedProgressStep = Math.max(maxUnlockedProgressStep, getProgressStepForSlide(current));
          maxUnlockedSlideIndex = Math.max(maxUnlockedSlideIndex, current);
        }
        deck.style.setProperty("--slide-index", String(current));
        const deckState = current === 0 ? "cover" : "form";
        deck.setAttribute("data-deck-state", deckState);
        pageRoot?.setAttribute("data-deck-state", deckState);
        syncBrandIcon();
        moveAccessibilityToolsForSlide();
        syncPreviewSteps();
        scrollActivePreviewStepIntoView();
      };

      const clearErrors = () => {
        firstInvalidTarget = null;
        deck.querySelectorAll(".field.is-invalid").forEach((field) => field.classList.remove("is-invalid"));
        deck.querySelectorAll(".availability-grid.is-invalid").forEach((grid) => grid.classList.remove("is-invalid"));
        deck.querySelectorAll(".select-field.is-invalid").forEach((field) => field.classList.remove("is-invalid"));
        deck.querySelectorAll(".option-grid.is-invalid").forEach((grid) => grid.classList.remove("is-invalid"));
        deck.querySelectorAll(".option-group-error").forEach((error) => error.remove());
      };

      const isValidationBypassed = (input) => {
        if (!input) return true;
        if (input.disabled) return true;
        const field = input.closest?.(".field");
        if (field) {
          const inlineDisplay = field.style?.display;
          const computedDisplay = window.getComputedStyle ? window.getComputedStyle(field).display : inlineDisplay;
          if (inlineDisplay === "none" || computedDisplay === "none" || field.hidden) return true;
        }
        const hiddenAncestor = input.closest?.('[hidden], [style*="display: none"]');
        if (hiddenAncestor && !hiddenAncestor.matches?.(".field-box")) return true;
        return false;
      };

      const markInvalid = (selector) => {
        const field = deck.querySelector(selector);
        if (!field) return;
        const target = field.closest(".field") || field.closest(".availability-grid") || field;
        target.classList.add("is-invalid");
        if (!firstInvalidTarget) firstInvalidTarget = target;
      };

      // Progress answer persistence intentionally disabled for privacy/shared-device safety.
      // Do not store form answers in browser storage.

      const markProgressDirty = () => {
        if (submissionCompleted) return;
        hasDirtyProgress = true;
      };

      const clearProgressDirty = () => {
        hasDirtyProgress = false;
      };

      const markOptionGroupInvalid = (selector) => {
        const button = deck.querySelector(selector);
        const grid = button?.closest?.(".option-grid");
        if (!grid) return;
        grid.classList.add("is-invalid");
        if (!grid.nextElementSibling?.classList?.contains("option-group-error")) {
          const error = document.createElement("div");
          error.className = "option-group-error";
          error.textContent = "Please select a response";
          grid.insertAdjacentElement("afterend", error);
        }
        if (!firstInvalidTarget) firstInvalidTarget = grid;
      };

      const clearOptionGroupError = (button) => {
        const grid = button?.closest?.(".option-grid");
        if (!grid) return;
        grid.classList.remove("is-invalid");
        const next = grid.nextElementSibling;
        if (next?.classList?.contains("option-group-error")) next.remove();
      };

      const hasValue = (input) => {
        if (!input) return false;
        if (input.type === "checkbox") return input.checked;
        if (input.tagName === "SELECT") {
          const value = String(input.value || "").trim();
          if (value) return true;
          const selected = input.options?.[input.selectedIndex];
          return Boolean(selected && String(selected.textContent || "").trim() && !selected.disabled);
        }
        return String(input.value || "").trim().length > 0;
      };

      const normalizeDefaultSelectValues = () => {
        deck.querySelectorAll("select").forEach((select) => {
          if (select.value) return;
          const selected = select.options?.[select.selectedIndex];
          if (!selected?.disabled || !String(selected.textContent || "").trim()) return;
          const matching = Array.from(select.options).find((option) => {
            return !option.disabled && String(option.textContent || "").trim() === String(selected.textContent || "").trim();
          });
          if (matching) select.value = matching.value || matching.textContent;
        });
      };

      const initAddressLookup = () => {
        const residentialLookup = document.getElementById("address-lookup");
        const residentialList = document.getElementById("address-lookup-results");
        const postalLookup = document.getElementById("postal-address-lookup");
        const postalList = document.getElementById("postal-address-lookup-results");
        const pendingLookups = new Map();
        const callLog = [];
        const debounceMs = 300;
        const timeoutMs = 8000;
        const maxCallsPerMinute = 25;

        const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
        const normalizeKey = (value) => normalize(value).toLowerCase().replace(/[^a-z0-9]/g, "");
        const pick = (record, keys) => {
          if (!record || typeof record !== "object") return "";
          const wanted = keys.map(normalizeKey);
          for (const [key, value] of Object.entries(record)) {
            if (wanted.includes(normalizeKey(key)) && normalize(value)) return normalize(value);
          }
          return "";
        };
        const getFullAddress = (record) => pick(record, [
          "full_address", "fullAddress", "FULL_ADDRESS", "formatted_address", "formattedAddress",
          "address", "ADDRESS", "complete_address", "completeAddress", "label", "LABEL",
          "ADDRESS_DETAIL", "address_detail", "property_address", "PROPERTY_ADDRESS"
        ]);
        const getSuburb = (record) => pick(record, ["suburb", "SUBURB", "locality", "LOCALITY", "locality_name", "LOCALITY_NAME", "town", "TOWN"]);
        const getState = (record) => pick(record, ["state", "STATE", "state_abbreviation", "STATE_ABBREVIATION", "stateCode", "region"]) || "VIC";
        const getPostcode = (record) => pick(record, ["postcode", "POSTCODE", "post_code", "POST_CODE", "postal_code", "POSTAL_CODE", "postalCode", "postCode"]);
        const getStreetLine = (record) => {
          const direct = pick(record, [
            "street", "street_address", "streetAddress", "STREET_ADDRESS", "address_line_1", "addressLine1",
            "ADDRESS_LINE_1", "address_line", "addressLine", "thoroughfare", "THOROUGHFARE",
            "mailing_address", "MAILING_ADDRESS", "line1"
          ]);
          if (direct) return direct;
          let full = getFullAddress(record);
          [getSuburb(record), getState(record), getPostcode(record)].filter(Boolean).forEach((part) => {
            full = full.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "");
          });
          return full.replace(/[,]{2,}/g, ",").replace(/^[,\s]+|[,\s]+$/g, "");
        };
        function fillAddressManualFields(mode, record) {
          const container = deck || document;
          const targetFields = container.querySelectorAll(`[data-address-manual="${mode}"]`);
          const normaliseValue = (value) => String(value ?? "").trim();
          const resolveState = (value) => {
            if (typeof normalizeState === "function") return normalizeState(value);
            const upper = normaliseValue(value).toUpperCase();
            if (upper === "VICTORIA") return "VIC";
            return upper || "VIC";
          };

          targetFields.forEach((fieldWrapper) => {
            fieldWrapper.hidden = false;
            fieldWrapper.style.display = "block";
            const input = fieldWrapper.querySelector("input, select");
            if (!input || !input.name) return;

            input.removeAttribute("disabled");
            input.disabled = false;

            if (input.name.includes("address")) {
              input.value = (typeof getStreetLine === "function" ? getStreetLine(record) : (record?.street || record?.address || record?.formatted_address)) || "";
            } else if (input.name.includes("suburb")) {
              input.value = record?.locality || record?.suburb || record?.LOCALITY || "";
            } else if (input.name.includes("state")) {
              input.value = resolveState(record?.state || record?.STATE || "VIC");
            } else if (input.name.includes("postcode")) {
              input.value = record?.postcode || record?.POSTCODE || record?.postal_code || "";
            }

            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
          });

          const lookupId = mode === "postal" ? "postal-address-lookup" : "address-lookup";
          const lookupField = container.getElementById?.(lookupId)?.closest(".address-lookup-field");
          if (lookupField) lookupField.style.display = "none";
        }

        const isPostalOnly = (record) => /\b(?:p\.?\s*o\.?\s*box|po\s*box|private\s+bag|locked\s+bag|bag)\b/i.test(`${getFullAddress(record)} ${getStreetLine(record)}`);

        const setControlValue = (control, value) => {
          if (!control) return;
          control.value = value || "";
          control.dispatchEvent(new Event("input", { bubbles: true }));
          control.dispatchEvent(new Event("change", { bubbles: true }));
          control.closest(".field")?.classList.remove("is-invalid");
        };
        const setSelectValue = (select, value, otherInputSelector) => {
          if (!select) return;
          const cleanValue = normalize(value) || (select.name?.includes("state") ? "VIC" : "");
          const options = Array.from(select.options || []);
          const exact = options.find((option) => normalize(option.textContent).toLowerCase() === cleanValue.toLowerCase() || normalize(option.value).toLowerCase() === cleanValue.toLowerCase());
          if (exact) {
            setControlValue(select, exact.value || exact.textContent);
            return;
          }
          const other = options.find((option) => normalize(option.textContent).toLowerCase().startsWith("other"));
          if (other) {
            setControlValue(select, other.value || other.textContent);
            const otherInput = deck.querySelector(otherInputSelector);
            if (otherInput) setControlValue(otherInput, cleanValue);
          }
        };

        const getManualFields = (mode) => Array.from(deck.querySelectorAll(`[data-address-manual="${mode}"]`));
        const getLookupInput = (mode) => mode === "postal" ? postalLookup : residentialLookup;
        const getLookupWrapper = (mode) => getLookupInput(mode)?.closest(".address-lookup-field");
        const getStreetControl = (mode) => mode === "postal"
          ? (document.getElementById("form-postal-street") || deck.querySelector('input[name="postal_address"]'))
          : (document.getElementById("form-street") || deck.querySelector('input[name="res_address"]'));
        const setManualMode = (mode, show, required) => {
          getManualFields(mode).forEach((field) => {
            field.hidden = !show;
            field.style.display = show ? "grid" : "none";
            field.querySelectorAll("input, select, textarea").forEach((control) => {
              control.disabled = false;
              control.required = Boolean(required && control.name);
              if (!required) control.setCustomValidity?.("");
            });
          });
        };
        const setLookupMode = (mode, show, required) => {
          const wrapper = getLookupWrapper(mode);
          const input = getLookupInput(mode);
          if (wrapper) {
            wrapper.hidden = !show;
            wrapper.style.display = show ? "grid" : "none";
          }
          if (input) {
            input.required = Boolean(required);
            input.disabled = !show;
            if (!required) input.setCustomValidity?.("");
            input.closest(".field")?.classList.remove("is-invalid");
          }
        };
        const syncLookupToStreetField = (mode) => {
          const lookup = getLookupInput(mode);
          const street = getStreetControl(mode);
          if (lookup && street) setControlValue(street, lookup.value);
        };
        const primeLookupMode = (mode) => {
          setLookupMode(mode, true, true);
          setManualMode(mode, false, false);
        };
        const revealManualFallback = (mode) => {
          const list = mode === "postal" ? postalList : residentialList;
          hideList(list);
          setLookupMode(mode, true, true);
          setManualMode(mode, true, true);
          syncLookupToStreetField(mode);
          const lookup = getLookupInput(mode);
          if (lookup) {
            lookup.placeholder = mode === "postal" ? "Enter your postal street address manually" : "Enter your street address manually";
          }
          getLookupWrapper(mode)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        };
        const showFilledAddressFieldsAfterSelection = (mode) => {
          setLookupMode(mode, true, true);
          setManualMode(mode, true, true);
        };
        const hideList = (list) => {
          if (!list) return;
          list.innerHTML = "";
          list.hidden = true;
        };
        const showList = (list, records, mode) => {
          if (!list) return;
          list.innerHTML = "";
          if (!records.length) {
            const empty = document.createElement("li");
            empty.className = "dropdown-empty";
            empty.textContent = "No matching addresses found. You can keep typing or enter the address manually.";
            list.appendChild(empty);
            list.hidden = false;
            return;
          }
          records.slice(0, 8).forEach((record) => {
            const item = document.createElement("li");
            item.tabIndex = 0;
            item.setAttribute("role", "option");
            item.textContent = getFullAddress(record) || getStreetLine(record) || "Address result";
            const choose = () => {
              markProgressDirty();
              if (mode === "residential" && isPostalOnly(record)) routePostalRecord(record, true);
              else if (mode === "postal") routePostalRecord(record, false);
              else routeResidentialRecord(record);
              hideList(list);
            };
            item.addEventListener("mousedown", (event) => { event.preventDefault(); choose(); });
            item.addEventListener("keydown", (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              choose();
            });
            list.appendChild(item);
          });
          list.hidden = false;
        };
        const showError = (list) => {
          if (!list) return;
          list.innerHTML = '<li class="dropdown-error">Address registry busy. Please enter details manually.</li>';
          list.hidden = false;
        };
        const enforceRateLimit = () => {
          const now = Date.now();
          while (callLog.length && now - callLog[0] > 60000) callLog.shift();
          if (callLog.length >= maxCallsPerMinute) return false;
          callLog.push(now);
          return true;
        };
        const runLookup = (q, list, mode) => {
          if (!enforceRateLimit()) {
            showError(list);
            revealManualFallback(mode);
            return;
          }
          const requestId = `${mode}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const timeout = window.setTimeout(() => {
            pendingLookups.delete(requestId);
            showError(list);
            revealManualFallback(mode);
          }, timeoutMs);
          pendingLookups.set(requestId, { list, mode, timeout });
          if (window.parent === window) {
            window.clearTimeout(timeout);
            pendingLookups.delete(requestId);
            showError(list);
            revealManualFallback(mode);
            return;
          }
          window.parent.postMessage({ type: "ADDRESS_SEARCH", q, requestId, mode }, "*");
        };
        const allowedAddressMessageOrigins = new Set([
          "https://www.gymfusion.com.au",
          "https://gymfusion.com.au",
          "https://editor.wix.com",
          "https://manage.wix.com"
        ]);
        const isTrustedAddressMessageOrigin = (event) => {
          if (event.source === window) return false;
          if (!event.origin || event.origin === "null") return false;
          if (allowedAddressMessageOrigins.has(event.origin)) return true;
          try {
            const host = new URL(event.origin).hostname;
            return host === "wix.com" || host.endsWith(".wix.com") || host.endsWith(".wixsite.com");
          } catch (error) {
            return false;
          }
        };
        window.addEventListener("message", (event) => {
          if (!isTrustedAddressMessageOrigin(event)) return;
          const payload = event.data;
          if (!payload || typeof payload !== "object") return;
          const type = payload.type || "ADDRESS_RESULTS";
          if (type === "ADDRESS_SEARCH") return;
          if (type !== "ADDRESS_RESULTS" && type !== "ADDRESS_ERROR" && !payload.records && !payload.data && !payload.error) return;
          const requestId = payload.requestId;
          const pending = requestId ? pendingLookups.get(requestId) : Array.from(pendingLookups.values()).at(-1);
          if (!pending) return;
          if (requestId) pendingLookups.delete(requestId);
          window.clearTimeout(pending.timeout);
          if (type === "ADDRESS_ERROR" || payload.error || payload.status === "error") {
            showError(pending.list);
            revealManualFallback(pending.mode);
            return;
          }
          const records = Array.isArray(payload.records)
            ? payload.records
            : Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.data)
                ? payload.data
                : [];
          if (!records.length) {
            showList(pending.list, records, pending.mode);
            revealManualFallback(pending.mode);
            return;
          }
          showList(pending.list, records, pending.mode);
        });
        const bindLookup = (input, list, mode) => {
          if (!input || !list) return;
          let timer = null;
          input.addEventListener("input", () => {
            markProgressDirty();
            syncLookupToStreetField(mode);
            const q = normalize(input.value);
            window.clearTimeout(timer);
            if (q.length < 4) {
              hideList(list);
              return;
            }
            timer = window.setTimeout(() => runLookup(q, list, mode), debounceMs);
          });
          input.addEventListener("blur", () => window.setTimeout(() => hideList(list), 180));
        };
        const routeResidentialRecord = (record) => {
          markProgressDirty();
          const full = getFullAddress(record) || getStreetLine(record);
          setControlValue(residentialLookup, full);
          setControlValue(getStreetControl("residential"), getStreetLine(record));
          setSelectValue(deck.querySelector('select[name="res_suburb"]'), getSuburb(record), 'input[name="res_suburb_other"]');
          setSelectValue(deck.querySelector('select[name="res_state"]'), getState(record) || "VIC", 'input[name="res_state_other"]');
          setControlValue(deck.querySelector('input[name="res_postcode"]'), getPostcode(record));
          showFilledAddressFieldsAfterSelection("residential");
        };
        const forcePostalDifferent = () => {
          markProgressDirty();
          const noButton = deck.querySelector('[data-choice-group="postal_same"][data-value="No"]');
          if (noButton) updateChoiceGroup(noButton);
          else updatePostalVisibility("No");
          primeLookupMode("postal");
        };
        const routePostalRecord = (record, clearResidential) => {
          markProgressDirty();
          forcePostalDifferent();
          if (clearResidential) {
            setControlValue(residentialLookup, "");
            setControlValue(getStreetControl("residential"), "");
            setSelectValue(deck.querySelector('select[name="res_suburb"]'), "", 'input[name="res_suburb_other"]');
            setControlValue(deck.querySelector('input[name="res_postcode"]'), "");
            setSelectValue(deck.querySelector('select[name="res_state"]'), "VIC", 'input[name="res_state_other"]');
          }
          const full = getFullAddress(record) || getStreetLine(record);
          setControlValue(postalLookup, full);
          setControlValue(getStreetControl("postal"), getStreetLine(record) || full);
          setSelectValue(deck.querySelector('select[name="postal_suburb"]'), getSuburb(record), 'input[name="postal_suburb_other"]');
          setSelectValue(deck.querySelector('select[name="postal_state"]'), getState(record) || "VIC", 'input[name="postal_state_other"]');
          setControlValue(deck.querySelector('input[name="postal_postcode"]'), getPostcode(record));
          showFilledAddressFieldsAfterSelection("postal");
          document.getElementById("postal-address-fields")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        };
        primeLookupMode("residential");
        if (document.getElementById("postal-address-fields")?.hidden === false) primeLookupMode("postal");
        bindLookup(residentialLookup, residentialList, "residential");
        bindLookup(postalLookup, postalList, "postal");
      };

      const isValidMobile = (input) => {
        if (!input) return false;
        const digits = String(input.value || "").replace(/\D/g, "");
        return digits.length === 10;
      };

      const getSelectedText = (selector) => {
        const item = deck.querySelector(selector);
        return item ? item.textContent.trim() : "";
      };

      const getAvailabilityVisibility = () => {
        const trainingType = getSelectedText('[data-option-group="training-type"].is-selected');
        const secondPreference = deck.querySelector('[data-choice-group="second_preference"].is-selected');
        const showOneToOne = trainingType === "1:1 Fitness Coaching" || trainingType === "Both";
        const showFusion = trainingType === "FUSION Classes" || trainingType === "Both" || (secondPreference && secondPreference.dataset.value !== "No");
        return { showOneToOne, showFusion };
      };

      const clearMatrixSelections = (selector) => {
        deck.querySelectorAll(selector).forEach((button) => {
          button.classList.remove("is-selected");
          button.setAttribute("aria-pressed", "false");
        });
      };

      const updateAvailabilityVisibility = () => {
        const oneToOneCard = deck.querySelector('[data-availability-card="one_to_one"]');
        const fusionCard = deck.querySelector('[data-availability-card="fusion"]');
        if (!oneToOneCard && !fusionCard) return;
        const { showOneToOne, showFusion } = getAvailabilityVisibility();
        if (oneToOneCard) {
          oneToOneCard.style.display = showOneToOne ? "block" : "none";
          if (!showOneToOne) {
            clearMatrixSelections('[data-matrix-group="one_to_one_morning"]');
            const grid = deck.querySelector('[aria-label="1:1 availability matrix"]');
            if (grid) grid.classList.remove("is-invalid");
          }
        }
        if (fusionCard) {
          fusionCard.style.display = showFusion ? "block" : "none";
          if (!showFusion) {
            clearMatrixSelections('[data-matrix-group="fusion_afternoon"]');
            clearMatrixSelections('[data-matrix-group="fusion_friday"]');
            const grid = deck.querySelector('[aria-label="Fusion classes availability"]');
            const friday = deck.querySelector('[aria-label="Fusion Friday morning availability"]');
            if (grid) grid.classList.remove("is-invalid");
            if (friday) friday.classList.remove("is-invalid");
          }
        }
        updateSelectionSummaries();
      };

      const updateSelectionSummaries = () => {
        deck.querySelectorAll("[data-summary]").forEach((summary) => {
          const group = summary.getAttribute("data-summary");
          const selections = Array.from(deck.querySelectorAll(`[data-summary-group="${group}"].is-selected`));
          if (selections.length === 0) {
            summary.classList.add("is-hidden");
            summary.innerHTML = "";
            return;
          }
          const rows = selections.map((button) => {
            const day = button.getAttribute("data-day") || "Day";
            const time = button.getAttribute("data-time") || "Time";
            return `<div>${day}, ${time}</div>`;
          });
          summary.innerHTML = rows.join("");
          summary.classList.remove("is-hidden");
        });
        const submit = deck.querySelector("[data-availability-submit]");
        if (submit) submit.classList.toggle("is-hidden", !deck.querySelector("[data-matrix-group].is-selected"));
      };

      const syncAvailabilitySlotLabel = (button) => {
        if (!button?.matches?.("[data-matrix-group]")) return;
        const action = button.classList.contains("is-selected") ? "Deselect" : "Select";
        const day = button.getAttribute("data-day") || "day";
        const time = button.getAttribute("data-time") || "time";
        button.setAttribute("aria-label", `${action} ${day}, ${time}`);
      };

      const updatePostalVisibility = (value) => {
        const postalFields = document.getElementById("postal-address-fields");
        if (!postalFields) return;
        const showPostal = value === "No";
        postalFields.style.display = showPostal ? "block" : "none";
        postalFields.hidden = !showPostal;
        postalFields.querySelectorAll("input, select, textarea").forEach((control) => {
          const otherWrapper = control.closest("[data-other-field]");
          if (!showPostal) {
            control.value = "";
            control.required = false;
            control.closest(".field")?.classList.remove("is-invalid");
            return;
          }
          if (!otherWrapper) control.required = true;
        });
        if (!showPostal) {
          postalFields.querySelectorAll("[data-other-field]").forEach((field) => {
            field.style.display = "none";
          });
        }
      };

      const updateSecondPreferenceVisibility = () => {
        const trainingType = getSelectedText('[data-option-group="training-type"].is-selected');
        const card = deck.querySelector('[data-conditional-card="second-preference"]');
        if (!card) return;
        const show = trainingType === "1:1 Fitness Coaching";
        card.style.display = show ? "block" : "none";
        if (!show) {
          card.querySelectorAll('[data-choice-group="second_preference"]').forEach((btn) => {
            btn.classList.remove("is-selected");
            btn.setAttribute("aria-pressed", "false");
          });
          card.querySelectorAll(".option-grid.is-invalid").forEach((grid) => {
            grid.classList.remove("is-invalid");
            if (grid.nextElementSibling?.classList?.contains("option-group-error")) grid.nextElementSibling.remove();
          });
        }
        updateAvailabilityVisibility();
      };

      const validateStep = (index) => {
        clearErrors();

        if (index === 1) {
          const missing = Array.from(deck.querySelectorAll("[data-intro-ack]")).find((checkbox) => !hasValue(checkbox));
          if (missing) firstInvalidTarget = missing.closest(".gradient-check") || missing;
          return !missing;
        }

        if (index === 2) {
          const consent = deck.querySelector('input[name="privacy_consent"]');
          if (!hasValue(consent)) firstInvalidTarget = consent?.closest(".gradient-check") || consent;
          return hasValue(consent);
        }

        if (index === 3) {
          const firstName = deck.querySelector('input[name="first_name"]');
          const lastName = deck.querySelector('input[name="last_name"]');
          const ageBand = deck.querySelector('select[name="age_band"]');
          const resAddress = deck.querySelector('input[name="res_address"]');
          const resSuburb = deck.querySelector('select[name="res_suburb"]');
          const resState = deck.querySelector('select[name="res_state"]');
          const resPostcode = deck.querySelector('input[name="res_postcode"]');
          const sexAtBirth = deck.querySelector('select[name="sex_at_birth"]');
          const sexAtBirthOther = deck.querySelector('input[name="sex_at_birth_other"]');
          const resSuburbOther = deck.querySelector('input[name="res_suburb_other"]');
          const resStateOther = deck.querySelector('input[name="res_state_other"]');
          const email = deck.querySelector('input[name="email"]');
          const confirmEmail = deck.querySelector('input[name="confirm_email"]');
          const mobile = deck.querySelector('input[name="mobile"]');
          const confirmMobile = deck.querySelector('input[name="confirm_mobile"]');
          const postalSame = deck.querySelector('[data-choice-group="postal_same"].is-selected');
          let valid = true;

          if (!hasValue(firstName)) {
            markInvalid('[data-field="first_name"]');
            valid = false;
          }
          if (!hasValue(lastName)) {
            markInvalid('[data-field="last_name"]');
            valid = false;
          }
          if (!hasValue(ageBand)) {
            markInvalid('select[name="age_band"]');
            valid = false;
          }
          if (!hasValue(sexAtBirth)) {
            markInvalid('select[name="sex_at_birth"]');
            valid = false;
          }
          if (!hasValue(resAddress)) {
            markInvalid('input[name="res_address"]');
            valid = false;
          }
          if (!hasValue(resSuburb)) {
            markInvalid('select[name="res_suburb"]');
            valid = false;
          }
          if (!hasValue(resState)) {
            markInvalid('select[name="res_state"]');
            valid = false;
          }
          if (resSuburb && resSuburb.value.startsWith("Other") && !hasValue(resSuburbOther)) {
            markInvalid('input[name="res_suburb_other"]');
            valid = false;
          }
          if (resState && resState.value.startsWith("Other") && !hasValue(resStateOther)) {
            markInvalid('input[name="res_state_other"]');
            valid = false;
          }
          if (!hasValue(resPostcode)) {
            markInvalid('input[name="res_postcode"]');
            valid = false;
          }
          if (sexAtBirth && sexAtBirth.value.startsWith("Another term") && !hasValue(sexAtBirthOther)) {
            markInvalid('input[name="sex_at_birth_other"]');
            valid = false;
          }
          if (!postalSame) {
            markOptionGroupInvalid('[data-choice-group="postal_same"]');
            valid = false;
          }
          if (!hasValue(email) || !email.checkValidity()) {
            markInvalid('[data-field="email"]');
            valid = false;
          }
          if (!hasValue(confirmEmail) || !confirmEmail.checkValidity()) {
            markInvalid('[data-field="confirm_email"]');
            valid = false;
          }
          const normalizedEmail = String(email?.value || "").trim().toLowerCase();
          const normalizedConfirmEmail = String(confirmEmail?.value || "").trim().toLowerCase();
          if (normalizedEmail && normalizedConfirmEmail && normalizedEmail !== normalizedConfirmEmail) {
            markInvalid('[data-field="confirm_email"]');
            valid = false;
          }
          if (!hasValue(mobile) || !isValidMobile(mobile)) {
            markInvalid('[data-field="mobile"]');
            valid = false;
          }
          if (!hasValue(confirmMobile) || !isValidMobile(confirmMobile)) {
            markInvalid('[data-field="confirm_mobile"]');
            valid = false;
          }
          const normalizedMobile = String(mobile?.value || "").replace(/\D/g, "");
          const normalizedConfirmMobile = String(confirmMobile?.value || "").replace(/\D/g, "");
          if (normalizedMobile && normalizedConfirmMobile && normalizedMobile !== normalizedConfirmMobile) {
            markInvalid('[data-field="confirm_mobile"]');
            valid = false;
          }

          const postalFields = document.getElementById("postal-address-fields");
          if (postalFields && postalFields.style.display !== "none") {
            const postalAddress = deck.querySelector('input[name="postal_address"]');
            const postalSuburb = deck.querySelector('select[name="postal_suburb"]');
            const postalState = deck.querySelector('select[name="postal_state"]');
            const postalPostcode = deck.querySelector('input[name="postal_postcode"]');
            const postalSuburbOther = deck.querySelector('input[name="postal_suburb_other"]');
            const postalStateOther = deck.querySelector('input[name="postal_state_other"]');

            if (!hasValue(postalAddress)) {
              markInvalid('input[name="postal_address"]');
              valid = false;
            }
            if (!hasValue(postalSuburb)) {
              markInvalid('select[name="postal_suburb"]');
              valid = false;
            }
            if (!hasValue(postalState)) {
              markInvalid('select[name="postal_state"]');
              valid = false;
            }
            if (postalSuburb && postalSuburb.value.startsWith("Other") && !hasValue(postalSuburbOther)) {
              markInvalid('input[name="postal_suburb_other"]');
              valid = false;
            }
            if (postalState && postalState.value.startsWith("Other") && !hasValue(postalStateOther)) {
              markInvalid('input[name="postal_state_other"]');
              valid = false;
            }
            if (!hasValue(postalPostcode)) {
              markInvalid('input[name="postal_postcode"]');
              valid = false;
            }
          }

          return valid;
        }

        if (index === 4) {
          const trainingType = deck.querySelector('[data-option-group="training-type"].is-selected');
          const secondPreferenceCard = deck.querySelector('[data-conditional-card="second-preference"]');
          const secondPreference = deck.querySelector('[data-choice-group="second_preference"].is-selected');
          const workShift = deck.querySelector('[data-choice-group="work_shift"].is-selected');
          const secondPreferenceRequired = secondPreferenceCard && secondPreferenceCard.style.display !== "none";
          let valid = true;
          if (!trainingType) {
            markOptionGroupInvalid('[data-option-group="training-type"]');
            valid = false;
          }
          if (secondPreferenceRequired && !secondPreference) {
            markOptionGroupInvalid('[data-choice-group="second_preference"]');
            valid = false;
          }
          if (!workShift) {
            markOptionGroupInvalid('[data-choice-group="work_shift"]');
            valid = false;
          }
          return valid;
        }

      if (index === 5) {
          if (deck.querySelector("[data-matrix-group].is-selected")) return true;
          const firstVisibleGrid = Array.from(deck.querySelectorAll(".availability-grid")).find((grid) => {
            const card = grid.closest("[data-availability-card]");
            return !card || card.style.display !== "none";
          });
          if (firstVisibleGrid) {
            firstVisibleGrid.classList.add("is-invalid");
            firstInvalidTarget = firstVisibleGrid;
          }
          return false;
        }

        return true;
      };

      const updateOptionGroup = (button) => {
        const group = button.getAttribute("data-option-group");
        if (!group) return;
        clearOptionGroupError(button);
        deck.querySelectorAll(`[data-option-group="${group}"]`).forEach((item) => {
          item.classList.remove("is-selected");
          item.setAttribute("aria-pressed", "false");
        });
        button.classList.add("is-selected");
        button.setAttribute("aria-pressed", "true");
        if (group === "training-type") {
          updateSecondPreferenceVisibility();
          updateAvailabilityVisibility();
        }
      };

      const updateChoiceGroup = (button) => {
        const group = button.getAttribute("data-choice-group");
        if (!group) return;
        clearOptionGroupError(button);
        const choiceContainer = button.closest(".check-row, .chip-grid") || deck;
        choiceContainer.querySelectorAll(`[data-choice-group="${group}"]`).forEach((item) => {
          item.classList.remove("is-selected");
          item.setAttribute("aria-pressed", "false");
        });
        button.classList.add("is-selected");
        button.setAttribute("aria-pressed", "true");

        if (group === "postal_same") {
          updatePostalVisibility(button.dataset.value || button.textContent.trim());
        }
        if (group === "second_preference") {
          updateAvailabilityVisibility();
        }
      };

      const updateMatrixGroup = (button) => {
        button.classList.toggle("is-selected");
        button.setAttribute("aria-pressed", button.classList.contains("is-selected") ? "true" : "false");
        syncAvailabilitySlotLabel(button);
        const grid = button.closest(".availability-grid");
        if (grid) grid.classList.remove("is-invalid");
        updateSelectionSummaries();
      };

      deck.querySelectorAll("[data-action='start']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          setSlide(1);
        });
      });

      deck.querySelectorAll("[data-action='back']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          setSlide(current - 1);
        });
      });

      deck.querySelectorAll("[data-action='next']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          if (!validateStep(current)) {
            scrollToFirstInvalid();
            return;
          }
          if (maxUnlockedSlideIndex > current) {
            recompletedProgressSteps.add(getProgressStepForSlide(current));
          }
          setSlide(current + 1);
        });
      });

      deck.querySelectorAll("[data-action='restart']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          setSlide(0);
        });
      });

      const resetFormStateForClose = () => {
        deck.querySelectorAll("input, textarea, select").forEach((control) => {
          if (control.matches(".text-scale-slider")) return;
          if (control.type === "checkbox" || control.type === "radio") control.checked = false;
          else if (control.tagName === "SELECT") control.selectedIndex = 0;
          else control.value = "";
        });
        deck.querySelectorAll(".is-selected, .is-invalid").forEach((item) => item.classList.remove("is-selected", "is-invalid"));
        deck.querySelectorAll("[aria-pressed='true']").forEach((item) => item.setAttribute("aria-pressed", "false"));
        deck.querySelectorAll("[data-matrix-group]").forEach((button) => syncAvailabilitySlotLabel(button));
        updateIntroConfirm();
        updatePrivacyConfirm();
        updatePronounsOther();
        updatePostalVisibility("Yes");
        updateSecondPreferenceVisibility();
        updateSelectionSummaries();
        maxUnlockedProgressStep = 0;
        maxUnlockedSlideIndex = 0;
        recompletedProgressSteps.clear();
        submissionCompleted = false;
        clearProgressDirty();
      };

      deck.querySelectorAll("[data-action='close-form']").forEach((button) => {
        button.addEventListener("click", () => {
          closeSiteMenu();
          toggleAccessibilityPanel(false);
          resetFormStateForClose();
          setSlide(0);
        });
      });

      deck.querySelectorAll("[data-option-group]").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          updateOptionGroup(button);
        });
      });

      deck.querySelectorAll("[data-choice-group]").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          updateChoiceGroup(button);
        });
      });

      deck.querySelectorAll("[data-matrix-group]").forEach((button) => {
        syncAvailabilitySlotLabel(button);
        button.addEventListener("click", () => {
          markProgressDirty();
          updateMatrixGroup(button);
        });
      });

      deck.querySelectorAll(".preview-step, .info-tile, .option-choice, .availability-slot").forEach((tile) => {
        tile.setAttribute("draggable", "false");
        tile.addEventListener("dragstart", (event) => event.preventDefault());
      });

      deck.querySelectorAll(".preview-step").forEach((step) => {
        const goToCompletedStep = () => {
          markProgressDirty();
          const stepIndex = getPreviewStepIndex(step);
          if (!Number.isFinite(stepIndex)) return;
          const targetIndex = getPreviewStepTargetIndex(stepIndex);
          if (targetIndex > current) {
            if (!validateStep(current)) scrollToFirstInvalid();
            return;
          }
          if (stepIndex > maxUnlockedProgressStep) return;
          if (!step.classList.contains("is-complete")) return;
          if (!canNavigateByPreviewStep(targetIndex)) return;
          setSlide(targetIndex);
        };
        step.addEventListener("click", goToCompletedStep);
        step.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          goToCompletedStep();
        });
      });

      deck.querySelectorAll("input, select, textarea").forEach((control) => {
        control.addEventListener("input", () => {
          markProgressDirty();
          const field = control.closest(".field");
          if (field) field.classList.remove("is-invalid");
        });
        control.addEventListener("change", () => {
          markProgressDirty();
          const field = control.closest(".field");
          if (field) field.classList.remove("is-invalid");
          if (control.classList.contains("select-field")) {
            control.classList.remove("is-invalid");
          }
        });
      });

      const introCheckboxes = Array.from(deck.querySelectorAll("[data-intro-ack]"));
      const introConfirm = deck.querySelector("[data-intro-confirm]");
      const privacyCheckbox = deck.querySelector('input[name="privacy_consent"]');
      const privacyConfirm = deck.querySelector("[data-privacy-confirm]");
      const autoScrolledFooters = new Set();

      const scrollCurrentPageToElement = (element) => {
        const currentPage = pages[current];
        if (!currentPage || !element) return;
        const scroller = currentPage.querySelector(".content-scroll");
        if (!scroller) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const targetTop = Math.max(0, scroller.scrollTop + elementRect.top - scrollerRect.top - 16);
        scroller.scrollTo({ top: targetTop, behavior: "smooth" });
      };

      const scrollToFirstInvalid = () => {
        if (!firstInvalidTarget || current === 5) return;
        scrollCurrentPageToElement(firstInvalidTarget);
      };

      const scrollCurrentPageToFooterOnce = (key) => {
        if (!key || autoScrolledFooters.has(key)) return;
        const currentPage = pages[current];
        if (!currentPage) return;
        const scroller = currentPage.querySelector(".content-scroll");
        const footer = currentPage.querySelector(".footer-actions");
        if (!scroller || !footer) return;

        autoScrolledFooters.add(key);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const targetTop = Math.max(0, footer.offsetTop + footer.offsetHeight - scroller.clientHeight + 16);
            scroller.scrollTo({
              top: targetTop,
              behavior: "smooth"
            });
          });
        });
      };

      const updateIntroConfirm = () => {
        if (!introCheckboxes.length || !introConfirm) return;
        const isVisible = introCheckboxes.every((checkbox) => checkbox.checked);
        introConfirm.classList.toggle("is-hidden", !isVisible);
        introConfirm.closest(".footer-actions")?.classList.toggle("is-revealed", isVisible);
        if (isVisible) {
          scrollCurrentPageToFooterOnce("intro");
        }
      };
      const updatePrivacyConfirm = () => {
        if (!privacyCheckbox || !privacyConfirm) return;
        const isVisible = privacyCheckbox.checked;
        privacyConfirm.classList.toggle("is-hidden", !isVisible);
        privacyConfirm.closest(".footer-actions")?.classList.toggle("is-revealed", isVisible);
        if (isVisible) {
          scrollCurrentPageToFooterOnce("privacy");
        }
      };

      const handleBeforeUnload = (event) => {
        if (!hasDirtyProgress || submissionCompleted) return;
        event.preventDefault();
        event.returnValue = "";
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      const updateOtherField = (select) => {
        const target = select.getAttribute("data-other-target");
        if (!target) return;
        const field = deck.querySelector(`[data-other-field="${target}"]`);
        if (!field) return;
        const value = select.value || "";
        const show = value.startsWith("Other") || value.startsWith("Another term");
        field.style.display = show ? "grid" : "none";
        const input = field.querySelector("input");
        if (input) {
          input.required = show;
          if (!show) input.value = "";
        }
      };
      const pronounsSelect = deck.querySelector('select[name="pronouns"]');
      const pronounsOtherField = deck.querySelector('[data-field="pronouns_other"]');
      const updatePronounsOther = () => {
        if (!pronounsSelect || !pronounsOtherField) return;
        const show = pronounsSelect.value === "Other (Self-Describe)";
        pronounsOtherField.style.display = show ? "grid" : "none";
        if (!show) {
          const input = pronounsOtherField.querySelector('input[name="pronouns_other"]');
          if (input) input.value = "";
        }
      };

      const part1SubmitEndpoint = window.EOI_PART1_SUBMIT_URL || (window.location.protocol === "file:" ? "" : `${window.location.origin}/_functions/eoi_part1_submit`);
      const buildSubmissionId = () => {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `submission_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      };
      const getPersistedEpisodeId = () =>
        String(window.__GYMFUSION_EOI_EPISODE_ID__ || sessionStorage.getItem("gymfusion_eoi_episode_id") || contextParams.get("episode_id") || "").trim();
      // Part 1 stores the lifecycle id for future forms.
      // Future Part 2-4 forms should read the same value, send it back to the backend,
      // and never create a new lifecycle unless the backend says no Active episode exists.
      const collectPart1SubmissionPayload = () => {
        const fields = {};
        deck.querySelectorAll("input[name], select[name], textarea[name]").forEach((control) => {
          const name = control.getAttribute("name");
          if (!name) return;
          if (control.type === "checkbox") {
            fields[name] = Boolean(control.checked);
            return;
          }
          if (control.type === "radio") return;
          fields[name] = String(control.value || "").trim();
        });

        const selections = {
          postal_same_as_residential: deck.querySelector('[data-choice-group="postal_same"].is-selected')?.dataset?.value || "",
          second_preference: deck.querySelector('[data-choice-group="second_preference"].is-selected')?.dataset?.value || "",
          work_shift: deck.querySelector('[data-choice-group="work_shift"].is-selected')?.dataset?.value || "",
          training_type: deck.querySelector('[data-option-group="training-type"].is-selected')?.textContent?.trim() || "",
          if_you_re_employed_do_your_work_shifts_stay_at_the_same: deck.querySelector('[data-choice-group="work_shift"].is-selected')?.dataset?.value || "",
          pronouns: deck.querySelector('select[name="pronouns"]')?.value || "",
        };

        const availability = {
          availability_general: Array.from(deck.querySelectorAll('[data-availability-card="one_to_one"] [data-matrix-group].is-selected')).map((button) => `${button.getAttribute("data-day") || ""} | ${button.getAttribute("data-time") || ""}`.trim()),
          availability_1to1_priority: Array.from(deck.querySelectorAll('[data-availability-card="one_to_one"] [data-matrix-group].is-selected')).map((button) => `${button.getAttribute("data-day") || ""} | ${button.getAttribute("data-time") || ""}`.trim()),
          availability_preference_1to1_considering_fusion: Array.from(deck.querySelectorAll('[data-availability-card="one_to_one"] [data-matrix-group].is-selected')).map((button) => `${button.getAttribute("data-day") || ""} | ${button.getAttribute("data-time") || ""}`.trim()),
          availability_both_programs: Array.from(deck.querySelectorAll('[data-availability-card="one_to_one"] [data-matrix-group].is-selected')).map((button) => `${button.getAttribute("data-day") || ""} | ${button.getAttribute("data-time") || ""}`.trim()),
          availability_fusion_general: Array.from(deck.querySelectorAll('[data-availability-card="fusion"] [data-matrix-group].is-selected')).map((button) => `${button.getAttribute("data-day") || ""} | ${button.getAttribute("data-time") || ""}`.trim()),
        };

        return {
          submissionId: buildSubmissionId(),
          formId: "eoi_part1",
          submittedAt: new Date().toISOString(),
          wixMemberId: null,
          episodeId: getPersistedEpisodeId() || null,
          email: fields.email || "",
          fields,
          selections,
          availability,
          rawPayload: {
            fields,
            selections,
            availability,
          },
        };
      };

      const submitPart1ToWix = async (button) => {
        if (!part1SubmitEndpoint) {
          throw new Error("EOI submission endpoint is not configured for file:// preview.");
        }
        const payload = collectPart1SubmissionPayload();
        const response = await fetch(part1SubmitEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || json?.ok === false) {
          throw new Error(json?.error || `Submission failed (${response.status})`);
        }
        if (json?.episodeId) {
          window.__GYMFUSION_EOI_EPISODE_ID__ = String(json.episodeId);
          sessionStorage.setItem("gymfusion_eoi_episode_id", String(json.episodeId));
        }
        if (button) button.textContent = "Submitted";
        return json;
      };

      const finalSubmitButton = deck.querySelector("[data-availability-submit]");
      if (finalSubmitButton) {
        finalSubmitButton.addEventListener("click", async () => {
          if (!validateStep(current)) {
            scrollToFirstInvalid();
            return;
          }
          finalSubmitButton.disabled = true;
          const originalLabel = finalSubmitButton.textContent;
          finalSubmitButton.textContent = "Submitting...";
          try {
            await submitPart1ToWix(finalSubmitButton);
            submissionCompleted = true;
            clearProgressDirty();
            finalSubmitButton.classList.add("is-hidden");
            setSlide(current + 1);
          } catch (error) {
            finalSubmitButton.disabled = false;
            finalSubmitButton.textContent = originalLabel;
            window.alert(String(error?.message || error));
          }
        });
      }
      introCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", updateIntroConfirm));
      if (privacyCheckbox) {
        privacyCheckbox.addEventListener("change", updatePrivacyConfirm);
      }
      if (pronounsSelect) {
        pronounsSelect.addEventListener("change", updatePronounsOther);
      }
      deck.querySelectorAll("select[data-other-target]").forEach((select) => {
        select.addEventListener("change", () => updateOtherField(select));
        updateOtherField(select);
      });
      updateIntroConfirm();
      updatePrivacyConfirm();
      updatePronounsOther();
      normalizeDefaultSelectValues();
      initAddressLookup();
      updateSecondPreferenceVisibility();
      updateAvailabilityVisibility();

      updatePostalVisibility("Yes");
      setSlide(0);
    })();
  

/* --- extracted script block boundary --- */


/* WixForge v9 cover image automatic fallback */
(function () {
  var primarySrc = "wix:image://v1/f190ff_5920c695956e45eba273f3c6af95fcf1~mv2.png/give-your-body-a-chance-hero.png#originWidth=1672&originHeight=941";
  var fallbackSrc = "https://i.ibb.co/S7Pm909Y/give-your-body-a-chance-hero.png";

  function useFallback(img) {
    if (!img || img.dataset.fallbackApplied === "true") return;
    img.dataset.fallbackApplied = "true";
    img.src = img.dataset.fallbackSrc || fallbackSrc;
  }

  function isLoaded(img) {
    return !!(img && img.complete && img.naturalWidth && img.naturalWidth > 1);
  }

  document.querySelectorAll(".cover-image").forEach(function (img) {
    img.dataset.primarySrc = img.dataset.primarySrc || primarySrc;
    img.dataset.fallbackSrc = img.dataset.fallbackSrc || fallbackSrc;

    img.addEventListener("error", function () {
      useFallback(img);
    });

    img.addEventListener("load", function () {
      if (!img.naturalWidth || img.naturalWidth < 2) useFallback(img);
    });

    if (!img.getAttribute("src")) img.src = img.dataset.primarySrc;

    window.setTimeout(function () {
      if (!isLoaded(img)) useFallback(img);
    }, 900);

    window.setTimeout(function () {
      if (!isLoaded(img)) useFallback(img);
    }, 2200);
  });
})();
