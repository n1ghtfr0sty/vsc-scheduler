---
name: verify
description: How to build, launch, and drive the VSC Scheduler app to verify changes end-to-end (server + browser UI).
---

# Verifying VSC Scheduler changes

No build step. Frontend is vanilla JS served from `public/`; backend is Express.

## Launch a test instance (don't touch the user's server on :3000)

The user's dev server often runs elevated on port 3000 and cannot be killed
from a non-elevated shell. Run a parallel instance instead:

```powershell
$env:PORT='3999'; npm run dev   # run_in_background
```

**Caution:** both instances share `data/vsc.db` — writes through a test
instance hit the real database. Clean up any test rows you create.

## Backend/API verification

Login first (session cookie), capture `csrfToken` from the login response,
send it as `X-CSRF-Token` on any POST/PUT/DELETE:

```powershell
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$login = Invoke-RestMethod "http://localhost:3999/api/auth/login" -Method Post `
  -Body (@{email='admin@vsc.com';password='password123'}|ConvertTo-Json) `
  -ContentType 'application/json' -WebSession $s
# mutations: -Headers @{'X-CSRF-Token'=$login.csrfToken}
```

Test accounts: admin@vsc.com, coach1/coach2@vsc.com, family1-3@vsc.com — all `password123`.
(coach/family accounts have reduced permissions — useful for permission-dependent UI.)

## Frontend/UI verification (headless browser)

No Playwright/Puppeteer in the project. Install `puppeteer-core` in the
scratchpad (NOT the project) and point it at the system Chrome:

- Chrome path: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Login flow: goto `http://localhost:3999/#/`, fill
  `#loginForm input[name="email"]` / `input[name="password"]`, click
  `#loginForm button[type="submit"]`, then
  `waitForFunction(() => window.Auth && Auth.currentUser)`.
- SPA renders after auth; give it ~500ms after login before asserting.
- Mobile layout breakpoint is 768px — set viewport width ≤768 to test it.
- A 401 console error for `/api/auth/me` before login is normal noise.

## Gotchas

- Server code changes require restarting the node process (user must restart
  their own :3000 instance — remind them).
- CSP is strict-ish: inline `onclick=` works only because
  `script-src-attr 'unsafe-inline'` is set in `src/index.js`. Watch the
  browser console for CSP violations when adding UI.
