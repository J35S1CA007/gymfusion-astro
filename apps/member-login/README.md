# GYMFUSION Members Login

Native Astro login for the Members Portal. Better Auth owns Portal credentials and sessions; D1 stores Better Auth state and the explicit account-to-C0 mapping. Wix/C0 remains authoritative for canonical identity, Member linkage, eligibility, provisioning, restrictions, and lifecycle.

## Production Configuration

Production values belong in the Worker environment. The local `.env` remains private and `.env.example` contains placeholders only.

Required public/runtime variables:

- `MEMBER_LOGIN_URL`
- `MEMBERS_PORTAL_URL`
- `MEMBER_PORTAL_SERVICE_URL`
- `GYMFUSION_TENANT_ID`
- `GYMFUSION_AUTOMATION_APP_CLIENT_ID`
- `GYMFUSION_GRAPH_SENDER_EMAIL`
- `TURNSTILE_SITE_KEY`

Required server-only secrets:

- `GYMFUSION_GRAPH_CLIENT_SECRET`
- `TURNSTILE_SECRET_KEY`

The Worker must bind the `BETTER_AUTH_DB` D1 database. Better Auth handles login, password creation, password reset, logout, and session cookies. Authenticated portal reads and submissions pass through server-side validation and the authoritative C0/Wix bridge; browser-provided Member IDs, Contact IDs, FUSIONIDs, or lifecycle values are never authority.
