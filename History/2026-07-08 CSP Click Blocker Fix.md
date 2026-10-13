# Development Session: July 8, 2026

## Focus
Debugging and fixing a site-wide "nothing is clickable" regression introduced by the security-hardening work.

## What Happened
After the helmet/CSRF/rate-limiting hardening (commit `427b983`), the SPA rendered fine but every button and link was dead. No errors were visible in the UI — the browser was silently refusing to execute inline event handlers.

## Root Cause
`src/index.js` sets a custom Content-Security-Policy via `helmet.contentSecurityPolicy({...})`. Helmet merges its **default directives** into any custom set (`useDefaults: true` is the default), and one of those defaults is `script-src-attr 'none'`. That directive governs inline event-handler *attributes* specifically and overrides `script-src` for them — so even though the custom policy included `scriptSrc: 'unsafe-inline'`, all 66 inline `onclick="..."` handlers across `public/js/app.js`, `public/js/calendar.js`, and `public/js/auth.js` were blocked.

Diagnosis was confirmed by fetching the live header from port 3000: it ended with `script-src-attr 'none'`.

## Fix
Added one directive to the CSP block in `src/index.js`:

```javascript
scriptSrcAttr: ["'unsafe-inline'"],
```

This does not weaken the security posture — `script-src` already allowed `'unsafe-inline'`; the attribute-specific default was just silently overriding it.

## Verification
- Started a second server instance on port 3999 with the fix; served header now includes `script-src-attr 'unsafe-inline'`.
- User restarted the real server on port 3000 (it runs in an elevated terminal, so it couldn't be restarted from the agent's non-elevated shell) and confirmed buttons and access work again.

## Files Modified
- `src/index.js` — added `scriptSrcAttr` directive with explanatory comment.

## Open Issues / Follow-ups
- **Refactor inline handlers:** Migrating the 66 `onclick=` attributes to `addEventListener`/event delegation would let us restore `script-src-attr 'none'` and eventually drop `'unsafe-inline'` from `script-src` entirely. Sizable refactor; deferred.

## Lesson
When a helmet CSP "looks right" but behavior says otherwise, check the **served header**, not the config — helmet merges defaults into custom directives, and `script-src-attr` / `style-src-attr` defaults can override what `script-src` appears to allow.
