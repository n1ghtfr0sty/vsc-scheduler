require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'vsc-scheduler-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const familiesRoutes = require('./routes/families');
const playersRoutes = require('./routes/players');
const teamsRoutes = require('./routes/teams');
const coachesRoutes = require('./routes/coaches');
const opponentsRoutes = require('./routes/opponents');
const seasonsRoutes = require('./routes/seasons');
const gamesRoutes = require('./routes/games');
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
  
  app.listen(PORT, () => {
    console.log(`VSC Scheduler running on port ${PORT}`);
  });
}

startServer();
