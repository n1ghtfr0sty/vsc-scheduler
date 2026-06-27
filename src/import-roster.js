const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else current += ch;
  }
  result.push(current);
  return result;
}

async function main() {
  const db = await getDb();
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  const csvPath = path.resolve(__dirname, '../member-registrations-20260531T234617.csv');
  const registrations = parseCSV(csvPath);
  console.log(`Loaded ${registrations.length} registration records`);

  // ── Collect unique coaches and players ──────────────────────────────────

  const coachRegistrations = registrations.filter(r => r['Registration Type'] === 'coach');
  const playerRegistrations = registrations.filter(r => r['Registration Type'] === 'player');

  // Coach map: email -> { firstName, middleName, lastName, phone, email }
  const coachMap = {};
  for (const reg of coachRegistrations) {
    const email = (reg['Email/UserID'] || reg['Contact Email'] || '').trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!coachMap[key]) {
      coachMap[key] = {
        firstName: reg['First Name'] || '',
        middleName: reg['Middle Name'] || '',
        lastName: reg['Last Name'] || '',
        phone: reg['Phone']?.replace(/\D/g, '') || '',
        email: email,
      };
    }
  }

  // Collect parent emails that match coach emails (coach/parent overlap)
  const coachEmails = new Set(Object.keys(coachMap));
  const overlappingParentEmails = new Set();

  // Player map: keyed by User ID
  const playerMap = {};
  for (const reg of playerRegistrations) {
    const uid = parseInt(reg['User ID']);
    if (!uid || playerMap[uid]) continue;

    const p1Email = reg['Parent One Email/UserID'] || '';
    const p2Email = reg['Parent Two Email'] || '';

    // Check for coach/parent overlap
    if (coachEmails.has(p1Email.toLowerCase())) overlappingParentEmails.add(p1Email.toLowerCase());
    if (coachEmails.has(p2Email.toLowerCase())) overlappingParentEmails.add(p2Email.toLowerCase());

    playerMap[uid] = {
      firstName: reg['First Name'] || '',
      middleName: reg['Middle Name'] || '',
      lastName: reg['Last Name'] || '',
      dob: reg['DOB'] || '',
      parentOne: { firstName: reg['Parent One First Name'] || '', lastName: reg['Parent One Last Name'] || '', email: p1Email, phone: (reg['Parent One Phone Number'] || '').replace(/\D/g, '') },
      parentTwo: { firstName: reg['Parent Two First Name'] || '', lastName: reg['Parent Two Last Name'] || '', email: p2Email, phone: (reg['Parent Two Phone Number'] || '').replace(/\D/g, '') },
    };
  }

  // ── Clear existing data ────────────────────────────────────────────────

  console.log('\nClearing existing data...');
  db.prepare('DELETE FROM player_teams').run();
  db.prepare('DELETE FROM team_coaches').run();
  db.prepare('DELETE FROM coaches').run();
  db.prepare('DELETE FROM players').run();
  db.prepare('DELETE FROM families').run();
  db.prepare('DELETE FROM users').run();
  // Restore admin with proper password
  db.prepare("INSERT OR REPLACE INTO users (id, email, password_hash, role, name, phone) VALUES (1, 'admin@vsc.com', '$2b$10$xSxmbM9NaWGzqnrGM9Cyk.j6KHqwddC34n2svTHTpE1.vE8G/LjPm', 'admin', 'Admin User', '')").run();

  // ── Step 1: Create teams ───────────────────────────────────────────────

  console.log('Setting up teams...');

  const teamDefs = [
    { name: 'Vikings B2013 (U13)', age_group: '2013' },
    { name: 'Vikings B2014 (U12)', age_group: '2014' },
    { name: 'Vikings B2016 (U10)', age_group: '2016' },
    { name: 'Vikings B2017 (U9)', age_group: '2017' },
    { name: 'Vikings B2018 Gold', age_group: '2018' },
    { name: 'Vikings B2018 Green', age_group: '2018' },
  ];

  // Clear any existing teams first (prevents duplicates on re-run)
  db.prepare('DELETE FROM teams').run();

  const teamMap = {};
  for (const t of teamDefs) {
    const result = db.prepare("INSERT INTO teams (name, age_group) VALUES (?, ?)").run(t.name, t.age_group);
    teamMap[t.name] = result.lastInsertRowid;
  }

  // ── Step 2: Create coaches ────────────────────────────────────────────

  console.log('Creating coaches...');

  const coachUserMap = {}; // email -> { id, name }

  for (const [email, coach] of Object.entries(coachMap)) {
    const fullName = [coach.firstName, coach.middleName, coach.lastName].filter(Boolean).join(' ');

    const result = db.prepare(
      "INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, '', 'coach', ?, ?)"
    ).run(email, fullName, coach.phone);

    db.prepare("INSERT INTO coaches (user_id, name, phone) VALUES (?, ?, ?)").run(
      result.lastInsertRowid, fullName, coach.phone
    );

    coachUserMap[email] = { id: result.lastInsertRowid, name: fullName };
  }

  // ── Step 3: Build family maps ──────────────────────────────────────────

  console.log('Processing families and players...');

  const familyMap = {}; // parentOne email -> { parentOne, parentTwo, players: [] }

  for (const reg of playerRegistrations) {
    const p1Email = (reg['Parent One Email/UserID'] || '').trim().toLowerCase();
    if (!p1Email) continue;

    if (!familyMap[p1Email]) {
      familyMap[p1Email] = {
        parentOne: {
          firstName: reg['Parent One First Name'] || '',
          lastName: reg['Parent One Last Name'] || '',
          email: p1Email,
          phone: (reg['Parent One Phone Number'] || '').replace(/\D/g, ''),
        },
        parentTwo: null,
        players: [],
      };

      if (reg['Parent Two First Name'] && reg['Parent Two Last Name']) {
        familyMap[p1Email].parentTwo = {
          firstName: reg['Parent Two First Name'],
          lastName: reg['Parent Two Last Name'],
          email: (reg['Parent Two Email'] || '').trim().toLowerCase(),
          phone: (reg['Parent Two Phone Number'] || '').replace(/\D/g, ''),
        };
      }
    }

    const uid = parseInt(reg['User ID']);
    if (playerMap[uid]) {
      familyMap[p1Email].players.push(playerMap[uid]);
    }
  }

  // ── Step 4: Create families and players ────────────────────────────────

  const userMap = {}; // family name -> { id }
  const playerFamilyMap = {}; // player userId -> { familyId, playerId }

  for (const [familyKey, family] of Object.entries(familyMap)) {
    // Format: "Last Name, 1st Parent Name & 2nd Parent Name Family"
    const lastName = family.parentOne.lastName;
    const p1Name = family.parentOne.firstName;
    const p2Name = family.parentTwo?.firstName
      ? ` & ${family.parentTwo.firstName}`
      : '';
    const fullName = `${lastName}, ${p1Name}${p2Name} Family`;

    // Check if parent email matches a coach (coach/parent overlap)
    let familyUserId;
    if (overlappingParentEmails.has(familyKey)) {
      const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(familyKey);
      if (existingUser) {
        familyUserId = existingUser.id; // Reuse coach user
      }
    }

    if (!familyUserId) {
      // Create new family user
      const userResult = db.prepare(
        "INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, '', 'family', ?, ?)"
      ).run(family.parentOne.email, fullName, family.parentOne.phone);
      familyUserId = userResult.lastInsertRowid;
    }

    // Create family record
    const familyResult = db.prepare("INSERT INTO families (user_id, name) VALUES (?, ?)").run(familyUserId, fullName);

    // Create players
    for (const player of family.players) {
      const playerName = [player.firstName, player.middleName, player.lastName].filter(Boolean).join(' ');

      let birthDate = null;
      if (player.dob) {
        const parts = player.dob.split('/');
        if (parts.length === 3) {
          birthDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }

      const playerResult = db.prepare(
        "INSERT INTO players (family_id, name, birth_date) VALUES (?, ?, ?)"
      ).run(familyResult.lastInsertRowid, playerName, birthDate);

      // Store player family mapping separately (fixed in step 6)
    }

    userMap[fullName] = { id: familyUserId };
  }

  // Build playerFamilyMap by looking up player by name in ALL families
  // (names can collide between families with same name)
  for (const reg of playerRegistrations) {
    const uid = parseInt(reg['User ID']);
    if (!playerMap[uid]) continue;

    const playerName = [playerMap[uid].firstName, playerMap[uid].middleName, playerMap[uid].lastName].filter(Boolean).join(' ');
    const playerInfo = db.prepare("SELECT id, family_id FROM players WHERE name = ?").get(playerName);
    if (playerInfo) {
      playerFamilyMap[uid] = { familyId: playerInfo.family_id, playerId: playerInfo.id };
    }
  }

  // ── Step 5: Build team rosters and link ───────────────────────────────

  console.log('Linking players and coaches to teams...');

  let playerLinks = 0;
  let coachLinks = 0;

  for (const reg of registrations) {
    const teamName = reg['Team'] || '';
    if (!teamName) continue;

    let dbTeamName = '';
    if (teamName.includes('B2013') || (teamName.includes('2013') && !teamName.includes('20130'))) dbTeamName = 'Vikings B2013 (U13)';
    else if (teamName.includes('B2014') || teamName.includes('2014')) dbTeamName = 'Vikings B2014 (U12)';
    else if (teamName.includes('B2016') || teamName.includes('2016')) dbTeamName = 'Vikings B2016 (U10)';
    else if (teamName.includes('B2017') || teamName.includes('2017')) dbTeamName = 'Vikings B2017 (U9)';
    else if (teamName.includes('B2018 Team Gold') || teamName.includes('2018') && teamName.includes('Gold')) dbTeamName = 'Vikings B2018 Gold';
    else if (teamName.includes('B2018 Team Green') || teamName.includes('2018') && teamName.includes('Green')) dbTeamName = 'Vikings B2018 Green';

    if (!dbTeamName || !teamMap[dbTeamName]) continue;
    const teamId = teamMap[dbTeamName];

    if (reg['Registration Type'] === 'player') {
      const uid = parseInt(reg['User ID']);
      if (playerFamilyMap[uid]) {
        db.prepare("INSERT OR IGNORE INTO player_teams (player_id, team_id) VALUES (?, ?)").run(playerFamilyMap[uid].playerId, teamId);
        playerLinks++;
      }
    } else if (reg['Registration Type'] === 'coach') {
      const email = (reg['Email/UserID'] || '').toLowerCase();
      if (coachUserMap[email]) {
        const coachInfo = db.prepare("SELECT id FROM coaches WHERE user_id = ?").get(coachUserMap[email].id);
        if (coachInfo) {
          db.prepare("INSERT OR IGNORE INTO team_coaches (coach_id, team_id) VALUES (?, ?)").run(coachInfo.id, teamId);
          coachLinks++;
        }
      }
    }
  }

  // ── Step 6: Set permissions ───────────────────────────────────────────

  console.log('Setting permissions...');

  // Admin: full access to all resources
  const adminStmt = db.prepare("INSERT OR REPLACE INTO user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete) VALUES (?, ?, 1, 1, 1, 1)");
  const resources = ['games', 'players', 'families', 'coaches', 'teams', 'opponents', 'seasons', 'settings', 'users'];
  for (const r of resources) adminStmt.run(1, r);

  // Families: view-only access to games, players, families, teams
  const familyResources = ['games', 'players', 'families', 'teams'];
  for (const [name, info] of Object.entries(userMap)) {
    for (const r of familyResources) {
      db.prepare("INSERT OR REPLACE INTO user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete) VALUES (?, ?, 1, 0, 0, 0)").run(info.id, r);
    }
  }

  // Coaches: view access to games, players, families, teams, coaches
  const coachResources = ['games', 'players', 'families', 'teams', 'coaches'];
  for (const [email, info] of Object.entries(coachUserMap)) {
    for (const r of coachResources) {
      db.prepare("INSERT OR REPLACE INTO user_permissions (user_id, resource, can_view, can_create, can_edit, can_delete) VALUES (?, ?, 1, 0, 0, 0)").run(info.id, r);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────

  console.log('\n═══════════════════════════════════════════');
  console.log('       ROSTER IMPORT SUMMARY');
  console.log('═══════════════════════════════════════════');

  console.log('\n--- Teams ---');
  db.prepare('SELECT id, name, age_group FROM teams ORDER BY age_group').all().forEach(t => {
    console.log(`  ${t.id}. ${t.name} (${t.age_group})`);
  });

  console.log('\n--- Coaches ---');
  db.prepare("SELECT u.id, u.name, u.email FROM users u WHERE u.role = 'coach'").all().forEach(c => {
    console.log(`  ${c.name} (${c.email})`);
  });

  console.log('\n--- Families & Players ---');
  const families = db.prepare(`
    SELECT f.name, f.user_id, COUNT(DISTINCT p.id) as player_count
    FROM families f
    LEFT JOIN players p ON p.family_id = f.id
    GROUP BY f.id
    ORDER BY f.name
  `).all();

  for (const f of families) {
    console.log(`  ${f.name}: ${f.player_count} player(s)`);
  }

  console.log('\n--- Totals ---');
  console.log(`  Coaches: ${db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='coach'").get().cnt}`);
  console.log(`  Families: ${families.length}`);
  console.log(`  Players: ${db.prepare("SELECT COUNT(*) as cnt FROM players").get().cnt}`);
  console.log(`  Coach-Team Links: ${coachLinks}`);
  console.log(`  Player-Team Links: ${playerLinks}`);
}

main().catch(err => { console.error('ERROR:', err); process.exit(1); });
