const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', requirePermission('seasons', 'view'), (req, res) => {
  try {
    const seasons = db.prepare('SELECT * FROM seasons ORDER BY start_date DESC').all();
    res.json({ seasons });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

router.post('/', requirePermission('seasons', 'create'), (req, res) => {
  try {
    const { name, year, type, start_date, end_date } = req.body;
    
    if (!name || !year || !type) {
      return res.status(400).json({ error: 'Name, year, and type are required' });
    }

    if (!['fall', 'winter', 'spring', 'summer'].includes(type)) {
      return res.status(400).json({ error: 'Invalid season type' });
    }

    const result = db.prepare(`
      INSERT INTO seasons (name, year, type, start_date, end_date) 
      VALUES (?, ?, ?, ?, ?)
    `).run(name, year, type, start_date || null, end_date || null);

    res.json({ season: { id: result.lastInsertRowid, name, year, type, start_date, end_date } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

router.put('/:id', requirePermission('seasons', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, year, type, start_date, end_date } = req.body;

    const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(id);
    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }

    db.prepare(`
      UPDATE seasons 
      SET name = ?, year = ?, type = ?, start_date = ?, end_date = ?
      WHERE id = ?
    `).run(
      name || season.name,
      year || season.year,
      type || season.type,
      start_date || season.start_date,
      end_date || season.end_date,
      id
    );

    res.json({ message: 'Season updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update season' });
  }
});

router.delete('/:id', requirePermission('seasons', 'delete'), (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM seasons WHERE id = ?').run(id);
    res.json({ message: 'Season deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete season' });
  }
});

module.exports = router;
