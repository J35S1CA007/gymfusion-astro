const INTENT_EVENT_NAME = "gf-member-nav-intent";
const STATE_ATTRIBUTE = "member-state";

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

function parseMemberState(rawState) {
  if (!rawState) {
    return {
      authenticated: false,
      displayName: "",
      loading: false,
      ready: true,
      dropdownOpen: false,
      notice: "",
    };
  }

  if (typeof rawState === "object") {
    return {
      authenticated: Boolean(rawState.authenticated),
      displayName: trimText(rawState.displayName),
      loading: Boolean(rawState.loading),
      ready: rawState.ready !== false,
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

function profileAvatarMarkup(label) {
  return `
    <svg class="gf-nav__avatar-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gf-nav-avatar-gradient" x1="0%" y1="30.81%" x2="100%" y2="69.19%">
          <stop offset="0%" stop-color="#9d0aff"></stop>
          <stop offset="31%" stop-color="#de0796"></stop>
          <stop offset="68%" stop-color="#fd1d1d"></stop>
          <stop offset="100%" stop-color="#fc9e19"></stop>
        </linearGradient>
      </defs>
      <circle class="gf-nav__avatar-face" cx="12" cy="12" r="10.5"></circle>
      <circle class="gf-nav__avatar-frame" cx="12" cy="12" r="11.15" fill="none" stroke="url(#gf-nav-avatar-gradient)" stroke-width="1.15"></circle>
      <circle class="gf-nav__avatar-person" cx="12" cy="8.6" r="2.55" fill="url(#gf-nav-avatar-gradient)"></circle>
      <path class="gf-nav__avatar-person" d="M12 14.15c-1.98 0-3.78 .88-4.98 2.28 1.18 1.39 2.97 2.22 4.98 2.22s3.8-.83 4.98-2.22c-1.2-1.4-3-2.28-4.98-2.28z" fill="url(#gf-nav-avatar-gradient)"></path>
    </svg>
    <span class="gf-nav__avatar-label">${escapeHtml(label)}</span>
  `;
}

function chevronSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gf-nav-chevron-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#9d0aff"></stop>
          <stop offset="31%" stop-color="#de0796"></stop>
          <stop offset="68%" stop-color="#fd1d1d"></stop>
          <stop offset="100%" stop-color="#fc9e19"></stop>
        </linearGradient>
      </defs>
      <path class="gf-nav__chevron" d="M6.5 9l5.5 6 5.5-6" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;
}

function buildMemberNavMarkup(rawState = {}) {
  const state = parseMemberState(rawState);
  const viewport = "mobile";
  const dropdownOpen = Boolean(state.dropdownOpen);
  const loggedIn = state.authenticated;
  const avatarLabel = loggedIn
    ? "Interim authenticated placeholder avatar"
    : "Permanent placeholder avatar";
  const statusText = state.notice || (state.loading ? "Loading member state" : loggedIn ? "Logged in" : "Logged out");

  return `
    <style>
      @font-face {
        font-family: "LegendFont";
        src: url("https://cdn.jsdelivr.net/gh/J35S1CA007/gymfusion-assets@main/LEGEND.ttf") format("truetype");
        font-weight: 700;
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
        font-family: "LegendFont", Arial, Helvetica, sans-serif;
        --bg: #000;
        --text: #f6fbff;
        --menu-bg: rgba(5, 2, 10, 0.94);
        --cta-gradient: linear-gradient(111deg, rgba(157, 10, 255, 1) 0%, rgba(222, 7, 150, 1) 31%, rgba(253, 29, 29, 1) 68%, rgba(252, 158, 25, 1) 100%);
        --nav-icon-gradient: linear-gradient(111deg, rgba(178, 18, 255, 1) 0%, rgba(255, 15, 179, 1) 24%, rgba(255, 49, 93, 1) 58%, rgba(255, 141, 33, 1) 100%);
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
        font-family: "LegendFont", Arial, Helvetica, sans-serif;
        --arrow-size: 34px;
        --avatar-size: 38px;
        transform: scale(var(--mobile-scale, 0.82));
        transform-origin: top right;
      }

      .gf-nav__stack {
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
        width: max-content;
        position: relative;
      }

      .gf-nav__row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
      }

      .gf-nav__panel {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2.8px;
        width: 85px;
        height: 63px;
        padding: calc(0.64em - 0.5px) 1.35em;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 19px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: capitalize;
        color: var(--text);
        animation: breathe 3.6s ease-in-out infinite;
        z-index: 20;
        isolation: isolate;
      }

      .gf-nav__panel.is-open {
        animation: none;
      }

      .gf-nav__panel.is-open .gf-nav__chevron {
        transform: rotate(180deg);
      }

      .gf-nav__panel.is-open .gf-nav__avatar,
      .gf-nav__panel.is-open .gf-nav__avatar-svg {
        transform: none;
      }

      .gf-nav__panel,
      .gf-nav__menu-item {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--text);
        font: inherit;
        cursor: pointer;
        padding: 0;
        margin: 0;
        -webkit-user-select: none;
        user-select: none;
      }

      .gf-nav__panel:focus-visible,
      .gf-nav__menu-item:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.95);
        outline-offset: 3px;
      }

      .gf-nav__button--toggle svg {
        width: var(--arrow-size);
        height: var(--arrow-size);
        display: block;
        stroke-width: 2.25;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
        flex: 0 0 auto;
        transition: transform 0.18s ease;
        filter: drop-shadow(0 0 4px rgba(255, 15, 179, 0.72));
        -webkit-user-select: none;
        user-select: none;
        -webkit-user-drag: none;
      }

      .gf-nav__button--toggle path {
        stroke: url(#gf-nav-chevron-gradient);
      }

      .gf-nav__chevron {
        transform-box: fill-box;
        transform-origin: center;
        transition: transform 0.18s ease;
      }

      .gf-nav__avatar {
        position: relative;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        width: var(--avatar-size);
        height: var(--avatar-size);
        flex: 0 0 auto;
        padding: 2px;
        background: transparent;
        box-shadow:
          0 0 4px rgba(255, 15, 179, 0.74),
          0 0 10px rgba(255, 49, 93, 0.36),
          0 0 16px rgba(255, 141, 33, 0.28);
        transition: filter 0.16s ease;
        -webkit-user-select: none;
        user-select: none;
      }

      .gf-nav__avatar::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--cta-gradient);
        opacity: 0.45;
        filter: blur(6px);
        z-index: 0;
      }

      .gf-nav__panel:hover .gf-nav__avatar,
      .gf-nav__panel:focus-visible .gf-nav__avatar,
      .gf-nav__panel:active .gf-nav__avatar,
      .gf-nav__panel.is-open .gf-nav__avatar {
        filter: brightness(1.15);
      }

      .gf-nav__panel:hover .gf-nav__avatar::before,
      .gf-nav__panel:focus-visible .gf-nav__avatar::before,
      .gf-nav__panel:active .gf-nav__avatar::before,
      .gf-nav__panel.is-open .gf-nav__avatar::before {
        opacity: 0.65;
      }

      .gf-nav__avatar-svg {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        display: block;
        overflow: visible;
        z-index: 2;
        -webkit-user-select: none;
        user-select: none;
        -webkit-user-drag: none;
      }

      .gf-nav__avatar-person {
        stroke: none;
      }

      .gf-nav__avatar-face {
        fill: rgba(3, 0, 10, 0.82);
      }

      .gf-nav__avatar-frame {
        stroke-linecap: round;
        filter: drop-shadow(0 0 2px rgba(255, 49, 93, 0.64));
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
        position: absolute;
        top: calc(100% + 10px);
        right: -24px;
        width: 149px;
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
        font-family: "LegendFont", Arial, Helvetica, sans-serif;
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

      @keyframes breathe {
        0%,
        100% {
          transform: translate(0, 0) scale(1);
        }

        50% {
          transform: translate(0, 0) scale(1.018);
        }
      }
    </style>

    <div
      class="gf-nav"
      data-viewport="${viewport}"
      data-auth="${loggedIn ? "logged-in" : "logged-out"}"
      data-dropdown-open="${dropdownOpen ? "true" : "false"}"
      aria-busy="${state.loading ? "true" : "false"}"
    >
      <div class="gf-nav__stack">
        <div class="gf-nav__row">
          <button
            class="gf-nav__panel${dropdownOpen ? " is-open" : ""} gf-nav__button--toggle"
            type="button"
            data-action="toggle-menu"
            aria-label="${dropdownOpen ? "Close member menu" : "Open member menu"}"
            aria-haspopup="menu"
            aria-expanded="${dropdownOpen ? "true" : "false"}"
          >
            ${chevronSvg()}
            <span class="gf-nav__avatar" aria-hidden="true">${profileAvatarMarkup(escapeHtml(avatarLabel))}</span>
          </button>
        </div>

        <div class="gf-nav__dropdown" role="menu" aria-label="${loggedIn ? "Authenticated member menu" : "Logged out member menu"}" ${dropdownOpen ? "" : "hidden"}>
          <div class="gf-nav__menu">
            ${
              loggedIn
                ? `
                  <button class="gf-nav__menu-item" type="button" data-action="portal" role="menuitem">Dashboard</button>
                  <button class="gf-nav__menu-item" type="button" data-action="logout" role="menuitem">Logout</button>
                `
                : `
                  <button class="gf-nav__menu-item" type="button" data-action="login" role="menuitem">Login</button>
                `
            }
          </div>
        </div>

        <div class="gf-nav__status" aria-live="polite">
          ${escapeHtml(statusText)}
        </div>
      </div>
    </div>
  `;
}

export function registerPublicMemberNavMobileElement() {
  if (typeof window === "undefined" || typeof customElements === "undefined") {
    return null;
  }

  if (customElements.get("gf-public-member-nav-mobile")) {
    return customElements.get("gf-public-member-nav-mobile");
  }

  class GfPublicMemberNavMobile extends HTMLElement {
    static observedAttributes = [STATE_ATTRIBUTE];

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._memberState = parseMemberState(null);
      this._dropdownOpen = false;
      this._rendering = false;
      this._restoreToggleFocus = false;
      this._onClick = this._onClick.bind(this);
      this._onDocPointerDown = this._onDocPointerDown.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onFocusOut = this._onFocusOut.bind(this);
    }

    connectedCallback() {
      this._memberState = parseMemberState(this.getAttribute(STATE_ATTRIBUTE));
      this._dropdownOpen = Boolean(this._memberState.dropdownOpen);
      this._render();
      this.addEventListener("keydown", this._onKeyDown);
      this.addEventListener("focusout", this._onFocusOut);
      window.addEventListener("pointerdown", this._onDocPointerDown, true);
    }

    disconnectedCallback() {
      this.removeEventListener("keydown", this._onKeyDown);
      this.removeEventListener("focusout", this._onFocusOut);
      window.removeEventListener("pointerdown", this._onDocPointerDown, true);
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (name !== STATE_ATTRIBUTE || oldValue === newValue) {
        return;
      }

      const nextState = parseMemberState(newValue);
      this._memberState = nextState;
      this._dropdownOpen = Boolean(nextState.dropdownOpen);
      this._render();
    }

    _render() {
      const restoreToggleFocus = this._restoreToggleFocus;
      this._restoreToggleFocus = false;
      this._rendering = true;

      try {
        this.shadowRoot.innerHTML = buildMemberNavMarkup({
          ...this._memberState,
          dropdownOpen: this._dropdownOpen,
        });
        this._bindActionListeners();
        if (restoreToggleFocus) {
          this.shadowRoot.querySelector('[data-action="toggle-menu"]')?.focus({ preventScroll: true });
        }
      } finally {
        this._rendering = false;
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

    _toggleHasFocus() {
      return this.shadowRoot?.activeElement?.getAttribute?.("data-action") === "toggle-menu";
    }

    _closeDropdown() {
      if (!this._dropdownOpen) {
        return;
      }

      this._dropdownOpen = false;
      this.setAttribute(STATE_ATTRIBUTE, JSON.stringify({
        ...this._memberState,
        dropdownOpen: false,
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

      if (action === "toggle-menu") {
        this._restoreToggleFocus = event?.detail === 0 && this.shadowRoot?.activeElement === trigger;
        this._dropdownOpen = !this._dropdownOpen;
        this.setAttribute(STATE_ATTRIBUTE, JSON.stringify({
          ...this._memberState,
          dropdownOpen: this._dropdownOpen,
        }));
        return;
      }

      if (action === "login" || action === "portal" || action === "logout") {
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

    _onKeyDown(event) {
      if (event?.key === "Escape" && this._dropdownOpen) {
        this._restoreToggleFocus = this._toggleHasFocus();
        this._closeDropdown();
      }
    }

    _onFocusOut(event) {
      if (this._rendering) {
        return;
      }

      const nextTarget = event?.relatedTarget;
      if (nextTarget && (this.contains(nextTarget) || this.shadowRoot?.contains(nextTarget))) {
        return;
      }

      this._closeDropdown();
    }
  }

  customElements.define("gf-public-member-nav-mobile", GfPublicMemberNavMobile);
  return GfPublicMemberNavMobile;
}

registerPublicMemberNavMobileElement();
