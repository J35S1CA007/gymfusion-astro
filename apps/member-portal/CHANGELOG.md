# Change Log

## Unreleased

- Converted the Part 2 Health Profile reference into a native Astro page.
- Added the React integration and a Shadix UI-derived signature pad that records PNG data, timestamp, document ID, filename, and stamped SVG output.
- Replaced the native date input with a Shadix UI-derived DateTimePicker while retaining the client-local current date and ISO submission value, with roving keyboard navigation and narrow-mobile containment.
- Preserved multi-step validation, conditional follow-ups, responsive presentation, and keyboard submission prevention.
- Added the required conditional specification field for the breathing “Other” option and preserved the requested multi-selection Follow Up 4 rule.
- Added accessible validation metadata and first-error focus handling.
- Added keyboard signature drawing with linked instructions and visible focus treatment.
- Added browser regression coverage for signature capture, resize-safe clearing, validation, Enter-key prevention, and breathing follow-up branching.
- Left authenticated session resolution and server-side health submission explicitly pending.

## v0.1.0
- Reserved target application for the GYMFUSION Member Portal.
- Not yet implemented.
