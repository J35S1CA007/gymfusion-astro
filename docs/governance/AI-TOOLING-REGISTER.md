# GYMFUSION AI Tooling Register

Tool approval does not create architectural authority. The locked Technical Specification, root AGENTS.md, and official framework documentation remain controlling.

| Tool | Status | Role | Authority / limits | Next action |
|---|---|---|---|---|
| Astro Docs MCP | APPROVED / CONFIGURED | official current Astro documentation grounding | development tooling only; not runtime infrastructure; does not override GYMFUSION architecture | continue using by default where supported |
| review-agent | APPROVED / INSTALLED | independent/adversarial review for material, detail-sensitive, safety-critical, architecture-sensitive, or final-acceptance work | review layer only; must reconcile findings against Technical Specification and repository evidence | use at appropriate review gates |
| `incluud/astro-codex-plugin` — `astro-best-practices` | CANDIDATE FOR EVALUATION | Astro implementation guidance/workflow accelerator | must remain subordinate to AGENTS.md + official Astro docs | audit provenance, maintenance, permissions/instructions, overlap, and usefulness before installation |
| `incluud/astro-codex-plugin` — `migrate` | CANDIDATE FOR EVALUATION | migration workflow assistance, potentially relevant to Wix/embed → Astro migration | must obey: Preserve approved GYMFUSION presentation; replace platform coupling. It must not redesign approved UX or restore obsolete Wix coupling. | audit before installation/use |
| `incluud/astro-codex-plugin` — `create-component` | CANDIDATE FOR EVALUATION | Astro component scaffolding | must not introduce speculative abstraction or generic redesign | audit before installation/use |
| `incluud/astro-codex-plugin` — `add-integration` | DEFERRED UNTIL NEEDED | Astro integration setup assistance | may only be used when an integration has already been architecturally approved | evaluate at first approved integration task |
| `incluud/astro-codex-plugin` — `content-collection` | DEFERRED UNTIL NEEDED | Astro Content Collections assistance | do not introduce Content Collections merely because the skill exists | evaluate only if the architecture adopts Content Collections |
| `incluud/astro-codex-plugin` — `docs-lookup` | NOT CURRENTLY REQUIRED | documentation lookup | overlaps with official Astro Docs MCP | do not install unless a later evidence-based need emerges |
| `terminalskills.io/skills/astro` | CANDIDATE FOR EVALUATION | general Astro workflow skill | likely overlaps with other Astro workflow tooling; avoid redundant/conflicting instruction layers | audit before considering installation |
| AstroDeck / generic AGENTS.md standards pack | REFERENCE ONLY | possible source of governance ideas | must not replace or override GYMFUSION-owned AGENTS.md | mine ideas manually only if useful |
| WebcoreUI | DEFERRED / OPTIONAL FUTURE EVALUATION | possible UI accelerator for genuinely new UI | must NOT be used to replace approved visual-parity source designs with generic library styling | evaluate only for appropriate future new-UI work |
| unofficial Font Awesome Pro redistribution repository | REJECTED | none | licensing/provenance conflict with current GYMFUSION governance | do not use |

If Font Awesome Pro is ever approved, it must come from an official/licensed source with valid GYMFUSION entitlement.

Installed/approved does not mean mandatory for every task.
Use the smallest useful toolset for the task.
Avoid redundant skills that provide overlapping instructions.
Tools cannot override locked architecture.
Tools cannot silently redesign approved UX.
Tools cannot weaken security boundaries.
Tools cannot justify speculative refactoring.
New tools require provenance, licensing, security, maintenance, permission, and instruction-overlap review.
Any change in tool status should update this register.
