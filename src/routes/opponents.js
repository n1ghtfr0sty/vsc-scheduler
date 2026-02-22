const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  try {
    const opponents = db.prepare('SELECT * FROM opponents ORDER BY name').all();
    res.json({ opponents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch opponents' });
  }
});

router.post('/', requireAuth, (req, res) => {
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

router.put('/:id', requireAuth, (req, res) => {
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

router.delete('/:id', requireRole('admin'), (req, res) => {
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
