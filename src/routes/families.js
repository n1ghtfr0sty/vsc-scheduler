const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  try {
    if (req.session.userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const families = db.prepare(`
      SELECT f.*, u.email, u.name as user_name 
      FROM families f 
      JOIN users u ON f.user_id = u.id
    `).all();
    res.json({ families });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch families' });
  }
});

router.get('/my', requireAuth, (req, res) => {
  try {
    const family = db.prepare(`
      SELECT f.* FROM families f WHERE f.user_id = ?
    `).get(req.session.userId);
    
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const players = db.prepare(`
      SELECT p.*, GROUP_CONCAT(t.id || ':' || t.name) as teams
      FROM players p
      LEFT JOIN player_teams pt ON p.id = pt.player_id
      LEFT JOIN teams t ON pt.team_id = t.id
      WHERE p.family_id = ?
      GROUP BY p.id
    `).all(family.id);

    res.json({ family, players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch family' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(id);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    if (req.session.userRole !== 'admin' && family.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('UPDATE families SET name = ? WHERE id = ?').run(name || family.name, id);
    res.json({ message: 'Family updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update family' });
  }
});

module.exports = router;
