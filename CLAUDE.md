# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vikings Soccer Club (VSC) Scheduler — a full-stack web app for scheduling youth soccer games with conflict detection for players, families, and coaches.

**Stack:** Node.js + Express, sql.js (WebAssembly SQLite), vanilla JS/HTML/CSS SPA, session-based auth (bcryptjs), PM2 for production.

## Commands

```bash
npm run dev        # Start server on http://localhost:3000
npm run seed       # Run schema + seed sample data (resets DB content)
npm run stop       # Kill node process (Windows)
node src/schema.js # Apply schema only (no seed data)

# PM2 (production)
pm2 start ecosystem.config.js
pm2 restart vsc-scheduler
pm2 logs vsc-scheduler --err --lines 50
```

**No build step** — frontend JS/CSS served as-is.

**Reset database:** `rm data/vsc.db && npm run seed`

**Manual API testing:**
```bash
curl http://localhost:3000/api/auth/me -c cookies.txt
curl "http://localhost:3000/api/games/conflicts?team_id=1&game_date=2025-09-15&start_time=09:00&end_time=10:30&location=Home"
```

## Architecture

### Backend (`/src`)

- `index.js` — Express entry point. Mounts all routes under `/api/*`. Falls back to `public/index.html` for all non-API routes (SPA).
- `db.js` — sql.js wrapper. Uses a **Proxy** to mimic better-sqlite3's synchronous API. Persists DB to `data/vsc.db` after every write via `saveDb()`. Must call `await getDb()` before any DB use (done at startup in `index.js`).
- `schema.js` — Creates all tables with `CREATE TABLE IF NOT EXISTS`. Default settings inserted here.
- `routes/` — One file per resource: auth, families, players, teams, coaches, opponents, seasons, games, settings.
- `middleware/auth.js` — `requireAuth` and `requireRole` middleware for protected routes.

**DB pattern** (all routes use this):
```javascript
const db = require('../db'); // already initialized at startup
const rows = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
const result = db.prepare('INSERT INTO games (...) VALUES (?)').run(value);
// result.lastInsertRowid available after .run()
```

**Key schema relationships:**
- `users` → `families` / `coaches` (1:1 via user_id)
- `players` → `families` (many:1), `player_teams` junction to `teams`
- `coaches` → `team_coaches` junction to `teams`
- `games` → `teams`, `opponents`, `seasons`
- `settings` — key/value store (travel_time_same_location, travel_time_different_location, default_game_duration)

### Frontend (`/public`)

**SPA with hash-based routing.** All page rendering is done client-side by injecting HTML into `<div id="main">`.

- `index.html` — Single entry point. Loads all JS files. Contains `<nav>` and `<div id="main">`.
- `js/router.js` — `window.Router` — hash-based router (`#/path`). Supports dynamic segments (`:id`) and query params.
- `js/api.js` — `window.API` — fetch wrapper for all backend calls. Handles auth errors globally.
- `js/auth.js` — `window.Auth` — login state, `Auth.currentUser`, `Auth.init()`.
- `js/app.js` — `window.App` — all page render functions (renderDashboard, renderGames, renderGameForm, etc.). The largest file (~50KB).
- `js/calendar.js` — Calendar component used in the dashboard.
- `js/background.js` — Animated background effect.

**Frontend globals:** `Router`, `API`, `Auth`, `App` — all set on `window`.

**Navigation pattern:**
```javascript
Router.navigate('/games/new?date=2025-09-15');
// or
window.location.hash = '#/path';
```

**API call pattern:**
```javascript
const data = await API.request('/api/games', { method: 'POST', body: JSON.stringify(payload) });
```

## Key Domain Logic

- **Conflict detection** (`/api/games/conflicts`): checks player/family/coach double-booking across games, accounting for travel time between locations.
- **Travel time** configurable in settings: same location = 0 min, different location = 90 min (default).
- **Default game duration**: 90 minutes.
- All times stored in **local time** (not UTC).
- User roles: `admin`, `coach`, `family`.

## Styling

Dark theme, VSC colors. All colors via CSS custom properties in `style.css`:
- Primary: `--primary: #228B22` (forest green), `--gold: #FFD700`
- Background: `--dark-bg: #1a1a1a`, cards: `--dark-card: #242424`
- Text: `--text: #e0e0e0`, muted: `--text-muted: #a0a0a0`

Use gradients for primary buttons/headers. Hover effects with `translateY` + shadow. Breakpoint at 768px.

## Development Logs

After each session, update two log files:
- `opencode/YYYY-MM-DD.md` — incremental change log (commit refs, files changed, descriptions)
- `History/YYYY-MM-DD Title.md` — session summary (what was done, what broke, files changed, open issues)

## GitHub Issues

Always verify issue numbers before closing: `gh issue list --repo n1ghtfr0sty/vsc-scheduler`. Confirm with user before closing any issue.

## Code Conventions

- Comment complex logic so the intent is clear to someone learning the codebase
- Server-side: CommonJS (`require`/`module.exports`)
- Frontend: globals on `window`, no modules
- DB columns/tables: `snake_case`; JS variables: `camelCase`; JS constants: `UPPER_SNAKE_CASE`
- No TypeScript, no build step, no Jest installed (manual curl testing)
