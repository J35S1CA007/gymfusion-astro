# GYMFUSION Members Login

Native Astro login presentation for the separate Members Portal application.

## Production Configuration

Production runtime values belong in the hosting or deployment platform environment configuration.
The real local `.env` remains local and must not be committed.
`.env.example` is template documentation only.
No Client Secret is required in this documented set.

### Production environment variables

- `WIX_HEADLESS_CLIENT_ID=8060e954-da1f-4eaf-81c9-4bdf0611c5f6`
- `WIX_AUTH_REDIRECT_URI=https://portal.gymfusion.com.au/api/auth/callback`
- `WIX_PASSWORD_RESET_REDIRECT_URI=https://portal.gymfusion.com.au/login?reset=complete`
- `MEMBER_LOGIN_URL=https://portal.gymfusion.com.au/login`
- `MEMBERS_PORTAL_URL=https://portal.gymfusion.com.au/dashboard`

### Locked Wix Headless settings

- Allowed redirect domain: `https://portal.gymfusion.com.au`
- Allowed authorization redirect URIs:
  - `https://portal.gymfusion.com.au/api/auth/callback`
  - `https://portal.gymfusion.com.au/login?reset=complete`
- Wix Login URL: `https://portal.gymfusion.com.au/login`
- Post-login Members Portal destination: `https://portal.gymfusion.com.au/dashboard`

`WIX_API_BASE_URL` is optional and defaults to `https://www.wixapis.com`; it is intended for isolated integration testing.

The implementation uses Wix Login V2 and Send Recovery Email over the self-managed REST APIs. Login credentials are accepted only by the server endpoint, Wix access and refresh tokens remain in a process-local server session, and the browser receives only an HttpOnly opaque session cookie. The OAuth authorization-code exchange uses a full-page PKCE redirect so mobile browsers do not depend on the desktop-only hidden-iframe direct-login exchange.

The session map is deliberately conservative for this first implementation. Production deployment must provide a shared, encrypted session store or equivalent single-instance guarantee before multi-instance traffic is enabled.
