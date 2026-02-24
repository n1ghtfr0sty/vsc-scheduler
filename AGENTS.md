# VSC Scheduler - Agent Guidelines

## Project Overview

Vikings Soccer Club (VSC) Scheduler is a full-stack web application for managing youth soccer games. It helps schedule games while detecting conflicts for players, families, and coaches.

### Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite (sql.js - WebAssembly-based)
- **Frontend**: Vanilla HTML/CSS/JavaScript (no framework)
- **Auth**: Session-based with bcryptjs
- **Process Manager**: PM2

### Directory Structure
```
/src                    # Server-side code
  /middleware           # Express middleware (auth)
  /routes               # API route handlers
  db.js                 # SQLite connection
  schema.js             # Database schema
  seed.js               # Sample data seeder
  index.js              # Express app entry point
/public                 # Static files served to browser
  /css                  # Stylesheets
  /js                   # Client-side JavaScript
    api.js              # API client
    auth.js             # Authentication helpers
    router.js           # Client-side router
    app.js              # Main app + page components
index.html              # SPA entry point
```

---

## Visual Appearance

### Color Palette
The app uses a modern dark theme with Vikings Soccer Club colors:

| Role | Color | Hex |
|------|-------|-----|
| Primary | Forest Green | #228B22 |
| Primary Dark | Dark Forest | #1a6b1a |
| Secondary/Accent | Gold | #FFD700 |
| Gold Light | Light Gold | #FFE44D |
| Gold Dark | Dark Gold | #DAA520 |
| Background | Dark Black | #121212 |
| Background Alt | Dark Grey | #1a1a1a |
| Card | Card Grey | #242424 |
| Border | Border Grey | #333333 |
| Text | Light Grey | #e0e0e0 |
| Text Muted | Muted Grey | #a0a0a0 |
| Danger | Red | #dc3545 |
| Warning | Amber | #DAA520 |

### CSS Guidelines

#### Custom Properties
All colors and spacing should use CSS custom properties:

```css
:root {
  --primary: #228B22;
  --primary-light: #2E8B2E;
  --primary-dark: #1a6b1a;
  --gold: #FFD700;
  --gold-light: #FFE44D;
  --gold-dark: #DAA520;
  --dark-bg: #1a1a1a;
  --dark-card: #242424;
  --dark-border: #333333;
  --text: #e0e0e0;
  --text-muted: #a0a0a0;
}
```

#### Styling Conventions
- Use gradients for primary elements (buttons, headers)
- Gold for headings and accents
- Dark cards with subtle borders
- Rounded corners (8-12px)
- Smooth transitions (0.2s) on interactive elements
- Hover effects with slight translate and shadow
- Focus states with colored outline/glow
- Dark scrollbar styling

#### Responsive Design
- Mobile-first approach
- Breakpoints at 768px
- Flexbox and grid for layouts
- Stack elements vertically on mobile

---

## Commands

### Installation
```bash
npm install
```

### Running Locally (Development)
```bash
npm run dev
# Server starts on http://localhost:3000
```

### Database Setup
```bash
# Create/update schema
node src/schema.js

# Seed sample data (also runs schema)
npm run seed
```

### Production Deployment
```bash
# Install dependencies
npm install

# Run schema and seed
npm run seed

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs vsc-scheduler
pm2 logs vsc-scheduler --err --lines 50
```

---

## Code Style Guidelines

### General Principles
- Keep files small and focused (single responsibility)
- Use meaningful variable and function names
- Comment complex logic so the intent is clear to someone learning the codebase

### JavaScript Style

#### Variables and Functions
```javascript
// Use const by default, let only when reassignment needed
const MAX_RETRIES = 3;
let currentRetry = 0;

// Functions: descriptive names, camelCase
function calculateEndTime(startTime, duration) { }

// Async functions for all database/API operations
async function getUserById(id) { }
```

#### Database Operations (sql.js)
```javascript
// Always use prepared statements with placeholders
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// For multiple rows
const users = db.prepare('SELECT * FROM users').all();

// For inserts/updates, use .run()
const result = db.prepare('INSERT INTO users (name) VALUES (?)').run(name);
```

#### Error Handling
```javascript
// Route error handlers
router.get('/', (req, res) => {
  try {
    // Your logic here
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Human-readable error message' });
  }
});
```

#### Imports/Exports
```javascript
// Server-side (CommonJS)
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

module.exports = router;

// Frontend (ES Modules via browser)
const API = { ... };
window.API = API;
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | auth-middleware.js |
| Database tables | snake_case | user_profiles |
| Database columns | snake_case | created_at |
| Variables | camelCase | gameDate |
| Constants | UPPER_SNAKE_CASE | MAX_GAMES |
| Classes | PascalCase | GameScheduler |
| Routes | kebab-case (URL) | /api/games/conflicts |

### API Response Format

```javascript
// Success responses
res.json({ data: [...] });
res.json({ message: 'Created successfully' });

// Error responses
res.status(400).json({ error: 'Validation message' });
res.status(401).json({ error: 'Authentication required' });
res.status(403).json({ error: 'Not authorized' });
res.status(404).json({ error: 'Resource not found' });
res.status(500).json({ error: 'Internal server error' });
```

### Frontend JavaScript Patterns

```javascript
// API calls via fetch wrapper
const data = await API.request('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(payload)
});

// DOM manipulation
document.getElementById('elementId');
document.querySelector('.class');

// Event handling
element.addEventListener('submit', async (e) => {
  e.preventDefault();
  // Handle form submission
});

// Client-side routing
Router.navigate('/path');
window.location.hash = '#/path';
```

### CSS Guidelines

```css
/* Use CSS custom properties for theming */
:root {
  --primary: #228B22;
  --gold: #FFD700;
}

/* BEM-like naming for complex components */
.nav-links__item--active { }

/* Mobile-first responsive */
@media (min-width: 768px) { }
```

---

## Database Conventions

### Schema Changes
1. Edit `src/schema.js` directly
2. Drop existing database: `rm data/vsc.db`
3. Re-run: `npm run seed`

### Migrations (if needed later)
- Store in `/src/migrations/`
- Numbered files: `001_initial_schema.js`

---

## Testing

### Manual Testing
```bash
# Start server
npm run dev

# Test API endpoints with curl
curl http://localhost:3000/api/auth/me \
  -H "Content-Type: application/json" \
  -c cookies.txt

# Check conflicts endpoint
curl "http://localhost:3000/api/games/conflicts?team_id=1&game_date=2025-09-15&start_time=09:00&end_time=10:30&location=Home"
```

### Adding Tests (Jest)
```bash
npm install --save-dev jest
```

Add to package.json:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

Run single test:
```bash
npm test -- games.test.js
npm test -- --testNamePattern="conflict detection"
```

---

## Common Tasks

### Adding a New API Endpoint
1. Create or edit route file in `/src/routes/`
2. Define route handlers
3. Test with curl or browser
4. Add frontend UI in `/public/js/app.js` if needed

### Adding a Database Field
1. Edit `src/schema.js`
2. Delete `data/vsc.db`
3. Run `npm run seed`

### Deploying Updates
```bash
# On server
cd /var/www/vsc-scheduler
git pull  # or upload new files

# Restart app
pm2 restart vsc-scheduler

# Check status
pm2 status
pm2 logs vsc-scheduler --lines 20
```

---

## Notes

- No TypeScript in this project
- No build step required (vanilla JS served as-is)
- Session auth uses express-session with cookie
- All times stored in local time (not UTC)
- Default game duration: 90 minutes
- Travel time between different locations: 90 minutes (configurable)
- Travel time between same locations: 0 minutes (configurable)

---

## GitHub Issue Management

### Important Rules
1. **Always verify the issue number** on GitHub before closing
2. **List current issues first** using `gh issue list --repo n1ghtfr0sty/vsc-scheduler`
3. **Ask user for confirmation** before closing any issue
4. **Do not assume** - verify the issue description matches the fix

### Closing Issues
```bash
# List issues first
gh issue list --repo n1ghtfr0sty/vsc-scheduler

# After user confirms, close the issue
gh issue close <issue-number> --repo n1ghtfr0sty/vsc-scheduler
```


---

## Development Logging

### OpenCode Log (`opencode/YYYY-MM-DD.md`)
Update this file as changes are made during development. Include:
- GitHub commit references (full hash)
- Specific files changed/added/removed
- Detailed description of each change
- Run after each session or significant change

### History Log (`History/YYYY-MM-DD Title.md`)
Create for each development session. Include:
- Date and duration
- Summary of what was accomplished
- What went well / what went wrong
- Full list of files changed
- GitHub commit history for the session
- Open issues status
- Suggestions for next steps

### Commits
Always include meaningful commit messages. Reference issues where applicable:
```bash
git commit -m "Fix: Make email login case-insensitive"
git commit -m "Add custom calendar component to dashboard"
```
