const express = require('express');
const db = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', requirePermission('coaches', 'view'), (req, res) => {
  try {
    const coaches = db.prepare(`
      SELECT c.*, u.email, u.name as user_name,
        GROUP_CONCAT(t.id || ':' || t.name) as teams
      FROM coaches c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN team_coaches tc ON c.id = tc.coach_id
      LEFT JOIN teams t ON tc.team_id = t.id
      GROUP BY c.id
      ORDER BY c.name
    `).all();
    res.json({ coaches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch coaches' });
  }
});

router.post('/', requirePermission('coaches', 'create'), (req, res) => {
  try {
    const { user_id, name, phone } = req.body;
    
    if (!user_id || !name) {
      return res.status(400).json({ error: 'User ID and name are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('coach', user_id);

    const result = db.prepare(
      'INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)'
    ).run(user_id, name, phone || null);

    res.json({ coach: { id: result.lastInsertRowid, user_id, name, phone } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create coach' });
  }
});

router.put('/:id', requirePermission('coaches', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
    if (!coach) {
      return res.status(404).json({ error: 'Coach not found' });
    }

    if (req.session.userRole !== 'admin' && coach.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare(
      'UPDATE coaches SET name = ?, phone = ? WHERE id = ?'
    ).run(name || coach.name, phone || coach.phone, id);

    res.json({ message: 'Coach updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update coach' });
  }
});

router.delete('/:id', requirePermission('coaches', 'delete'), (req, res) => {
  try {
    const { id } = req.params;
    const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
    
    if (coach) {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('family', coach.user_id);
    }
    
    db.prepare('DELETE FROM coaches WHERE id = ?').run(id);
    res.json({ message: 'Coach deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete coach' });
  }
});

router.post('/:id/teams', requirePermission('coaches', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { team_id } = req.body;

    if (req.session.userRole !== 'admin') {
      const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
      if (coach.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    db.prepare('INSERT OR IGNORE INTO team_coaches (coach_id, team_id) VALUES (?, ?)').run(id, team_id);
    res.json({ message: 'Coach assigned to team' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign coach to team' });
  }
});

router.delete('/:id/teams/:teamId', requirePermission('coaches', 'edit'), (req, res) => {
  try {
    const { id, teamId } = req.params;

    if (req.session.userRole !== 'admin') {
      const coach = db.prepare('SELECT * FROM coaches WHERE id = ?').get(id);
      if (coach.user_id !== req.session.userId) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    db.prepare('DELETE FROM team_coaches WHERE coach_id = ? AND team_id = ?').run(id, teamId);
    res.json({ message: 'Coach removed from team' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove coach from team' });
  }
});

module.exports = router;
