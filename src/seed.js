const { getDb } = require('./db');
const bcrypt = require('bcryptjs');

async function main() {
  const db = await getDb();

  console.log('Creating schema...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'coach', 'family')),
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      birth_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age_group TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_teams (
      player_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      PRIMARY KEY (player_id, team_id),
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS coaches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_coaches (
      coach_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      PRIMARY KEY (coach_id, team_id),
      FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS opponents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('fall', 'winter', 'spring', 'summer')),
      start_date TEXT,
      end_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      opponent_id INTEGER NOT NULL,
      location TEXT,
      season_id INTEGER,
      game_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (opponent_id) REFERENCES opponents(id) ON DELETE CASCADE,
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO settings (key, value) VALUES ('travel_time_same_location', '0');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('travel_time_different_location', '90');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('default_game_duration', '90');
  `);

  console.log('Seeding data...');

  const passwordHash = bcrypt.hashSync('password123', 10);

  const admin = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'admin@vsc.com', passwordHash, 'admin', 'Admin User', '555-0100'
  );

  const coach1 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'coach1@vsc.com', passwordHash, 'coach', 'Coach Mike Johnson', '555-0101'
  );

  const coach2 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'coach2@vsc.com', passwordHash, 'coach', 'Coach Sarah Williams', '555-0102'
  );

  const family1 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'family1@vsc.com', passwordHash, 'family', 'Johnson Family', '555-0103'
  );

  const family2 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'family2@vsc.com', passwordHash, 'family', 'Smith Family', '555-0104'
  );

  const family3 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'family3@vsc.com', passwordHash, 'family', 'Davis Family', '555-0105'
  );

  const fam1 = db.prepare(`INSERT INTO families (user_id, name) VALUES (?, ?)`).run(family1.lastInsertRowid, 'Johnson Family');
  const fam2 = db.prepare(`INSERT INTO families (user_id, name) VALUES (?, ?)`).run(family2.lastInsertRowid, 'Smith Family');
  const fam3 = db.prepare(`INSERT INTO families (user_id, name) VALUES (?, ?)`).run(family3.lastInsertRowid, 'Davis Family');

  const player1 = db.prepare(`INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)`).run(fam1.lastInsertRowid, 'Tommy Johnson', '2015-03-15');
  const player2 = db.prepare(`INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)`).run(fam1.lastInsertRowid, 'Billy Johnson', '2017-06-20');
  const player3 = db.prepare(`INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)`).run(fam2.lastInsertRowid, 'Emma Smith', '2014-09-10');
  const player4 = db.prepare(`INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)`).run(fam2.lastInsertRowid, 'Jack Smith', '2016-01-25');
  const player5 = db.prepare(`INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)`).run(fam3.lastInsertRowid, 'Lily Davis', '2015-08-30');

  const team1 = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U10 Boys', 'Under 10');
  const team2 = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U12 Girls', 'Under 12');
  const team3 = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U14 Boys', 'Under 14');
  const team4 = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U16 Girls', 'Under 16');

  db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(player1.lastInsertRowid, team1.lastInsertRowid);
  db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(player2.lastInsertRowid, team1.lastInsertRowid);
  db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(player3.lastInsertRowid, team2.lastInsertRowid);
  db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(player4.lastInsertRowid, team2.lastInsertRowid);
  db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(player5.lastInsertRowid, team3.lastInsertRowid);
  db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(player5.lastInsertRowid, team4.lastInsertRowid);

  const coachRec1 = db.prepare(`INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)`).run(coach1.lastInsertRowid, 'Mike Johnson', '555-0101');
  const coachRec2 = db.prepare(`INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)`).run(coach2.lastInsertRowid, 'Sarah Williams', '555-0102');

  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec1.lastInsertRowid, team1.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec2.lastInsertRowid, team2.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec2.lastInsertRowid, team4.lastInsertRowid);

  const opponents = [
    ['Rockets FC', 'John Smith', '555-1001', 'john@rockets.com', 'Rockets Field'],
    ['United FC', 'Mary Brown', '555-1002', 'mary@united.com', 'United Park'],
    ['Stars SC', 'Bob Wilson', '555-1003', 'bob@stars.com', 'Stars Arena'],
    ['Eagle United', 'Lisa Davis', '555-1004', 'lisa@eagles.com', 'Eagle Stadium'],
    ['Phoenix SC', 'Tom Miller', '555-1005', 'tom@phoenix.com', 'Phoenix Grounds'],
    ['Warriors FC', 'Amy Garcia', '555-1006', 'amy@warriors.com', 'Warrior Field'],
    ['Lightning SC', 'Chris Lee', '555-1007', 'chris@lightning.com', 'Lightning Park'],
    ['Thunder FC', 'Rachel White', '555-1008', 'rachel@thunder.com', 'Thunder Arena']
  ];

  const oppStmt = db.prepare(`INSERT INTO opponents (name, contact_name, phone, email, location) VALUES (?, ?, ?, ?, ?)`);
  opponents.forEach(o => oppStmt.run(o[0], o[1], o[2], o[3], o[4]));

  const season1 = db.prepare(`INSERT INTO seasons (name, year, type, start_date, end_date) VALUES (?, ?, ?, ?, ?)`).run(
    "Fall '25", '2025', 'fall', '2025-09-01', '2025-11-30'
  );
  const season2 = db.prepare(`INSERT INTO seasons (name, year, type, start_date, end_date) VALUES (?, ?, ?, ?, ?)`).run(
    "Winter '25", '2025', 'winter', '2025-12-01', '2026-02-28'
  );

  const game1 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team1.lastInsertRowid, 1, 'Rockets Field', season1.lastInsertRowid, '2025-09-15', '09:00', '10:30', 'Season opener'
  );
  const game2 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team1.lastInsertRowid, 2, 'Home Field', season1.lastInsertRowid, '2025-09-22', '10:00', '11:30', ''
  );
  const game3 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team2.lastInsertRowid, 3, 'Stars Arena', season1.lastInsertRowid, '2025-09-15', '09:00', '10:30', 'Home game'
  );
  const game4 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team2.lastInsertRowid, 4, 'Eagle Stadium', season1.lastInsertRowid, '2025-09-22', '14:00', '15:30', ''
  );
  const game5 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team3.lastInsertRowid, 5, 'Phoenix Grounds', season1.lastInsertRowid, '2025-09-20', '11:00', '12:30', 'Saturday match'
  );
  const game6 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team3.lastInsertRowid, 6, 'Home Field', season1.lastInsertRowid, '2025-09-27', '11:00', '12:30', ''
  );
  const game7 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team4.lastInsertRowid, 7, 'Lightning Park', season2.lastInsertRowid, '2025-12-07', '10:00', '11:30', 'Winter season opener'
  );
  const game8 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team4.lastInsertRowid, 8, 'Thunder Arena', season2.lastInsertRowid, '2025-12-14', '13:00', '14:30', ''
  );
  const game9 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team1.lastInsertRowid, 7, 'Home Field', season2.lastInsertRowid, '2025-12-07', '09:00', '10:30', 'INTENTIONAL CONFLICT TEST'
  );
  const game10 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    team4.lastInsertRowid, 1, 'Rockets Field', season1.lastInsertRowid, '2025-09-22', '10:00', '11:30', 'INTENTIONAL CONFLICT - SAME TIME, SAME LOCATION'
  );

  console.log('Seed data complete!');
  console.log('Login credentials:');
  console.log('  Admin: admin@vsc.com / password123');
  console.log('  Coach: coach1@vsc.com / password123');
  console.log('  Coach: coach2@vsc.com / password123');
  console.log('  Family: family1@vsc.com / password123');
}

main().catch(console.error);
