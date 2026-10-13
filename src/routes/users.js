const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

const RESOURCES = ['games', 'players', 'families', 'coaches', 'teams', 'opponents', 'seasons', 'settings', 'users'];
const ROLES = ['admin', 'coach', 'family', 'pending'];

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

// Admin only: create a user directly (bypasses the register -> pending flow).
// Non-admin users start with no permissions; admins bypass permission checks
// entirely, so no user_permissions rows are created here.
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const emailLower = email.toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(emailLower);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(emailLower, passwordHash, role, name, phone || null);

    res.json({
      user: { id: result.lastInsertRowid, email: emailLower, name, role, phone: phone || null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Admin only: edit a user's profile (name, email, phone) and optionally
// reset their password (blank/absent password keeps the current one).
// Role changes go through PUT /:id/role, not here.
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const emailLower = email.toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?').get(emailLower, id);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered to another user' });
    }

    db.prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?')
      .run(name, emailLower, phone || null, id);

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    }

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Admin only: delete a user. Cascades (foreign_keys = ON in db.js) remove
// their family -> players -> team assignments, coach record -> team
// assignments, and permission rows.
router.delete('/:id', requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (parseInt(id, 10) === req.session.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    if (user.role === 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'").get().cnt;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
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
