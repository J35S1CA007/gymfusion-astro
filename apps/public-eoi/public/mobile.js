
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
      const brandIcon = document.querySelector("[data-brand-icon]");
      const brandIconImage = document.querySelector("[data-brand-icon-img]");
      const siteMenuButtons = Array.from(document.querySelectorAll("[data-site-menu-toggle]"));
      const siteMenus = Array.from(document.querySelectorAll(".site-menu"));
      const siteMenuLinks = Array.from(document.querySelectorAll(".site-menu-link"));
      const siteMenuLayer = document.getElementById("site-menu-layer");
      const menuWarningModal = document.getElementById("menu-warning-modal");
      const menuWarningDestination = document.getElementById("menu-warning-destination");
      const menuWarningStay = document.querySelector("[data-menu-warning-stay]");
      const menuWarningLeave = document.querySelector("[data-menu-warning-leave]");
      const emailWarningModal = document.getElementById("email-warning-modal");
      const emailWarningAddress = document.getElementById("email-warning-address");
      const emailWarningStay = document.querySelector("[data-email-warning-stay]");
      const emailWarningCopy = document.querySelector("[data-email-warning-copy]");
      const emailWarningOpen = document.querySelector("[data-email-warning-open]");
      const coverGalleryFrame = document.querySelector('.cover-page iframe.carousel');
      const validationAnnouncer = document.getElementById("validation-announcer");
      const iconResolutionCache = new Map();
      const ICON_SOURCE_MAP = Object.freeze({
        "accessibility-support-outline": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/accessibility-button-icon.svg",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/accessibility-button-icon.svg"
        },
        "accessibility-support": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/accessibility-button-icon.svg",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/accessibility-button-icon.svg"
        },
        "details-person": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/details-icon.png",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/details-icon.png"
        },
        "privacy-shield": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/privacy-icon.png",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/privacy-icon.png"
        },
        "preferences-icon": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/preferences-icon.png",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/preferences-icon.png"
        },
        "availability-calendar": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/event-date-and-time-symbol-svgrepo-com.png",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/event-date-and-time-symbol-svgrepo-com.png"
        },
        "thank-you": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/thank-you-icon.svg",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/thank-you-icon.svg"
        },
        "menu-gradient": {
          primary: "/assets/mobile-eoi-part-1-form-assets/icons/menu-icon.png",
          backup: "/assets/mobile-eoi-part-1-form-assets/icons/menu-icon.png"
        }
      });
      const WELCOME_GIF_URL = "https://static.wixstatic.com/media/f190ff_39dcaaaf6805463f9731fec4f8b7f5a0~mv2.gif";
      const WELCOME_GIF_FALLBACK_URL = "/assets/mobile-eoi-part-1-form-assets/icons/handwave-fallback-icon.png";
      const WELCOME_STATIC_URL = "/assets/mobile-eoi-part-1-form-assets/icons/handwave-fallback-icon.png";
      const accessibilityTextSteps = Object.freeze(["much-smaller", "smaller", "default", "larger", "much-larger"]);
      const accessibilityTextLabels = Object.freeze({
        "much-smaller": "Much smaller",
        smaller: "Smaller",
        default: "Default",
        larger: "Larger",
        "much-larger": "Much larger"
      });
      const defaultAccessibilityPrefs = Object.freeze({
        text: "default",
        contrast: false,
        spacing: false,
        font: false,
        motion: false
      });

      let accessibilityPrefs = { ...defaultAccessibilityPrefs };
      let brandAnimationTimer = null;
      let current = 0;
      const SLIDES = Object.freeze({
        cover: 0,
        ageGate: 1,
        intro: 2,
        privacy: 3,
        personal: 4,
        preferences: 5,
        availability: 6,
        submitted: 7
      });
      const ADULT_AGE_ELIGIBILITY_VALUE = "18_OR_OVER";
      const UNDER_18_AGE_ELIGIBILITY_VALUE = "UNDER_18";
      const UNDER_18_PREFER_NOT_TO_SAY_VALUE = "PREFER_NOT_TO_SAY";
      const UNDER18_HOMEPAGE_URL = "https://www.gymfusion.com.au/";
      const LOCAL_PREVIEW_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0"];
      const UNDER18_SUBMIT_URL =
        window.EOI_UNDER18_SUBMIT_URL ||
        (LOCAL_PREVIEW_HOSTS.includes(window.location.hostname)
          ? "/api/preview/under18-service-demand-submit"
          : "https://www.gymfusion.com.au/_functions/under18_service_demand_submit");
      const UNDER18_TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
      const LOCAL_PREVIEW_UNDER18_STATE =
        LOCAL_PREVIEW_HOSTS.includes(window.location.hostname)
          ? String(contextParams.get("preview_under18_state") || "").trim().toLowerCase()
          : "";
      let pendingMenuDestinationUrl = "";
      let pendingMenuDestinationLabel = "";
      let pendingEmailAddress = "";
      let activeMenuButton = null;
      let activeMenu = null;
      let isRestoringProgress = false;
      let hasDirtyProgress = false;
      let submissionCompleted = false;
      const originalMenuAnchors = new Map();
      const validationDescribedBy = new WeakMap();
      const activeModalState = {
        element: null,
        trigger: null
      };

      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

      const slugifyValidationKey = (value) =>
        String(value || "validation")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

      const announceValidation = (message) => {
        if (!validationAnnouncer) return;
        validationAnnouncer.textContent = "";
        if (!message) return;
        window.requestAnimationFrame(() => {
          validationAnnouncer.textContent = message;
        });
      };

      const rememberValidationDescription = (element) => {
        if (!element || validationDescribedBy.has(element)) return;
        validationDescribedBy.set(element, element.getAttribute("aria-describedby") || "");
      };

      const setValidationDescription = (element, ids = []) => {
        if (!element) return;
        rememberValidationDescription(element);
        const original = validationDescribedBy.get(element) || "";
        const values = new Set(original.split(/\s+/).filter(Boolean));
        ids.filter(Boolean).forEach((id) => values.add(id));
        if (values.size) {
          element.setAttribute("aria-describedby", Array.from(values).join(" "));
        }
        element.setAttribute("aria-invalid", "true");
      };

      const clearValidationDescription = (element) => {
        if (!element) return;
        if (validationDescribedBy.has(element)) {
          const original = validationDescribedBy.get(element);
          if (original) element.setAttribute("aria-describedby", original);
          else element.removeAttribute("aria-describedby");
          validationDescribedBy.delete(element);
        } else {
          element.removeAttribute("aria-describedby");
        }
        element.removeAttribute("aria-invalid");
      };

      const setValidationState = (target, message, describedByIds = []) => {
        if (!target) return;
        const nodes = [
          target,
          ...(typeof target.querySelectorAll === "function"
            ? Array.from(target.querySelectorAll("input, select, textarea, button"))
            : [])
        ];
        nodes.forEach((node) => setValidationDescription(node, describedByIds));
        announceValidation(message);
      };

      const clearValidationState = (target) => {
        if (!target) return;
        const nodes = [
          target,
          ...(typeof target.querySelectorAll === "function"
            ? Array.from(target.querySelectorAll("input, select, textarea, button"))
            : [])
        ];
        nodes.forEach((node) => clearValidationDescription(node));
      };

      const getModalFocusableElements = (modal) =>
        Array.from(modal?.querySelectorAll?.("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") || [])
          .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null);

      const openModal = (modal, trigger) => {
        if (!modal) return;
        activeModalState.element = modal;
        activeModalState.trigger = trigger instanceof HTMLElement ? trigger : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        modal.hidden = false;
        window.requestAnimationFrame(() => {
          modal.classList.add("active");
          (getModalFocusableElements(modal)[0] || modal).focus?.({ preventScroll: true });
        });
      };

      const closeModal = (modal) => {
        if (!modal) return;
        modal.classList.remove("active");
        const trigger = modal === activeModalState.element ? activeModalState.trigger : null;
        if (modal === activeModalState.element) {
          activeModalState.element = null;
          activeModalState.trigger = null;
        }
        window.setTimeout(() => {
          if (!modal.classList.contains("active")) {
            modal.hidden = true;
            if (trigger instanceof HTMLElement && trigger.isConnected) {
              trigger.focus({ preventScroll: true });
            }
          }
        }, 220);
      };

      const trapActiveModalFocus = (event) => {
        const modal = activeModalState.element;
        if (!modal || modal.hidden) return;

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (modal === menuWarningModal) closeMenuWarning();
          else if (modal === emailWarningModal) closeEmailWarning();
          return;
        }

        if (event.key !== "Tab") return;

        const focusables = getModalFocusableElements(modal);
        if (!focusables.length) {
          event.preventDefault();
          modal.focus?.({ preventScroll: true });
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      };

      const keepFocusInsideModal = (event) => {
        const modal = activeModalState.element;
        if (!modal || modal.hidden) return;
        if (modal.contains(event.target)) return;
        const [firstFocusable] = getModalFocusableElements(modal);
        (firstFocusable || modal).focus?.({ preventScroll: true });
      };

      if (siteMenuLayer && siteMenuLayer.parentElement !== document.body) {
        document.body.appendChild(siteMenuLayer);
      }

      const storeMenuAnchor = (menu) => {
        if (!menu || originalMenuAnchors.has(menu)) return;
        originalMenuAnchors.set(menu, {
          parent: menu.parentNode,
          nextSibling: menu.nextSibling
        });
      };

      const restoreMenuAnchor = (menu) => {
        const anchor = menu ? originalMenuAnchors.get(menu) : null;
        if (!menu || !anchor?.parent) return;
        if (anchor.nextSibling) anchor.parent.insertBefore(menu, anchor.nextSibling);
        else anchor.parent.appendChild(menu);
      };

      const loadImageSource = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          const timer = window.setTimeout(() => reject(new Error("Image load timed out")), 1200);
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          image.onload = () => {
            window.clearTimeout(timer);
            resolve(src);
          };
          image.onerror = () => {
            window.clearTimeout(timer);
            reject(new Error("Image failed to load"));
          };
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

      const showBrandFallback = () => {
        if (!brandIcon) return;
        brandIcon.dataset.brandIconState = "dot";
      };

      const showBrandStaticIcon = () => {
        if (!brandIcon || !brandIconImage) return;
        window.clearTimeout(brandAnimationTimer);
        brandIconImage.onerror = () => {
          brandIcon.dataset.brandIconState = "dot";
        };
        brandIconImage.src = WELCOME_STATIC_URL;
        brandIcon.dataset.brandIconState = "image";
      };

      const syncBrandIcon = () => {
        if (!brandIcon || !brandIconImage) return;

        window.clearTimeout(brandAnimationTimer);

        if (current !== SLIDES.intro || deck.getAttribute("data-deck-state") !== "form") {
          brandIconImage.removeAttribute("src");
          brandIcon.dataset.brandIconState = "dot";
          return;
        }

        if (accessibilityPrefs.motion) {
          showBrandStaticIcon();
          return;
        }

        brandIconImage.removeAttribute("src");
        brandIcon.dataset.brandIconState = "dot";

        void brandIconImage.offsetWidth;

        const replayToken = Date.now();
        let fallbackAttempted = false;
        brandIconImage.onerror = () => {
          if (!fallbackAttempted) {
            fallbackAttempted = true;
            brandIconImage.src = `${WELCOME_GIF_FALLBACK_URL}?replay=${replayToken}`;
            return;
          }
          showBrandStaticIcon();
        };

        brandIconImage.src = `${WELCOME_GIF_URL}?replay=${replayToken}`;
        brandIcon.dataset.brandIconState = "image";

        brandAnimationTimer = window.setTimeout(() => {
          if (current !== SLIDES.intro || deck.getAttribute("data-deck-state") !== "form") return;
          showBrandStaticIcon();
        }, 2400);
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

      const closeSiteMenus = () => {
        siteMenuButtons.forEach((button) => {
          button.setAttribute("aria-expanded", "false");
        });
        if (activeMenu) {
          activeMenu.hidden = true;
          restoreMenuAnchor(activeMenu);
          activeMenu = null;
        }
        if (siteMenuLayer) siteMenuLayer.hidden = true;
        document.body.classList.remove("is-menu-open");
        activeMenuButton = null;
      };

      const toggleSiteMenu = (button) => {
        const menuId = button.getAttribute("aria-controls");
        const menu = menuId ? document.getElementById(menuId) : null;
        if (!menu) return;
        if (!siteMenuLayer) return;
        storeMenuAnchor(menu);
        const shouldOpen = menu.hidden || activeMenu !== menu;
        closeSiteMenus();
        if (!shouldOpen) return;

        siteMenuLayer.hidden = false;
        siteMenuLayer.appendChild(menu);
        menu.hidden = false;
        activeMenu = menu;
        activeMenuButton = button;

        button.setAttribute("aria-expanded", "true");
        document.body.classList.add("is-menu-open");

        const rect = button.getBoundingClientRect();
        menu.style.left = "0px";
        menu.style.top = "0px";
        menu.style.right = "auto";

        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;
        const desiredLeft = rect.left;
        const desiredTop = rect.bottom + 8;
        const left = clamp(desiredLeft, padding, Math.max(padding, viewportWidth - menuRect.width - padding));
        const top = clamp(desiredTop, padding, Math.max(padding, viewportHeight - menuRect.height - padding));
        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
      };

      const formatMenuDestinationLabel = (label) =>
        label
          .toLowerCase()
          .replace(/\b\w/g, (letter) => letter.toUpperCase());

      const openMenuWarning = (label, url) => {
        if (!menuWarningModal || !menuWarningDestination) return;
        pendingMenuDestinationUrl = url;
        pendingMenuDestinationLabel = formatMenuDestinationLabel(label);
        menuWarningDestination.textContent = pendingMenuDestinationLabel;
        openModal(menuWarningModal, document.activeElement instanceof HTMLElement ? document.activeElement : null);
        closeSiteMenus();
      };

      const openEmailWarning = (address) => {
        if (!emailWarningModal || !emailWarningAddress) return;
        pendingEmailAddress = String(address || "").trim();
        emailWarningAddress.textContent = pendingEmailAddress;
        openModal(emailWarningModal, document.activeElement instanceof HTMLElement ? document.activeElement : null);
        closeSiteMenus();
      };

      const closeMenuWarning = () => {
        if (!menuWarningModal) return;
        closeModal(menuWarningModal);
      };

      const closeEmailWarning = () => {
        if (!emailWarningModal) return;
        closeModal(emailWarningModal);
      };

      const confirmMenuNavigation = () => {
        const destinationUrl = pendingMenuDestinationUrl;
        closeMenuWarning();
        if (!destinationUrl) return;
        window.open(destinationUrl, "_blank", "noopener,noreferrer");
      };

      const copyTextToClipboard = async (text) => {
        if (!text) return false;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {
          // fall through to textarea fallback
        }
        try {
          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const copied = document.execCommand("copy");
          textarea.remove();
          return copied;
        } catch {
          return false;
        }
      };

      const openEmailApp = (address) => {
        const target = String(address || pendingEmailAddress || "").trim();
        if (!target) return;
        window.location.href = `mailto:${target}`;
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

      const initializeInlineCoverCarousel = () => {
        const cadenceMs = 300
        const transitionMs = 800
        const blackPeak = 0.48
        const fadeRestScale = 1.02

        const coverPage = document.querySelector('.cover-page')
        const carousel = coverPage?.querySelector('.carousel')
        const slides = carousel ? [...carousel.querySelectorAll('.slide')] : []
        const fadeLayer = carousel?.querySelector('.fade-black-layer')

        if (!carousel || slides.length < 2 || !fadeLayer) return

        slides.forEach((image) => {
          const fallbackSrc = image.getAttribute('data-fallback-src')
          if (!fallbackSrc) return
          image.addEventListener(
            'error',
            () => {
              if (image.src === fallbackSrc) return
              image.src = fallbackSrc
            },
            { once: true }
          )
        })

        let index = 0
        let timerId = null
        let transitioning = false
        let isPaused = false

        const stop = () => {
          if (timerId) {
            clearTimeout(timerId)
            timerId = null
          }
        }

        const transitionTo = async (nextIndex) => {
          if (transitioning || nextIndex === index) return
          transitioning = true

          const from = slides[index]
          const to = slides[nextIndex]

          from.style.zIndex = '2'
          to.style.zIndex = '3'
          to.style.opacity = '0'
          to.classList.add('is-active')

          const animations = [
            from.animate(
              [
                { opacity: 1, transform: `scale(${fadeRestScale})` },
                { opacity: 0, transform: `scale(${fadeRestScale + 0.015})` }
              ],
              { duration: transitionMs, easing: 'ease-in-out', fill: 'forwards' }
            ),
            to.animate(
              [
                { opacity: 0, transform: 'scale(0.985)' },
                { opacity: 1, transform: 'scale(1)', offset: 0.72 },
                { opacity: 1, transform: `scale(${fadeRestScale})` }
              ],
              { duration: transitionMs, easing: 'ease-in-out', fill: 'forwards' }
            ),
            fadeLayer.animate(
              [
                { opacity: 0 },
                { opacity: blackPeak, offset: 0.5 },
                { opacity: 0 }
              ],
              { duration: transitionMs, easing: 'ease-in-out', fill: 'forwards' }
            )
          ]

          await Promise.all(animations.map((a) => a.finished.catch(() => undefined)))

          from.classList.remove('is-active')
          from.style.opacity = '0'
          from.style.transform = 'translate3d(0, 0, 0) scale(1)'
          from.style.zIndex = '1'

          to.style.opacity = '1'
          to.style.transform = `translate3d(0, 0, 0) scale(${fadeRestScale})`
          to.style.zIndex = '2'
          fadeLayer.style.opacity = '0'

          index = nextIndex
          transitioning = false
        }

        const loop = async () => {
          if (isPaused || document.hidden) return

          const nextIndex = (index + 1) % slides.length
          await transitionTo(nextIndex)
          if (isPaused || document.hidden) return
          timerId = window.setTimeout(loop, Math.max(0, cadenceMs - transitionMs))
        }

        const start = () => {
          stop()
          if (isPaused || document.hidden) return
          slides.forEach((slide, slideIndex) => {
            slide.style.transform =
              slideIndex === 0
                ? `translate3d(0, 0, 0) scale(${fadeRestScale})`
                : 'translate3d(0, 0, 0) scale(1)'
          })
          timerId = window.setTimeout(loop, cadenceMs)
        }

        carousel.addEventListener('mouseenter', () => {
          isPaused = true
          stop()
        })
        carousel.addEventListener('mouseleave', () => {
          isPaused = false
          start()
        })
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) stop()
          else if (!isPaused) start()
        })

        start()
      };

      const syncAccessibilityButtons = () => {
        const index = Math.max(0, accessibilityTextSteps.indexOf(accessibilityPrefs.text));
        if (accessibilityTextSlider) {
          accessibilityTextSlider.min = "0";
          accessibilityTextSlider.max = String(accessibilityTextSteps.length - 1);
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

      const notifyGalleryMotionPreference = () => {
        if (!coverGalleryFrame) return;
        coverGalleryFrame.dataset.reducedMotion = String(accessibilityPrefs.motion);
        try {
          coverGalleryFrame.contentWindow?.postMessage?.({
            type: "gf-eoi-gallery-motion",
            motionReduced: accessibilityPrefs.motion
          }, window.location.origin);
        } catch {
          // Same-origin preview can still fail if the frame is not ready yet.
        }
      };

      const applyAccessibilityPrefs = () => {
        document.body.dataset.a11yText = accessibilityPrefs.text;
        accessibilityPrefs.contrast ? (document.body.dataset.a11yContrast = "high") : delete document.body.dataset.a11yContrast;
        accessibilityPrefs.spacing ? (document.body.dataset.a11ySpacing = "expanded") : delete document.body.dataset.a11ySpacing;
        accessibilityPrefs.font ? (document.body.dataset.a11yFont = "dyslexic") : delete document.body.dataset.a11yFont;
        accessibilityPrefs.motion ? (document.body.dataset.a11yMotion = "reduced") : delete document.body.dataset.a11yMotion;
        syncAccessibilityButtons();
        syncBrandIcon();
        notifyGalleryMotionPreference();
      };

      const toggleAccessibilityPanel = (forceOpen) => {
        if (!accessibilityToggle || !accessibilityPanel) return;
        const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : accessibilityPanel.hidden;
        accessibilityPanel.hidden = !shouldOpen;
        accessibilityToggle.setAttribute("aria-expanded", String(shouldOpen));
        document.body.classList.toggle("is-a11y-open", shouldOpen);
        applyAccessibilityTriggerIcon(shouldOpen);
      };

      accessibilityPrefs = { ...defaultAccessibilityPrefs };
      applyAccessibilityPrefs();
      initializeIconFallbacks();
      initializeMenuIcon();
      initializeCoverImageFallbacks();
      initializeInlineCoverCarousel();
      applyAccessibilityTriggerIcon(false);

      accessibilityToggle?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleAccessibilityPanel();
      });

      siteMenuButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleSiteMenu(button);
        });
      });

      siteMenus.forEach((menu) => {
        menu.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      });

      const getAnchorHref = (anchor) => String(anchor?.getAttribute("href") || "").trim();
      const isExternalHttpLink = (href) => /^https?:\/\//i.test(href);
      const isMailtoLink = (href) => /^mailto:/i.test(href);
      const getMailtoAddress = (href) => href.replace(/^mailto:/i, "").split("?")[0].trim();

      const handleExternalAnchorClick = (anchor, event) => {
        const href = getAnchorHref(anchor);
        if (!href || href.startsWith("#")) return false;
        if (isMailtoLink(href)) {
          event.preventDefault();
          event.stopPropagation();
          openEmailWarning(getMailtoAddress(href));
          return true;
        }
        if (isExternalHttpLink(href)) {
          event.preventDefault();
          event.stopPropagation();
          const label = anchor.closest(".site-menu-link")?.querySelector(".site-menu-label")?.textContent?.trim() || anchor.textContent.trim() || href;
          openMenuWarning(label, href);
          return true;
        }
        return false;
      };

      siteMenuLinks.forEach((link) => {
        link.addEventListener("click", (event) => {
          handleExternalAnchorClick(link, event);
        });
      });

      document.addEventListener("click", (event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!anchor) return;
        if (anchor.classList.contains("site-menu-link")) return;
        handleExternalAnchorClick(anchor, event);
      }, true);

      menuWarningStay?.addEventListener("click", closeMenuWarning);
      menuWarningLeave?.addEventListener("click", confirmMenuNavigation);
      menuWarningModal?.addEventListener("click", (event) => {
        if (event.target === menuWarningModal) {
          closeMenuWarning();
        }
      });
      emailWarningStay?.addEventListener("click", closeEmailWarning);
      emailWarningCopy?.addEventListener("click", async () => {
        const copied = await copyTextToClipboard(pendingEmailAddress);
        if (copied) {
          const original = emailWarningCopy.textContent;
          emailWarningCopy.textContent = "Email copied";
          window.setTimeout(() => {
            emailWarningCopy.textContent = original;
          }, 1200);
        }
      });
      emailWarningOpen?.addEventListener("click", () => {
        const address = pendingEmailAddress;
        closeEmailWarning();
        openEmailApp(address);
      });
      emailWarningModal?.addEventListener("click", (event) => {
        if (event.target === emailWarningModal) {
          closeEmailWarning();
        }
      });

      document.addEventListener("keydown", trapActiveModalFocus, true);
      document.addEventListener("focusin", keepFocusInsideModal, true);

      accessibilityTextSlider?.addEventListener("input", () => {
        const index = Number(accessibilityTextSlider.value);
        accessibilityPrefs.text = accessibilityTextSteps[index] || defaultAccessibilityPrefs.text;
        applyAccessibilityPrefs();
      });

      accessibilityToggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const key = button.getAttribute("data-a11y-toggle");
          if (key === "contrast") accessibilityPrefs.contrast = !accessibilityPrefs.contrast;
          if (key === "spacing") accessibilityPrefs.spacing = !accessibilityPrefs.spacing;
          if (key === "font") accessibilityPrefs.font = !accessibilityPrefs.font;
          if (key === "motion") accessibilityPrefs.motion = !accessibilityPrefs.motion;
          applyAccessibilityPrefs();
        });
      });

      accessibilityReset?.addEventListener("click", () => {
        accessibilityPrefs = { ...defaultAccessibilityPrefs };
        applyAccessibilityPrefs();
      });

      document.addEventListener("click", (event) => {
        if (
          event.target instanceof Node &&
          !siteMenuButtons.some((button) => button.contains(event.target)) &&
          !siteMenus.some((menu) => menu.contains(event.target))
        ) {
          closeSiteMenus();
        }
        if (
          accessibilityPanel &&
          !accessibilityPanel.hidden &&
          event.target instanceof Node &&
          accessibilityTools &&
          !accessibilityTools.contains(event.target)
        ) {
          toggleAccessibilityPanel(false);
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closeMenuWarning();
        closeSiteMenus();
        toggleAccessibilityPanel(false);
      });

      const pages = Array.from(deck.querySelectorAll(".deck-page"));
      const pageRoot = document.querySelector(".page");
      let firstInvalidTarget = null;
      let maxUnlockedProgressStep = 0;
      let maxUnlockedSlideIndex = 0;
      const recompletedProgressSteps = new Set();

      const getPreviewStepIndex = (step) => {
        const label = step.querySelector("strong")?.textContent || "";
        return Number.parseInt(label, 10);
      };

      const getProgressStepForSlide = (slideIndex) => {
        if (slideIndex < SLIDES.intro) return 0;
        return Math.min(Math.max(slideIndex - 1, 1), 6);
      };

      const getPreviewStepTargetIndex = (stepIndex) => {
        return stepIndex + 1;
      };

      const canNavigateByPreviewStep = (targetIndex) => current >= SLIDES.privacy && targetIndex <= maxUnlockedSlideIndex;

      const syncPreviewSteps = () => {
        const activeProgressStep = getProgressStepForSlide(current);
        const hasReachedStepThree = maxUnlockedSlideIndex >= SLIDES.personal;
        const showStartReturnLocks = hasReachedStepThree && current === SLIDES.intro;
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
        deck.style.setProperty("--slide-index", String(current));
        syncDeckState(current);
        syncBrandIcon();
        syncPreviewSteps();
      };

      const syncDeckState = (index) => {
        const deckState = Number(index) === SLIDES.cover ? "cover" : "form";
        deck.setAttribute("data-deck-state", deckState);
        pageRoot?.setAttribute("data-deck-state", deckState);
      };

      const getProgressControlKey = (control, index) => {
        if (!control) return `control-${index}`;
        if (control.name) return `${control.tagName.toLowerCase()}[name="${control.name}"]`;
        if (control.id) return `#${control.id}`;
        const field = control.getAttribute("data-field");
        if (field) return `${control.tagName.toLowerCase()}[data-field="${field}"]`;
        return `${control.tagName.toLowerCase()}:${index}`;
      };

      const getSelectedButtonState = (button) => ({
        kind: button.getAttribute("data-option-group")
          ? "option"
          : button.getAttribute("data-choice-group")
            ? "choice"
            : "matrix",
        group:
          button.getAttribute("data-option-group") ||
          button.getAttribute("data-choice-group") ||
          button.getAttribute("data-matrix-group") ||
          "",
        value: button.getAttribute("data-value") || button.getAttribute("data-day") || button.getAttribute("data-time") || button.textContent.trim(),
        day: button.getAttribute("data-day") || "",
        time: button.getAttribute("data-time") || ""
      });

      // Progress answer persistence intentionally disabled for privacy/shared-device safety.
      // Do not store form answers in browser storage.

      const markProgressDirty = () => {
        if (isRestoringProgress || submissionCompleted) return;
        hasDirtyProgress = true;
      };

      const clearProgressDirty = () => {
        hasDirtyProgress = false;
      };

      const clearErrors = () => {
        deck.querySelectorAll(".field.is-invalid").forEach((field) => field.classList.remove("is-invalid"));
        deck.querySelectorAll(".availability-grid.is-invalid").forEach((grid) => grid.classList.remove("is-invalid"));
        deck.querySelectorAll(".select-field.is-invalid").forEach((field) => field.classList.remove("is-invalid"));
        deck.querySelectorAll(".option-grid.is-invalid").forEach((grid) => grid.classList.remove("is-invalid"));
        deck.querySelectorAll("[aria-invalid='true'], [data-validation-original-describedby]").forEach((node) => {
          clearValidationDescription(node);
        });
        deck.querySelectorAll(".option-group-error").forEach((error) => error.remove());
        announceValidation("");
      };

      const markInvalid = (selector, message) => {
        const field = deck.querySelector(selector);
        if (!field) return;
        const target = field.closest(".field") || field.closest(".availability-grid") || field.closest(".gradient-check") || field;
        const errorNode = target.querySelector?.(".form-error") || (target.nextElementSibling?.classList?.contains("form-error") ? target.nextElementSibling : null);
        const describedByIds = [];
        if (errorNode) {
          if (!errorNode.id) {
            errorNode.id = `validation-${slugifyValidationKey(selector)}-error`;
          }
          describedByIds.push(errorNode.id);
        }
        target.classList.add("is-invalid");
        setValidationState(target, message, describedByIds);
        if (!firstInvalidTarget) firstInvalidTarget = target;
      };

      const clearOptionGroupError = (button) => {
        const grid = button?.closest?.(".option-grid");
        if (!grid) return;
        grid.classList.remove("is-invalid");
        clearValidationState(grid);
        const next = grid.nextElementSibling;
        if (next?.classList?.contains("option-group-error")) {
          next.remove();
        }
      };

      const markOptionGroupInvalid = (selector, message = "Please select a response") => {
        const button = deck.querySelector(selector);
        const grid = button?.closest?.(".option-grid");
        if (!grid) return;
        grid.classList.add("is-invalid");
        if (!grid.nextElementSibling?.classList?.contains("option-group-error")) {
          const error = document.createElement("div");
          error.className = "option-group-error";
          error.id = `validation-${slugifyValidationKey(selector)}-error`;
          error.textContent = message;
          grid.insertAdjacentElement("afterend", error);
        }
        const errorNode = grid.nextElementSibling?.classList?.contains("option-group-error") ? grid.nextElementSibling : null;
        const describedByIds = errorNode?.id ? [errorNode.id] : [];
        setValidationState(grid, message, describedByIds);
        if (!firstInvalidTarget) firstInvalidTarget = grid;
      };

      const hasValue = (input) => {
        if (!input) return false;
        if (input.type === "checkbox") return input.checked;
        if (input.tagName === "SELECT") {
          const selected = input.options[input.selectedIndex];
          return String(input.value || selected?.textContent || "").trim().length > 0;
        }
        return String(input.value || "").trim().length > 0;
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
          syncAvailabilitySlotLabel(button);
        });
      };

      const updateAvailabilitySubmit = () => {
        const submit = deck.querySelector("[data-availability-submit]");
        if (!submit) return;
        const hasSelection = Boolean(deck.querySelector("[data-matrix-group].is-selected"));
        submit.classList.toggle("is-hidden", !hasSelection);
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
            if (grid) {
              grid.classList.remove("is-invalid");
              clearValidationState(grid);
            }
          }
        }
        if (fusionCard) {
          fusionCard.style.display = showFusion ? "block" : "none";
          if (!showFusion) {
            clearMatrixSelections('[data-matrix-group="fusion_afternoon"]');
            clearMatrixSelections('[data-matrix-group="fusion_friday"]');
            const grid = deck.querySelector('[aria-label="Fusion classes availability"]');
            const friday = deck.querySelector('[aria-label="Fusion Friday morning availability"]');
            if (grid) {
              grid.classList.remove("is-invalid");
              clearValidationState(grid);
            }
            if (friday) {
              friday.classList.remove("is-invalid");
              clearValidationState(friday);
            }
          }
        }
        updateSelectionSummaries();
      };

      const updateSelectionSummaries = () => {
        deck.querySelectorAll("[data-summary]").forEach((summary) => {
          const group = summary.getAttribute("data-summary");
          const selections = Array.from(deck.querySelectorAll(`[data-summary-group="${group}"].is-selected`));
          const summaryTitle = deck.querySelector(`[data-summary-title="${group}"]`);
          if (selections.length === 0) {
            summary.classList.add("is-hidden");
            if (summaryTitle) summaryTitle.classList.add("is-hidden");
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
          if (summaryTitle) summaryTitle.classList.remove("is-hidden");
        });
        updateAvailabilitySubmit();
      };

      const updatePostalVisibility = (value) => {
        const postalFields = document.getElementById("postal-address-fields");
        if (!postalFields) return;
        const showPostal = value === "No";
        postalFields.style.display = showPostal ? "block" : "none";
        postalFields.hidden = !showPostal;

        postalFields.querySelectorAll("input, select, textarea").forEach((control) => {
          const otherWrapper = control.closest("[data-other-field]");
          const isOtherControl = Boolean(otherWrapper);
          if (!showPostal) {
            control.required = false;
            control.value = "";
            control.setCustomValidity?.("");
            control.closest(".field")?.classList.remove("is-invalid");
            clearValidationDescription(control);
            return;
          }
          if (!isOtherControl) {
            control.required = true;
          }
        });
        if (!showPostal) {
          clearValidationState(postalFields);
        }

        postalFields.querySelectorAll("[data-other-field]").forEach((field) => {
          const select = postalFields.querySelector(`select[data-other-target="${field.getAttribute("data-other-field")}"]`);
          const shouldShow = showPostal && select && (select.value || "").startsWith("Other");
          field.hidden = !shouldShow;
          field.classList.toggle("is-hidden", !shouldShow);
          field.style.setProperty("display", shouldShow ? "grid" : "none", "important");
          field.style.setProperty("visibility", shouldShow ? "visible" : "hidden", "important");
          const input = field.querySelector("input, select, textarea");
          if (input) {
            input.required = Boolean(shouldShow);
            if (!shouldShow) {
              input.value = "";
              input.setCustomValidity?.("");
              input.closest(".field")?.classList.remove("is-invalid");
              clearValidationDescription(input);
            }
          }
          if (!shouldShow) {
            clearValidationState(field);
          }
        });
      };

      const updateSecondPreferenceVisibility = () => {
        const trainingType = getSelectedText('[data-option-group="training-type"].is-selected');
        const card = deck.querySelector('[data-conditional-card="second-preference"]');
        if (!card) return;
        const show = trainingType === "1:1 Fitness Coaching";
        card.style.display = show ? "block" : "none";
        if (!show) {
          card.querySelectorAll(".option-grid.is-invalid").forEach((grid) => {
            grid.classList.remove("is-invalid");
            clearValidationState(grid);
            if (grid.nextElementSibling?.classList?.contains("option-group-error")) {
              grid.nextElementSibling.remove();
            }
          });
          card.querySelectorAll('[data-choice-group="second_preference"]').forEach((btn) => {
            btn.classList.remove("is-selected");
            btn.setAttribute("aria-pressed", "false");
          });
          clearValidationState(card);
        }
        updateAvailabilityVisibility();
      };

      const isSlide4Complete = () => {
        const trainingType = deck.querySelector('[data-option-group="training-type"].is-selected');
        const secondPreferenceCard = deck.querySelector('[data-conditional-card="second-preference"]');
        const secondPreference = deck.querySelector('[data-choice-group="second_preference"].is-selected');
        const workShift = deck.querySelector('[data-choice-group="work_shift"].is-selected');
        const secondPreferenceRequired = secondPreferenceCard && secondPreferenceCard.style.display !== "none";
        return Boolean(trainingType && workShift && (!secondPreferenceRequired || secondPreference));
      };

      const maybeScrollSlide4ToContinue = () => {
        if (current !== SLIDES.preferences || !isSlide4Complete()) return;
        scrollCurrentPageToFooter();
      };

      const validateStep = (index) => {
        firstInvalidTarget = null;
        clearErrors();

        if (index === SLIDES.intro) {
          const missingCheckbox = Array.from(deck.querySelectorAll("[data-intro-ack]")).find((checkbox) => !hasValue(checkbox));
          if (missingCheckbox) {
            const target = missingCheckbox.closest(".gradient-check") || missingCheckbox;
            setValidationState(target, "Please confirm both acknowledgements.");
            target.classList.add("is-invalid");
            firstInvalidTarget = target;
            return false;
          }
          return true;
        }

        if (index === SLIDES.privacy) {
          const privacyConsent = deck.querySelector('input[name="privacy_consent"]');
          if (!hasValue(privacyConsent)) {
            const target = privacyConsent?.closest(".gradient-check") || privacyConsent;
            setValidationState(target, "Please confirm the privacy notice.");
            target.classList.add("is-invalid");
            firstInvalidTarget = target;
            return false;
          }
          return true;
        }

        if (index === SLIDES.personal) {
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
            markInvalid('[data-field="first_name"]', "First name is required.");
            valid = false;
          }
          if (!hasValue(lastName)) {
            markInvalid('[data-field="last_name"]', "Last name is required.");
            valid = false;
          }
          if (!hasValue(ageBand)) {
            markInvalid('select[name="age_band"]', "Age band is required.");
            valid = false;
          }
          if (!hasValue(sexAtBirth)) {
            markInvalid('select[name="sex_at_birth"]', "Please select a response.");
            valid = false;
          }
          if (!hasValue(resAddress)) {
            markInvalid('input[name="res_address"]', "Street address is required.");
            valid = false;
          }
          if (!hasValue(resSuburb)) {
            markInvalid('select[name="res_suburb"]', "Suburb is required.");
            valid = false;
          }
          if (!hasValue(resState)) {
            markInvalid('select[name="res_state"]', "State is required.");
            valid = false;
          }
          if (resSuburb && resSuburb.value.startsWith("Other") && !hasValue(resSuburbOther)) {
            markInvalid('input[name="res_suburb_other"]', "Please specify your suburb.");
            valid = false;
          }
          if (resState && resState.value.startsWith("Other") && !hasValue(resStateOther)) {
            markInvalid('input[name="res_state_other"]', "Please specify your state.");
            valid = false;
          }
          if (!hasValue(resPostcode)) {
            markInvalid('input[name="res_postcode"]', "Postcode is required.");
            valid = false;
          }
          if (sexAtBirth && sexAtBirth.value.startsWith("Another term") && !hasValue(sexAtBirthOther)) {
            markInvalid('input[name="sex_at_birth_other"]', "Please specify your response.");
            valid = false;
          }
          if (!postalSame) {
            markOptionGroupInvalid('[data-choice-group="postal_same"]', "Please select a response.");
            valid = false;
          }
          if (!hasValue(email) || !email.checkValidity()) {
            markInvalid('[data-field="email"]', "A valid email address is required.");
            valid = false;
          }
          if (!hasValue(confirmEmail) || !confirmEmail.checkValidity()) {
            markInvalid('[data-field="confirm_email"]', "A valid email address is required.");
            valid = false;
          }
          const normalizedEmail = String(email?.value || "").trim().toLowerCase();
          const normalizedConfirmEmail = String(confirmEmail?.value || "").trim().toLowerCase();
          if (normalizedEmail && normalizedConfirmEmail && normalizedEmail !== normalizedConfirmEmail) {
            markInvalid('[data-field="confirm_email"]', "Email addresses must match.");
            valid = false;
          }
          if (!hasValue(mobile) || !isValidMobile(mobile)) {
            markInvalid('[data-field="mobile"]', "Enter a 10-digit mobile number.");
            valid = false;
          }
          if (!hasValue(confirmMobile) || !isValidMobile(confirmMobile)) {
            markInvalid('[data-field="confirm_mobile"]', "Enter a 10-digit mobile number.");
            valid = false;
          }
          const normalizedMobile = String(mobile?.value || "").replace(/\D/g, "");
          const normalizedConfirmMobile = String(confirmMobile?.value || "").replace(/\D/g, "");
          if (normalizedMobile && normalizedConfirmMobile && normalizedMobile !== normalizedConfirmMobile) {
            markInvalid('[data-field="confirm_mobile"]', "Mobile numbers must match.");
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
              markInvalid('input[name="postal_address"]', "Postal address is required.");
              valid = false;
            }
            if (!hasValue(postalSuburb)) {
              markInvalid('select[name="postal_suburb"]', "Suburb is required.");
              valid = false;
            }
            if (!hasValue(postalState)) {
              markInvalid('select[name="postal_state"]', "State is required.");
              valid = false;
            }
            if (postalSuburb && postalSuburb.value.startsWith("Other") && !hasValue(postalSuburbOther)) {
              markInvalid('input[name="postal_suburb_other"]', "Please specify your postal suburb.");
              valid = false;
            }
            if (postalState && postalState.value.startsWith("Other") && !hasValue(postalStateOther)) {
              markInvalid('input[name="postal_state_other"]', "Please specify your postal state.");
              valid = false;
            }
            if (!hasValue(postalPostcode)) {
              markInvalid('input[name="postal_postcode"]', "Postcode is required.");
              valid = false;
            }
          }

          return valid;
        }

        if (index === SLIDES.preferences) {
          const trainingType = deck.querySelector('[data-option-group="training-type"].is-selected');
          const secondPreferenceCard = deck.querySelector('[data-conditional-card="second-preference"]');
          const secondPreference = deck.querySelector('[data-choice-group="second_preference"].is-selected');
          const workShift = deck.querySelector('[data-choice-group="work_shift"].is-selected');
          const secondPreferenceRequired = secondPreferenceCard && secondPreferenceCard.style.display !== "none";
          let valid = true;
          if (!trainingType) {
            markOptionGroupInvalid('[data-option-group="training-type"]', "Please select a training type.");
            valid = false;
          }
          if (secondPreferenceRequired && !secondPreference) {
            markOptionGroupInvalid('[data-choice-group="second_preference"]', "Please select a response.");
            valid = false;
          }
          if (!workShift) {
            markOptionGroupInvalid('[data-choice-group="work_shift"]', "Please select a response.");
            valid = false;
          }
          return valid;
        }

        if (index === SLIDES.availability) {
          if (deck.querySelector("[data-matrix-group].is-selected")) return true;
          const firstVisibleGrid = Array.from(deck.querySelectorAll(".availability-grid")).find((grid) => {
            const card = grid.closest("[data-availability-card]");
            return !card || card.style.display !== "none";
          });
          if (firstVisibleGrid) {
            firstVisibleGrid.classList.add("is-invalid");
            setValidationState(firstVisibleGrid, "Please select at least one availability slot.");
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
        maybeScrollSlide4ToContinue();
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
        maybeScrollSlide4ToContinue();
      };

      const updateMatrixGroup = (button) => {
        button.classList.toggle("is-selected");
        button.setAttribute("aria-pressed", button.classList.contains("is-selected") ? "true" : "false");
        syncAvailabilitySlotLabel(button);
        const grid = button.closest(".availability-grid");
        if (grid) {
          grid.classList.remove("is-invalid");
          clearValidationState(grid);
        }
        updateSelectionSummaries();
      };

      const syncAvailabilitySlotLabel = (button) => {
        if (!button?.matches?.("[data-matrix-group]")) return;
        const action = button.classList.contains("is-selected") ? "Deselect" : "Select";
        const day = button.getAttribute("data-day") || "day";
        const time = button.getAttribute("data-time") || "time";
        button.setAttribute("aria-label", `${action} ${day}, ${time}`);
      };

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

      deck.querySelectorAll("input, select, textarea").forEach((control) => {
        control.addEventListener("input", () => {
          markProgressDirty();
          const field = control.closest(".field");
          if (field) field.classList.remove("is-invalid");
          clearValidationState(field || control.closest(".option-grid") || control.closest(".availability-grid") || control);
        });
        control.addEventListener("change", () => {
          markProgressDirty();
          const field = control.closest(".field");
          if (field) field.classList.remove("is-invalid");
          if (control.classList.contains("select-field")) {
            control.classList.remove("is-invalid");
          }
          clearValidationState(field || control.closest(".option-grid") || control.closest(".availability-grid") || control);
        });
      });

      const introCheckboxes = Array.from(deck.querySelectorAll("[data-intro-ack]"));
      const introConfirm = deck.querySelector("[data-intro-confirm]");
      const privacyCheckbox = deck.querySelector('input[name="privacy_consent"]');
      const privacyConfirm = deck.querySelector("[data-privacy-confirm]");
      const ageGatePanel = deck.querySelector("[data-age-eligibility-panel]");
      const ageGateScroll = deck.querySelector(".age-gate-scroll");
      const ageGateView = deck.querySelector('[data-age-eligibility-view="gate"]');
      const ageGateButtons = Array.from(deck.querySelectorAll("[data-age-eligibility-choice]"));
      const under18Panel = deck.querySelector("[data-under18-soft-exit]");
      const under18Processing = deck.querySelector("[data-under18-processing]");
      const under18Success = deck.querySelector("[data-under18-success]");
      const under18Failure = deck.querySelector("[data-under18-failure]");
      const under18AgeBandButtons = Array.from(deck.querySelectorAll("[data-under18-age-band]"));
      const under18SubmitButtons = Array.from(deck.querySelectorAll("[data-under18-submit]"));
      const under18ActionFooter = deck.querySelector("[data-under18-actions]");
      const under18HomeExitButton = deck.querySelector("[data-under18-home-exit]");
      const under18RetryButton = deck.querySelector("[data-under18-retry]");
      const under18HomeButtons = Array.from(deck.querySelectorAll("[data-under18-home]"));
      const under18TurnstileHost = deck.querySelector("[data-under18-turnstile]");
      const under18TurnstileMessage = deck.querySelector("[data-under18-turnstile-message]");
      const scrollIdleTimers = new WeakMap();
      let selectedAgeEligibility = "";
      let under18SelectedAgeBand = "";
      let under18SubmissionInFlight = false;
      let under18TurnstileToken = "";
      let under18TurnstileScriptPromise = null;
      let under18TurnstileWidgetId = null;

      const markScrollActive = (scroller) => {
        if (!scroller) return;
        scroller.classList.add("is-scrolling");
        window.clearTimeout(scrollIdleTimers.get(scroller));
        scrollIdleTimers.set(scroller, window.setTimeout(() => {
          scroller.classList.remove("is-scrolling");
        }, 650));
      };

      deck.querySelectorAll(".content-scroll").forEach((scroller) => {
        scroller.addEventListener("scroll", () => markScrollActive(scroller), { passive: true });
        scroller.addEventListener("touchstart", () => markScrollActive(scroller), { passive: true });
        scroller.addEventListener("pointerdown", () => markScrollActive(scroller), { passive: true });
        scroller.addEventListener("wheel", () => markScrollActive(scroller), { passive: true });
      });

      const scrollCurrentPageToFooter = () => {
        const currentPage = pages[current];
        if (!currentPage) return;
        const scroller = currentPage.querySelector(".content-scroll");
        const footer = currentPage.querySelector(".footer-actions");
        if (!scroller || !footer) return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const footerSafeInset = 72;
            const targetTop = Math.max(0, footer.offsetTop + footer.offsetHeight - scroller.clientHeight + footerSafeInset);
            scroller.scrollTo({
              top: targetTop,
              behavior: "smooth"
            });
          });
        });
      };

      const isVisibleInScroller = (element, scroller) => {
        if (!element || !scroller) return true;
        const elementRect = element.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        return elementRect.top >= scrollerRect.top + 12 && elementRect.bottom <= scrollerRect.bottom - 12;
      };

      const scrollCurrentPageToElement = (element) => {
        const currentPage = pages[current];
        if (!currentPage || !element) return;
        const scroller = currentPage.querySelector(".content-scroll");
        if (!scroller || isVisibleInScroller(element, scroller)) return;
        const scrollerRect = scroller.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const targetTop = Math.max(0, scroller.scrollTop + elementRect.top - scrollerRect.top - 16);
        scroller.scrollTo({
          top: targetTop,
          behavior: "smooth"
        });
      };

      const scrollToFirstInvalid = () => {
        if (current === SLIDES.submitted || !firstInvalidTarget) return;
        scrollCurrentPageToElement(firstInvalidTarget);
      };

      const scrollToNextUncheckedCheckbox = (checkboxes) => {
        const currentPage = pages[current];
        if (!currentPage) return false;
        const nextCheckbox = checkboxes.find((checkbox) => !checkbox.checked && currentPage.contains(checkbox));
        if (!nextCheckbox) return false;
        scrollCurrentPageToElement(nextCheckbox.closest(".gradient-check") || nextCheckbox);
        return true;
      };

      const resetEntryScroll = (targetIndex) => {
        if (targetIndex <= 0) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scroller = pages[targetIndex]?.querySelector(".content-scroll");
            if (scroller) scroller.scrollTop = 0;
          });
        });
      };

      const scrollActiveStepperIntoView = (targetIndex) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const stepper = pages[targetIndex]?.querySelector(".preview-stepper");
            const activeStep = stepper?.querySelector(".preview-step.is-active");
            if (!stepper || !activeStep) return;
            const stepperRect = stepper.getBoundingClientRect();
            const activeRect = activeStep.getBoundingClientRect();
            const targetLeft = stepper.scrollLeft + activeRect.left - stepperRect.left - ((stepperRect.width - activeRect.width) / 2);
            stepper.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
          });
        });
      };

      const handleBeforeUnload = (event) => {
        if (!hasDirtyProgress || submissionCompleted) return;
        event.preventDefault();
        event.returnValue = "";
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      const navigateToSlide = (index) => {
        const targetIndex = Math.max(0, Math.min(index, pages.length - 1));
        if (targetIndex === 0) {
          maxUnlockedProgressStep = 0;
          maxUnlockedSlideIndex = 0;
        } else if (targetIndex === 1 || targetIndex === 2) {
          maxUnlockedProgressStep = Math.max(maxUnlockedProgressStep, getProgressStepForSlide(targetIndex));
          maxUnlockedSlideIndex = Math.max(maxUnlockedSlideIndex, targetIndex);
        } else {
          maxUnlockedProgressStep = Math.max(maxUnlockedProgressStep, getProgressStepForSlide(targetIndex));
          maxUnlockedSlideIndex = Math.max(maxUnlockedSlideIndex, targetIndex);
        }
        syncDeckState(targetIndex);
        setSlide(targetIndex);
        resetEntryScroll(targetIndex);
        scrollActiveStepperIntoView(targetIndex);
      };

      const resetFormStateForClose = () => {
        const form = deck.querySelector("form");
        if (form) form.reset();

        deck.querySelectorAll("input, textarea, select").forEach((control) => {
          if (control.matches("[data-a11y-toggle], .text-scale-slider")) return;
          if (control.type === "checkbox" || control.type === "radio") {
            control.checked = false;
          } else if (control.tagName === "SELECT") {
            control.selectedIndex = 0;
          } else {
            control.value = "";
          }
          clearValidationDescription(control);
        });

        deck.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
        deck.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
        deck.querySelectorAll(".option-grid.is-invalid, .availability-grid.is-invalid").forEach((el) => el.classList.remove("is-invalid"));
        deck.querySelectorAll("[aria-invalid='true'], [data-validation-original-describedby]").forEach((node) => clearValidationDescription(node));

        deck.querySelectorAll("[aria-pressed='true']").forEach((el) => el.setAttribute("aria-pressed", "false"));
        deck.querySelectorAll("[aria-selected='true']").forEach((el) => el.setAttribute("aria-selected", "false"));
        deck.querySelectorAll("[aria-checked='true']").forEach((el) => {
          if (!el.matches("[data-a11y-toggle]")) el.setAttribute("aria-checked", "false");
        });

        deck.querySelectorAll(".form-error, .option-group-error").forEach((el) => {
          el.textContent = "";
          el.hidden = true;
          el.style.visibility = "hidden";
          el.style.opacity = "0";
        });

        deck.querySelectorAll(".selection-summary").forEach((el) => {
          el.classList.add("is-hidden");
          el.textContent = "";
        });

        deck.querySelectorAll(".selection-summary-title").forEach((el) => {
          el.classList.add("is-hidden");
        });

        deck.querySelectorAll(".content-scroll").forEach((el) => {
          el.scrollTop = 0;
        });
        deck.querySelectorAll(".preview-stepper").forEach((el) => {
          el.scrollLeft = 0;
        });

        introCheckboxes.forEach((checkbox) => {
          checkbox.checked = false;
        });
        if (privacyCheckbox) privacyCheckbox.checked = false;
        updateIntroConfirm();
        updatePrivacyConfirm();
        updatePronounsOther();
        updatePostalVisibility("Yes");
        updateSecondPreferenceVisibility();
        updateAvailabilityVisibility();
        updateSelectionSummaries();
        showAgeEligibilityGate();
        sessionStorage.removeItem("gymfusion_eoi_part1_submission_id");
        delete window.__GYMFUSION_EOI_PART1_SUBMISSION_ID__;
        deck.querySelectorAll(".preview-step").forEach((step, index) => {
          step.classList.toggle("is-active", index === 0);
          step.classList.toggle("is-complete", false);
          step.classList.toggle("is-locked", index > 0);
        });
        clearProgressDirty();
        submissionCompleted = false;
      };

      const updateIntroConfirm = (shouldAutoScroll = false) => {
        if (!introCheckboxes.length || !introConfirm) return;
        const adultReady = introCheckboxes.every((checkbox) => checkbox.checked);
        introConfirm.classList.toggle("is-hidden", !adultReady);
        introConfirm.closest(".footer-actions")?.classList.toggle("is-revealed", adultReady);
        if (!shouldAutoScroll) return;
        if (!adultReady) {
          scrollToNextUncheckedCheckbox(introCheckboxes);
        } else {
          scrollCurrentPageToFooter();
        }
      };
      const updatePrivacyConfirm = (shouldAutoScroll = false) => {
        if (!privacyCheckbox || !privacyConfirm) return;
        const isVisible = privacyCheckbox.checked;
        privacyConfirm.classList.toggle("is-hidden", !isVisible);
        privacyConfirm.closest(".footer-actions")?.classList.toggle("is-revealed", isVisible);
        if (!shouldAutoScroll) return;
        if (!isVisible) {
          scrollCurrentPageToElement(privacyCheckbox.closest(".gradient-check") || privacyCheckbox);
        } else {
          scrollCurrentPageToFooter();
        }
      };

      deck.querySelectorAll("[data-action='start']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          showAgeEligibilityGate();
          navigateToSlide(SLIDES.ageGate);
        });
      });

      deck.querySelectorAll("[data-action='back']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          navigateToSlide(current - 1);
        });
      });

      deck.querySelectorAll("[data-action='next']").forEach((button) => {
        button.addEventListener("click", () => {
          if (button.hasAttribute("data-availability-submit")) {
            return;
          }
          markProgressDirty();
          if (!validateStep(current)) {
            scrollToFirstInvalid();
            return;
          }
          if (maxUnlockedSlideIndex > current) {
            recompletedProgressSteps.add(getProgressStepForSlide(current));
          }
          navigateToSlide(current + 1);
        });
      });

      deck.querySelectorAll("[data-action='restart']").forEach((button) => {
        button.addEventListener("click", () => {
          markProgressDirty();
          navigateToSlide(0);
        });
      });

      deck.querySelectorAll("[data-action='close-form']").forEach((button) => {
        button.addEventListener("click", () => {
          closeSiteMenus();
          toggleAccessibilityPanel(false);
          resetFormStateForClose();
          navigateToSlide(0);
          syncDeckState(0);
        });
      });

      deck.querySelectorAll(".preview-step").forEach((step) => {
        const goToCompletedStep = () => {
          markProgressDirty();
          const stepIndex = getPreviewStepIndex(step);
          if (!Number.isFinite(stepIndex)) return;
          const targetIndex = getPreviewStepTargetIndex(stepIndex);
          if (targetIndex > current) {
            if (!validateStep(current)) {
              scrollToFirstInvalid();
            }
            return;
          }
          if (stepIndex > maxUnlockedProgressStep) return;
          if (!step.classList.contains("is-complete")) return;
          if (!canNavigateByPreviewStep(targetIndex)) return;
          navigateToSlide(targetIndex);
        };
        step.addEventListener("click", goToCompletedStep);
        step.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          markProgressDirty();
          goToCompletedStep();
        });
      });

      const updateOtherField = (select) => {
        const target = select.getAttribute("data-other-target");
        if (!target) return;
        const field = deck.querySelector(`[data-other-field="${target}"]`);
        if (!field) return;

        const value = String(select.value || "").trim();
        const postalWrapper = field.closest("#postal-address-fields");
        const postalVisible = !postalWrapper || postalWrapper.style.display !== "none";
        const show = Boolean(postalVisible && (value === "Another term" || value.startsWith("Other")));

        field.hidden = !show;
        field.classList.toggle("is-hidden", !show);
        field.style.setProperty("display", show ? "grid" : "none", "important");
        field.style.setProperty("visibility", show ? "visible" : "hidden", "important");

        field.querySelectorAll("input, select, textarea").forEach((input) => {
          input.required = show;
          input.disabled = !show;
          if (!show) {
            input.value = "";
            input.setCustomValidity?.("");
            input.closest(".field")?.classList.remove("is-invalid");
            clearValidationDescription(input);
          }
        });
        if (!show) {
          clearValidationState(field);
        }
      };
      const pronounsSelect = deck.querySelector('select[name="pronouns"]');
      const pronounsOtherField = deck.querySelector('[data-field="pronouns_other"]');
      const updatePronounsOther = () => {
        if (!pronounsSelect || !pronounsOtherField) return;
        const show = pronounsSelect.value === "Other (Self-Describe)";
        pronounsOtherField.hidden = !show;
        pronounsOtherField.classList.toggle("is-hidden", !show);
        pronounsOtherField.style.setProperty("display", show ? "grid" : "none", "important");
        pronounsOtherField.style.setProperty("visibility", show ? "visible" : "hidden", "important");
        const input = pronounsOtherField.querySelector('input[name="pronouns_other"]');
        if (input) {
          input.required = false;
          input.disabled = !show;
          if (!show) {
            input.value = "";
            input.setCustomValidity("");
            input.closest(".field")?.classList.remove("is-invalid");
            clearValidationDescription(input);
          }
        }
        if (!show) {
          clearValidationState(pronounsOtherField);
        }
      };

      const part1SubmitEndpoint =
        window.EOI_PART1_SUBMIT_URL ||
        (window.location.protocol === "file:"
          ? ""
          : LOCAL_PREVIEW_HOSTS.includes(window.location.hostname)
            ? "/api/preview/eoi-part1-submit"
            : "https://www.gymfusion.com.au/_functions/eoi_part1_submit");
      const isLocalTurnstileHost = () => LOCAL_PREVIEW_HOSTS.includes(window.location.hostname);
      const getUnder18TurnstileSiteKeyFromHost = () =>
        String(document.querySelector(".mobile-form-host")?.getAttribute("data-under18-turnstile-site-key") || "").trim();
      const getUnder18TurnstileSiteKey = () =>
        String(getUnder18TurnstileSiteKeyFromHost() || contextParams.get("under18_turnstile_site_key") || "").trim() ||
        (isLocalTurnstileHost() ? UNDER18_TURNSTILE_TEST_SITE_KEY : "");
      const getUnder18SubmissionNonce = () => {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `under18_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      };
      const showUnder18TurnstileMessage = (message) => {
        if (!under18TurnstileMessage) return;
        under18TurnstileMessage.textContent = message || "";
        under18TurnstileMessage.classList.toggle("is-hidden", !message);
      };
      const getLocalPreviewUnder18Mode = () => {
        if (LOCAL_PREVIEW_UNDER18_STATE === "pending") return "pending";
        if (LOCAL_PREVIEW_UNDER18_STATE === "unavailable" || LOCAL_PREVIEW_UNDER18_STATE === "error") return "unavailable";
        if (LOCAL_PREVIEW_UNDER18_STATE === "failure") return "failure";
        return "success";
      };
      const hasLocalPreviewUnder18Token = () => {
        const previewMode = getLocalPreviewUnder18Mode();
        return previewMode !== "pending" && previewMode !== "unavailable";
      };
      const renderLocalPreviewTurnstile = () => {
        if (!under18TurnstileHost) return false;
        under18TurnstileHost.textContent = "";
        under18TurnstileHost.setAttribute("data-preview-turnstile", "true");
        under18TurnstileHost.setAttribute("data-preview-turnstile-mode", getLocalPreviewUnder18Mode());
        under18TurnstileToken = hasLocalPreviewUnder18Token() ? "preview-turnstile-token" : "";
        showUnder18TurnstileMessage("");
        updateUnder18SubmitAvailability();
        return true;
      };
      const setUnder18View = (view) => {
        const views = [
          ["gate", ageGateView],
          ["under18", under18Panel],
          ["processing", under18Processing],
          ["success", under18Success],
          ["failure", under18Failure]
        ];
        views.forEach(([key, element]) => {
          if (!element) return;
          element.classList.toggle("is-hidden", key !== view);
        });
        ageGatePanel?.setAttribute("data-under18-view", view);
        ageGateScroll?.classList.toggle("is-under18-view", view === "under18" || view === "processing" || view === "success" || view === "failure");
      };
      const updateUnder18AgeBandButtons = () => {
        under18AgeBandButtons.forEach((button) => {
          const isSelected = String(button.getAttribute("data-value") || "") === under18SelectedAgeBand;
          button.classList.toggle("is-selected", isSelected);
          button.setAttribute("aria-pressed", String(isSelected));
        });
      };
      const updateUnder18SubmitAvailability = () => {
        const isReady = Boolean(under18TurnstileToken) && !under18SubmissionInFlight;
        under18SubmitButtons.forEach((button) => {
          button.disabled = !isReady;
          button.classList.toggle("is-hidden", !isReady);
          button.setAttribute("aria-hidden", String(!isReady));
        });
        if (under18HomeExitButton) {
          under18HomeExitButton.classList.toggle("is-hidden", isReady);
          under18HomeExitButton.disabled = isReady;
          under18HomeExitButton.setAttribute("aria-hidden", String(isReady));
        }
      };
      const resetUnder18Turnstile = () => {
        under18TurnstileToken = "";
        updateUnder18SubmitAvailability();
        if (isLocalTurnstileHost() && under18TurnstileHost) {
          under18TurnstileHost.textContent = "";
          under18TurnstileHost.setAttribute("data-preview-turnstile", "true");
          under18TurnstileHost.setAttribute("data-preview-turnstile-mode", getLocalPreviewUnder18Mode());
          return;
        }
        if (window.turnstile && under18TurnstileWidgetId !== null) {
          window.turnstile.reset(under18TurnstileWidgetId);
        }
      };
      const ensureUnder18TurnstileScript = () => {
        if (window.turnstile) return Promise.resolve(window.turnstile);
        if (under18TurnstileScriptPromise) return under18TurnstileScriptPromise;
        under18TurnstileScriptPromise = new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-under18-turnstile-script]');
          if (existing) {
            existing.addEventListener("load", () => resolve(window.turnstile), { once: true });
            existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
            return;
          }
          const script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.defer = true;
          script.setAttribute("data-under18-turnstile-script", "true");
          script.onload = () => resolve(window.turnstile);
          script.onerror = () => reject(new Error("Turnstile failed to load"));
          document.head.appendChild(script);
        });
        return under18TurnstileScriptPromise;
      };
      const ensureUnder18Turnstile = async () => {
        if (!under18TurnstileHost) return false;
        if (isLocalTurnstileHost()) {
          return renderLocalPreviewTurnstile();
        }
        const siteKey = getUnder18TurnstileSiteKey();
        if (!siteKey) {
          showUnder18TurnstileMessage("We’re currently experiencing difficulties confirming you’re a human. Please try again in a few minutes, or contact us at support@gymfusion.com.au if the problem continues.");
          updateUnder18SubmitAvailability();
          return false;
        }
        showUnder18TurnstileMessage("");
        try {
          const turnstile = await ensureUnder18TurnstileScript();
          if (!turnstile || typeof turnstile.render !== "function") throw new Error("Turnstile unavailable");
          if (under18TurnstileWidgetId === null) {
            under18TurnstileWidgetId = turnstile.render(under18TurnstileHost, {
              sitekey: siteKey,
              theme: "dark",
              size: "flexible",
              callback(token) {
                under18TurnstileToken = String(token || "").trim();
                showUnder18TurnstileMessage("");
                updateUnder18SubmitAvailability();
              },
              "expired-callback": () => {
                under18TurnstileToken = "";
                showUnder18TurnstileMessage("Human verification expired. Please verify again.");
                updateUnder18SubmitAvailability();
              },
              "error-callback": () => {
                under18TurnstileToken = "";
                showUnder18TurnstileMessage("Human verification could not be completed. Please try again.");
                updateUnder18SubmitAvailability();
              }
            });
          } else {
            resetUnder18Turnstile();
          }
          updateUnder18SubmitAvailability();
          return true;
        } catch {
          showUnder18TurnstileMessage("We’re currently experiencing difficulties confirming you’re a human. Please try again in a few minutes, or contact us at support@gymfusion.com.au if the problem continues.");
          updateUnder18SubmitAvailability();
          return false;
        }
      };
      const showAgeEligibilityGate = () => {
        selectedAgeEligibility = "";
        under18SubmissionInFlight = false;
        under18SelectedAgeBand = "";
        updateUnder18AgeBandButtons();
        resetUnder18Turnstile();
        showUnder18TurnstileMessage("");
        updateUnder18SubmitAvailability();
        ageGateButtons.forEach((button) => {
          button.classList.remove("is-selected");
          button.setAttribute("aria-pressed", "false");
        });
        setUnder18View("gate");
      };
      const showUnder18Planning = async () => {
        setUnder18View("under18");
        ageGateScroll?.scrollTo({ top: 0, behavior: "auto" });
        await ensureUnder18Turnstile();
      };
      const getLocalPreviewUnder18Outcome = () =>
        LOCAL_PREVIEW_UNDER18_STATE === "failure" ? "failure" : "success";
      const applyLocalPreviewUnder18State = () => {
        if (!LOCAL_PREVIEW_UNDER18_STATE) return false;
        selectedAgeEligibility = UNDER_18_AGE_ELIGIBILITY_VALUE;
        const previewMode = getLocalPreviewUnder18Mode();
        if (previewMode === "pending" || previewMode === "unavailable") {
          setUnder18View("under18");
          renderLocalPreviewTurnstile();
          showUnder18TurnstileMessage(
            previewMode === "unavailable"
              ? "We’re currently experiencing difficulties confirming you’re a human. Please try again in a few minutes, or contact us at support@gymfusion.com.au if the problem continues."
              : ""
          );
          navigateToSlide(SLIDES.ageGate);
          return true;
        }
        if (LOCAL_PREVIEW_UNDER18_STATE !== "failure" && LOCAL_PREVIEW_UNDER18_STATE !== "success") {
          return false;
        }
        setUnder18View(getLocalPreviewUnder18Outcome());
        showUnder18TurnstileMessage("");
        navigateToSlide(SLIDES.ageGate);
        return true;
      };
      const submitUnder18Planning = async () => {
        if (under18SubmissionInFlight) return;
        if (!under18TurnstileToken) {
          showUnder18TurnstileMessage("Please complete the human verification before submitting.");
          updateUnder18SubmitAvailability();
          return;
        }

        under18SubmissionInFlight = true;
        updateUnder18SubmitAvailability();
        setUnder18View("processing");

        try {
          if (isLocalTurnstileHost()) {
            await new Promise((resolve) => window.setTimeout(resolve, 320));
            setUnder18View(getLocalPreviewUnder18Outcome());
            return;
          }
          const payload = {
            turnstileToken: under18TurnstileToken,
            submissionNonce: getUnder18SubmissionNonce()
          };
          if (under18SelectedAgeBand) {
            payload.under18AgeBand = under18SelectedAgeBand;
          }

          const response = await fetch(UNDER18_SUBMIT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const result = await response.json().catch(() => ({}));
          const isRecordedResponse =
            response.ok && (
              result?.ok === true ||
              result?.status === "RECORDED" ||
              result?.body?.ok === true ||
              result?.body?.status === "RECORDED"
            );
          if (!isRecordedResponse) {
            throw new Error(String(result?.code || response.status || "submit_failed"));
          }
          setUnder18View("success");
        } catch {
          setUnder18View("failure");
        } finally {
          under18SubmissionInFlight = false;
          under18TurnstileToken = "";
          updateUnder18SubmitAvailability();
          resetUnder18Turnstile();
        }
      };
      const buildSubmissionId = () => {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `submission_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      };
      const getOrCreateSubmissionId = () => {
        const key = "gymfusion_eoi_part1_submission_id";
        const existing = String(window.__GYMFUSION_EOI_PART1_SUBMISSION_ID__ || sessionStorage.getItem(key) || "").trim();
        if (existing) {
          window.__GYMFUSION_EOI_PART1_SUBMISSION_ID__ = existing;
          return existing;
        }
        const next = buildSubmissionId();
        window.__GYMFUSION_EOI_PART1_SUBMISSION_ID__ = next;
        sessionStorage.setItem(key, next);
        return next;
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
          if (control.type === "radio") {
            if (control.checked) fields[name] = String(control.value || "").trim();
            return;
          }
          fields[name] = String(control.value || "").trim();
        });
        fields.age_eligibility_confirmation = selectedAgeEligibility || ADULT_AGE_ELIGIBILITY_VALUE;

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
          submissionId: getOrCreateSubmissionId(),
          formId: "eoi_part1",
          formPart: "PART_1",
          formVersion: 1,
          submittedAt: new Date().toISOString(),
          email: fields.email || "",
          fields,
          selections,
          availability,
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
        if (!response.ok || json?.ok !== true) {
          throw new Error(json?.error || `Submission failed (${response.status})`);
        }
        if (json?.episodeId) {
          window.__GYMFUSION_EOI_EPISODE_ID__ = String(json.episodeId);
          sessionStorage.setItem("gymfusion_eoi_episode_id", String(json.episodeId));
        }
        submissionCompleted = true;
        clearProgressDirty();
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
            finalSubmitButton.classList.add("is-hidden");
          } catch (error) {
            finalSubmitButton.disabled = false;
            finalSubmitButton.textContent = originalLabel;
            window.alert(error?.message || "Submission failed");
          }
        });
      }

      ageGateButtons.forEach((button) => {
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", async () => {
          markProgressDirty();
          const value = String(button.getAttribute("data-value") || "");
          ageGateButtons.forEach((item) => {
            const isActive = item === button;
            item.classList.toggle("is-selected", isActive);
            item.setAttribute("aria-pressed", String(isActive));
          });
          selectedAgeEligibility = value;
          if (value === ADULT_AGE_ELIGIBILITY_VALUE) {
            navigateToSlide(SLIDES.intro);
            return;
          }
          if (value === UNDER_18_AGE_ELIGIBILITY_VALUE) {
            await showUnder18Planning();
          }
        });
      });
      under18AgeBandButtons.forEach((button) => {
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          markProgressDirty();
          const value = String(button.getAttribute("data-value") || "");
          under18SelectedAgeBand = under18SelectedAgeBand === value ? "" : value;
          updateUnder18AgeBandButtons();
          if (under18ActionFooter) {
            scrollCurrentPageToElement(under18ActionFooter);
          }
        });
      });
      under18SubmitButtons.forEach((button) => {
        button.addEventListener("click", submitUnder18Planning);
      });
      under18RetryButton?.addEventListener("click", async () => {
        markProgressDirty();
        await showUnder18Planning();
      });
      under18HomeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          window.location.assign(UNDER18_HOMEPAGE_URL);
        });
      });

      const initAddressAutofill = () => {
        const debounceMs = 300;
        const maxCallsPerMinute = 25;
        const timeoutMs = 1200;
        const callLog = [];
        const pendingLookups = new Map();

        const residentialLookup = document.getElementById("address-lookup");
        const residentialList = document.getElementById("address-lookup-results");
        const postalLookup = document.getElementById("postal-address-lookup");
        const postalList = document.getElementById("postal-address-lookup-results");

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
        const getStreetLine = (record) => {
          const direct = pick(record, [
            "street", "street_address", "streetAddress", "STREET_ADDRESS", "address_line_1", "addressLine1",
            "ADDRESS_LINE_1", "address_line", "addressLine", "thoroughfare", "THOROUGHFARE",
            "mailing_address", "MAILING_ADDRESS"
          ]);
          if (direct) return direct;
          let full = getFullAddress(record);
          const suburb = getSuburb(record);
          const state = getState(record);
          const postcode = getPostcode(record);
          [suburb, state, postcode].filter(Boolean).forEach((part) => {
            full = full.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "");
          });
          return full.replace(/[,]{2,}/g, ",").replace(/^[,\s]+|[,\s]+$/g, "");
        };
        const getSuburb = (record) => pick(record, ["suburb", "SUBURB", "locality", "LOCALITY", "locality_name", "LOCALITY_NAME", "town", "TOWN"]);
        const getState = (record) => pick(record, ["state", "STATE", "state_abbreviation", "STATE_ABBREVIATION"]) || "VIC";
        const getPostcode = (record) => pick(record, ["postcode", "POSTCODE", "post_code", "POST_CODE", "postal_code", "POSTAL_CODE"]);
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
          const options = Array.from(select.options);
          const exact = options.find((option) => normalize(option.textContent).toLowerCase() === cleanValue.toLowerCase() || normalize(option.value).toLowerCase() === cleanValue.toLowerCase());
          if (exact) {
            select.value = exact.value || exact.textContent;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            select.closest(".field")?.classList.remove("is-invalid");
            return;
          }
          const other = options.find((option) => normalize(option.textContent).toLowerCase().startsWith("other"));
          if (other) {
            select.value = other.value || other.textContent;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            const otherInput = deck.querySelector(otherInputSelector);
            if (otherInput) setControlValue(otherInput, cleanValue);
          }
        };

        const getManualFields = (mode) => Array.from(deck.querySelectorAll(`[data-address-manual="${mode}"]`));
        const getLookupWrapper = (mode) => (mode === "postal" ? postalLookup : residentialLookup)?.closest(".address-lookup-field");
        const getLookupInput = (mode) => mode === "postal" ? postalLookup : residentialLookup;

        const setManualMode = (mode, show, required) => {
          getManualFields(mode).forEach((field) => {
            field.style.display = show ? "grid" : "none";
            field.hidden = !show;
            field.querySelectorAll("input, select, textarea").forEach((control) => {
              control.required = Boolean(required);
              control.disabled = false;
              if (!required) control.setCustomValidity?.("");
            });
          });
        };

        const setLookupMode = (mode, show, required) => {
          const wrapper = getLookupWrapper(mode);
          const input = getLookupInput(mode);
          if (wrapper) {
            wrapper.style.display = show ? "grid" : "none";
            wrapper.hidden = !show;
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
          const street = mode === "postal"
            ? (document.getElementById("form-postal-street") || deck.querySelector('input[name="postal_address"]'))
            : (document.getElementById("form-street") || deck.querySelector('input[name="res_address"]'));
          if (lookup && street) setControlValue(street, lookup.value);
        };

        const primeLookupMode = (mode) => {
          setLookupMode(mode, true, false);
          setManualMode(mode, true, true);
        };

        const revealManualFallback = (mode) => {
          const list = mode === "postal" ? postalList : residentialList;
          hideList(list);
          setLookupMode(mode, true, true);
          setManualMode(mode, true, true);
          syncLookupToStreetField(mode);
          const lookup = getLookupInput(mode);
          if (lookup) {
            lookup.placeholder = mode === "postal"
              ? "Enter your postal street address manually"
              : "Enter your street address manually";
          }
          const wrapper = getLookupWrapper(mode);
          wrapper?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        };

        const showFilledAddressFieldsAfterSelection = (mode) => {
          setLookupMode(mode, true, false);
          setManualMode(mode, true, true);
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
              if (mode === "residential" && isPostalOnly(record)) {
                routePostalRecord(record, true);
              } else if (mode === "postal") {
                routePostalRecord(record, false);
              } else {
                routeResidentialRecord(record);
              }
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
        const hideList = (list) => {
          if (!list) return;
          list.innerHTML = "";
          list.hidden = true;
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
          setControlValue(document.getElementById("form-street") || deck.querySelector('input[name="res_address"]'), getStreetLine(record));
          setSelectValue(document.getElementById("form-suburb") || deck.querySelector('select[name="res_suburb"]'), getSuburb(record), 'input[name="res_suburb_other"]');
          setSelectValue(document.getElementById("form-state") || deck.querySelector('select[name="res_state"]'), getState(record) || "VIC", 'input[name="res_state_other"]');
          setControlValue(document.getElementById("form-postcode") || deck.querySelector('input[name="res_postcode"]'), getPostcode(record));
          showFilledAddressFieldsAfterSelection("residential");
        };

        const forcePostalDifferent = () => {
          markProgressDirty();
          const noButton = deck.querySelector('[data-choice-group="postal_same"][data-value="No"]');
          if (noButton) {
            updateChoiceGroup(noButton);
          } else {
            updatePostalVisibility("No");
          }
          primeLookupMode("postal");
        };

        const routePostalRecord = (record, clearResidential) => {
          markProgressDirty();
          forcePostalDifferent();
          if (clearResidential) {
            setControlValue(residentialLookup, "");
            setControlValue(document.getElementById("form-street") || deck.querySelector('input[name="res_address"]'), "");
            setSelectValue(document.getElementById("form-suburb") || deck.querySelector('select[name="res_suburb"]'), "", 'input[name="res_suburb_other"]');
            setControlValue(document.getElementById("form-postcode") || deck.querySelector('input[name="res_postcode"]'), "");
            setSelectValue(document.getElementById("form-state") || deck.querySelector('select[name="res_state"]'), "VIC", 'input[name="res_state_other"]');
          }
          const full = getFullAddress(record) || getStreetLine(record);
          setControlValue(postalLookup, full);
          setControlValue(document.getElementById("form-postal-street") || deck.querySelector('input[name="postal_address"]'), getStreetLine(record) || full);
          setSelectValue(document.getElementById("form-postal-suburb") || deck.querySelector('select[name="postal_suburb"]'), getSuburb(record), 'input[name="postal_suburb_other"]');
          setSelectValue(document.getElementById("form-postal-state") || deck.querySelector('select[name="postal_state"]'), getState(record) || "VIC", 'input[name="postal_state_other"]');
          setControlValue(document.getElementById("form-postal-postcode") || deck.querySelector('input[name="postal_postcode"]'), getPostcode(record));
          showFilledAddressFieldsAfterSelection("postal");
          document.getElementById("postal-address-fields")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        };

        primeLookupMode("residential");
        if (document.getElementById("postal-address-fields")?.hidden === false) primeLookupMode("postal");
        bindLookup(residentialLookup, residentialList, "residential");
        bindLookup(postalLookup, postalList, "postal");
      };

      initAddressAutofill();

      introCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
        markProgressDirty();
        updateIntroConfirm(true);
      }));
      if (privacyCheckbox) {
        privacyCheckbox.addEventListener("change", () => {
          markProgressDirty();
          updatePrivacyConfirm(true);
        });
      }
      if (pronounsSelect) {
        ["change", "input", "blur"].forEach((eventName) => {
          pronounsSelect.addEventListener(eventName, updatePronounsOther);
        });
        updatePronounsOther();
      }
      deck.querySelectorAll("select[data-other-target]").forEach((select) => {
        select.addEventListener("change", () => {
          markProgressDirty();
          updateOtherField(select);
        });
        updateOtherField(select);
      });
      updateIntroConfirm();
      updatePrivacyConfirm();
      updatePronounsOther();
      updatePostalVisibility("Yes");
      deck.querySelectorAll("select[data-other-target]").forEach((select) => updateOtherField(select));
      updateSecondPreferenceVisibility();
      updateAvailabilityVisibility();
      showAgeEligibilityGate();
      syncDeckState(0);
      setSlide(0);
      applyLocalPreviewUnder18State();
    })();
  
