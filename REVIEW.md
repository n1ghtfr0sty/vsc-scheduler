# VSC Scheduler — Codebase Review & Recommendations

> **Date:** 2026-06-09
> **Reviewer:** scheduler-reviewer
> **Scope:** Full codebase audit — backend, frontend, security, architecture, and business logic

---

## Executive Summary

A functional Express + SQLite single-page application with solid routing, auth, and conflict-detection logic. The codebase is **~3,000 lines of source code** across a clean flat structure. It serves a real soccer club well, but has several **security gaps**, **code quality issues**, and **missing features** that should be addressed before production use.

---

## 1. Security

### 1.1 🚨 CRITICAL — Hardcoded Credentials in Seed Data
**File:** `src/seed.js` (lines ~300+)
**Issue:** Default admin and coach password `password123` is hardcoded. No mechanism to enforce a password change on first login.
**Recommendation:**
- Force password change on first login with `admin@vsc.com`
- Add a `password_needs_reset` flag or `last_password_change` column to the `users` table
- On login, check if password is the seeded default and redirect to change form
- Alternatively, seed a cryptographically random password and print it once

### 1.2 🚨 CRITICAL — Missing CSRF Protection
**Issue:** All POST/PUT/DELETE routes accept state-changing requests with no CSRF token. The app uses `sameSite: 'lax'` cookies but does not protect against cross-site request forgery on any endpoint.
**Recommendation:**
- Install `csurf` or implement a simple CSRF token middleware
- Add token generation on session creation and validation on all mutating routes

### 1.3 ⚠️ HIGH — No Input Validation / Sanitization
**Issue:** Routes perform minimal input checking. Name fields, text fields, and freeform inputs go straight into SQL parameterized queries (safe from SQL injection) but have no XSS protection. The frontend uses `innerHTML` extensively:
- `app.js` line 155+ — `innerHTML` in render functions
- `app.js` — `showModal()` with `innerHTML`
- Calendar `innerHTML` in `calendar.js`
**Recommendation:**
- Add input length limits (e.g., name ≤ 100 chars)
- Use `textContent` instead of `innerHTML` for user-provided content, or escape with a library like `dompurify`
- Validate email format, phone format, date format on the backend before storing

### 1.4 ⚠️ HIGH — Insecure Session Secret
**File:** `.env`, `src/index.js`
**Issue:** `SESSION_SECRET` defaults to `'vsc-scheduler-secret'` in code and is `vsc-scheduler-secret-change-in-production` in `.env`. Neither is cryptographically random.
**Recommendation:**
- Generate a 64+ character random secret on first run
- Document the requirement to change it in production
- Add a startup check: warn if the secret looks like a placeholder

### 1.5 ⚠️ HIGH — Missing Security Headers
**File:** `src/index.js`
**Issue:** No security headers configured (no `helmet`, no CSP, no X-Frame-Options, no X-Content-Type-Options).
**Recommendation:**
```js
const helmet = require('helmet');
app.use(helmet());
```

### 1.6 ⚠️ MEDIUM — SQL Injection via Dynamic IN Clauses
**File:** `src/routes/games.js`, `src/routes/coaches.js`, `src/routes/players.js`
**Issue:** Dynamic `IN (...)` clauses built with string interpolation:
```js
`SELECT COUNT(*) as cnt FROM player_teams WHERE player_id IN (${playerIds.join(',')})`
```
While the IDs come from DB queries (not user input), this pattern is fragile and should be parameterized properly.
**Recommendation:**
- Build parameterized queries with `$1, $2, ...` placeholders matching the array length
- Or use a helper function for safe IN clause generation

### 1.7 ⚠️ MEDIUM — No Rate Limiting Beyond Login
**Issue:** Only the login route has rate limiting (`express-rate-limit`). All other endpoints are unlimited, including the `/api/settings/import` bulk import endpoint.
**Recommendation:**
- Add a general rate limiter for all API routes
- Add a stricter limiter for the import endpoint
- Consider per-IP rate limiting

---

## 2. Architecture & Code Quality

### 2.1 📦 DB.js — Unusual Proxy Pattern
**File:** `src/db.js`
**Issue:** The entire DB instance is wrapped in a `Proxy` that lazily binds methods. While this works, it's an unusual pattern that:
- Makes debugging harder (stack traces point through the proxy)
- Returns the bound method directly in middleware (`const permission = db.prepare(...).get(...)`) which breaks if the proxy behavior changes
- `saveDb()` is a no-op with no explanation
**Recommendation:**
```js
module.exports = {
  async getDb() { ... },
  // Expose methods directly:
  exec: async (sql, ...args) => { const db = await getDb(); return db.exec(sql, ...args); }
};
```
Or at minimum, document why the proxy pattern was chosen and remove the no-op `saveDb`.

### 2.2 📦 Schema Duplication — Drift Risk
**Files:** `src/schema.js` AND `src/seed.js`
**Issue:** The schema DDL exists in both `schema.js` and `seed.js`. If one changes and the other doesn't, they drift.
**Recommendation:**
- Have `seed.js` `require()` the schema DDL from `schema.js` instead of duplicating it
- Or extract schema into `src/schema.js` as a single source of truth and have seed import it

### 2.3 📦 No Dependency Between Tables on Game Creation
**File:** `src/routes/games.js`
**Issue:** Games can be created without a `season_id`. The `season_id` is optional in the schema but semantically all games should belong to a season.
**Recommendation:**
- Either make `season_id` NOT NULL or add business logic to warn/require a season
- Add validation in the games route

### 2.4 📦 Error Handling Inconsistency
**Issue:** Some routes use `try/catch` with `console.error` + JSON error response; others don't. Some catch `err` and return generic messages; some let it bubble to the global error handler.
**Recommendation:**
- Create a standardized error response helper:
```js
function sendError(res, message, status = 500) {
  return res.status(status).json({ error: message });
}
```
- Use it consistently across all routes

### 2.5 📦 No Centralized Error Handler
**File:** `src/index.js`
**Issue:** Global error handler only logs and returns a generic message. No structured error logging, no request correlation IDs, no error tracking integration.
**Recommendation:**
- Add structured logging (Winston or Pino)
- Add request ID tracking
- Consider Sentry or similar for production error tracking

### 2.6 📦 Duplicate Logic: `getCoachTeamIds`
**Files:** `src/routes/games.js`, `src/routes/teams.js`
**Issue:** The `getCoachTeamIds` function is duplicated in both files with nearly identical SQL.
**Recommendation:**
- Extract to `src/utils/permissions.js` or similar
- Share across routes

### 2.7 📦 Hardcoded Default Locations
**Files:** `app.js`, `settings.js`
**Issue:** Home location defaults like `'Evergreen'` are hardcoded in multiple places.
**Recommendation:**
- Rely solely on the `settings` table for configuration values
- Remove hardcoded fallbacks from the frontend

---

## 3. Frontend Issues

### 3.1 🚨 XSS Vulnerability — Unescaped User Content in innerHTML
**File:** `public/js/app.js` (every render function)
**Issue:** Every view uses `innerHTML` with interpolated user data. A user who controls their own name (via `PUT /api/users/:id/role` or direct DB access) can inject arbitrary HTML/JS into every page that displays their data.
**Example:**
```js
// Line ~200 in app.js
<div class="game-teams"><a href="#/teams/${game.team_id}">${game.team_name}</a></div>
```
If `game.team_name` contains `<script>...`, it executes.
**Recommendation:**
- Use a `createEl()` helper for safe DOM creation with `textContent`
- Or add `escapeHtml()` before interpolation
- Or switch to a templating library that auto-escapes

### 3.2 📦 No Loading/Spinner State Management
**Issue:** Each route manually sets `main.innerHTML = '<div class="loading">Loading...</div>'` but doesn't handle errors during loading (e.g., network timeout). If a fetch fails before the `catch`, the user sees "Loading..." forever.
**Recommendation:**
- Create a `showLoading()` / `hideLoading()` utility
- Add a timeout on all API calls
- Handle network failures gracefully

### 3.3 📦 No Route Permission Enforcement on Client
**Issue:** Navigation links are hidden based on `Auth.can()`, but users can type any URL hash directly. The `requireAuth()` check handles auth, but there's no check that unauthorized users can't access pages they shouldn't see.
**Recommendation:**
- Add a client-side route guard that checks permissions before rendering
- The server already returns 403, but the client should handle this gracefully (e.g., redirect to home with a message)

### 3.4 📦 API request — No Timeout
**File:** `public/js/api.js`
**Issue:** `fetch()` calls have no timeout. A hung request will keep the UI in a loading state indefinitely.
**Recommendation:**
```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10s
const response = await fetch(endpoint, { ...options, signal: controller.signal });
clearTimeout(timeout);
```

### 3.5 📦 Calendar `onclick` Inline Handlers
**File:** `public/js/calendar.js`
**Issue:** Inline `onclick` attributes like `onclick="calendar.previousMonth()"` are brittle. If `calendar` is not yet defined (timing issue), this throws.
**Recommendation:**
- Use `addEventListener` after rendering

### 3.6 📦 No Mobile/Responsive Testing Evidence
**Issue:** The app has a responsive layout but the CSS and JS assume desktop-first. The navbar collapses to overflow on small screens without hamburger toggle.
**Recommendation:**
- Add a mobile nav toggle button
- Test on mobile viewports
- Consider touch-friendly tap targets

### 3.7 📦 No Accessibility (a11y) Features
**Issue:** No `aria-*` attributes, no keyboard navigation, no skip links, no focus management. All interactivity is click-based.
**Recommendation:**
- Add `role="navigation"`, `aria-label` on interactive elements
- Add keyboard shortcuts for common actions
- Ensure focus order is logical

---

## 4. Business Logic

### 4.1 📋 Game Conflict Detection — Good
**File:** `src/routes/games.js`
**Assessment:** The conflict detection system is well-designed. It checks player, family, and coach conflicts with configurable travel time. This is the strongest piece of logic in the codebase.

### 4.2 ⚠️ No Duplicate Game Prevention
**Issue:** The same team can be scheduled for overlapping times with different opponents if no conflict is detected (e.g., no player overlap).
**Recommendation:**
- Add a hard check: a team cannot have two games at the same time, regardless of player overlap
- This is a safety net for the soft conflict warnings

### 4.3 📋 Coach Assignment Validation
**File:** `src/routes/games.js`
**Assessment:** Games require the creating user to be assigned to the team. This is correct.

### 4.4 ⚠️ Missing: Game Status Workflow
**Issue:** Games have no status field. No distinction between scheduled, confirmed, cancelled, or completed games.
**Recommendation:**
- Add `status` column to `games`: `scheduled | confirmed | cancelled | completed | postponed`
- Add a UI for coaches to update game status before/after games

### 4.5 ⚠️ Missing: Game Results/Score Entry
**Issue:** No mechanism to record game outcomes (score, notes, MVP).
**Recommendation:**
- Add `home_score INTEGER`, `away_score INTEGER` to the `games` table
- Allow coaches to submit results after the game

### 4.6 ⚠️ Missing: Notification System
**Issue:** No notification mechanism. Coaches have no way to be notified of schedule changes, conflicts, or new games assigned to them.
**Recommendation:**
- Add an in-app notification system (database table)
- Consider email notifications for critical events

### 4.7 ⚠️ No Import/Export Validation
**File:** `src/routes/settings.js`
**Issue:** The import endpoint accepts arbitrary JSON and inserts it directly. No validation of data integrity, no rollback on failure, no backup before import.
**Recommendation:**
- Validate the imported data structure before inserting
- Wrap the entire import in a transaction
- Create a backup snapshot before bulk import
- Add a dry-run/preview mode

### 4.8 ⚠️ No Audit Log
**Issue:** No record of who made what changes and when. Admin actions (role changes, permission changes) are not audited.
**Recommendation:**
- Add an `audit_log` table: `user_id`, `action`, `table`, `record_id`, `old_value`, `new_value`, `timestamp`
- Log all CRUD operations at minimum
- Log all permission/role changes with severity

---

## 5. Database & Data Integrity

### 5.1 📋 Schema — Solid
**Assessment:** The schema is well-designed for the domain. Foreign keys, proper types, CHECK constraints on enums, and cascade deletes are in place.

### 5.2 ⚠️ No Database Migrations
**Issue:** Schema changes must be manually applied via `schema.js`. There's no migration system (like `knex-migrate` or `sql-migrate`).
**Recommendation:**
- Add a migration tool (`knex`, `db-migrate`, or custom migration runner)
- Track applied migrations in a `migrations` table

### 5.3 ⚠️ No Database Indexes Beyond Primary Keys
**Issue:** No explicit indexes on foreign keys, date columns, or frequently queried columns. With a small dataset this is fine, but performance will degrade with thousands of games.
**Recommendation:**
```sql
CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_games_season ON games(season_id);
CREATE INDEX idx_games_team ON games(team_id);
CREATE INDEX idx_games_opponent ON games(opponent_id);
CREATE INDEX idx_families_user ON families(user_id);
CREATE INDEX idx_players_family ON players(family_id);
```

### 5.4 ⚠️ `calendar_events` Table Uses `COALESCE` for All Fields
**File:** `src/routes/events.js`
**Issue:** The update query uses `COALESCE(?, column)` for every field, meaning every update sends all 7 fields even if only one changed. The `PUT` client in `api.js` also sends all fields.
**Recommendation:**
- Either send only changed fields (PATCH-style) or accept sending all fields (current behavior is fine, just document it)

### 5.5 ⚠️ No Soft Deletes
**Issue:** `DELETE CASCADE` removes data permanently. If a game is accidentally deleted, it's gone. If a team is deleted, all games are gone.
**Recommendation:**
- Add `deleted_at DATETIME` to critical tables
- Filter queries by `WHERE deleted_at IS NULL`
- Allow admins to restore soft-deleted records

### 5.6 📋 Settings Table — Good Pattern
**Assessment:** Using a key-value store for app settings is appropriate. The default values (travel time, game duration, home location) are reasonable.

### 5.7 ⚠️ No Unique Constraints on Business Keys
**Issue:** 
- `opponents.name` has no unique constraint — duplicate opponent names can be created
- `seasons` has no unique constraint on `(name, year, type)` — duplicates possible
**Recommendation:**
```sql
CREATE UNIQUE INDEX idx_opponents_name ON opponents(name);
CREATE UNIQUE INDEX idx_seasons_name_year_type ON seasons(name, year, type);
```

---

## 6. Testing & Reliability

### 6.1 🚨 No Tests
**Issue:** Zero test files exist. `package.json` has no `test` script.
**Recommendation:**
- Add `vitest` or `jest`
- Start with critical path tests:
  - Auth flow (login, register, permissions)
  - Game conflict detection
  - Permission enforcement
  - Import/export round-trip
- Aim for 60%+ coverage on business logic

### 6.2 ⚠️ No CI/CD Pipeline
**Issue:** No GitHub Actions, no automated testing, no deployment pipeline.
**Recommendation:**
- Add a GitHub Actions workflow
- Run tests on push/PR
- Add linting step

### 6.3 ⚠️ No Logging Strategy
**Issue:** Only `console.error` for errors. No request logging, no structured logs.
**Recommendation:**
- Add `morgan` for HTTP request logging
- Add structured error logging with timestamps, request IDs, and user IDs

---

## 7. Missing Features (from Action Items)

### 7.1 Print Styling
**Issue:** The print button (`window.print()`) prints the raw page without print-specific CSS.
**Recommendation:**
```css
@media print {
  .navbar, .modal, #toast, #bgCanvas, .btn, .filter-bar { display: none !important; }
  body { background: white; color: black; }
  .card { box-shadow: none; border: 1px solid #ccc; page-break-inside: avoid; }
  /* Schedule-specific print layout */
}
```

### 7.2 Calendar Month View — Game Listing
**Issue:** Action items note: "the month should show a list sorted by start time" and "the weekly should show them within the time they exist."
**Recommendation:**
- Implement time-based vertical positioning in the week view (each game positioned by start time)
- Add expandable game list in the month view day cells

### 7.3 Case-Insensitive Email
**Issue:** Action items note email should be case-insensitive. The code already does `LOWER(email)` on login and registration, so this is partially addressed.
**Recommendation:**
- Add a `LOWER(email)` unique index to prevent case-duplicate registrations
- Normalize email to lowercase everywhere it's stored

---

## 8. File Structure & Organization

### 8.1 📋 Clean Flat Structure
**Assessment:** The flat `src/routes/*.js` structure is appropriate for this scale. No over-engineering.

### 8.2 ⚠️ No Request Validation Middleware
**Issue:** Routes rely on manual `if (!field) return 400` checks. No schema validation layer.
**Recommendation:**
- Add `zod` or `joi` for request validation:
```js
const gameSchema = z.object({
  team_id: z.number().int().positive(),
  opponent_id: z.number().int().positive(),
  game_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  // etc.
});
```

### 8.3 ⚠️ No API Versioning
**Issue:** All routes live at `/api/...` with no version. Breaking changes would affect all clients.
**Recommendation:**
- For now, this is fine (single browser client), but plan for `/api/v1/...` if a mobile app is added

### 8.4 ⚠️ Missing `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`
**Issue:** No community/developer documentation.
**Recommendation:**
- Add `CONTRIBUTING.md` with setup instructions
- Add a brief `README.md` at project root

---

## 9. Quick Wins (Low Effort, High Impact)

| # | Priority | Change | Effort |
|---|----------|--------|--------|
| 1 | 🔴 High | Add `helmet()` security headers | 5 min |
| 2 | 🔴 High | Escape user content in innerHTML (XSS fix) | 30 min |
| 3 | 🔴 High | Add CSRF protection | 1 hour |
| 4 | 🟡 Med | Extract `getCoachTeamIds` to shared utility | 15 min |
| 5 | 🟡 Med | Add HTTP request logging (`morgan`) | 15 min |
| 6 | 🟡 Med | Normalize `DB_PATH` in `.env` (currently `./data/vsc.db` but schema resolves differently) | 15 min |
| 7 | 🟡 Med | Add print CSS | 20 min |
| 8 | 🟡 Med | Add DB indexes for frequently queried columns | 10 min |
| 9 | 🟢 Low | Add `package.json` test script + vitest scaffold | 15 min |
| 10 | 🟢 Low | Add unique index on `opponents.name` | 5 min |
| 11 | 🟢 Low | Replace `console.error` with structured logging | 30 min |
| 12 | 🟢 Low | Add input length limits (name ≤ 100, phone ≤ 20, notes ≤ 1000) | 20 min |

---

## 10. Prioritized Roadmap

### Phase 1: Security Hardening (Week 1)
1. Add `helmet()` + security headers
2. Fix XSS vulnerabilities (escape user content)
3. Add CSRF protection
4. Fix session secret
5. Add rate limiting to all mutating endpoints

### Phase 2: Code Quality (Week 2)
6. Consolidate `getCoachTeamIds`
7. Standardize error handling
8. Add input validation (zod/joi)
9. Fix DB proxy pattern or document it
10. Deduplicate schema between seed and schema files

### Phase 3: Data & Reliability (Week 3)
11. Add database indexes
12. Add unique constraints on business keys
13. Add audit log table
14. Add soft deletes for critical entities
15. Add import validation + transaction wrapping

### Phase 4: Testing & DevOps (Week 4)
16. Add vitest + critical path tests
17. Add CI/CD pipeline (GitHub Actions)
18. Add structured logging
19. Add health check endpoint (`/health`)
20. Add environment-based config loading

### Phase 5: Feature Completeness (Week 5+)
21. Game status workflow
22. Game results/scoring
23. In-app notifications
24. Calendar improvements (time-based week view)
25. Print styling for schedule
26. Mobile responsive polish

---

## Final Assessment

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | 7/10 | Clean structure, some duplication, proxy pattern is unusual |
| **Security** | 4/10 | Critical XSS and CSRF gaps; needs hardening before production |
| **Data Integrity** | 6/10 | Good schema, missing indexes, unique constraints, and migrations |
| **Frontend** | 5/10 | Functional but XSS-vulnerable; no accessibility; needs mobile polish |
| **Testing** | 2/10 | Zero tests — highest priority improvement |
| **Business Logic** | 7/10 | Conflict detection is solid; missing game workflow features |
| **DevOps** | 3/10 | No CI, no logging, no deployment docs |

**Overall: 5/10** — A solid foundation that's functional but needs security hardening and testing before it can be trusted in production. The conflict detection system is the crown jewel; everything else needs polishing.
