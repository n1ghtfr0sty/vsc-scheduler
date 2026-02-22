const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const getCoachTeamIds = (userId, role) => {
  if (role === 'admin') {
    return db.prepare('SELECT id FROM teams').all().map(t => t.id);
  }
  return db.prepare(`
    SELECT DISTINCT t.id FROM teams t
    JOIN team_coaches tc ON t.id = tc.team_id
    JOIN coaches c ON tc.coach_id = c.id
    WHERE c.user_id = ?
  `).all(userId).map(t => t.id);
};

router.get('/', requireAuth, (req, res) => {
  try {
    const teams = db.prepare(`
      SELECT t.*, 
        GROUP_CONCAT(c.id || ':' || c.name) as coaches
      FROM teams t
      LEFT JOIN team_coaches tc ON t.id = tc.team_id
      LEFT JOIN coaches c ON tc.coach_id = c.id
      GROUP BY t.id
      ORDER BY t.name
    `).all();
    res.json({ teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.get('/my', requireAuth, (req, res) => {
  try {
    const teamIds = getCoachTeamIds(req.session.userId, req.session.userRole);
    const teams = db.prepare(`
      SELECT t.*, 
        GROUP_CONCAT(c.id || ':' || c.name) as coaches
      FROM teams t
      LEFT JOIN team_coaches tc ON t.id = tc.team_id
      LEFT JOIN coaches c ON tc.coach_id = c.id
      WHERE t.id IN (${teamIds.length ? teamIds.join(',') : '0'})
      GROUP BY t.id
      ORDER BY t.name
    `).all();
    res.json({ teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.post('/', requireRole('admin'), (req, res) => {
  try {
    const { name, age_group } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = db.prepare(
      'INSERT INTO teams (name, age_group) VALUES (?, ?)'
    ).run(name, age_group || null);

    res.json({ team: { id: result.lastInsertRowid, name, age_group } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, age_group } = req.body;

    const teamIds = getCoachTeamIds(req.session.userId, req.session.userRole);
    if (!teamIds.includes(parseInt(id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
    db.prepare(
      'UPDATE teams SET name = ?, age_group = ? WHERE id = ?'
    ).run(name || team.name, age_group || team.age_group, id);

    res.json({ message: 'Team updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM teams WHERE id = ?').run(id);
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

router.get('/:id/players', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const teamIds = getCoachTeamIds(req.session.userId, req.session.userRole);
    if (!teamIds.includes(parseInt(id))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const players = db.prepare(`
      SELECT p.*, f.name as family_name
      FROM players p
      JOIN families f ON p.family_id = f.id
      JOIN player_teams pt ON p.id = pt.player_id
      WHERE pt.team_id = ?
      ORDER BY p.name
    `).all(id);

    res.json({ players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

module.exports = router;
