require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { getDb } = require('./db');
const { generateCsrfToken, csrfMiddleware } = require('./middleware/csrf');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security Headers (helmet) ---
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https://maps.google.com"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
}));
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));

// --- Session Secret (cryptographically random, stored in .env) ---
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || /^vsc-scheduler|placeholder|change-this|your-secret/i.test(sessionSecret)) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  WARNING: Using default/insecure session secret. Set SESSION_SECRET in .env to a 64+ character random string.');
  }
  sessionSecret = crypto.randomBytes(64).toString('hex');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  name: 'vsc-scheduler.sid'
}));

// Initialize CSRF token on every session creation
app.use((req, res, next) => {
  if (req.session && !req.session._csrf && req.session.userId) {
    generateCsrfToken(req);
  }
  next();
});

// --- Rate Limiting ---
// General rate limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,                   // 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Stricter rate limiter for the import endpoint (bulk data operations)
const importLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                     // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Import requests limited, please try again later' }
});

app.use('/api/', apiLimiter);

// --- CSRF Protection ---
// Validate CSRF token on all state-changing requests (POST/PUT/DELETE/PATCH)
// Exempt login, register, and logout from CSRF (first-time user flow)
app.use('/api/', csrfMiddleware({
  strict: true,
  methodExempts: ['GET', 'HEAD', 'OPTIONS'],
  pathExempts: ['/api/auth/register', '/api/auth/login', '/api/auth/logout'],
}));

app.use(express.static(path.join(__dirname, '../public')));
const usersRoutes = require('./routes/users');
const familiesRoutes = require('./routes/families');
const playersRoutes = require('./routes/players');
const teamsRoutes = require('./routes/teams');
const coachesRoutes = require('./routes/coaches');
const opponentsRoutes = require('./routes/opponents');
const seasonsRoutes = require('./routes/seasons');
const gamesRoutes = require('./routes/games');
const eventsRoutes = require('./routes/events');
const settingsRoutes = require('./routes/settings');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/families', familiesRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/coaches', coachesRoutes);
app.use('/api/opponents', opponentsRoutes);
app.use('/api/seasons', seasonsRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/settings', settingsRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
  await getDb();
  console.log('Database initialized');

  // Bind to all interfaces for external access
  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(Number(PORT), HOST, () => {
    console.log(`VSC Scheduler running on http://${HOST === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : HOST}:${PORT}`);
    console.log(`Access locally: http://localhost:${PORT}`);
    console.log(`Access from network: http://172.21.233.71:${PORT}`);
  });
}

startServer();
