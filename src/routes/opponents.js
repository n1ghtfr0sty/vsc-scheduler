const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', requirePermission('opponents', 'view'), (req, res) => {
  try {
    const opponents = db.prepare('SELECT * FROM opponents ORDER BY name').all();
    res.json({ opponents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch opponents' });
  }
});

router.get('/:id', requirePermission('opponents', 'view'), (req, res) => {
  try {
    const { id } = req.params;
    const opponent = db.prepare('SELECT * FROM opponents WHERE id = ?').get(id);
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }

    // Also fetch games scheduled against this opponent
    const games = db.prepare(`
      SELECT g.*, t.name as team_name, s.name as season_name
      FROM games g
      JOIN teams t ON g.team_id = t.id
      LEFT JOIN seasons s ON g.season_id = s.id
      WHERE g.opponent_id = ?
      ORDER BY g.game_date, g.start_time
    `).all(id);

    res.json({ opponent, games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch opponent' });
  }
});

router.post('/', requirePermission('opponents', 'create'), (req, res) => {
  try {
    const { name, contact_name, phone, email, location } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = db.prepare(`
      INSERT INTO opponents (name, contact_name, phone, email, location) 
      VALUES (?, ?, ?, ?, ?)
    `).run(name, contact_name || null, phone || null, email || null, location || null);

    res.json({ opponent: { id: result.lastInsertRowid, name, contact_name, phone, email, location } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create opponent' });
  }
});

router.put('/:id', requirePermission('opponents', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_name, phone, email, location } = req.body;

    const opponent = db.prepare('SELECT * FROM opponents WHERE id = ?').get(id);
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }

    db.prepare(`
      UPDATE opponents 
      SET name = ?, contact_name = ?, phone = ?, email = ?, location = ?
      WHERE id = ?
    `).run(
      name || opponent.name,
      contact_name || opponent.contact_name,
      phone || opponent.phone,
      email || opponent.email,
      location || opponent.location,
      id
    );

    res.json({ message: 'Opponent updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update opponent' });
  }
});

router.delete('/:id', requirePermission('opponents', 'delete'), (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM opponents WHERE id = ?').run(id);
    res.json({ message: 'Opponent deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete opponent' });
  }
});

module.exports = router;
