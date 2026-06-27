const express = require('express');
const db = require('../db');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/', requirePermission('events', 'view'), (req, res) => {
  try {
    const { month } = req.query;
    // month format: YYYY-MM (e.g., 2025-09)

    let query = `
      SELECT * FROM calendar_events
    `;
    const params = [];

    if (month) {
      query += ' WHERE event_date LIKE ?';
      params.push(month + '%');
    }

    query += ' ORDER BY event_date, start_time';

    const events = db.prepare(query).all(...params);
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/:id', requirePermission('events', 'view'), (req, res) => {
  try {
    const { id } = req.params;
    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

router.post('/', requirePermission('events', 'create'), (req, res) => {
  try {
    const { name, event_date, start_time, end_time, event_type, location, description, notes } = req.body;

    if (!name || !event_date || !event_type) {
      return res.status(400).json({ error: 'Missing required fields: name, event_date, event_type' });
    }

    const result = db.prepare(`
      INSERT INTO calendar_events (name, event_date, start_time, end_time, event_type, location, description, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, event_date, start_time || null, end_time || null, event_type, location || null, description || null, notes || null);

    res.json({
      event: { id: result.lastInsertRowid, name, event_date, start_time, end_time, event_type, location, description, notes },
      message: 'Event created'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/:id', requirePermission('events', 'edit'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, event_date, start_time, end_time, event_type, location, description, notes } = req.body;

    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    db.prepare(`
      UPDATE calendar_events
      SET name = COALESCE(?, name),
          event_date = COALESCE(?, event_date),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          event_type = COALESCE(?, event_type),
          location = COALESCE(?, location),
          description = COALESCE(?, description),
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(
      name || event.name,
      event_date || event.event_date,
      start_time || event.start_time,
      end_time || event.end_time,
      event_type || event.event_type,
      location || event.location,
      description || event.description,
      notes || event.notes,
      id
    );

    res.json({ message: 'Event updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', requirePermission('events', 'delete'), (req, res) => {
  try {
    const { id } = req.params;

    const event = db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    db.prepare('DELETE FROM calendar_events WHERE id = ?').run(id);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;
