#!/usr/bin/env node
/**
 * One-off cleanup for rows orphaned by historical app-side deletes made
 * before `PRAGMA foreign_keys = ON` was added to src/db.js. With FK now
 * enabled, future app deletes cascade correctly, but rows left dangling
 * by older deletes are still in the live DB.
 *
 * Usage:
 *   node scripts/cleanup-orphans.js            # dry run (default)
 *   node scripts/cleanup-orphans.js --apply    # actually delete + null
 *
 * Optional env:
 *   DB_PATH=/path/to/vsc.db     # default: ./data/vsc.db (relative to repo root)
 *
 * Optional safety:
 *   cp data/vsc.db data/vsc.db.bak   # before --apply, in case of accidents
 *
 * Strategy:
 *   1. Build the "alive" set per non-root table by walking the cascade DAG
 *      from the roots (users, teams, opponents, seasons, calendar_events).
 *   2. Anything NOT alive is an orphan and will be deleted.
 *   3. games.season_id is nullable with ON DELETE SET NULL, so dangling
 *      season refs are reported and (with --apply) nulled rather than
 *      treated as a delete trigger.
 *   4. The script runs with foreign_keys = OFF so cascading deletes within
 *      the orphan set work safely; the app's pragma setting is not touched.
 */

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const APPLY = process.argv.includes('--apply');
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/vsc.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
// We do our own cascade accounting; turning this off prevents the DB from
// refusing intermediate deletes inside an orphan chain.
db.pragma('foreign_keys = OFF');

const idSet = (rows) => new Set(rows.map((r) => r.id));

const alive = {};
const orphans = {};

// Roots: tables with no inbound FKs (they never get orphaned).
alive.users = idSet(db.prepare('SELECT id FROM users').all());
alive.teams = idSet(db.prepare('SELECT id FROM teams').all());
alive.opponents = idSet(db.prepare('SELECT id FROM opponents').all());
alive.seasons = idSet(db.prepare('SELECT id FROM seasons').all());
alive.calendar_events = idSet(db.prepare('SELECT id FROM calendar_events').all());

// Helper: turn a Set of ids into a SQL IN-list (or "NULL" for empty).
const inList = (set) => (set.size === 0 ? 'NULL' : [...set].map(() => '?').join(','));
const params = (set) => (set.size === 0 ? [] : [...set]);

// Level 1: families, coaches, user_permissions → users
alive.families = idSet(
  db
    .prepare(`SELECT id FROM families WHERE user_id IN (${inList(alive.users)})`)
    .all(...params(alive.users))
);
alive.coaches = idSet(
  db
    .prepare(`SELECT id FROM coaches WHERE user_id IN (${inList(alive.users)})`)
    .all(...params(alive.users))
);
alive.user_permissions = idSet(
  db
    .prepare(
      `SELECT user_id AS id FROM user_permissions WHERE user_id IN (${inList(alive.users)})`
    )
    .all(...params(alive.users))
);

// Level 2: players → families
alive.players = idSet(
  db
    .prepare(`SELECT id FROM players WHERE family_id IN (${inList(alive.families)})`)
    .all(...params(alive.families))
);

// Level 3: player_teams, team_coaches
alive.player_teams = idSet(
  db
    .prepare(
      `SELECT player_id AS id FROM player_teams
       WHERE player_id IN (${inList(alive.players)})
         AND team_id IN (${inList(alive.teams)})`
    )
    .all(...params(alive.players), ...params(alive.teams))
);
alive.team_coaches = idSet(
  db
    .prepare(
      `SELECT coach_id AS id FROM team_coaches
       WHERE coach_id IN (${inList(alive.coaches)})
         AND team_id IN (${inList(alive.teams)})`
    )
    .all(...params(alive.coaches), ...params(alive.teams))
);

// Level 4: games → teams + opponents
alive.games = idSet(
  db
    .prepare(
      `SELECT id FROM games
       WHERE team_id IN (${inList(alive.teams)})
         AND opponent_id IN (${inList(alive.opponents)})`
    )
    .all(...params(alive.teams), ...params(alive.opponents))
);

// Orphans = rows in the table that are not in the alive set.
const orphanIds = (table, aliveSet) => {
  const all = db.prepare(`SELECT id FROM ${table}`).all().map((r) => r.id);
  return all.filter((id) => !aliveSet.has(id));
};

orphans.families = orphanIds('families', alive.families);
orphans.players = orphanIds('players', alive.players);
orphans.coaches = orphanIds('coaches', alive.coaches);
orphans.player_teams = db
  .prepare('SELECT player_id, team_id FROM player_teams')
  .all()
  .filter((r) => !alive.player_teams.has(r.player_id))
  .map((r) => r);
orphans.team_coaches = db
  .prepare('SELECT coach_id, team_id FROM team_coaches')
  .all()
  .filter((r) => !alive.team_coaches.has(r.coach_id))
  .map((r) => r);
orphans.user_permissions = db
  .prepare('SELECT user_id FROM user_permissions')
  .all()
  .filter((r) => !alive.user_permissions.has(r.user_id))
  .map((r) => r.user_id);
orphans.games = orphanIds('games', alive.games);

// Dangling (nullable) season FKs on games — not orphan rows, just stale FKs.
const danglingSeasonGames = db
  .prepare(
    `SELECT id, season_id FROM games
     WHERE season_id IS NOT NULL
       AND season_id NOT IN (${inList(alive.seasons)})`
  )
  .all(...params(alive.seasons));

// Report
console.log(`Database: ${dbPath}`);
console.log(`Mode:     ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (read-only)'}`);
console.log('---');
console.log('Orphan rows by table:');
for (const t of ['families', 'players', 'coaches', 'player_teams', 'team_coaches', 'user_permissions', 'games']) {
  const n = Array.isArray(orphans[t]) ? orphans[t].length : 0;
  console.log(`  ${t.padEnd(20)} ${n}`);
}
console.log(`  ${'games.season_id'.padEnd(20)} ${danglingSeasonGames.length} (dangling FK, will be NULLed)`);

const totalOrphans =
  orphans.families.length +
  orphans.players.length +
  orphans.coaches.length +
  orphans.player_teams.length +
  orphans.team_coaches.length +
  orphans.user_permissions.length +
  orphans.games.length;
const totalDangling = danglingSeasonGames.length;

if (totalOrphans === 0 && totalDangling === 0) {
  console.log('---');
  console.log('Nothing to do.');
  db.close();
  process.exit(0);
}

if (!APPLY) {
  console.log('---');
  console.log('Re-run with --apply to perform the cleanup.');
  db.close();
  process.exit(0);
}

// APPLY: wrap in a transaction.
console.log('---');
const tx = db.transaction(() => {
  if (orphans.families.length) {
    db.prepare(
      `DELETE FROM families WHERE id IN (${orphans.families.map(() => '?').join(',')})`
    ).run(...orphans.families);
  }
  if (orphans.players.length) {
    db.prepare(
      `DELETE FROM players WHERE id IN (${orphans.players.map(() => '?').join(',')})`
    ).run(...orphans.players);
  }
  if (orphans.coaches.length) {
    db.prepare(
      `DELETE FROM coaches WHERE id IN (${orphans.coaches.map(() => '?').join(',')})`
    ).run(...orphans.coaches);
  }
  if (orphans.player_teams.length) {
    for (const { player_id, team_id } of orphans.player_teams) {
      db.prepare('DELETE FROM player_teams WHERE player_id = ? AND team_id = ?').run(
        player_id,
        team_id
      );
    }
  }
  if (orphans.team_coaches.length) {
    for (const { coach_id, team_id } of orphans.team_coaches) {
      db.prepare('DELETE FROM team_coaches WHERE coach_id = ? AND team_id = ?').run(
        coach_id,
        team_id
      );
    }
  }
  if (orphans.user_permissions.length) {
    db.prepare(
      `DELETE FROM user_permissions WHERE user_id IN (${orphans.user_permissions
        .map(() => '?')
        .join(',')})`
    ).run(...orphans.user_permissions);
  }
  if (orphans.games.length) {
    db.prepare(
      `DELETE FROM games WHERE id IN (${orphans.games.map(() => '?').join(',')})`
    ).run(...orphans.games);
  }
  if (danglingSeasonGames.length) {
    db.prepare(
      `UPDATE games SET season_id = NULL
       WHERE id IN (${danglingSeasonGames.map(() => '?').join(',')})`
    ).run(...danglingSeasonGames.map((r) => r.id));
  }
});
tx();

console.log(
  `Deleted: ${orphans.families.length} families, ${orphans.players.length} players, ` +
    `${orphans.coaches.length} coaches, ${orphans.player_teams.length} player_teams, ` +
    `${orphans.team_coaches.length} team_coaches, ${orphans.user_permissions.length} permissions, ` +
    `${orphans.games.length} games. NULLed ${danglingSeasonGames.length} season FKs.`
);
db.close();
