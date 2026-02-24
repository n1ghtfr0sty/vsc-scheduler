const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const getCoachTeamIds = (userId, role) => {
  if (role === 'admin') {
    return db.prepare('SELECT id FROM teams').all().map(t => t.id);
  }
  const result = db.prepare(`
    SELECT DISTINCT t.id FROM teams t
    JOIN team_coaches tc ON t.id = tc.team_id
    JOIN coaches c ON tc.coach_id = c.id
    WHERE c.user_id = ?
  `).all(userId);
  return result.map(t => t.id);
};

const getSettings = () => {
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const config = {};
  settings.forEach(s => config[s.key] = parseInt(s.value));
  return config;
};

const checkConflicts = (teamId, gameDate, startTime, endTime, newLocation, excludeGameId = null) => {
  const config = getSettings();
  const conflicts = [];
  const suggestions = { before: null, after: null };

  const teamPlayers = db.prepare(`
    SELECT p.id, p.name, p.family_id, f.user_id as family_user_id
    FROM players p
    JOIN families f ON p.family_id = f.id
    JOIN player_teams pt ON p.id = pt.player_id
    WHERE pt.team_id = ?
  `).all(teamId);

  const playerIds = teamPlayers.map(p => p.id);
  const familyIds = [...new Set(teamPlayers.map(p => p.family_id))];
  const familyUserIds = teamPlayers.map(p => p.family_user_id).filter(Boolean);

  const coaches = db.prepare(`
    SELECT c.id, c.name FROM coaches c
    JOIN team_coaches tc ON c.id = tc.coach_id
    WHERE tc.team_id = ?
  `).all(teamId);
  const coachIds = coaches.map(c => c.id);

  let gamesQuery = `
    SELECT g.*, t.name as team_name, o.name as opponent_name
    FROM games g
    JOIN teams t ON g.team_id = t.id
    JOIN opponents o ON g.opponent_id = o.id
    WHERE g.game_date = ?
  `;
  
  const params = [gameDate];
  
  if (excludeGameId) {
    gamesQuery += ' AND g.id != ?';
    params.push(excludeGameId);
  }

  const existingGames = db.prepare(gamesQuery).all(...params);

  existingGames.forEach(game => {
    const newStart = startTime;
    const newEnd = endTime;
    const existStart = game.start_time;
    const existEnd = game.end_time;

    const timesOverlap = !(newEnd <= existStart || newStart >= existEnd);

    if (timesOverlap) {
      const isSameLocation = newLocation && game.location && 
        newLocation.toLowerCase() === game.location.toLowerCase();
      
      const travelTime = isSameLocation ? config.travel_time_same_location : config.travel_time_different_location;

      const hasPlayerConflict = playerIds.length > 0 && db.prepare(`
        SELECT COUNT(*) as cnt FROM player_teams WHERE player_id IN (${playerIds.join(',')}) AND team_id = ?
      `).get(game.team_id).cnt > 0;

      const hasFamilyConflict = familyIds.length > 0 && db.prepare(`
        SELECT COUNT(*) as cnt FROM players p
        JOIN player_teams pt ON p.id = pt.player_id
        WHERE p.family_id IN (${familyIds.join(',')}) AND pt.team_id = ?
      `).get(game.team_id).cnt > 0;

      const hasCoachConflict = coachIds.includes(game.team_id) || 
        (coachIds.length > 0 && db.prepare(`
          SELECT COUNT(*) as cnt FROM team_coaches WHERE coach_id IN (${coachIds.join(',')}) AND team_id = ?
        `).get(game.team_id).cnt > 0);

      if (hasPlayerConflict || hasFamilyConflict || hasCoachConflict) {
        const conflictType = [];
        if (hasPlayerConflict) conflictType.push('Player');
        if (hasFamilyConflict) conflictType.push('Family');
        if (hasCoachConflict) conflictType.push('Coach');

        conflicts.push({
          game: game,
          type: conflictType.join(', '),
          reason: `Same time (${existStart}-${existEnd})`
        });
      }
    }
  });

  return { conflicts, suggestions };
};

router.get('/', requireAuth, (req, res) => {
  try {
    const { season_id, team_id } = req.query;
    
    let query = `
      SELECT g.*, t.name as team_name, o.name as opponent_name, o.location as opponent_location,
        s.name as season_name
      FROM games g
      JOIN teams t ON g.team_id = t.id
      JOIN opponents o ON g.opponent_id = o.id
      LEFT JOIN seasons s ON g.season_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (season_id) {
      query += ' AND g.season_id = ?';
      params.push(season_id);
    }

    if (team_id) {
      query += ' AND g.team_id = ?';
      params.push(team_id);
    }

    query += ' ORDER BY g.game_date, g.start_time';

    const games = db.prepare(query).all(...params);
    res.json({ games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

router.get('/conflicts', requireAuth, (req, res) => {
  try {
    const { team_id, game_date, start_time, end_time, location, exclude_game_id } = req.query;
    
    if (!team_id || !game_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'team_id, game_date, start_time, and end_time are required' });
    }

    const result = checkConflicts(
      parseInt(team_id), 
      game_date, 
      start_time, 
      end_time, 
      location, 
      exclude_game_id ? parseInt(exclude_game_id) : null
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check conflicts' });
  }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes } = req.body;

    if (!team_id || !opponent_id || !game_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const teamIds = getCoachTeamIds(req.session.userId, req.session.userRole);
    if (!teamIds.includes(parseInt(team_id))) {
      return res.status(403).json({ error: 'Not authorized for this team' });
    }

    const config = getSettings();
    const duration = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1]) - 
                     parseInt(start_time.split(':')[0]) * 60 - parseInt(start_time.split(':')[1]);
    
    const calculatedEndTime = end_time;

    const conflictResult = checkConflicts(team_id, game_date, start_time, calculatedEndTime, location);

    const result = db.prepare(`
      INSERT INTO games (team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(team_id, opponent_id, location || null, season_id || null, game_date, start_time, calculatedEndTime, notes || null);

    res.json({ 
      game: { id: result.lastInsertRowid, team_id, opponent_id, location, season_id, game_date, start_time, end_time: calculatedEndTime },
      conflicts: conflictResult.conflicts 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { team_id, opponent_id, location, season_id, game_date, start_time, end_time, notes } = req.body;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const teamIds = getCoachTeamIds(req.session.userId, req.session.userRole);
    if (!teamIds.includes(game.team_id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const effectiveTeamId = team_id || game.team_id;
    const effectiveDate = game_date || game.game_date;
    const effectiveStart = start_time || game.start_time;
    const effectiveEnd = end_time || game.end_time;
    const effectiveLocation = location || game.location;

    const conflictResult = checkConflicts(
      effectiveTeamId, 
      effectiveDate, 
      effectiveStart, 
      effectiveEnd, 
      effectiveLocation, 
      parseInt(id)
    );

    db.prepare(`
      UPDATE games 
      SET team_id = ?, opponent_id = ?, location = ?, season_id = ?, 
          game_date = ?, start_time = ?, end_time = ?, notes = ?
      WHERE id = ?
    `).run(
      effectiveTeamId,
      opponent_id || game.opponent_id,
      effectiveLocation,
      season_id || game.season_id,
      effectiveDate,
      effectiveStart,
      effectiveEnd,
      notes || game.notes,
      id
    );

    res.json({ 
      message: 'Game updated',
      conflicts: conflictResult.conflicts 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const teamIds = getCoachTeamIds(req.session.userId, req.session.userRole);
    if (!teamIds.includes(game.team_id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    res.json({ message: 'Game deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

module.exports = router;
