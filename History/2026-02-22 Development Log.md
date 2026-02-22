# VSC Scheduler Project - Development Log

**Date**: 2026-02-22  
**Time**: ~6 hours of development

---

## Summary

A full development session focused on setting up the development environment, styling, and improving user experience.

---

## What Was Accomplished

### 1. Environment Setup
- Set up GitHub repository connection
- Configured GitHub CLI and authenticated
- Initialized git repo and pushed initial commit

### 2. Database Migration
- **Problem**: `better-sqlite3` failed to install due to missing Windows SDK for native compilation
- **Solution**: Migrated to `sql.js` (WebAssembly-based SQLite)
- Updated `package.json`, `db.js`, `seed.js`, `schema.js`, and `index.js`

### 3. Visual Styling Enhancements
- Implemented dark theme with Vikings Soccer Club colors (Forest Green + Gold)
- Added animated soccer ball background with canvas
- Implemented gold "candle light" mouse effect
- Styled navigation as buttons with hover effects
- Added responsive design

### 4. Calendar Component
- Created custom calendar.js class
- Implemented month and week views
- Added navigation (prev/next month, prev/next week, today)
- Color-coded game events (green=away, gold=home, red=conflict)
- Integrated into dashboard

### 5. Full Roster Setup
- Created 8 teams with full rosters:
  - U6-U8: 8 players each (boys & girls)
  - U9-U10: 12 players each (boys & girls)
  - U11-U12: 14 players each (boys & girls)
  - U13-U16: 18 players each (boys & girls)
- Added 28 new families with accounts
- Assigned coaches to teams

### 6. Bug Fixes
- Fixed session/authentication issues
- Fixed email login to be case-insensitive
- Fixed calendar week view navigation
- Fixed API error handling

---

## What Went Well

1. **sql.js migration** - Smooth transition from better-sqlite3
2. **Visual effects** - Canvas background and mouse glow effect working nicely
3. **Calendar** - Custom calendar with good functionality
4. **Team roster generation** - Efficiently created all families and players

---

## What Went Wrong

1. **Wrong issue closed** - Closed issue #2 instead of verifying first. Later corrected by reopening #2 and closing #1.
2. **Calendar not showing** - Took time to debug - was missing Calendar class check in conditional
3. **Authentication issues** - Session not persisting due to route ordering - required moving static file serving before session middleware

---

## Files Changed/Added

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modified | Changed to sql.js |
| `src/db.js` | Modified | Rewrote for sql.js async init |
| `src/seed.js` | Modified | Full roster seeding |
| `src/schema.js` | Modified | Async getDb |
| `src/index.js` | Modified | Route setup changes |
| `src/routes/auth.js` | Modified | Case-insensitive email |
| `public/css/style.css` | Modified | Dark theme, buttons, calendar |
| `public/js/background.js` | Added | Animated soccer balls + candle |
| `public/js/calendar.js` | Added | Custom calendar component |
| `public/index.html` | Modified | Added canvas + calendar script |
| `public/js/app.js` | Modified | Dashboard calendar integration |
| `public/js/api.js` | Modified | Better error handling |
| `.gitignore` | Added | Standard node ignores |
| `opencode/2026-02-21.md` | Added | Development log |

---

## GitHub Commits

- `c01f84b` - Initial commit: VSC Scheduler project
- `332b7d7` - Add gold candle light effect on mouse position
- `537c375` - Reduce candle light brightness to 25%
- `b70fbba` - Add custom calendar component to dashboard
- `3dab72b` - Fix calendar onclick handlers
- `699eefa` - Fix API auth error handling
- `3169656` - Fix calendar week view navigation
- `629381e` - Add full rosters to teams: U6-U8 (8), U9-U10 (12), U11-U12 (14), U13-U16 (18)
- `dfdbe77` - Fix: Make email login case-insensitive

---

## Open GitHub Issues

- **#2**: "Schedule page - print schedule not clean" - OPEN
- **#3**: "Game creation time - end time should always be set to default game time duration upon start time modification" - OPEN

---

## Next Steps

1. **Issue #2**: Fix print schedule styling for cleaner output
2. **Issue #3**: Auto-update end time when start time changes in game creation
3. **Additional improvements**:
   - Add more game scheduling functionality
   - Improve opponent management
   - Add team statistics
   - Consider adding practice scheduling
