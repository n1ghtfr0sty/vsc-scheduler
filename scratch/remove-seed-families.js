/**
 * Remove all family.*@vsc.com users (and cascading families, players, player_teams)
 * from the live database.
 *
 * Usage:  node scratch/remove-seed-families.js
 */
const { getDb } = require('../src/db');

async function main() {
  const db = await getDb();

  // Enable foreign keys so CASCADE works
  db.pragma('foreign_keys = ON');

  // Preview what will be deleted
  const users = db.prepare(
    `SELECT id, email, name FROM users WHERE email LIKE 'family.%@vsc.com'`
  ).all();

  if (users.length === 0) {
    console.log('No family.*@vsc.com users found. Nothing to delete.');
    return;
  }

  console.log(`Found ${users.length} family.*@vsc.com users to delete:`);
  users.forEach(u => console.log(`  [${u.id}] ${u.email} — ${u.name}`));

  const userIds = users.map(u => u.id);

  // Count related records before deletion
  const placeholders = userIds.map(() => '?').join(',');

  const familyCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM families WHERE user_id IN (${placeholders})`
  ).get(...userIds).cnt;

  const playerCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM players WHERE family_id IN (SELECT id FROM families WHERE user_id IN (${placeholders}))`
  ).get(...userIds).cnt;

  const ptCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM player_teams WHERE player_id IN (SELECT id FROM players WHERE family_id IN (SELECT id FROM families WHERE user_id IN (${placeholders})))`
  ).get(...userIds).cnt;

  const permCount = db.prepare(
    `SELECT COUNT(*) as cnt FROM user_permissions WHERE user_id IN (${placeholders})`
  ).get(...userIds).cnt;

  console.log(`\nCascade impact:`);
  console.log(`  ${familyCount} families`);
  console.log(`  ${playerCount} players`);
  console.log(`  ${ptCount} player_teams`);
  console.log(`  ${permCount} user_permissions`);

  // Delete — CASCADE handles families, players, player_teams, user_permissions
  const result = db.prepare(
    `DELETE FROM users WHERE email LIKE 'family.%@vsc.com'`
  ).run();

  console.log(`\nDeleted ${result.changes} users (cascaded children removed).`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
