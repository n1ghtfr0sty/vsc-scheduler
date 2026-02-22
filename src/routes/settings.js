const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    res.json({ settings: settingsObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', requireRole('admin'), (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }

    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    if (existing) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(value), key);
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, String(value));
    }

    res.json({ message: 'Setting updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

router.get('/export', requireRole('admin'), (req, res) => {
  try {
    const data = {
      users: db.prepare('SELECT * FROM users').all(),
      families: db.prepare('SELECT * FROM families').all(),
      players: db.prepare('SELECT * FROM players').all(),
      teams: db.prepare('SELECT * FROM teams').all(),
      player_teams: db.prepare('SELECT * FROM player_teams').all(),
      coaches: db.prepare('SELECT * FROM coaches').all(),
      team_coaches: db.prepare('SELECT * FROM team_coaches').all(),
      opponents: db.prepare('SELECT * FROM opponents').all(),
      seasons: db.prepare('SELECT * FROM seasons').all(),
      games: db.prepare('SELECT * FROM games').all(),
      settings: db.prepare('SELECT * FROM settings').all()
    };

    data.users.forEach(u => delete u.password_hash);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

router.post('/import', requireRole('admin'), (req, res) => {
  try {
    const data = req.body;

    if (data.settings) {
      data.settings.forEach(s => {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
      });
    }

    if (data.seasons) {
      data.seasons.forEach(s => {
        db.prepare(`INSERT OR IGNORE INTO seasons (id, name, year, type, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(s.id, s.name, s.year, s.type, s.start_date, s.end_date);
      });
    }

    if (data.opponents) {
      data.opponents.forEach(o => {
        db.prepare(`INSERT OR IGNORE INTO opponents (id, name, contact_name, phone, email, location) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(o.id, o.name, o.contact_name, o.phone, o.email, o.location);
      });
    }

    if (data.teams) {
      data.teams.forEach(t => {
        db.prepare(`INSERT OR IGNORE INTO teams (id, name, age_group) VALUES (?, ?, ?)`)
          .run(t.id, t.name, t.age_group);
      });
    }

    if (data.users) {
      data.users.forEach(u => {
        if (u.password_hash) {
          db.prepare(`INSERT OR IGNORE INTO users (id, email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(u.id, u.email, u.password_hash, u.role, u.name, u.phone);
        }
      });
    }

    if (data.families) {
      data.families.forEach(f => {
        db.prepare(`INSERT OR IGNORE INTO families (id, user_id, name) VALUES (?, ?, ?)`)
          .run(f.id, f.user_id, f.name);
      });
    }

    if (data.players) {
      data.players.forEach(p => {
        db.prepare(`INSERT OR IGNORE INTO players (id, family_id, name, birth_date) VALUES (?, ?, ?, ?)`)
          .run(p.id, p.family_id, p.name, p.birth_date);
      });
    }

    if (data.player_teams) {
      data.player_teams.forEach(pt => {
        db.prepare(`INSERT OR IGNORE INTO player_teams (player_id, team_id) VALUES (?, ?)`)
          .run(pt.player_id, pt.team_id);
      });
    }

    if (data.coaches) {
      data.coaches.forEach(c => {
        db.prepare(`INSERT OR IGNORE INTO coaches (id, user_id, name, phone) VALUES (?, ?, ?, ?)`)
          .run(c.id, c.user_id, c.name, c.phone);
      });
    }

    if (data.team_coaches) {
      data.team_coaches.forEach(tc => {
        db.prepare(`INSERT OR IGNORE INTO team_coaches (coach_id, team_id) VALUES (?, ?)`)
          .run(tc.coach_id, tc.team_id);
      });
    }

    if (data.games) {
      data.games.forEach(g => {
        db.prepare(`INSERT OR IGNORE INTO games (id, team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(g.id, g.team_id, g.opponent_id, g.location, g.season_id, g.game_date, g.start_time, g.end_time, g.notes);
      });
    }

    res.json({ message: 'Data imported successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

module.exports = router;
