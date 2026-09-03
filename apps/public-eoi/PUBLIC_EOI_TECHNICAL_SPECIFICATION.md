# GYMFUSION Public EOI Technical Specification

This document records locked architecture decisions and implementation invariants for the Public EOI application.

## Responsive Presentation Architecture

**Responsive Presentation Architecture — Locked Decision**

The Public EOI desktop and mobile experiences are presentation states of the same user journey and state model. They are not separate functional forms or independent workflows.

Crossing the responsive breakpoint must change presentation only. It must not reset, restart, duplicate, or independently own form state, validation state, submission state, eligibility state, Turnstile state, or user-entered data.

A desktop viewport reduced below the agreed responsive breakpoint must transition to the mobile presentation, and a mobile-width viewport increased above the breakpoint must transition to the desktop presentation, without requiring a page reload and without losing the current journey state.

Desktop and mobile may differ visually where appropriate, but they must preserve equivalent functionality, accessibility capability, validation behaviour, backend contracts, security boundaries, and submission outcomes.

### Implementation Invariant

Responsive state is viewport-driven presentation state; business logic and journey ownership remain shared.

## Specification Governance

Locked architectural decisions for Public EOI must be recorded here rather than existing only in chat, handover notes, or UAT. Implementation changes must preserve the locked decisions in this document. Changing a locked decision requires explicit approval before implementation.
