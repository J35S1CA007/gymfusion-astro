# GYMFUSION Astro Agent Guide

## Purpose
This file governs AI-agent behaviour inside `gymfusion-astro`.
It translates locked GYMFUSION architecture and repository governance into operating rules.
It does not replace the Technical Specification.

## Authority Hierarchy
1. Locked GYMFUSION Technical Specification in `/Users/ccuser/gymfusion-wix-repo/docs/technical-specification/**`
2. Current `gymfusion-astro` repository architecture and changelog governance
3. Approved GYMFUSION architecture and repository boundaries
4. Official Astro documentation and Astro Docs MCP
5. App-specific implementation evidence when it does not conflict with higher authority

App code, history, screenshots, and migration sources may inform work, but they do not override locked architecture.

## Repository Responsibilities
- `gymfusion-astro`: Astro application/frontend source of truth
- `gymfusion-wix-repo`: Wix / Velo / backend authority and central Technical Specification
- `gymfusion-embeds`: legacy Wix embed implementation and migration evidence
- `gymfusion-assets`: reusable GYMFUSION brand and general assets

## Locked Architecture
- C0 canonical identity/provisioning architecture is locked.
- Astro integrates with C0; it does not replace it.
- Do not reopen, reinterpret, or redesign C0.
- Wix remains authoritative for approved data, identity, CRM/member capabilities, provisioning, and business logic.
- Astro is the application/frontend platform.

## Application Trust Boundaries
- Public EOI: public/unauthenticated application with a hardened server-side boundary
- Member Portal: authenticated application with secure server-controlled authentication/session handling
- Staff CRM: privileged application requiring authentication plus GYMFUSION authorization

Public, member, and staff applications do not have to use identical integration patterns.

## Security Rules
- Browser-supplied Member ID, Contact ID, FUSIONID, role, permission, or lifecycle state is not authority.
- Privileged credentials and tokens must not be exposed to browser code.
- Sensitive or privileged operations must go through approved server-side boundaries.
- UI visibility is not an authorization boundary.
- Secrets do not belong in repository source.
- `.env` must not be committed.
- `.env.example` contains placeholders only.

## Astro Framework Governance
- Review official Astro release notes and changelog before upgrading.
- Keep test, check, lint, and build green after framework changes.
- Prefer official Astro docs / Astro Docs MCP over model memory.
- Treat Astro 7.2.4 as the current baseline only if the repository has not been upgraded.

## Third-Party Tooling
- Third-party skills, plugins, and UI libraries are optional accelerators, not architecture authority.
- Review provenance, licensing, security, and maintenance before adoption.
- Do not use unofficial redistributions of licensed or commercial assets/packages.
- Use official licensed sources for approved commercial assets.

## Visual and Design Preservation
Preserve approved GYMFUSION presentation; replace platform coupling.

- Do not silently redesign an approved GYMFUSION experience.
- Astro migration does not authorize generic framework styling.
- Reproduce approved source designs from actual source/CSS/assets when possible.
- Screenshots are evidence; current source files are preferred when available.
- Removing Wix transport does not remove approved visual or interaction behaviour.
- Reuse approved GYMFUSION assets where appropriate.

## Desktop and Mobile
One shared application/state model does not require identical desktop and mobile visual composition.
Desktop and mobile may have distinct approved presentations.
Preserve those differences when authoritative evidence establishes them.

## Function vs Presentation
Distinguish functional/schema migration from visual/page-experience migration.
Do not declare frontend migration complete solely because fields exist, tests pass, validation works, or routes compile.
Verify visual/page-experience parity separately where required.

For the current Public EOI state:
- EOI Part 1 functional/schema migration: complete
- EOI Part 1 visual/page-experience migration: incomplete

## Accessibility
Preserve approved accessibility behaviour, including semantic labels, focus behaviour, keyboard navigation, readable contrast, accessibility controls, reduced-motion considerations, and responsive usability.

## Shared Code and Abstraction
- Use `packages/shared` only for genuine cross-app reuse.
- Do not prematurely abstract Public EOI code.
- Avoid speculative helpers and components.
- Keep app-specific behaviour in its app until reuse is proven.

## Legacy Wix and Embed Migration
Preserve approved presentation, interaction behaviour, and business semantics when migrating from Wix or embeds.
Replace platform coupling, not approved behaviour.

## Backend Integration
- Astro must not invent or assert canonical FUSIONID, canonical person identity, Member ownership, Contact ownership, safeguarding state, blocked or restricted state, reconciliation state, or lifecycle or authorization state.
- Authoritative business and security decisions must come from approved GYMFUSION/Wix server-side logic.
- Public EOI, Member Portal, and Staff CRM integration must follow the locked Technical Specification.
- Do not duplicate the full EOI routing matrix here; cross-reference the Technical Specification.
- Browser-entered or browser-stored IDs and state are inputs only, never authority.

## Verification and Acceptance
Default operating sequence: `inspect → modify → verify → self-review`.

Use the relevant checks for the work being changed, including where applicable:
- app-specific tests
- Astro check
- lint
- production build
- targeted regression tests
- security/integration checks
- manual visual review when visual parity is part of acceptance

Passing compilation or tests alone does not establish visual/page-experience acceptance.
Do not claim completion when a required manual review gate remains outstanding.

## Review-Agent Use
Use the installed `review-agent` skill for independent/adversarial review when work is detail-sensitive, safety-critical, architecture-sensitive, or intended for final acceptance.

Use it particularly for:
- specification or governance changes
- security/authentication/authorization changes
- backend integration boundaries
- visual-parity acceptance
- complex Git consolidation or branch promotion
- destructive operations
- final review before declaring a major migration slice complete

`review-agent` is a review layer, not architecture authority.
Its findings must be reconciled against the Technical Specification and actual repository evidence.

Do not treat implementation self-review as a substitute for `review-agent` where an independent review gate is required.

## Manual Review Gates
Require explicit human/WixForge/Jess review before accepting or finalizing material changes involving:
- visual parity
- UX/layout changes
- approved design reconstruction
- applicant-facing wording where exact copy is not locked
- security-sensitive architecture
- destructive Git operations
- branch deletion
- deployment
- DNS/hosting
- production/live mutations

Agents must not silently decide unresolved product or design wording.

## Changelog Governance
Root `/CHANGELOG.md` is for:
- workspace-wide changes
- shared packages
- repository architecture
- tooling
- changes affecting multiple apps

Application changelogs are for app-specific changes:
- `apps/public-eoi/CHANGELOG.md`
- `apps/member-portal/CHANGELOG.md`
- `apps/staff-crm/CHANGELOG.md`

Update the appropriate changelog when the task requires it.
Do not fabricate historical releases.

## Git and Working-Tree Safety
- Do not force-push unless explicitly authorized.
- Do not delete branches because they merely appear old.
- Respect branch/register governance where applicable.
- Preserve unrelated dirty work.
- Do not bundle unrelated changes into one commit.
- Do not silently merge or cherry-pick unrelated history.
- Destructive Git operations require explicit authorization.
- Verify branch, HEAD, and worktree before risky operations.
- Stop rather than reset, clean, or stash unknown user work.

## Technical Specification Cross-Reference
Use `/Users/ccuser/gymfusion-wix-repo/docs/technical-specification/` for detailed architecture rather than copying large matrices or contracts into `AGENTS.md`.

Summary only:
- Part A — Governance / Platform Architecture
- Part B — Data / Collection Architecture
- Part C — Operational Governance
- Part D — Lifecycle / Business Processes
- Part E — Developer Implementation Guide

If `AGENTS.md` conflicts with the locked Technical Specification, the Technical Specification wins.

## Astro Docs MCP
- Name: `Astro Docs`
- URL: `https://mcp.docs.astro.build/mcp`
- Transport: `Streamable HTTP`

Use where supported for current Astro framework grounding.
Official Astro docs / Astro Docs MCP outrank third-party Astro guidance.
MCP is development tooling, not runtime application infrastructure.
Do not place MCP credentials or secrets in repository files.

## Current Application Status
### `apps/public-eoi`
- active application
- EOI Part 1 functional/schema migration: complete
- EOI Part 1 visual/page-experience migration: incomplete
- Astro ↔ authoritative Wix backend/routing integration: not yet implemented end-to-end
- Astro reCAPTCHA: not yet implemented
- final end-to-end UAT: pending

### `apps/member-portal`
- locked target application
- not yet implemented
- authentication/session implementation details remain implementation-phase work where not already locked

### `apps/staff-crm`
- locked target application
- not yet implemented
- privileged authorization must follow GYMFUSION server-side StaffRoles / StaffPermissionRules authority

Avoid speculative implementation detail.

## Completion Rule
Do not report a task complete if:
- required tests, check, or build are failing
- required manual review is still pending
- visual parity remains unresolved where parity is part of the task
- an open architecture decision was silently guessed
- deployment or live mutation was required but not actually performed
- source evidence contradicts the claimed result

Use truthful status language such as:
- complete
- partial
- blocked
- pending manual review
- target-state only
- implementation-time verification
