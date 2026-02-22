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

  // Normalize existing emails to lowercase
  db.exec(`UPDATE users SET email = LOWER(email)`);

  const passwordHash = bcrypt.hashSync('password123', 10);

  // Admin user
  const admin = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'admin@vsc.com', passwordHash, 'admin', 'Admin User', '555-0100'
  );

  // Coaches
  const coach1 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'coach1@vsc.com', passwordHash, 'coach', 'Coach Mike Johnson', '555-0101'
  );
  const coach2 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'coach2@vsc.com', passwordHash, 'coach', 'Coach Sarah Williams', '555-0102'
  );
  const coach3 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'coach3@vsc.com', passwordHash, 'coach', 'Coach Tom Wilson', '555-0103'
  );
  const coach4 = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
    'coach4@vsc.com', passwordHash, 'coach', 'Coach Lisa Brown', '555-0104'
  );

  // Helper to create family with user
  function createFamily(email, familyName, phone) {
    const user = db.prepare(`INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)`).run(
      email, passwordHash, 'family', familyName, phone
    );
    const family = db.prepare(`INSERT INTO families (user_id, name) VALUES (?, ?)`).run(user.lastInsertRowid, familyName);
    return { userId: user.lastInsertRowid, familyId: family.lastInsertRowid };
  }

  // Helper to create player
  function createPlayer(familyId, playerName, birthDate) {
    const player = db.prepare(`INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)`).run(familyId, playerName, birthDate);
    return player.lastInsertRowid;
  }

  // Helper to assign player to team
  function assignPlayerToTeam(playerId, teamId) {
    db.prepare(`INSERT INTO player_teams (player_id, team_id) VALUES (?, ?)`).run(playerId, teamId);
  }

  // Teams
  const teamU6Boys = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U6-U8 Boys', 'U6-U8');
  const teamU6Girls = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U6-U8 Girls', 'U6-U8');
  const teamU9Boys = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U9-U10 Boys', 'U9-U10');
  const teamU9Girls = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U9-U10 Girls', 'U9-U10');
  const teamU11Boys = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U11-U12 Boys', 'U11-U12');
  const teamU11Girls = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U11-U12 Girls', 'U11-U12');
  const teamU13Boys = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U13-U16 Boys', 'U13-U16');
  const teamU13Girls = db.prepare(`INSERT INTO teams (name, age_group) VALUES (?, ?)`).run('U13-U16 Girls', 'U13-U16');

  // U6-U8 Boys (8 players) - 2 families with 4 players each
  const u6B1 = createFamily('family.anderson@vsc.com', 'Anderson Family', '555-0201');
  const u6B2 = createFamily('family.baker@vsc.com', 'Baker Family', '555-0202');
  
  assignPlayerToTeam(createPlayer(u6B1.familyId, 'James Anderson', '2019-03-15'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B1.familyId, 'Oliver Anderson', '2020-06-20'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B1.familyId, 'Ethan Anderson', '2021-01-10'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B1.familyId, 'Lucas Anderson', '2021-08-25'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B2.familyId, 'Mason Baker', '2019-05-12'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B2.familyId, 'Liam Baker', '2020-02-18'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B2.familyId, 'Noah Baker', '2021-07-22'), teamU6Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6B2.familyId, 'Elijah Baker', '2021-11-30'), teamU6Boys.lastInsertRowid);

  // U6-U8 Girls (8 players) - 2 families with 4 players each
  const u6G1 = createFamily('family.clark@vsc.com', 'Clark Family', '555-0203');
  const u6G2 = createFamily('family.davis@vsc.com', 'Davis Family', '555-0204');
  
  assignPlayerToTeam(createPlayer(u6G1.familyId, 'Emma Clark', '2019-04-08'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G1.familyId, 'Ava Clark', '2020-09-15'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G1.familyId, 'Sophia Clark', '2021-02-28'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G1.familyId, 'Isabella Clark', '2021-10-12'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G2.familyId, 'Mia Davis', '2019-07-20'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G2.familyId, 'Charlotte Davis', '2020-03-05'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G2.familyId, 'Amelia Davis', '2021-06-17'), teamU6Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u6G2.familyId, 'Harper Davis', '2021-12-03'), teamU6Girls.lastInsertRowid);

  // U9-U10 Boys (12 players) - 3 families with 4 players each
  const u9B1 = createFamily('family.evans@vsc.com', 'Evans Family', '555-0205');
  const u9B2 = createFamily('family.frank@vsc.com', 'Frank Family', '555-0206');
  const u9B3 = createFamily('family.green@vsc.com', 'Green Family', '555-0207');
  
  assignPlayerToTeam(createPlayer(u9B1.familyId, 'William Evans', '2016-01-15'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B1.familyId, 'Benjamin Evans', '2016-08-22'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B1.familyId, 'Henry Evans', '2017-04-10'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B1.familyId, 'Alexander Evans', '2017-11-28'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B2.familyId, 'Sebastian Frank', '2016-02-18'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B2.familyId, 'Jack Frank', '2016-09-25'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B2.familyId, 'Daniel Frank', '2017-05-14'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B2.familyId, 'Matthew Frank', '2017-12-01'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B3.familyId, 'Michael Green', '2016-03-22'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B3.familyId, 'Owen Green', '2016-10-08'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B3.familyId, 'Ethan Green', '2017-06-15'), teamU9Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9B3.familyId, 'Aiden Green', '2018-01-20'), teamU9Boys.lastInsertRowid);

  // U9-U10 Girls (12 players) - 3 families with 4 players each
  const u9G1 = createFamily('family.harris@vsc.com', 'Harris Family', '555-0208');
  const u9G2 = createFamily('family.jackson@vsc.com', 'Jackson Family', '555-0209');
  const u9G3 = createFamily('family.king@vsc.com', 'King Family', '555-0210');
  
  assignPlayerToTeam(createPlayer(u9G1.familyId, 'Abigail Harris', '2016-02-10'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G1.familyId, 'Emily Harris', '2016-07-18'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G1.familyId, 'Elizabeth Harris', '2017-03-25'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G1.familyId, 'Sofia Harris', '2017-10-05'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G2.familyId, 'Avery Jackson', '2016-04-12'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G2.familyId, 'Ella Jackson', '2016-11-20'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G2.familyId, 'Scarlett Jackson', '2017-07-08'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G2.familyId, 'Grace Jackson', '2018-01-15'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G3.familyId, 'Chloe King', '2016-05-22'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G3.familyId, 'Victoria King', '2016-12-10'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G3.familyId, 'Riley King', '2017-08-18'), teamU9Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u9G3.familyId, 'Aria King', '2018-02-25'), teamU9Girls.lastInsertRowid);

  // U11-U12 Boys (14 players) - 4 families (3 with 4, 1 with 2)
  const u11B1 = createFamily('family.lee@vsc.com', 'Lee Family', '555-0211');
  const u11B2 = createFamily('family.martin@vsc.com', 'Martin Family', '555-0212');
  const u11B3 = createFamily('family.thompson@vsc.com', 'Thompson Family', '555-0213');
  const u11B4 = createFamily('family.white@vsc.com', 'White Family', '555-0214');
  
  assignPlayerToTeam(createPlayer(u11B1.familyId, 'Jacob Lee', '2014-01-08'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B1.familyId, 'Logan Lee', '2014-06-15'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B1.familyId, 'Isaac Lee', '2015-02-22'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B1.familyId, 'Luke Lee', '2015-09-30'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B2.familyId, 'Gabriel Martin', '2014-03-12'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B2.familyId, 'Anthony Martin', '2014-10-25'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B2.familyId, 'Joshua Martin', '2015-05-18'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B2.familyId, 'Andrew Martin', '2015-12-05'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B3.familyId, 'David Thompson', '2014-04-20'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B3.familyId, 'Joseph Thompson', '2014-11-08'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B3.familyId, 'Samuel Thompson', '2015-06-22'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B3.familyId, 'Carter Thompson', '2016-01-10'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B4.familyId, 'John White', '2014-07-28'), teamU11Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11B4.familyId, 'Julian White', '2015-03-15'), teamU11Boys.lastInsertRowid);

  // U11-U12 Girls (14 players) - 4 families (3 with 4, 1 with 2)
  const u11G1 = createFamily('family.hall@vsc.com', 'Hall Family', '555-0215');
  const u11G2 = createFamily('family.allen@vsc.com', 'Allen Family', '555-0216');
  const u11G3 = createFamily('family.young@vsc.com', 'Young Family', '555-0217');
  const u11G4 = createFamily('family.king.vsc@email', 'King Girls Family', '555-0218');
  
  assignPlayerToTeam(createPlayer(u11G1.familyId, 'Natalie Hall', '2014-02-14'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G1.familyId, 'Hannah Hall', '2014-08-22'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G1.familyId, 'Addison Hall', '2015-04-05'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G1.familyId, 'Layla Hall', '2015-10-18'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G2.familyId, 'Brooklyn Allen', '2014-05-20'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G2.familyId, 'Zoe Allen', '2014-12-08'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G2.familyId, 'Penelope Allen', '2015-07-25'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G2.familyId, 'Layton Allen', '2016-02-12'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G3.familyId, 'Nora Young', '2014-06-28'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G3.familyId, 'Hazel Young', '2015-01-15'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G3.familyId, 'Violet Young', '2015-08-30'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G3.familyId, 'Aurora Young', '2016-03-18'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G4.familyId, 'Savannah King', '2014-09-10'), teamU11Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u11G4.familyId, 'Audrey King', '2015-05-02'), teamU11Girls.lastInsertRowid);

  // U13-U16 Boys (18 players) - 5 families (3 with 4, 2 with 3)
  const u13B1 = createFamily('family.robinson@vsc.com', 'Robinson Family', '555-0219');
  const u13B2 = createFamily('family.wright@vsc.com', 'Wright Family', '555-0220');
  const u13B3 = createFamily('family.scott@vsc.com', 'Scott Family', '555-0221');
  const u13B4 = createFamily('family.adams@vsc.com', 'Adams Family', '555-0222');
  const u13B5 = createFamily('family.nelson@vsc.com', 'Nelson Family', '555-0223');
  
  assignPlayerToTeam(createPlayer(u13B1.familyId, 'Tyler Robinson', '2012-01-10'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B1.familyId, 'Brandon Robinson', '2012-07-22'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B1.familyId, 'Austin Robinson', '2013-02-15'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B1.familyId, 'Justin Robinson', '2013-09-28'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B2.familyId, 'Ryan Wright', '2012-03-18'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B2.familyId, 'Kevin Wright', '2012-10-05'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B2.familyId, 'Jordan Wright', '2013-05-12'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B2.familyId, 'Eric Wright', '2013-12-20'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B3.familyId, 'Jason Scott', '2012-04-25'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B3.familyId, 'Adam Scott', '2012-11-10'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B3.familyId, 'Brian Scott', '2013-06-18'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B3.familyId, 'Chris Scott', '2014-01-05'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B4.familyId, 'Nathan Adams', '2012-05-30'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B4.familyId, 'Patrick Adams', '2013-01-22'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B4.familyId, 'Sean Adams', '2013-08-08'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B5.familyId, 'Ben Nelson', '2012-06-15'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B5.familyId, 'Tim Nelson', '2013-02-28'), teamU13Boys.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13B5.familyId, 'Sam Nelson', '2013-10-12'), teamU13Boys.lastInsertRowid);

  // U13-U16 Girls (18 players) - 5 families (3 with 4, 2 with 3)
  const u13G1 = createFamily('family.carter@vsc.com', 'Carter Family', '555-0224');
  const u13G2 = createFamily('family.mitchell@perez.com', 'Mitchell Family', '555-0225');
  const u13G3 = createFamily('family.perez@vsc.com', 'Perez Family', '555-0226');
  const u13G4 = createFamily('family.roberts@vsc.com', 'Roberts Family', '555-0227');
  const u13G5 = createFamily('family.turner@vsc.com', 'Turner Family', '555-0228');
  
  assignPlayerToTeam(createPlayer(u13G1.familyId, 'Lauren Carter', '2012-02-08'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G1.familyId, 'Ashley Carter', '2012-08-15'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G1.familyId, 'Stephanie Carter', '2013-03-22'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G1.familyId, 'Nicole Carter', '2013-10-30'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G2.familyId, 'Megan Mitchell', '2012-04-18'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G2.familyId, 'Kimberly Mitchell', '2012-11-25'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G2.familyId, 'Michelle Mitchell', '2013-07-02'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G2.familyId, 'Jennifer Mitchell', '2014-01-18'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G3.familyId, 'Samantha Perez', '2012-05-28'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G3.familyId, 'Amanda Perez', '2013-01-10'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G3.familyId, 'Melissa Perez', '2013-08-25'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G3.familyId, 'Jessica Perez', '2014-03-12'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G4.familyId, 'Rebecca Roberts', '2012-06-12'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G4.familyId, 'Angela Roberts', '2013-02-05'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G4.familyId, 'Laura Roberts', '2013-09-18'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G5.familyId, 'Rachel Turner', '2012-07-20'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G5.familyId, 'Christina Turner', '2013-03-15'), teamU13Girls.lastInsertRowid);
  assignPlayerToTeam(createPlayer(u13G5.familyId, 'Heather Turner', '2013-11-02'), teamU13Girls.lastInsertRowid);

  // Create coaches records
  const coachRec1 = db.prepare(`INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)`).run(coach1.lastInsertRowid, 'Mike Johnson', '555-0101');
  const coachRec2 = db.prepare(`INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)`).run(coach2.lastInsertRowid, 'Sarah Williams', '555-0102');
  const coachRec3 = db.prepare(`INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)`).run(coach3.lastInsertRowid, 'Tom Wilson', '555-0103');
  const coachRec4 = db.prepare(`INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)`).run(coach4.lastInsertRowid, 'Lisa Brown', '555-0104');

  // Assign coaches to teams
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec1.lastInsertRowid, teamU6Boys.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec2.lastInsertRowid, teamU6Girls.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec1.lastInsertRowid, teamU9Boys.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec2.lastInsertRowid, teamU9Girls.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec3.lastInsertRowid, teamU11Boys.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec4.lastInsertRowid, teamU11Girls.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec3.lastInsertRowid, teamU13Boys.lastInsertRowid);
  db.prepare(`INSERT INTO team_coaches (coach_id, team_id) VALUES (?, ?)`).run(coachRec4.lastInsertRowid, teamU13Girls.lastInsertRowid);

  // Opponents
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

  // Seasons
  const season1 = db.prepare(`INSERT INTO seasons (name, year, type, start_date, end_date) VALUES (?, ?, ?, ?, ?)`).run(
    "Fall '25", '2025', 'fall', '2025-09-01', '2025-11-30'
  );
  const season2 = db.prepare(`INSERT INTO seasons (name, year, type, start_date, end_date) VALUES (?, ?, ?, ?, ?)`).run(
    "Winter '25", '2025', 'winter', '2025-12-01', '2026-02-28'
  );

  // Sample Games
  const game1 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    teamU9Boys.lastInsertRowid, 1, 'Rockets Field', season1.lastInsertRowid, '2025-09-15', '09:00', '10:30', 'Season opener'
  );
  const game2 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    teamU11Boys.lastInsertRowid, 2, 'Home Field', season1.lastInsertRowid, '2025-09-22', '10:00', '11:30', ''
  );
  const game3 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    teamU13Boys.lastInsertRowid, 3, 'Stars Arena', season1.lastInsertRowid, '2025-09-15', '09:00', '10:30', 'Home game'
  );
  const game4 = db.prepare(`INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    teamU6Boys.lastInsertRowid, 4, 'Eagle Stadium', season1.lastInsertRowid, '2025-09-22', '09:00', '10:00', 'U6-U8 friendly'
  );

  console.log('Seed data complete!');
  console.log('Login credentials:');
  console.log('  Admin: admin@vsc.com / password123');
  console.log('  Coach: coach1@vsc.com / password123');
  console.log('  Coach: coach2@vsc.com / password123');
  console.log('  Coach: coach3@vsc.com / password123');
  console.log('  Coach: coach4@vsc.com / password123');
  console.log('  Family: family.anderson@vsc.com / password123');
}

main().catch(console.error);
