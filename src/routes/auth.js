const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Build a formatted permissions object for a given user.
// Returns null for admin (admin bypasses all checks on the frontend via can()).
function getUserPermissions(userId, role) {
  if (role === 'admin') return null;

  const rows = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').all(userId);
  const permissions = {};
  rows.forEach(row => {
    permissions[row.resource] = {
      view:   !!row.can_view,
      create: !!row.can_create,
      edit:   !!row.can_edit,
      delete: !!row.can_delete
    };
  });
  return permissions;
}

router.post('/register', (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const emailLower = email.toLowerCase();

    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(emailLower);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    // All new registrations start as 'pending' — an admin must grant a role and permissions
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(emailLower, passwordHash, 'pending', name, phone || null);

    req.session.userId = result.lastInsertRowid;
    req.session.userRole = 'pending';

    res.json({
      user: {
        id: result.lastInsertRowid,
        email: emailLower,
        name,
        role: 'pending'
      },
      permissions: {}
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailLower = email.toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(emailLower);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      permissions: getUserPermissions(user.id, user.role)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role, phone FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    user,
    permissions: getUserPermissions(user.id, user.role)
  });
});

module.exports = router;
