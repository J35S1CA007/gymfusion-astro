<task>
Rebuild the GYMFUSION Members Login as a native Astro app in:

  /Users/ccuser/gymfusion-astro/apps/member-login

This is Task 1 and must be completed before the Members Portal build begins.

The app currently contains reference material and assets but no active Astro login implementation.

Build the functional Members Login page from the supplied references and locked design requirements below.

Do NOT begin the Members Portal build.
Do NOT modify Public EOI functionality except where a shared header component must be safely reused by import/reference without changing its behaviour.
</task>

<locked>
AUTHENTICATION / TERMINOLOGY

- Use "Log In" and "Log Out".
- Do not use "Sign In" or "Sign Out".
- The login must use the existing supported Wix Members authentication architecture.
- Do not create a second credential system.
- Forgot Password must work directly on the Login page.
- No separate Forgot Password page is required.
- Successful authentication must hand the member into the Members Portal route at `/members`.
- Already-authenticated members reaching the Login page should be handled safely and should not be asked to log in again unnecessarily.

PAGE BACKGROUND

The authoritative full-screen background asset is:

  /Users/ccuser/gymfusion-astro/apps/member-login/assets/background-members-login-screen.png

Requirements:
- use this supplied asset directly;
- it fills the entire viewport width and height;
- it remains responsive;
- no unintended blank gutters/background areas;
- the login composition sits on top of this background.

CENTRED LOGIN COMPOSITION

The page must contain a centred square/panel.

Its visual stack is:

  FULL-SCREEN BACKGROUND IMAGE
        ↓
  CENTRED GRADIENT SQUARE
        ↓
  TRANSPARENT SPIRAL PATTERN
        ↓
  WELCOME BACK + FUNCTIONAL LOGIN FORM

The square background must use the exact gradient documented in:

  /Users/ccuser/gymfusion-astro/apps/member-login/reference/css-snippet-for-behind-gf-spiral-pattern-transparent.png.rtf

Exact gradient:

  linear-gradient(
    111deg,
    #FF924E 4.821134868421053%,
    #FF0006 23.183936403508774%,
    rgba(255,0,87,0.92) 42.61924342105263%,
    #A000FF 74.0234375%,
    #8554FA 83.62801535087719%
  )

On top of the gradient square, use:

  /Users/ccuser/gymfusion-astro/apps/member-login/assets/gf-spiral-pattern-transparent.png

The spiral asset must remain a supplied asset, not be redrawn/recreated.

LOGIN FORM REFERENCE

Use this as the strongest visual/interaction reference:

  /Users/ccuser/gymfusion-astro/apps/member-login/reference/welcome-back-login-gf-portal.html

It is reference-only and must NOT be executed as an iframe/embed or copied as an isolated runtime.

Rebuild its behaviour natively in Astro.

The active implementation must include:
- WELCOME BACK
- Email
- Password
- Log In
- Forgot Password?
- same-page password recovery mode
- return-to-login mode
- loading/error/success states
- functional keyboard navigation
- reduced-motion support

FORGOT PASSWORD

Forgot Password must function on the same page.

Use the reference HTML's transition concept as visual guidance:
- selecting "Forgot Password?" transitions the form into password-reset mode;
- password field is removed/hidden appropriately;
- Email remains available;
- CTA becomes the appropriate password-reset action;
- user can return to normal Login mode without leaving the page.

The actual reset action must use the supported Wix password-recovery mechanism.

Do not fake success.
Only show reset success after authoritative backend/Wix confirmation.

FONTS

Use:
- `SEPARATED.ttf` for "WELCOME BACK"
- exact font family treatment from the reference HTML where appropriate:
  - Gamuth Sans
  - Gamuth Sans Bold
  - Gamuth Display Black
  - Pacifico

Font reference:
  /Users/ccuser/gymfusion-astro/apps/member-login/reference/fonts.rtf

Authoritative font assets live in the existing GYMFUSION assets repository.

Do not replace the WELCOME BACK treatment with a generic font.

LOGOS

Codex may freely use the approved supplied logo assets in:

  /Users/ccuser/gymfusion-astro/apps/member-login/assets/member-login-page-logos

Current assets include:
- gf-members-portal-transparent logo.png
- vibrant_gf_spiral_transparent.png
- vibrant_gf_title_and_white_slogan_transparent.png

Codex may choose their placement/sizing/responsive treatment.

Do not redraw, recolour, distort, or substitute these assets.

HEADER

Reuse the visual/header pattern from the Public EOI Astro project:
- black header strip
- Menu button / dropdown
- top GYMFUSION logo

But:
- DO NOT include the public Members Login button in the header on the Members Login page.

Reference instruction:
  /Users/ccuser/gymfusion-astro/apps/member-login/reference/utilise .astro project public-eoi header strip with the menu button and top logo but not the login button.rtf

The login page should therefore feel visually connected to the Public EOI Astro experience without duplicating the public login control.

LEGACY REFERENCE

The file:

  /Users/ccuser/gymfusion-astro/apps/member-login/reference/legacy-wix-login-lightbox.png

is visual reference only.

It may inform the overall feel/layout, but it is not runtime authority and must not be recreated literally if it conflicts with the current locked requirements.
</locked>

<to_verify_before_implementation>
Before writing code:

1. Inspect the full current contents of:
   /Users/ccuser/gymfusion-astro/apps/member-login

2. Read all supplied reference files.

3. Inspect the current Public EOI Astro header implementation sufficiently to reuse its header/menu visual behaviour safely.

4. Inspect the existing Wix-side Members Login/authentication implementation in:
   /Users/ccuser/gymfusion-wix-repo

Establish from real code:
- current login API/function
- current password-reset/recovery pathway
- expected authenticated success result
- expected Portal destination
- session/auth state handling
- any existing safe redirect/handoff contract

5. Do not infer Wix auth behaviour from the old HTML reference.

6. If the existing supported authentication path cannot be established from current code, STOP and report BLOCKED rather than inventing a new auth architecture.
</to_verify_before_implementation>

<implementation_requirements>
Build the minimum complete native Astro app required for Task 1.

At minimum provide:
- Astro app/package setup if currently absent
- page route
- responsive page shell
- reused/recreated header components as appropriate
- full-screen background layer
- centred gradient square
- supplied spiral overlay
- native login form
- native forgot-password state
- Wix authentication transport
- Wix password recovery transport
- already-authenticated handling
- authenticated redirect/handoff to `/members`
- safe error handling
- loading states
- accessibility
- focused browser tests

Do not use:
- iframe
- HTML embed runtime
- `new Function`
- `postMessage` bridge architecture
- browser-controlled identity authority
- fake local login success
</implementation_requirements>

<responsive_and_accessibility>
The same app must work on Desktop and Mobile.

Responsive presentation may differ, but functionality must remain equivalent.

Require:
- no horizontal overflow at approximately 320px, 390px/414px, and desktop widths;
- full-screen background preserved;
- centred square/panel remains usable on small screens;
- form must not clip;
- touch-friendly controls;
- semantic labels;
- visible keyboard focus;
- Enter-to-submit where appropriate;
- Escape behaviour where relevant for dropdown/menu;
- screen-reader accessible validation/errors;
- no functionality dependent solely on hover;
- reduced-motion preference respected;
- appropriate autocomplete values for email/current-password;
- focus returns sensibly when leaving Forgot Password mode.
</responsive_and_accessibility>

<auth_safety>
Treat authentication as security-sensitive.

Verify at minimum:

- valid credentials → authenticated success only after Wix confirms success;
- invalid credentials → remain unauthenticated;
- network/backend failure → no fake success;
- malformed backend response → no fake success;
- duplicate Log In click while request is in flight does not issue uncontrolled duplicate operations;
- password reset success only after authoritative confirmation;
- password reset failure does not show success;
- authenticated member visiting login is handled safely;
- unauthenticated member cannot reach `/members` merely by client-side state manipulation;
- browser input cannot supply an authoritative FUSIONID/Wix Member ID/Contact ID.

Do not expose raw internal auth errors, IDs, stack traces, or sensitive implementation details in the UI.
</auth_safety>

<may_modify>
Primarily:

  /Users/ccuser/gymfusion-astro/apps/member-login/**

You may add the files necessary to make `apps/member-login` a functional Astro app.

You may safely reuse/import shared code/assets where appropriate.

If a Wix backend/auth change is genuinely required to connect the existing supported login contract, keep it minimal and explicitly report it.

Do not modify unrelated applications.
</may_modify>

<forbidden>
Do NOT:

- begin Members Portal Dashboard/Profile/Submissions/Evidence implementation;
- implement EOI Parts 2–4;
- modify the Members Portal handover/specification;
- redesign Public EOI;
- replace Wix credential authority;
- implement custom password storage;
- invent new identity architecture;
- alter canonical FUSIONID rules;
- deploy;
- publish;
- modify DNS;
- stage;
- commit;
- push.

Stop after implementation and verification for review.
</forbidden>

<missing_context_gating>
Do not invent missing authentication semantics, routes, Wix API behaviour, or identity rules.

Retrieve repository evidence where available.

If a missing fact materially affects authentication/security correctness and cannot be established, report:

  BLOCKED

with the exact missing fact.

Do not guess.
</missing_context_gating>

<completeness_contract>
Task 1 is complete only when:

- Members Login is a native Astro implementation;
- supplied background is full-screen;
- centred gradient square exists;
- supplied spiral pattern overlays the square;
- supplied/reference typography is respected;
- Email + Password login works through Wix;
- Forgot Password works on the same page through Wix;
- authenticated success goes to `/members`;
- already-authenticated handling works;
- Desktop and Mobile are usable;
- accessibility basics pass;
- no reference HTML is acting as active runtime;
- focused authentication/browser tests pass;
- no Members Portal feature implementation has begun.
</completeness_contract>

<verification_loop>
Run the narrowest relevant verification and then self-review.

At minimum:

1. Astro check for member-login
2. Astro build for member-login
3. focused browser tests covering:
   - successful login
   - invalid login
   - backend/network failure
   - duplicate login click
   - forgot-password transition
   - password-reset success
   - password-reset failure
   - return to login
   - already-authenticated redirect
   - Desktop viewport
   - ~390/414px viewport
   - 320px viewport
4. accessibility smoke:
   - keyboard operation
   - visible focus
   - labels
   - error announcements
   - reduced motion
5. inspect for:
   - iframe
   - active legacy embed runtime
   - fake login success
   - browser authority identifiers
6. `git diff --check`
7. inspect final diff and confirm only authorised scope changed

If a focused test exposes an implementation defect within this task's scope, fix it and rerun the relevant verification before reporting.

Do not stage/commit/push.
</verification_loop>

<default_follow_through_policy>
Proceed through:

inspect
→ establish current Wix auth contract
→ build native Astro login
→ wire auth/recovery
→ responsive/accessibility pass
→ browser verification
→ self-review
→ report

Do not stop for routine implementation questions that are already resolved by the locked requirements.

Stop only for a material security/authentication ambiguity that cannot be grounded from repository evidence.
</default_follow_through_policy>

<structured_output_contract>
Return exactly:

# TASK 1 — MEMBERS LOGIN REBUILD

## 1. RESULT
`PASS`, `PASS WITH GAPS`, or `BLOCKED`

## 2. AUTH CONTRACT VERIFIED
- Wix login authority:
- password recovery authority:
- authenticated success contract:
- authenticated destination:
- already-authenticated behaviour:
- browser identity authority rejected: PASS/FAIL

## 3. IMPLEMENTATION
- native Astro login: PASS/FAIL
- full-screen supplied background: PASS/FAIL
- centred gradient square: PASS/FAIL
- supplied spiral overlay: PASS/FAIL
- supplied/reference fonts: PASS/FAIL
- approved logo assets used: YES/NO
- Public EOI-style header reused: PASS/FAIL
- public Login header button absent: PASS/FAIL
- Email/Password login functional: PASS/FAIL
- Forgot Password same-page flow functional: PASS/FAIL
- return-to-login functional: PASS/FAIL
- authenticated redirect to `/members`: PASS/FAIL

## 4. RESPONSIVE / ACCESSIBILITY
- Desktop: PASS/FAIL
- ~414px: PASS/FAIL
- ~390px: PASS/FAIL
- 320px: PASS/FAIL
- horizontal overflow absent: PASS/FAIL
- keyboard navigation: PASS/FAIL
- visible focus: PASS/FAIL
- accessible validation/errors: PASS/FAIL
- reduced motion: PASS/FAIL

## 5. AUTH SAFETY
- backend-confirmed login success only: PASS/FAIL
- invalid credentials safe: PASS/FAIL
- network/backend failure safe: PASS/FAIL
- malformed response safe: PASS/FAIL
- duplicate-submit guard: PASS/FAIL
- backend-confirmed reset success only: PASS/FAIL
- no custom credential authority: PASS/FAIL
- no browser identity authority: PASS/FAIL
- no active iframe/embed runtime: PASS/FAIL

## 6. FILES CHANGED
List every file changed/added.

## 7. TESTS
List exact commands and results.

## 8. SAFETY
- Members Portal implementation started: NO
- Public EOI functionality changed: NO, unless explicitly required and reported
- staged: NO
- commit: NO
- push: NO
- deploy: NO
- publish: NO

## FINAL

If complete:

`TASK 1 MEMBERS LOGIN PASS — READY FOR REVIEW`

If blocked:

`TASK 1 MEMBERS LOGIN BLOCKED`

with the exact unresolved requirement.
</structured_output_contract>