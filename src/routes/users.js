const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const RESOURCES = ['games', 'players', 'families', 'coaches', 'teams', 'opponents', 'seasons', 'settings', 'users'];

// Admin only: list all users with their current permissions
router.get('/', requireRole('admin'), (req, res) => {
  try {
    const users = db.prepare(
      'SELECT id, email, name, role, phone, created_at FROM users ORDER BY created_at DESC'
    ).all();

    // Attach a formatted permissions object to each user
    users.forEach(user => {
      const rows = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').all(user.id);
      user.permissions = {};
      rows.forEach(row => {
        user.permissions[row.resource] = {
          view:   !!row.can_view,
          create: !!row.can_create,
          edit:   !!row.can_edit,
          delete: !!row.can_delete
        };
      });
    });

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin only: update a user's role
router.put('/:id/role', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'coach', 'family', 'pending'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    res.json({ message: 'Role updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Admin only: update all permissions for a user in one call.
// Expects body: { permissions: { games: { view, create, edit, delete }, ... } }
router.put('/:id/permissions', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: 'permissions object required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Upsert permissions for every known resource so the full set is always stored
    RESOURCES.forEach(resource => {
      const perms = permissions[resource] || {};
      stmt.run(
        id,
        resource,
        perms.view   ? 1 : 0,
        perms.create ? 1 : 0,
        perms.edit   ? 1 : 0,
        perms.delete ? 1 : 0
      );
    });

    res.json({ message: 'Permissions updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

module.exports = router;
