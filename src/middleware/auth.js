const db = require('../db');

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Check a specific permission (view/create/edit/delete) on a resource.
// Admins bypass all checks. Pending users are blocked from everything.
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins always have full access
    if (req.session.userRole === 'admin') return next();

    // Pending users have no access until an admin grants them a role
    if (req.session.userRole === 'pending') {
      return res.status(403).json({ error: 'Your account is pending approval by an administrator' });
    }

    // Look up the specific permission for this user, resource, and action
    const permission = db.prepare(
      'SELECT * FROM user_permissions WHERE user_id = ? AND resource = ?'
    ).get(req.session.userId, resource);

    const actionColumn = `can_${action}`;
    if (!permission || !permission[actionColumn]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = { requireAuth, requirePermission, requireRole };
