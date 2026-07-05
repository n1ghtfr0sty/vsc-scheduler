# VSC Scheduler — Standards & Guidelines

> **Version:** 1.0.0  
> **Last Updated:** 2026-06-09  
> **Owner:** Standards Team  
> **Scope:** Backend routes, frontend JS, middleware, error handling, input validation

---

## 1. XSS Mitigation Standard

### 1.1 Rule: Never Use `innerHTML` with User Data

**Rationale:** The application uses `innerHTML` throughout `public/js/app.js`, `public/js/calendar.js`, and `public/js/auth.js` to render user-provided data directly into the DOM. This creates XSS vulnerabilities — any stored user input (names, notes, locations, etc.) can contain executable JavaScript.

**Prohibited patterns:**
```js
// ❌ NEVER — user data flows directly through innerHTML
main.innerHTML = `<div>${userData.name}</div>`;

// ❌ NEVER — template literal interpolation with API response data
html += `<span>${game.team_name}</span>`;
```

**Required patterns:**
```js
// ✅ Option A: Safe DOM creation with textContent
function createEl(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  children.forEach(c => {
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else if (c instanceof Node) el.appendChild(c);
  });
  return el;
}

// Usage: createEl('div', { className: 'card' }, createEl('h2', {}, 'Title'), 'Plain text content')
```

```js
// ✅ Option B: Escape helper for innerHTML situations (temporary bridge)
const ESCAPE_HTML = (() => {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
  return (str) => typeof str === 'string' ? str.replace(/[&<>"'/]/g, c => map[c]) : '';
})();

// Usage: html += `<span>${ESCAPE_HTML(user.name)}</span>`;
```

### 1.2 Frontend Implementation Plan

| File | Affected Functions | Priority |
|------|-------------------|----------|
| `app.js` | All render functions (renderLogin, renderRegister, renderDashboard, renderSchedule, renderGameList, renderGameForm, renderTeams, renderTeamsDetail, renderPlayers, renderPlayerDetail, renderFamilyDetail, showPlayerForm, renderOpponents, renderOpponentDetail, renderSeasons, showSeasonForm, renderFamilies, renderCoaches, renderCoachDetail, renderSettings, showModal, showGameDetailsModal, renderUsers, renderEvents, showEventForm, showEventDetailsModal) | 🔴 Critical |
| `calendar.js` | `renderMonthView`, `renderWeekView` | 🔴 Critical |
| `auth.js` | Any DOM manipulation | 🟡 Medium |

**Must do:**
1. Create `escapeHTML(str)` helper in `public/js/app.js` (top-level, exported)
2. Create `createElement(tag, attrs, ...children)` helper in `public/js/app.js`
3. Replace ALL `innerHTML` assignments with either `createElement` calls or `escapeHTML()` interpolation
4. Specifically fix `showModal()` — it injects raw form HTML into `document.getElementById('modalBody').innerHTML`
5. Replace inline `onclick` attributes in calendar with `addEventListener` after DOM creation

### 1.3 Backend Input Sanitization

All string inputs received from the frontend must be trimmed and validated before storage:
```js
// Route-level sanitization
const sanitized = Object.fromEntries(
  Object.entries(req.body).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
);
```

### 1.4 CSP Configuration (helmet)

The CSP in `src/index.js` currently allows `'unsafe-inline'` and `'unsafe-eval'` for scripts. Once XSS mitigation is complete:
```js
// After innerHTML is eliminated:
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],        // Remove 'unsafe-inline', 'unsafe-eval'
    styleSrc: ["'self'", "'unsafe-inline'"],  // 'unsafe-inline' OK for framework CSS
    imgSrc: ["'self'", "data:", "https://maps.google.com"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
}));
```

---

## 2. CSRF Standard

### 2.1 Token Generation & Storage

- Tokens generated via `crypto.randomBytes(32).toString('hex')` — stored in `req.session._csrf`
- Token is **session-bound**, not user-bound (one token per session)
- Token is **auto-generated** on first request if not present (see `csrfMiddleware`)

### 2.2 Route Protection

**All non-safe HTTP methods (POST, PUT, DELETE, PATCH) MUST include CSRF validation.**

Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF checks.

**Middleware usage pattern:**
```js
const { csrfMiddleware } = require('./middleware/csrf');

// Apply globally to all routes AFTER session middleware
app.use(csrfMiddleware({
  strict: true,
  methodExempts: ['GET', 'HEAD', 'OPTIONS'],
  pathExempts: ['/api/settings/import']  // Exempt bulk import if it uses file upload
}));
```

### 2.3 Client-Side Token Inclusion

**All fetch calls must include the CSRF token in the `X-CSRF-Token` header:**

```js
// In public/js/api.js — prepend to every request
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
  || localStorage.getItem('csrf-token');

const response = await fetch(endpoint, {
  ...options,
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    ...options.headers
  }
});
```

**Server must expose the token to the frontend:**

```js
// In src/index.js, before static file serving
app.use((req, res, next) => {
  const token = req.session?._csrf || '';
  res.setHeader('X-CSRF-Token', token);
  next();
});
```

**Frontend must extract and store the token on page load:**
```js
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content
  || localStorage.getItem('csrf-token');
```

### 2.4 Response When Validation Fails

```json
{
  "error": "Invalid CSRF token. Please refresh the page and try again.",
  "code": "CSRF_TOKEN_INVALID"
}
```

**Client behavior on 403:** Redirect to login page with a toast notification.

---

## 3. Rate Limiting Standard

### 3.1 Global Default

| Scope | Window | Max Requests | Action on Exceed |
|-------|--------|--------------|------------------|
| All API routes | 15 minutes | 100 | 429 Too Many Requests |
| All routes (static, HTML) | 15 minutes | 300 | 429 Too Many Requests |

### 3.2 Stricter Limits — Specific Endpoints

| Endpoint Group | Window | Max Requests | Rationale |
|----------------|--------|--------------|-----------|
| `/api/auth/login` | 15 minutes | 10 | Brute-force protection |
| `/api/auth/register` | 15 minutes | 5 | Registration spam prevention |
| `/api/settings/import` | 15 minutes | 5 | Bulk import abuse prevention |
| `/api/players`, `/api/teams`, `/api/families` (POST/PUT/DELETE) | 5 minutes | 30 | Frequent mutation endpoints |

### 3.3 Implementation

```js
const rateLimit = require('express-rate-limit');

// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  keyGenerator: (req) => req.ip  // IP-based tracking
});

// Apply globally
app.use('/api', globalLimiter);

// Stricter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 3.4 Rate Limit Headers

All responses MUST include these headers:
```
X-RateLimit-Limit: <max requests>
X-RateLimit-Remaining: <requests remaining>
X-RateLimit-Reset: <unix timestamp when window resets>
```

### 3.5 Exceptions

| Endpoint | Reason |
|----------|--------|
| `/health` | Health checks should never be rate-limited |
| Webhooks (if added in future) | External systems may hit rate limits |
| Internal API calls (server-to-server) | Use separate middleware chain |

---

## 4. Input Validation Standard

### 4.1 Validation Library

Use **zod** for runtime validation. It provides TypeScript-friendly schemas, error messages, and can validate nested objects/arrays.

**Package:** `zod` (add to `package.json`)

### 4.2 Field-Level Rules

#### General String Rules
```js
// All text fields from forms/API requests
const stringRules = {
  name: z.string().min(1).max(100).trim().toLowerCase(),  // names
  email: z.string().min(1).max(255).trim().email().toLowerCase(),  // emails
  phone: z.string().min(0).max(20).trim().regex(/^[\d\s\-\+\(\)]+$/),  // phone (optional)
  notes: z.string().min(0).max(1000).trim(),  // freeform text
  location: z.string().min(0).max(255).trim(),  // location names
  description: z.string().min(0).max(2000).trim(),  // descriptions
  age_group: z.string().min(0).max(50).trim(),  // team age groups
};
```

#### Numeric ID Rules
```js
// All foreign key references
const idSchema = z.object({
  id: z.number().int().positive(),
  team_id: z.number().int().positive(),
  player_id: z.number().int().positive(),
  family_id: z.number().int().positive(),
  coach_id: z.number().int().positive(),
  user_id: z.number().int().positive(),
  season_id: z.number().int().positive().or(z.null()),
  opponent_id: z.number().int().positive(),
});
```

#### Date/Time Rules
```js
const dateSchema = {
  game_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional().or(z.literal('')),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM').optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
};
```

#### Enum/Check Rules
```js
const roleSchema = z.enum(['admin', 'coach', 'family', 'pending']);
const eventTypeSchema = z.enum(['tournament', 'party', 'meeting', 'practice', 'other']);
const seasonTypeSchema = z.enum(['fall', 'winter', 'spring', 'summer']);
```

### 4.3 Route-Level Validation

Every mutating route (POST, PUT, DELETE) MUST validate input before database access:

```js
// ✅ Correct pattern
const gameCreateSchema = z.object({
  team_id: z.number().int().positive(),
  opponent_id: z.number().int().positive(),
  location: z.string().min(0).max(255).trim().optional(),
  season_id: z.number().int().positive().or(z.null()).optional(),
  game_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().min(0).max(1000).trim().optional(),
});

router.post('/', requirePermission('games', 'create'), (req, res) => {
  const result = gameCreateSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
        code: i.code
      }))
    });
  }

  const data = result.data;
  // ... proceed with validated data
});
```

**Validation error response format:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "email", "message": "Invalid email format", "code": "invalid_string" }
  ]
}
```

### 4.4 Validation Coverage Matrix

| Route | Required Fields | Validation Priority |
|-------|----------------|---------------------|
| `POST /api/auth/register` | email, password, name | 🔴 Critical (email format, password strength) |
| `POST /api/auth/login` | email, password | 🔴 Critical |
| `POST /api/players` | family_id, name | 🔴 Critical |
| `POST /api/games` | team_id, opponent_id, game_date, start_time, end_time | 🔴 Critical |
| `PUT /api/games/:id` | All mutable fields | 🟡 Medium |
| `POST /api/teams` | name | 🟡 Medium |
| `POST /api/coaches` | user_id, name | 🟡 Medium |
| `POST /api/seasons` | name, year, type | 🟡 Medium |
| `POST /api/events` | name, event_date, event_type | 🟡 Medium |
| `POST /api/opponents` | name | 🟢 Low |
| `POST /api/settings/import` | data (full structure) | 🔴 Critical (validate structure before insert) |
| `DELETE` routes | Route parameter IDs | 🟢 Low (just verify exists) |

### 4.5 Optional Fields

All fields marked `optional()` in zod schemas:
- Must be sent as `null` if explicitly empty (not missing from the object)
- Default value on the DB side handles truly absent values
- Frontend should send `{ field: null }` for cleared optional fields

---

## 5. Error Handling Standard

### 5.1 Error Response Format

Every error response MUST follow this structure:

```json
{
  "error": "<Human-readable message>",
  "code": "<Machine-readable error code>",
  "details": { /* Optional: additional context for debugging */ }
}
```

**Error codes (use these consistently):**

| Code | HTTP Status | Usage |
|------|-------------|-------|
| `AUTH_REQUIRED` | 401 | User not authenticated |
| `INSUFFICIENT_PERMISSIONS` | 403 | User authenticated but lacks permission |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `DUPLICATE_ENTRY` | 409 | Unique constraint violated |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `CSRF_TOKEN_INVALID` | 403 | Invalid CSRF token |
| `IMPORT_ERROR` | 400 | Data import failed |

### 5.2 Route-Level Error Handling

**Every route must wrap its logic in try/catch and use the error format:**

```js
router.post('/', (req, res) => {
  try {
    // Route logic
    res.json({ data: 'success' });
  } catch (err) {
    // Map error to appropriate code/status
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'A record with this value already exists', code: 'DUPLICATE_ENTRY' });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR', details: err.details });
    }
    // Fallback: generic server error
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
  }
});
```

**Required:**
1. Never send `err.stack` or raw error objects to the client
2. Log `err.stack` to console/server log for debugging
3. Use specific error codes (not generic messages)
4. Include `code` in every error response

### 5.3 Global Error Handler

```js
// src/index.js — Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorResponse = {
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR'
  };

  // Log full error with request context
  console.error(`[${new Date().toISOString()}]`, {
    level: 'error',
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    userId: req.session?.userId || 'anonymous',
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Only send the safe response to client
  res.status(statusCode).json(errorResponse);
});
```

### 5.4 Error Categories & When to Use

| Category | Code | HTTP Status | When to Use |
|----------|------|-------------|-------------|
| Client Errors | `VALIDATION_ERROR` | 400 | Bad input, missing fields, format issues |
| Client Errors | `NOT_FOUND` | 404 | Resource doesn't exist |
| Client Errors | `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role/permission |
| Client Errors | `AUTH_REQUIRED` | 401 | No valid session/token |
| Server Errors | `DATABASE_ERROR` | 500 | SQLite errors, connection issues |
| Server Errors | `INTERNAL_ERROR` | 500 | Uncaught exceptions, unexpected state |
| Rate Limiting | `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from same IP |

### 5.5 Console Error Replacement

Replace all bare `console.error(err)` calls with structured logging:

```js
// ❌ Current pattern
console.error(err);

// ✅ Required pattern
console.error('Error in /api/games/:id', {
  message: err.message,
  code: err.code,
  userId: req.session?.userId,
  timestamp: new Date().toISOString()
});
```

**Standard error logging format:**
```json
{
  "level": "error",
  "service": "vsc-scheduler",
  "module": "<route-file>",
  "message": "<error message>",
  "code": "<error code>",
  "userId": "<session userId or 'anonymous'>",
  "method": "<HTTP method>",
  "path": "<request path>",
  "ip": "<client IP>",
  "timestamp": "<ISO timestamp>"
}
```

---

## Appendices

### A. Quick Reference: Before & After

**Before (XSS vulnerability):**
```js
main.innerHTML = `<div>${user.name}</div>`;
```

**After (safe):**
```js
main.innerHTML = `<div>${ESCAPE_HTML(user.name)}</div>`;
// OR
main.appendChild(createEl('div', {}, user.name));
```

**Before (no validation):**
```js
if (!email) return res.status(400).json({ error: 'Email required' });
db.prepare('INSERT INTO users (...) VALUES (?)').run(email);
```

**After (validated):**
```js
const schema = z.object({ email: z.string().email() });
const result = schema.safeParse(req.body);
if (!result.success) return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: result.error.issues });
db.prepare('INSERT INTO users (...) VALUES (?)').run(result.data.email);
```

### B. Implementation Checklist

- [ ] Create `escapeHTML` and `createElement` helpers in `public/js/app.js`
- [ ] Wire up CSRF middleware globally in `src/index.js`
- [ ] Add `X-CSRF-Token` header to all fetch calls in `public/js/api.js`
- [ ] Add global rate limiter in `src/index.js`
- [ ] Add stricter rate limits for auth/import endpoints
- [ ] Add zod to `package.json` and install
- [ ] Create validation schemas for all routes
- [ ] Wrap all routes with try/catch using error response format
- [ ] Replace all `console.error(err)` with structured logging
- [ ] Update global error handler in `src/index.js`
- [ ] Remove `'unsafe-inline'` from CSP after XSS mitigation is complete

### C. Dependencies to Add

```json
{
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

### D. Dependencies to Verify

| Package | Used In | Notes |
|---------|---------|-------|
| `helmet` | `src/index.js` | Already imported but needs CSP tightening |
| `express-rate-limit` | `src/index.js`, `src/routes/auth.js` | Already installed |
| `express-session` | `src/index.js` | Already installed |
| `better-sqlite3` | `src/db.js` | Already installed |
| `bcrypt` | `src/routes/auth.js` | Already installed |

---

*This document is maintained by the Standards Team. All code changes must comply with these standards. Updates require review from the reviewer and approval from the planning team.*
