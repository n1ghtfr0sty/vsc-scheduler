const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', requirePermission('players', 'view'), (req, res) => {
  try {
    const players = db.prepare(`
      SELECT p.*, f.name as family_name, f.id as family_id,
        GROUP_CONCAT(t.id || ':' || t.name) as teams
      FROM players p
      JOIN families f ON p.family_id = f.id
      LEFT JOIN player_teams pt ON p.id = pt.player_id
      LEFT JOIN teams t ON pt.team_id = t.id
      GROUP BY p.id
      ORDER BY p.name
    `).all();
    res.json({ players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.post('/', requirePermission('players', 'create'), (req, res) => {
  try {
    const { name, birth_date, family_id } = req.body;

    if (!name || !family_id) {
      return res.status(400).json({ error: 'Name and family_id are required' });
    }

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(family_id);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    if (req.session.userRole !== 'admin' && family.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const result = db.prepare(
      'INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)'
    ).run(family_id, name, birth_date || null);

    res.json({ player: { id: result.lastInsertRowid, name, birth_date } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

router.put('/:id', requirePermission('players', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, birth_date } = req.body;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(player.family_id);
    if (req.session.userRole !== 'admin' && family.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare(
      'UPDATE players SET name = ?, birth_date = ? WHERE id = ?'
    ).run(name || player.name, birth_date || player.birth_date, id);

    res.json({ message: 'Player updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

router.delete('/:id', requirePermission('players', 'delete'), (req, res) => {
  try {
    const { id } = req.params;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(player.family_id);
    if (req.session.userRole !== 'admin' && family.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('DELETE FROM players WHERE id = ?').run(id);
    res.json({ message: 'Player deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

router.post('/:id/teams', requirePermission('players', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { team_id } = req.body;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(player.family_id);
    if (req.session.userRole !== 'admin' && family.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(team_id);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    db.prepare('INSERT OR IGNORE INTO player_teams (player_id, team_id) VALUES (?, ?)').run(id, team_id);
    res.json({ message: 'Player added to team' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add player to team' });
  }
});

router.delete('/:id/teams/:teamId', requirePermission('players', 'edit'), (req, res) => {
  try {
    const { id, teamId } = req.params;

    const player = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(player.family_id);
    if (req.session.userRole !== 'admin' && family.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('DELETE FROM player_teams WHERE player_id = ? AND team_id = ?').run(id, teamId);
    res.json({ message: 'Player removed from team' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove player from team' });
  }
});

module.exports = router;
