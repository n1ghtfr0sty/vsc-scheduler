# User Management (Create / Edit / Delete) — Design Spec

**Date:** 2026-07-11
**Status:** Approved
**Closes:** GitHub issue #8 — "User management page admin functions"

## Problem

The admin Users page (`#/users`) can change roles and permissions but cannot
create, edit, or delete users. Registration is the only way in (users land as
`pending`), and there is no way to remove an account or fix a typo'd email.

## Decisions

- Full issue #8 scope: create + edit + delete, all admin-only.
- Delete safeguards: self-delete blocked; last remaining admin cannot be
  deleted.
- Permissions model unchanged: **admins bypass all permission checks**; the
  `user_permissions` table only governs non-admin users. Created non-admin
  users start with no permissions (admin grants them afterward, same as
  approved registrations today).
- Confirmation for delete uses the existing modal, with a role-aware cascade
  warning. Generic wording (no pre-fetched row counts).

## Backend

### src/db.js
Enable `db.pragma('foreign_keys = ON')` on the connection so the cascades
already declared in schema.js actually fire (SQLite defaults to OFF).
`import-roster.js` and maintenance scripts already do this manually; the app
connection was the gap. App-wide effect: inserts that would orphan references
now error — correct behavior.

### src/routes/users.js (all `requireRole('admin')`)

**POST /** — create user.
- Body: `{ name, email, password, role, phone? }`.
- Validate: name/email/password required; role in
  `['admin','coach','family','pending']`; email unique case-insensitively.
- Hash password with bcrypt (same as register). Insert; return the new user
  (id, name, email, role, phone). No permission rows created.

**PUT /:id** — edit user.
- Body: `{ name, email, phone?, password? }`.
- 404 if user missing. Email uniqueness check excludes the user itself.
- `password` optional: blank/absent keeps the current hash; provided → bcrypt
  re-hash (admin password rescue — the app has no self-service reset).
- Role is NOT edited here (existing role dropdown already does that).

**DELETE /:id** — delete user.
- 404 if missing.
- 400 if `id == req.session.userId` ("You cannot delete your own account").
- 400 if target is the only admin ("Cannot delete the last admin account").
- `DELETE FROM users WHERE id = ?`; cascades remove family → players →
  player_teams (family users), coaches → team_coaches (coaches), and
  user_permissions rows.

## Frontend

### public/js/api.js
`API.users.create(data)`, `API.users.update(id, data)`, `API.users.delete(id)`.

### public/js/app.js (renderUsers)
- **Add User** button in the page header → `showModal` form: name, email,
  phone, password, role select. Submit → POST → toast → re-render.
- **Edit** button per user card → pre-filled modal (name, email, phone, empty
  "New password (leave blank to keep)") → PUT → toast → re-render.
- **Delete User** button (danger style) per card, hidden on the logged-in
  admin's own card → confirmation modal: user name/email + role-aware warning
  ("also permanently deletes their family profile, players, and team
  assignments" for family; coach equivalent for coach) + Cancel / Delete →
  DELETE → toast → re-render.
- Errors surface through the existing toast (API error messages).

## Testing (headless Chrome + API probes on a :3999 instance)

- Create: user appears in list; duplicate email rejected; invalid role
  rejected; created coach can log in; created non-admin has no permissions.
- Edit: name/email/phone persist; blank password keeps login working;
  set password changes login; duplicate email rejected.
- Delete: family user's family/players/permission rows actually deleted
  (proves pragma + cascade); self-delete returns 400 and button absent on own
  card; last-admin delete returns 400.
- Non-admin session gets 403 on all three endpoints.
