# Scheduler — DOX Local Index

## Purpose

Vikings Soccer Club Game Scheduler — a Node.js Express application for scheduling soccer games, managing players, teams, families, coaches, and opponents for the VSC league.

**Type:** Production web application  
**Status:** Active — security hardening in progress (Phase 1)

---

## Ownership

- **Owner:** [Session 2]
- **Contributors:** VSC administration
- **Runtime:** `npm start` (Express server, better-sqlite3, bcrypt auth)

---

## Local Contracts

- **API Layer:** RESTful routes in `src/routes/` (auth, coaches, families, games, players, seasons, teams, users, settings, opponents, events)
- **Data:** SQLite via better-sqlite3 (`src/db.js`, `src/schema.js`)
- **Auth:** Session-based with bcrypt, express-session, express-rate-limit
- **CLI:** `code-agent-cli.js` for automated code-agent interactions
- **Seeding:** `src/seed.js` for initial data population
- **Import:** `src/import-roster.js` for roster data imports
- **Frontend:** Single-page app in `public/` (app.js, calendar.js, events.js, api.js)

---

## Security Posture

Per full codebase review (`REVIEW.md`), the application has several security gaps that must be addressed before production use:

- **Critical:** XSS via `innerHTML` with user content, missing CSRF protection, hardcoded seed credentials, weak session secret
- **High:** No input validation or sanitization, SQL injection risk in dynamic IN clauses, no rate limiting on mutating endpoints
- **Medium:** No structured logging, unusual DB proxy pattern, schema drift between seed.js and schema.js
- **Low:** Missing indexes, no soft deletes, no audit log, no testing framework

See `REVIEW.md` for the full audit, 26 remediation items, and 5-phase prioritized roadmap.

**Standards:** `STANDARDS.md` contains all security, validation, and error handling standards. All code changes must comply with these standards.

---

## Work Guidance

- All route files follow the pattern: `src/routes/<entity>.js`
- Database schema and migrations live in `src/schema.js` and `src/db.js` (note: `src/db.js` uses an unusual Proxy pattern — document or refactor per `REVIEW.md`)
- Authentication middleware in `src/middleware/auth.js`
- When modifying routes, verify against schema for consistency
- Session data and cookies in `public/` and client-side storage
- Check `evergreen-calendar-2026-27.md` for season-specific business logic
- Member registration data in `member-registrations-*.csv`
- All code changes must pass reviewer validation against `REVIEW.md` checklist

---

## Verification

- `npm test` — tests pending (Phase 4)
- Verify route routes mount in `src/index.js`
- Confirm schema changes propagate to `src/db.js`
- Test auth flows: login, session middleware, token validation
- Verify CSV imports parse correctly
- Check rate-limiting and session configuration
- After Phase 1: confirm helmet() headers, CSRF tokens, input escaping, session secret randomness
- After Phase 4: confirm vitest passes, CI/CD pipeline operational

---

## Child DOX Index

No sub-modules or child DOX files in this project.
