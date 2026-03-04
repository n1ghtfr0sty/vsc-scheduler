# GEMINI.md

This file provides context and instructions for Gemini CLI when working in the Vikings Soccer Club (VSC) Scheduler repository.

## Project Overview

**VSC Scheduler** is a full-stack web application designed for youth soccer clubs to manage game schedules with advanced conflict detection. It ensures that players, families, and coaches are not double-booked, while also accounting for travel time between different locations.

### Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** `better-sqlite3` native synchronous driver connecting directly to `data/vsc.db`.
- **Frontend:** Vanilla JavaScript, HTML5, CSS3. Built as a Single Page Application (SPA) with hash-based routing.
- **Authentication:** Session-based using `express-session` (backed by `connect-sqlite3`) and native `bcrypt`. Rate limited via `express-rate-limit`.
- **Deployment:** PM2 (managed via `ecosystem.config.js`).

## Building and Running

### Development Commands
- `npm run dev`: Starts the Express server on `http://localhost:3000`.
- `npm run seed`: Resets the database and applies schema with sample data.
- `npm run stop`: Forcefully kills all node processes (useful on Windows).
- `node src/schema.js`: Applies the database schema without adding seed data.

### Database Management
- **Persistence:** `better-sqlite3` reads/writes directly to the `data/vsc.db` file. We use WAL mode for performance. All database operations are synchronous.
- **Reset:** `rm data/vsc.db && npm run seed` (manual deletion followed by seeding).

## Architecture & Patterns

### Backend (`/src`)
- **Database Access (`src/db.js`):** Use the exported proxy which wraps the native `better-sqlite3` connection (`prepare(sql).all()`, `get()`, `run()`).
  - *Note:* Always `await getDb()` (or ensure it's initialized) before any operations. `src/index.js` handles this at startup.
- **Routing:** API routes are modularized in `src/routes/` and mounted under `/api/`.
- **Middleware:** `src/middleware/auth.js` provides `requireAuth`, `requirePermission(resource, action)`, and `requireRole(role)`.

### Frontend (`/public`)
- **Entry Point:** `index.html` loads all scripts and serves as the SPA container.
- **Routing:** Hash-based routing managed by `window.Router` in `js/router.js`. Includes entity detail routes (`#/teams/:id`, `#/players/:id`, `#/families/:id`, `#/coaches/:id`, `#/opponents/:id`).
- **API Communication:** `window.API` in `js/api.js` provides a fetch wrapper.
- **State Management:** `window.Auth` in `js/auth.js` manages user sessions and permissions.
- **View Logic:** `window.App` in `js/app.js` contains most of the rendering and event handling logic.

## Key Domain Logic

### Conflict Detection
Located in `src/routes/games.js` (`checkConflicts` function):
- **Overlapping Times:** Checks if a new game overlaps with existing ones for the same team.
- **Entity Conflicts:** Detects if any player in the team, their family members, or assigned coaches are already involved in another game at the same time.
- **Travel Time:** Configurable via `settings`. Default is 0 mins for the same location and 90 mins for different locations.

### Roles & Permissions
- **Roles:** `admin`, `coach`, `family`, `pending`.
- **Permission Matrix:** Managed via the `user_permissions` table, defining `can_view`, `can_create`, `can_edit`, and `can_delete` for resources like `games`, `players`, `teams`, etc.

## Development Conventions

- **Code Style:** Use CommonJS (`require`) on the backend. Use global objects on `window` for the frontend (no modules/build step).
- **Naming:** 
  - Database: `snake_case` (tables and columns).
  - JavaScript: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants.
- **Documentation:** Complex logic should be commented. Update `History/` and `opencode/` logs after significant changes.
- **Testing:** Currently relies on manual testing or `curl` commands.
