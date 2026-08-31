# Member Portal

Astro application for authenticated GYMFUSION member experiences.

## Current Scope

- Ready for Movement Part 2 Health Profile frontend implemented at `/`.
- Interactive signature capture uses a React island adapted from the MIT-licensed `@shadix-ui/signature-pad` registry component.
- Health-information date selection uses a React island adapted from the MIT-licensed `@shadix-ui/datetimepicker` registry component.
- Authenticated Wix Headless session resolution and the secure server-side submission boundary remain pending implementation.
- The form intentionally validates without sending health information until that trusted boundary is implemented.

## Commands

```sh
npm run dev --workspace apps/member-portal
npm run check --workspace apps/member-portal
npm run build --workspace apps/member-portal
npm test --workspace apps/member-portal
```
