const DEFAULT_PORTAL_URL = "https://portal.gymfusion.com.au";
const DEFAULT_BREAKPOINT = 768;
const LOGIN_LIGHTBOX_NAME = "Login";
const INTENT_EVENT_NAME = "gf-member-nav-intent";
const STATE_ATTRIBUTE = "member-state";
const PORTAL_ATTRIBUTE = "portal-url";
const LIGHTBOX_ATTRIBUTE = "login-lightbox-name";
const BIND_KEY = "__gfPublicMemberNavBridge";

function trimText(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

export function resolveMemberDisplayName(member) {
  return (
    trimText(member?.profile?.nickname) ||
    trimText(member?.contactDetails?.firstName) ||
    "Member"
  );
}

export function resolveViewport(win = typeof window !== "undefined" ? window : null, breakpoint = DEFAULT_BREAKPOINT) {
  if (typeof win?.matchMedia === "function") {
    try {
      return win.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches ? "mobile" : "desktop";
    } catch {
      // fall through to width-based detection.
    }
  }

  return ((win?.innerWidth || 1024) < breakpoint) ? "mobile" : "desktop";
}

export function parseMemberState(rawState) {
  if (!rawState) {
    return {
      authenticated: false,
      displayName: "",
      loading: true,
      ready: false,
      dropdownOpen: false,
      notice: "",
    };
  }

  if (typeof rawState === "object") {
    return {
      authenticated: Boolean(rawState.authenticated),
      displayName: trimText(rawState.displayName),
      loading: Boolean(rawState.loading),
      ready: Boolean(rawState.ready),
      dropdownOpen: Boolean(rawState.dropdownOpen),
      notice: trimText(rawState.notice),
    };
  }

  try {
    return parseMemberState(JSON.parse(rawState));
  } catch {
    return parseMemberState(null);
  }
}

export function buildPresentationState(member, options = {}) {
  const authenticated = Boolean(member && member._id);
  return {
    authenticated,
    displayName: authenticated ? resolveMemberDisplayName(member) : "",
    loading: Boolean(options.loading),
    ready: options.ready !== false,
    notice: trimText(options.notice),
  };
}

const PLACEHOLDER_AVATAR_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath d='M0 0h512v512H0z' fill='none'/%3E%3Cpath fill='%23fff' d='M399 384.2c-22.1-38.4-63.6-64.2-111-64.2h-64c-47.4 0-88.9 25.8-111 64.2c35.2 39.2 86.2 63.8 143 63.8s107.8-24.7 143-63.8M0 256a256 256 0 1 1 512 0a256 256 0 1 1-512 0m256 16a72 72 0 1 0 0-144a72 72 0 1 0 0 144'/%3E%3C/svg%3E";

function profileAvatarMarkup(label) {
  return `
    <img class="gf-nav__avatar-img" src="${PLACEHOLDER_AVATAR_SVG}" alt="">
    <span class="gf-nav__avatar-label">${escapeHtml(label)}</span>
  `;
}

function chevronSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 9l5.5 6 5.5-6" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

export function buildMemberNavMarkup(rawState = {}, options = {}) {
  const state = parseMemberState(rawState);
  const viewport = options.viewport || resolveViewport(options.window, options.breakpoint);
  const dropdownOpen = state.authenticated && Boolean(state.dropdownOpen);
  const loggedIn = state.authenticated;
  const memberName = loggedIn ? trimText(state.displayName) || "Member" : "";
  const avatarLabel = loggedIn
    ? "Interim authenticated placeholder avatar"
    : "Permanent placeholder avatar";
  const statusText = state.notice || (state.loading ? "Loading member state" : loggedIn ? "Logged in" : "Logged out");
  return `
    <style>
      @font-face {
        font-family: "GamuthSans";
        src: url("https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/Gamuth%20Font%20Family/GamuthSans-Bold.ttf") format("truetype");
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "GamuthSansLightMobile";
        src: url("https://raw.githubusercontent.com/J35S1CA007/gymfusion-assets/main/Gamuth%20Font%20Family/mobile/GamuthSans-Light_mobile.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "GamuthDisplayMediumMobile";
        src: url("https://raw.githubusercontent.com/J35S1CA007/gymfusion-assets/main/Gamuth%20Font%20Family/mobile/Gamuth%20Display%20Medium_mobile.ttf") format("truetype");
        font-weight: 500;
        font-style: normal;
        font-display: swap;
      }

      @font-face {
        font-family: "GamuthSansRegularMobile";
        src: url("https://raw.githubusercontent.com/J35S1CA007/gymfusion-assets/main/Gamuth%20Font%20Family/mobile/GamuthSans-Regular_mobile.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }

      :host {
        display: block;
        position: relative;
        z-index: 40;
        pointer-events: none;
        isolation: isolate;
        opacity: 1;
        width: max-content;
        max-width: 100%;
        color: #fff;
        font-family: "GamuthSans", Arial, Helvetica, sans-serif;
        --bg: #000;
        --text: #f6fbff;
        --menu-bg: rgba(5, 2, 10, 0.94);
        --cta-gradient: linear-gradient(111deg, rgba(157, 10, 255, 1) 0%, rgba(222, 7, 150, 1) 31%, rgba(253, 29, 29, 1) 68%, rgba(252, 158, 25, 1) 100%);
      }

      :host,
      :host *,
      :host *::before,
      :host *::after {
        box-sizing: border-box;
      }

      .gf-nav {
        pointer-events: auto;
        display: block;
        width: max-content;
        color: var(--text);
        font-family: "GamuthSans", Arial, Helvetica, sans-serif;
      }

      .gf-nav[data-auth="logged-out"] {
        margin-left: 110px;
      }

      .gf-nav__stack {
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        width: max-content;
      }

      .gf-nav__row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }

      .gf-nav__panel {
        --pill-font-size: clamp(12px, min(5cqw, 23cqh), 16px);
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.65em;
        min-width: calc(7.9em + 2px);
        min-height: calc(2.65em - 1px);
        padding: calc(0.64em - 4px) 1.22em;
        border: none;
        border-radius: 0;
        background: transparent;
        cursor: pointer;
        font-family: "GamuthSans", Arial, Helvetica, sans-serif;
        font-size: var(--pill-font-size);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: capitalize;
        color: var(--text);
        box-shadow: none;
        transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
        z-index: 20;
        isolation: isolate;
        transform: translate(0, 0);
        animation: breathe 3.6s ease-in-out infinite;
      }

      .gf-nav__panel::before {
        content: "";
        position: absolute;
        inset: -10px;
        border-radius: inherit;
        background: var(--cta-gradient);
        filter: blur(8px);
        opacity: 0.62;
        mix-blend-mode: screen;
        z-index: -1;
        transition: opacity 0.16s ease;
      }

      .gf-nav__panel::after {
        content: "";
        position: absolute;
        inset: 0;
        padding: 2px;
        border-radius: inherit;
        background: var(--cta-gradient);
        pointer-events: none;
        z-index: 1;
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
      }

      .gf-nav__panel > * {
        position: relative;
        z-index: 2;
      }

      .gf-nav__panel:hover,
      .gf-nav__panel:focus-within,
      .gf-nav__panel.is-open {
        transform: translate(0, -2px) scale(1.05);
        animation: none;
        background: transparent;
        box-shadow: none;
        outline: none;
      }

      .gf-nav__panel:hover::before,
      .gf-nav__panel:focus-within::before,
      .gf-nav__panel.is-open::before {
        opacity: 0.72;
      }

      .gf-nav__button,
      .gf-nav__menu-item {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--text);
        font: inherit;
        cursor: pointer;
        padding: 0;
        margin: 0;
      }

      .gf-nav__button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 32px;
        padding: 0 4px;
        text-decoration: none;
        color: var(--text);
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .gf-nav__button--login {
        font-family: "GamuthSansRegularMobile", "GamuthDisplayMediumMobile", "GamuthSansLightMobile", "GamuthSans", Arial, Helvetica, sans-serif;
        font-size: 1.05em;
        font-weight: 750;
        text-transform: capitalize;
        letter-spacing: 0.10em;
        text-shadow: 0.22px 0 currentColor;
        transform: translateX(-9px);
      }

      .gf-nav__button:focus-visible,
      .gf-nav__menu-item:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.95);
        outline-offset: 3px;
      }

      .gf-nav__button--toggle {
        width: auto;
        padding-inline: 0;
      }

      .gf-nav__button--toggle svg,
      .gf-nav__avatar svg {
        width: 1.45em;
        height: 1.45em;
        display: block;
        stroke: currentColor;
        stroke-width: 2.25;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
        overflow: visible;
      }

      .gf-nav__button svg path,
      .gf-nav__button svg circle,
      .gf-nav__avatar svg path,
      .gf-nav__avatar svg circle {
        stroke: currentColor;
        stroke-width: 2.25;
        fill: none;
      }

      .gf-nav__greeting {
        color: #fff;
        font-size: 1em;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
        letter-spacing: 0.08em;
      }

      .gf-nav__avatar {
        width: 1.45em;
        height: 1.45em;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        overflow: hidden;
        flex-shrink: 0;
        transform: translateX(8px);
      }

      .gf-nav__avatar-img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        display: block;
      }

      .gf-nav__avatar-label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .gf-nav__dropdown {
        width: 290px;
        padding: 12px;
        border-radius: 0;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: var(--menu-bg);
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.48);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      .gf-nav__dropdown[hidden] {
        display: none;
      }

      .gf-nav__menu {
        display: grid;
        gap: 10px;
      }

      .gf-nav__menu-item {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 16px;
        border: none;
        border-radius: 0;
        background: transparent;
        color: #f6fbff;
        font-family: "GamuthSans", Arial, Helvetica, sans-serif;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        isolation: isolate;
        cursor: pointer;
        transition: transform 0.2s ease, filter 0.2s ease;
      }

      .gf-nav__menu-item::before {
        content: "";
        position: absolute;
        inset: -8px;
        border-radius: inherit;
        background: var(--cta-gradient);
        filter: blur(8px);
        opacity: 0.62;
        mix-blend-mode: screen;
        z-index: -1;
        transition: opacity 0.16s ease;
      }

      .gf-nav__menu-item::after {
        content: "";
        position: absolute;
        inset: 0;
        padding: 2px;
        border-radius: inherit;
        background: var(--cta-gradient);
        pointer-events: none;
        z-index: 1;
        -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
      }

      .gf-nav__menu-item > * {
        position: relative;
        z-index: 2;
      }

      .gf-nav__menu-item:hover,
      .gf-nav__menu-item:focus-visible {
        transform: translateY(-1px) scale(1.02);
        filter: brightness(1.15);
        outline: none;
      }

      .gf-nav__menu-item:hover::before,
      .gf-nav__menu-item:focus-visible::before {
        opacity: 0.72;
      }

      .gf-nav__status {
        position: absolute;
        left: -9999px;
      }

      [data-auth="logged-out"] .gf-nav__dropdown {
        display: none;
      }

      @keyframes breathe {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }
        50% {
          transform: translate(0, 0) scale(1.03);
        }
      }

      @media (max-width: 767px) {
        .gf-nav__dropdown {
          width: 250px;
        }
      }
    </style>

    <div
      class="gf-nav"
      data-viewport="${viewport}"
      data-auth="${loggedIn ? "logged-in" : "logged-out"}"
      data-dropdown-open="${loggedIn && dropdownOpen ? "true" : "false"}"
      aria-busy="${state.loading ? "true" : "false"}"
    >
      <div class="gf-nav__stack">
        <div class="gf-nav__row">
          <div class="gf-nav__panel${loggedIn && dropdownOpen ? " is-open" : ""}">
            ${
              loggedIn
                ? `
                  <button
                    class="gf-nav__button gf-nav__button--toggle"
                    type="button"
                    data-action="toggle-menu"
                    aria-label="${dropdownOpen ? "Close member menu" : "Open member menu"}"
                    aria-haspopup="menu"
                    aria-expanded="${dropdownOpen ? "true" : "false"}"
                  >
                    ${chevronSvg()}
                  </button>
                  ${viewport === "desktop" ? `<div class="gf-nav__greeting">Hi, ${escapeHtml(memberName)}</div>` : ""}
                `
                : `
                  <button
                    class="gf-nav__button gf-nav__button--login"
                    type="button"
                    data-action="login"
                    aria-label="Login"
                  >
                    Login
                  </button>
                `
            }
            <span class="gf-nav__avatar" aria-hidden="true">${profileAvatarMarkup(escapeHtml(avatarLabel))}</span>
          </div>
        </div>

        <div class="gf-nav__dropdown" role="menu" aria-label="Authenticated member menu" ${loggedIn && dropdownOpen ? "" : "hidden"}>
          <div class="gf-nav__menu">
            <button class="gf-nav__menu-item" type="button" data-action="portal" role="menuitem">
              Go to GYMFUSION Portal
            </button>
            <button class="gf-nav__menu-item" type="button" data-action="logout" role="menuitem">
              Log out
            </button>
          </div>
        </div>

        <div class="gf-nav__status" aria-live="polite">
          ${escapeHtml(statusText)}
        </div>
      </div>
    </div>
  `;
}

function getHostListener(host, type, handler) {
  if (typeof host?.on === "function") {
    try {
      const maybeCleanup = host.on(type, handler);
      if (typeof maybeCleanup === "function") {
        return maybeCleanup;
      }
    } catch {
      // Fall back to DOM-style listeners.
    }
  }

  if (typeof host?.addEventListener === "function") {
    host.addEventListener(type, handler);
    return () => {
      if (typeof host.removeEventListener === "function") {
        host.removeEventListener(type, handler);
      }
    };
  }

  return () => {};
}

function setHostAttribute(host, name, value) {
  if (typeof host?.setAttribute === "function") {
    host.setAttribute(name, value);
    return true;
  }

  if (host && name in host) {
    host[name] = value;
    return true;
  }

  return false;
}

function getHostAttribute(host, name) {
  if (typeof host?.getAttribute === "function") {
    return host.getAttribute(name);
  }

  if (host && name in host) {
    return host[name];
  }

  return null;
}

function isMemberStateLoggedIn(state) {
  return Boolean(state?.authenticated);
}

async function safeGetCurrentMember(currentMemberApi) {
  if (!currentMemberApi?.getMember) {
    return undefined;
  }

  return currentMemberApi.getMember();
}

export function attachPublicMemberNavBridge(host, overrides = {}) {
  if (!host || host[BIND_KEY]) {
    return host?.[BIND_KEY] || (() => {});
  }

  const runtime = {
    currentMemberApi: overrides.currentMemberApi,
    authenticationApi: overrides.authenticationApi,
    wixWindowApi: overrides.wixWindowApi,
    portalUrl: overrides.portalUrl || DEFAULT_PORTAL_URL,
    loginLightboxName: overrides.loginLightboxName || LOGIN_LIGHTBOX_NAME,
    window: overrides.window || (typeof window !== "undefined" ? window : null),
  };

  let destroyed = false;
  let refreshToken = 0;
  let dropdownOpen = false;
  let currentViewport = resolveViewport(runtime.window);
  const listenerCleanups = [];

  const publishState = (member, extra = {}) => {
    const presentationState = buildPresentationState(member, {
      loading: Boolean(extra.loading),
      ready: extra.ready !== false,
      notice: extra.notice,
    });

    setHostAttribute(host, STATE_ATTRIBUTE, JSON.stringify({
      ...presentationState,
      viewport: currentViewport,
      dropdownOpen: isMemberStateLoggedIn(presentationState) ? dropdownOpen : false,
    }));
    setHostAttribute(host, PORTAL_ATTRIBUTE, runtime.portalUrl);
    setHostAttribute(host, LIGHTBOX_ATTRIBUTE, runtime.loginLightboxName);
  };

  const refreshMember = async () => {
    const token = ++refreshToken;
    publishState(undefined, { loading: true, ready: false });

    try {
      const member = await safeGetCurrentMember(runtime.currentMemberApi);
      if (destroyed || token !== refreshToken) {
        return;
      }

      publishState(member, { loading: false, ready: true });
      if (!isMemberStateLoggedIn(parseMemberState(getHostAttribute(host, STATE_ATTRIBUTE)))) {
        dropdownOpen = false;
      }
    } catch {
      if (destroyed || token !== refreshToken) {
        return;
      }

      publishState(undefined, { loading: false, ready: true });
      dropdownOpen = false;
    }
  };

  const closeDropdown = () => {
    if (!dropdownOpen) {
      return;
    }

    dropdownOpen = false;
    const state = parseMemberState(getHostAttribute(host, STATE_ATTRIBUTE));
    setHostAttribute(host, STATE_ATTRIBUTE, JSON.stringify({
      ...state,
      dropdownOpen: false,
      viewport: currentViewport,
    }));
  };

  const openPortal = () => {
    closeDropdown();
    if (typeof runtime.window?.location?.assign === "function") {
      runtime.window.location.assign(runtime.portalUrl);
      return;
    }

    if (runtime.window?.location) {
      runtime.window.location.href = runtime.portalUrl;
    }
  };

  const openLogin = async () => {
    closeDropdown();
    if (typeof runtime.wixWindowApi?.openLightbox !== "function") {
      await refreshMember();
      return;
    }

    try {
      await runtime.wixWindowApi.openLightbox(runtime.loginLightboxName);
      await refreshMember();
    } catch {
      await refreshMember();
    }
  };

  const logout = async () => {
    closeDropdown();

    if (typeof runtime.authenticationApi?.logout !== "function") {
      await refreshMember();
      return;
    }

    try {
      await runtime.authenticationApi.logout();
      await refreshMember();
    } catch {
      await refreshMember();
    }
  };

  const handleIntent = async (event) => {
    const detail = event?.detail || event?.data || {};
    const action = detail.action || detail.type || "";

    if (action === "login") {
      await openLogin();
      return;
    }

    if (action === "toggle-menu") {
      const state = parseMemberState(getHostAttribute(host, STATE_ATTRIBUTE));
      if (!isMemberStateLoggedIn(state)) {
        return;
      }

      dropdownOpen = !dropdownOpen;
      setHostAttribute(host, STATE_ATTRIBUTE, JSON.stringify({
        ...state,
        dropdownOpen,
        viewport: currentViewport,
      }));
      return;
    }

    if (action === "portal") {
      openPortal();
      return;
    }

    if (action === "logout") {
      await logout();
    }
  };

  const handleMemberChange = async (memberApi) => {
    await refreshMember(memberApi || runtime.currentMemberApi);
  };

  const handleViewportChange = () => {
    const nextViewport = resolveViewport(runtime.window);
    if (nextViewport === currentViewport) {
      return;
    }

    currentViewport = nextViewport;
    closeDropdown();
    const state = parseMemberState(getHostAttribute(host, STATE_ATTRIBUTE));
    setHostAttribute(host, STATE_ATTRIBUTE, JSON.stringify({
      ...state,
      viewport: currentViewport,
      dropdownOpen: isMemberStateLoggedIn(state) ? dropdownOpen : false,
    }));
  };

  const onPointerDown = (event) => {
    if (!dropdownOpen) {
      return;
    }

    const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(host)) {
      return;
    }

    closeDropdown();
  };

  const onKeyDown = (event) => {
    if (event?.key === "Escape") {
      closeDropdown();
    }
  };

  const onFocusOut = (event) => {
    const nextFocus = event?.relatedTarget;
    if (nextFocus && typeof host.contains === "function" && host.contains(nextFocus)) {
      return;
    }

    closeDropdown();
  };

  listenerCleanups.push(getHostListener(host, INTENT_EVENT_NAME, handleIntent));

  if (runtime.window) {
    runtime.window.addEventListener("pointerdown", onPointerDown, true);
    runtime.window.addEventListener("keydown", onKeyDown);
    runtime.window.addEventListener("resize", handleViewportChange);
    listenerCleanups.push(() => runtime.window.removeEventListener("pointerdown", onPointerDown, true));
    listenerCleanups.push(() => runtime.window.removeEventListener("keydown", onKeyDown));
    listenerCleanups.push(() => runtime.window.removeEventListener("resize", handleViewportChange));
  }

  if (typeof host?.addEventListener === "function") {
    host.addEventListener("focusout", onFocusOut);
    listenerCleanups.push(() => host.removeEventListener("focusout", onFocusOut));
  }

  const authBridgeKey = "__gfPublicMemberNavAuthBridge";
  if (runtime.window) {
    if (!runtime.window[authBridgeKey]) {
      runtime.window[authBridgeKey] = { login: null, logout: null };
    }

    const bridge = runtime.window[authBridgeKey];
    bridge.login = handleMemberChange;
    bridge.logout = () => {
      dropdownOpen = false;
      publishState(undefined, { loading: false, ready: true });
    };

    if (typeof runtime.authenticationApi?.onLogin === "function" && !bridge._registeredLogin) {
      bridge._registeredLogin = true;
      Promise.resolve(runtime.authenticationApi.onLogin((memberApi) => {
        if (typeof bridge.login === "function") {
          void bridge.login(memberApi);
        }
      })).catch(() => {});
    }

    if (typeof runtime.authenticationApi?.onLogout === "function" && !bridge._registeredLogout) {
      bridge._registeredLogout = true;
      Promise.resolve(runtime.authenticationApi.onLogout(() => {
        if (typeof bridge.logout === "function") {
          bridge.logout();
        }
      })).catch(() => {});
    }
  }

  publishState(undefined, { loading: true, ready: false });
  void refreshMember();

  const cleanup = () => {
    if (destroyed) {
      return;
    }

    destroyed = true;
    dropdownOpen = false;
    while (listenerCleanups.length) {
      const cleanupFn = listenerCleanups.pop();
      try {
        cleanupFn?.();
      } catch {
        // cleanup must stay silent.
      }
    }

    if (runtime.window && runtime.window[authBridgeKey]) {
      const bridge = runtime.window[authBridgeKey];
      if (bridge.login === handleMemberChange) {
        bridge.login = null;
      }
      bridge.logout = null;
      bridge._registeredLogin = false;
      bridge._registeredLogout = false;
    }

    delete host[BIND_KEY];
  };

  host[BIND_KEY] = cleanup;
  return cleanup;
}

export function registerPublicMemberNavElement() {
  if (typeof window === "undefined" || typeof customElements === "undefined") {
    return null;
  }

  if (customElements.get("gf-public-member-nav")) {
    return customElements.get("gf-public-member-nav");
  }

  class GfPublicMemberNav extends HTMLElement {
    static observedAttributes = [STATE_ATTRIBUTE, PORTAL_ATTRIBUTE, LIGHTBOX_ATTRIBUTE];

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._memberState = parseMemberState(null);
      this._dropdownOpen = false;
      this._restoreToggleFocus = false;
      this._suppressFocusOut = false;
      this._viewport = resolveViewport(window);
      this._onClick = this._onClick.bind(this);
      this._onDocumentKeyDown = this._onDocumentKeyDown.bind(this);
      this._onDocPointerDown = this._onDocPointerDown.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onFocusOut = this._onFocusOut.bind(this);
      this._onResize = this._onResize.bind(this);
      this._connected = false;
    }

    connectedCallback() {
      this._connected = true;
      this._memberState = parseMemberState(this.getAttribute(STATE_ATTRIBUTE));
      this._dropdownOpen = Boolean(this._memberState.dropdownOpen);
      this._viewport = resolveViewport(window);
      this._render();
      this.addEventListener("keydown", this._onKeyDown);
      this.addEventListener("focusout", this._onFocusOut);
      document.addEventListener("keydown", this._onDocumentKeyDown, true);
      window.addEventListener("pointerdown", this._onDocPointerDown, true);
      window.addEventListener("resize", this._onResize);
    }

    disconnectedCallback() {
      this._connected = false;
      this.removeEventListener("keydown", this._onKeyDown);
      this.removeEventListener("focusout", this._onFocusOut);
      document.removeEventListener("keydown", this._onDocumentKeyDown, true);
      window.removeEventListener("pointerdown", this._onDocPointerDown, true);
      window.removeEventListener("resize", this._onResize);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }

      if (name === STATE_ATTRIBUTE) {
        const nextState = parseMemberState(newValue);
        const wasLoggedIn = this._memberState.authenticated;
        this._memberState = nextState;
        if (!nextState.authenticated || !wasLoggedIn) {
          this._dropdownOpen = Boolean(nextState.dropdownOpen) && nextState.authenticated;
        } else if (typeof nextState.dropdownOpen === "boolean") {
          this._dropdownOpen = nextState.dropdownOpen;
        }
      }

      if (this._connected) {
        this._render();
      }
    }

    _render() {
      const restoreToggleFocus = this._restoreToggleFocus;
      this._restoreToggleFocus = false;
      this.shadowRoot.innerHTML = buildMemberNavMarkup({
        ...this._memberState,
        dropdownOpen: this._dropdownOpen,
      }, {
        viewport: this._viewport,
        window,
      });
      this._bindActionListeners();
      this._syncDropdownPresentation(this._dropdownOpen);
      if (restoreToggleFocus) {
        this.shadowRoot.querySelector('[data-action="toggle-menu"]')?.focus({ preventScroll: true });
      }
    }

    _syncDropdownPresentation(isOpen) {
      const panel = this.shadowRoot.querySelector('.gf-nav__panel');
      const toggle = this.shadowRoot.querySelector('[data-action="toggle-menu"]');
      const dropdown = this.shadowRoot.querySelector('.gf-nav__dropdown');

      panel?.classList.toggle('is-open', isOpen);
      if (toggle instanceof HTMLElement) {
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        toggle.setAttribute('aria-label', isOpen ? 'Close member menu' : 'Open member menu');
      }
      if (dropdown instanceof HTMLElement) {
        dropdown.hidden = !isOpen;
      }
    }

    _bindActionListeners() {
      const triggers = this.shadowRoot.querySelectorAll("[data-action]");
      triggers.forEach((trigger) => {
        trigger.addEventListener("click", this._onClick);
      });
    }

    _dispatchIntent(action) {
      this.dispatchEvent(new CustomEvent(INTENT_EVENT_NAME, {
        bubbles: true,
        composed: true,
        detail: { action },
      }));
    }

    _closeDropdown() {
      if (!this._dropdownOpen) {
        return;
      }

      this._dropdownOpen = false;
      this._syncDropdownPresentation(false);
      this.setAttribute(STATE_ATTRIBUTE, JSON.stringify({
        ...this._memberState,
        dropdownOpen: false,
      }));
    }

    _toggleDropdown() {
      if (!this._memberState.authenticated) {
        return;
      }

      this._restoreToggleFocus = true;
      const nextOpen = !this._dropdownOpen;
      this._dropdownOpen = nextOpen;
      if (nextOpen) {
        this._suppressFocusOut = true;
        queueMicrotask(() => {
          this._suppressFocusOut = false;
        });
      }
      this._syncDropdownPresentation(this._dropdownOpen);
      this.setAttribute(STATE_ATTRIBUTE, JSON.stringify({
        ...this._memberState,
        dropdownOpen: this._dropdownOpen,
      }));
    }

    _onClick(event) {
      const trigger = event.currentTarget || event.target?.closest?.("[data-action]");
      if (!trigger) {
        return;
      }

      const action = typeof trigger.getAttribute === "function"
        ? trigger.getAttribute("data-action")
        : trigger.dataset?.action;

      if (action === "login") {
        this._dispatchIntent("login");
        return;
      }

      if (action === "toggle-menu") {
        this._toggleDropdown();
        return;
      }

      if (action === "portal" || action === "logout") {
        this._closeDropdown();
        this._dispatchIntent(action);
      }
    }

    _onDocPointerDown(event) {
      if (!this._dropdownOpen) {
        return;
      }

      const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
      if (path.includes(this)) {
        return;
      }

      this._closeDropdown();
    }

    _onDocumentKeyDown(event) {
      if (document.activeElement !== this) {
        return;
      }

      const activeAction = this.shadowRoot?.activeElement?.getAttribute?.("data-action");
      if (activeAction !== "toggle-menu") {
        return;
      }

      if (event?.key === "Enter" || event?.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        this._toggleDropdown();
        return;
      }

      if (event?.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this._restoreToggleFocus = true;
        this._closeDropdown();
      }
    }

    _onKeyDown(event) {
      if (event?.key === "Escape") {
        this._restoreToggleFocus = true;
        this._closeDropdown();
      }
    }

    _onFocusOut(event) {
      if (this._suppressFocusOut) {
        return;
      }

      const nextTarget = event?.relatedTarget;
      if (nextTarget && (this.contains(nextTarget) || this.shadowRoot?.contains(nextTarget))) {
        return;
      }

      if (document.activeElement === this || this.shadowRoot?.contains(document.activeElement)) {
        return;
      }

      this._closeDropdown();
    }

    _onResize() {
      const nextViewport = resolveViewport(window);
      if (nextViewport === this._viewport) {
        return;
      }

      this._viewport = nextViewport;
      this._render();
    }
  }

  customElements.define("gf-public-member-nav", GfPublicMemberNav);
  return GfPublicMemberNav;
}

registerPublicMemberNavElement();
