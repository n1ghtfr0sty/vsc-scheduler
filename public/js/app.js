const App = {
  async init() {
    this.setupRoutes();
    await Auth.init();
    Router.init();
  },

  setupRoutes() {
    Router.route('/', () => this.renderLogin());
    Router.route('/register', () => this.renderRegister());
    Router.route('/dashboard', () => this.renderDashboard());
    Router.route('/schedule', () => this.renderSchedule());
    Router.route('/games', () => this.renderGames());
    Router.route('/games/new', () => this.renderGameForm());
    Router.route('/games/:id/edit', (params) => this.renderGameForm(params.id));
    Router.route('/teams', () => this.renderTeams());
    Router.route('/teams/:id', (params) => this.renderTeamDetail(params.id));
    Router.route('/players', () => this.renderPlayers());
    Router.route('/opponents', () => this.renderOpponents());
    Router.route('/seasons', () => this.renderSeasons());
    Router.route('/families', () => this.renderFamilies());
    Router.route('/coaches', () => this.renderCoaches());
    Router.route('/settings', () => this.renderSettings());
  },

  renderLogin() {
    if (Auth.currentUser) {
      Router.navigate('/dashboard');
      return;
    }

    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="auth-container">
        <h1>Vikings Soccer Club</h1>
        <div class="card">
          <h2>Login</h2>
          <form id="loginForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" required>
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
            <p class="switch-auth">Don't have an account? <a onclick="Router.navigate('/register')">Register</a></p>
          </form>
        </div>
      </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await Auth.login(formData.get('email'), formData.get('password'));
        this.showToast('Login successful', 'success');
        Router.navigate('/dashboard');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  renderRegister() {
    if (Auth.currentUser) {
      Router.navigate('/dashboard');
      return;
    }

    const main = document.getElementById('main');
    main.innerHTML = `
      <div class="auth-container">
        <h1>Vikings Soccer Club</h1>
        <div class="card">
          <h2>Register</h2>
          <form id="registerForm">
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" required>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" name="password" required>
            </div>
            <div class="form-group">
              <label>Name</label>
              <input type="text" name="name" required>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" name="phone">
            </div>
            <div class="form-group">
              <label>Role</label>
              <select name="role" required>
                <option value="family">Family</option>
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary">Register</button>
            <p class="switch-auth">Already have an account? <a onclick="Router.navigate('/')">Login</a></p>
          </form>
        </div>
      </div>
    `;

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await Auth.register(
          formData.get('email'),
          formData.get('password'),
          formData.get('name'),
          formData.get('phone'),
          formData.get('role')
        );
        this.showToast('Registration successful', 'success');
        Router.navigate('/dashboard');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  async renderDashboard() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      console.log('Fetching data...');
      const [gamesData, teamsData, settingsData] = await Promise.all([
        API.games.getAll(),
        Auth.isCoach() ? API.teams.getMy() : Promise.resolve({ teams: [] }),
        API.settings.get()
      ]);
      console.log('Games data:', gamesData);

      const totalGames = gamesData.games.length;
      const totalTeams = teamsData.teams?.length || 0;
      const upcomingGames = gamesData.games.filter(g => new Date(g.game_date) >= new Date()).length;

      main.innerHTML = `
        <h1>Dashboard</h1>
        
        <div id="calendarContainer"></div>
        
        <div class="dashboard-grid">
          <div class="stat-card">
            <h3>Total Games</h3>
            <div class="value">${totalGames}</div>
          </div>
          <div class="stat-card">
            <h3>Your Teams</h3>
            <div class="value">${totalTeams}</div>
          </div>
          <div class="stat-card">
            <h3>Upcoming Games</h3>
            <div class="value">${upcomingGames}</div>
          </div>
          <div class="stat-card">
            <h3>Travel Time (Same Location)</h3>
            <div class="value">${settingsData.settings.travel_time_same_location || 0} min</div>
          </div>
          <div class="stat-card">
            <h3>Travel Time (Different Location)</h3>
            <div class="value">${settingsData.settings.travel_time_different_location || 90} min</div>
          </div>
          <div class="stat-card">
            <h3>Default Game Duration</h3>
            <div class="value">${settingsData.settings.default_game_duration || 90} min</div>
          </div>
        </div>

        <div class="card">
          <h2>Recent Games</h2>
          ${gamesData.games.slice(0, 5).map(game => `
            <div class="game-card">
              <div class="game-date">${game.game_date} at ${game.start_time}</div>
              <div class="game-teams">${game.team_name} vs ${game.opponent_name}</div>
              <div class="game-location">${game.location || 'TBD'}</div>
            </div>
          `).join('')}
          ${gamesData.games.length === 0 ? '<p class="empty-state">No games scheduled</p>' : ''}
        </div>

        ${Auth.isCoach() ? `
          <div class="card">
            <h2>Quick Actions</h2>
            <button class="btn btn-primary" onclick="Router.navigate('/games/new')">Schedule New Game</button>
            <button class="btn btn-secondary" onclick="Router.navigate('/schedule')">View Schedule</button>
          </div>
        ` : ''}
      `;
      
      const calendarContainer = document.getElementById('calendarContainer');
      console.log('Calendar container:', calendarContainer);
      console.log('Calendar class:', window.Calendar);
      if (calendarContainer && window.Calendar) {
        console.log('Creating calendar...');
        window.calendar = new Calendar(calendarContainer, {
          onDateClick: (date) => {
            Router.navigate(`/schedule?date=${date}`);
          },
          onEventClick: (gameId) => {
            Router.navigate(`/games/${gameId}`);
          }
        });
        window.calendar.setGames(gamesData.games);
        console.log('Calendar created successfully');
      } else {
        console.log('Calendar NOT created - container:', calendarContainer, 'Calendar:', window.Calendar);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async renderSchedule() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const [gamesData, seasonsData, teamsData] = await Promise.all([
        API.games.getAll(),
        API.seasons.getAll(),
        API.teams.getAll()
      ]);

      const params = Router.getParams();
      let filteredGames = gamesData.games;

      if (params.season_id) {
        filteredGames = filteredGames.filter(g => g.season_id == params.season_id);
      }
      if (params.team_id) {
        filteredGames = filteredGames.filter(g => g.team_id == params.team_id);
      }

      main.innerHTML = `
        <h1>Schedule</h1>
        <div class="filter-bar">
          <select id="seasonFilter" onchange="App.filterSchedule()">
            <option value="">All Seasons</option>
            ${seasonsData.seasons.map(s => `
              <option value="${s.id}" ${params.season_id == s.id ? 'selected' : ''}>${s.name}</option>
            `).join('')}
          </select>
          <select id="teamFilter" onchange="App.filterSchedule()">
            <option value="">All Teams</option>
            ${teamsData.teams.map(t => `
              <option value="${t.id}" ${params.team_id == t.id ? 'selected' : ''}>${t.name}</option>
            `).join('')}
          </select>
          <button class="btn btn-outline" onclick="window.print()">Print Schedule</button>
        </div>
        <div id="scheduleList">
          ${this.renderGameList(filteredGames)}
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  renderGameList(games) {
    if (games.length === 0) {
      return '<p class="empty-state">No games scheduled</p>';
    }

    const grouped = {};
    games.forEach(game => {
      if (!grouped[game.game_date]) {
        grouped[game.game_date] = [];
      }
      grouped[game.game_date].push(game);
    });

    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0])).map(([date, dayGames]) => `
      <div class="card">
        <h3>${date}</h3>
        ${dayGames.map(game => `
          <div class="game-card">
            <div class="game-date">${game.start_time} - ${game.end_time}</div>
            <div class="game-teams">${game.team_name} vs ${game.opponent_name}</div>
            <div class="game-location">${game.location || 'TBD'}</div>
            ${game.notes ? `<div class="game-notes">${game.notes}</div>` : ''}
            ${game.season_name ? `<div class="game-date">${game.season_name}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `).join('');
  },

  filterSchedule() {
    const season_id = document.getElementById('seasonFilter').value;
    const team_id = document.getElementById('teamFilter').value;
    let query = '';
    if (season_id) query += `season_id=${season_id}&`;
    if (team_id) query += `team_id=${team_id}`;
    Router.navigate(`/schedule${query ? '?' + query : ''}`);
  },

  async renderGames() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const [gamesData, teamsData, opponentsData, seasonsData] = await Promise.all([
        API.games.getAll(),
        API.teams.getMy(),
        API.opponents.getAll(),
        API.seasons.getAll()
      ]);

      const settings = await API.settings.get();

      main.innerHTML = `
        <div class="header-actions">
          <h1>Games</h1>
          ${Auth.isCoach() ? `<button class="btn btn-primary" onclick="Router.navigate('/games/new')">+ New Game</button>` : ''}
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Team</th>
                <th>Opponent</th>
                <th>Location</th>
                <th>Season</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${gamesData.games.map(game => `
                <tr>
                  <td>${game.game_date}</td>
                  <td>${game.start_time} - ${game.end_time}</td>
                  <td>${game.team_name}</td>
                  <td>${game.opponent_name}</td>
                  <td>${game.location || 'TBD'}</td>
                  <td>${game.season_name || 'N/A'}</td>
                  <td class="actions">
                    ${Auth.isCoach() ? `
                      <button class="btn btn-outline" onclick="Router.navigate('/games/${game.id}/edit')">Edit</button>
                      <button class="btn btn-danger" onclick="App.deleteGame(${game.id})">Delete</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${gamesData.games.length === 0 ? '<p class="empty-state">No games scheduled</p>' : ''}
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async renderGameForm(editId = null) {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const [teamsData, opponentsData, seasonsData, settingsData] = await Promise.all([
        API.teams.getMy(),
        API.opponents.getAll(),
        API.seasons.getAll(),
        API.settings.get()
      ]);

      let game = null;
      if (editId) {
        const gamesData = await API.games.getAll();
        game = gamesData.games.find(g => g.id == editId);
      }

      const defaultDuration = parseInt(settingsData.settings.default_game_duration) || 90;

      main.innerHTML = `
        <h1>${editId ? 'Edit Game' : 'New Game'}</h1>
        <div class="card">
          <form id="gameForm">
            <input type="hidden" name="id" value="${editId || ''}">
            <div class="form-group">
              <label>Team *</label>
              <select name="team_id" required>
                <option value="">Select Team</option>
                ${teamsData.teams.map(t => `
                  <option value="${t.id}" ${game?.team_id == t.id ? 'selected' : ''}>${t.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Opponent *</label>
              <select name="opponent_id" required>
                <option value="">Select Opponent</option>
                ${opponentsData.opponents.map(o => `
                  <option value="${o.id}" ${game?.opponent_id == o.id ? 'selected' : ''}>${o.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Season</label>
              <select name="season_id">
                <option value="">Select Season</option>
                ${seasonsData.seasons.map(s => `
                  <option value="${s.id}" ${game?.season_id == s.id ? 'selected' : ''}>${s.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Location</label>
              <input type="text" name="location" value="${game?.location || ''}">
            </div>
            <div class="form-group">
              <label>Date *</label>
              <input type="date" name="game_date" value="${game?.game_date || ''}" required>
            </div>
            <div class="form-group">
              <label>Start Time *</label>
              <input type="time" name="start_time" value="${game?.start_time || ''}" required onchange="App.calculateEndTime()">
            </div>
            <div class="form-group">
              <label>End Time *</label>
              <input type="time" name="end_time" value="${game?.end_time || ''}" required>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea name="notes">${game?.notes || ''}</textarea>
            </div>
            <div id="conflictWarning" class="alert alert-warning hidden"></div>
            <button type="submit" class="btn btn-primary">${editId ? 'Update' : 'Create'} Game</button>
            <button type="button" class="btn btn-outline" onclick="Router.navigate('/games')">Cancel</button>
          </form>
        </div>
      `;

      document.getElementById('gameForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          team_id: parseInt(formData.get('team_id')),
          opponent_id: parseInt(formData.get('opponent_id')),
          season_id: formData.get('season_id') ? parseInt(formData.get('season_id')) : null,
          location: formData.get('location'),
          game_date: formData.get('game_date'),
          start_time: formData.get('start_time'),
          end_time: formData.get('end_time'),
          notes: formData.get('notes')
        };

        try {
          if (editId) {
            await API.games.update(editId, data);
            this.showToast('Game updated', 'success');
          } else {
            await API.games.create(data);
            this.showToast('Game created', 'success');
          }
          Router.navigate('/games');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });

      document.getElementById('gameForm').addEventListener('change', async (e) => {
        const team_id = document.querySelector('[name="team_id"]').value;
        const game_date = document.querySelector('[name="game_date"]').value;
        const start_time = document.querySelector('[name="start_time"]').value;
        const end_time = document.querySelector('[name="end_time"]').value;
        const location = document.querySelector('[name="location"]').value;

        if (team_id && game_date && start_time && end_time) {
          try {
            const result = await API.games.checkConflicts({
              team_id,
              game_date,
              start_time,
              end_time,
              location,
              exclude_game_id: editId || undefined
            });

            const warningEl = document.getElementById('conflictWarning');
            if (result.conflicts && result.conflicts.length > 0) {
              warningEl.classList.remove('hidden');
              warningEl.innerHTML = `
                <strong>Conflicts detected:</strong><br>
                ${result.conflicts.map(c => `
                  ${c.type} conflict: ${c.game.team_name} vs ${c.game.opponent_name} at ${c.game.start_time}-${c.game.end_time} (${c.game.location || 'TBD'})
                `).join('<br>')}
              `;
            } else {
              warningEl.classList.add('hidden');
            }
          } catch (err) {
            console.error('Conflict check failed:', err);
          }
        }
      });
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  calculateEndTime() {
    const startInput = document.querySelector('[name="start_time"]');
    const endInput = document.querySelector('[name="end_time"]');
    if (startInput.value && !endInput.value) {
      const [hours, minutes] = startInput.value.split(':');
      const endHours = parseInt(hours) + 1;
      endInput.value = `${String(endHours).padStart(2, '0')}:${minutes}`;
    }
  },

  async deleteGame(id) {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      await API.games.delete(id);
      this.showToast('Game deleted', 'success');
      this.renderGames();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderTeams() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const data = await API.teams.getAll();

      main.innerHTML = `
        <div class="header-actions">
          <h1>Teams</h1>
          ${Auth.isAdmin() ? `<button class="btn btn-primary" onclick="App.showTeamForm()">+ New Team</button>` : ''}
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age Group</th>
                <th>Coaches</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.teams.map(team => `
                <tr>
                  <td>${team.name}</td>
                  <td>${team.age_group || 'N/A'}</td>
                  <td>${team.coaches || 'None'}</td>
                  <td class="actions">
                    <button class="btn btn-outline" onclick="Router.navigate('/teams/${team.id}')">View</button>
                    ${Auth.isCoach() ? `
                      <button class="btn btn-outline" onclick="App.showTeamForm(${team.id})">Edit</button>
                    ` : ''}
                    ${Auth.isAdmin() ? `
                      <button class="btn btn-danger" onclick="App.deleteTeam(${team.id})">Delete</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${data.teams.length === 0 ? '<p class="empty-state">No teams created</p>' : ''}
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async renderTeamDetail(id) {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const [teamData, playersData] = await Promise.all([
        API.teams.getAll(),
        API.teams.getPlayers(id)
      ]);

      const team = teamData.teams.find(t => t.id == id);

      main.innerHTML = `
        <h1>${team?.name || 'Team'}</h1>
        <div class="card">
          <h2>Team Info</h2>
          <p><strong>Age Group:</strong> ${team?.age_group || 'N/A'}</p>
          <p><strong>Coaches:</strong> ${team?.coaches || 'None'}</p>
        </div>
        <div class="card">
          <h2>Players</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Birth Date</th>
                <th>Family</th>
              </tr>
            </thead>
            <tbody>
              ${playersData.players.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.birth_date || 'N/A'}</td>
                  <td>${p.family_name || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${playersData.players.length === 0 ? '<p class="empty-state">No players on this team</p>' : ''}
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async showTeamForm(editId = null) {
    let team = null;
    if (editId) {
      const data = await API.teams.getAll();
      team = data.teams.find(t => t.id == editId);
    }

    this.showModal(editId ? 'Edit Team' : 'New Team', `
      <form id="teamForm">
        <input type="hidden" name="id" value="${editId || ''}">
        <div class="form-group">
          <label>Name *</label>
          <input type="text" name="name" value="${team?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Age Group</label>
          <input type="text" name="age_group" value="${team?.age_group || ''}">
        </div>
        <button type="submit" class="btn btn-primary">${editId ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </form>
    `);

    document.getElementById('teamForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        age_group: formData.get('age_group')
      };

      try {
        if (editId) {
          await API.teams.update(editId, data);
          this.showToast('Team updated', 'success');
        } else {
          await API.teams.create(data);
          this.showToast('Team created', 'success');
        }
        closeModal();
        this.renderTeams();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  async deleteTeam(id) {
    if (!confirm('Are you sure?')) return;

    try {
      await API.teams.delete(id);
      this.showToast('Team deleted', 'success');
      this.renderTeams();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderPlayers() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const data = await API.players.getAll();

      main.innerHTML = `
        <div class="header-actions">
          <h1>Players</h1>
          ${Auth.isAdmin() ? `<button class="btn btn-primary" onclick="App.showPlayerForm()">+ New Player</button>` : ''}
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Birth Date</th>
                <th>Family</th>
                <th>Teams</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.players.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.birth_date || 'N/A'}</td>
                  <td>${p.family_name || 'N/A'}</td>
                  <td>${p.teams || 'None'}</td>
                  <td class="actions">
                    ${Auth.isAdmin() ? `
                      <button class="btn btn-outline" onclick="App.showPlayerForm(${p.id})">Edit</button>
                      <button class="btn btn-danger" onclick="App.deletePlayer(${p.id})">Delete</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async showPlayerForm(editId = null) {
    let player = null;
    const [playersData, familiesData, teamsData] = await Promise.all([
      API.players.getAll(),
      API.families.getAll(),
      API.teams.getAll()
    ]);

    if (editId) {
      player = playersData.players.find(p => p.id == editId);
    }

    this.showModal(editId ? 'Edit Player' : 'New Player', `
      <form id="playerForm">
        <input type="hidden" name="id" value="${editId || ''}">
        <div class="form-group">
          <label>Name *</label>
          <input type="text" name="name" value="${player?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Birth Date</label>
          <input type="date" name="birth_date" value="${player?.birth_date || ''}">
        </div>
        <div class="form-group">
          <label>Family *</label>
          <select name="family_id" required>
            <option value="">Select Family</option>
            ${familiesData.families.map(f => `
              <option value="${f.id}" ${player?.family_id == f.id ? 'selected' : ''}>${f.name}</option>
            `).join('')}
          </select>
        </div>
        <button type="submit" class="btn btn-primary">${editId ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </form>
    `);

    document.getElementById('playerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        birth_date: formData.get('birth_date'),
        family_id: parseInt(formData.get('family_id'))
      };

      try {
        if (editId) {
          await API.players.update(editId, data);
          this.showToast('Player updated', 'success');
        } else {
          await API.players.create(data);
          this.showToast('Player created', 'success');
        }
        closeModal();
        this.renderPlayers();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  async deletePlayer(id) {
    if (!confirm('Are you sure?')) return;

    try {
      await API.players.delete(id);
      this.showToast('Player deleted', 'success');
      this.renderPlayers();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderOpponents() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const data = await API.opponents.getAll();

      main.innerHTML = `
        <div class="header-actions">
          <h1>Opponents</h1>
          <button class="btn btn-primary" onclick="App.showOpponentForm()">+ New Opponent</button>
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.opponents.map(o => `
                <tr>
                  <td>${o.name}</td>
                  <td>${o.contact_name || 'N/A'}</td>
                  <td>${o.phone || 'N/A'}</td>
                  <td>${o.email || 'N/A'}</td>
                  <td>${o.location || 'N/A'}</td>
                  <td class="actions">
                    <button class="btn btn-outline" onclick="App.showOpponentForm(${o.id})">Edit</button>
                    ${Auth.isAdmin() ? `
                      <button class="btn btn-danger" onclick="App.deleteOpponent(${o.id})">Delete</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async showOpponentForm(editId = null) {
    let opponent = null;
    if (editId) {
      const data = await API.opponents.getAll();
      opponent = data.opponents.find(o => o.id == editId);
    }

    this.showModal(editId ? 'Edit Opponent' : 'New Opponent', `
      <form id="opponentForm">
        <input type="hidden" name="id" value="${editId || ''}">
        <div class="form-group">
          <label>Name *</label>
          <input type="text" name="name" value="${opponent?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Contact Name</label>
          <input type="text" name="contact_name" value="${opponent?.contact_name || ''}">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value="${opponent?.phone || ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" value="${opponent?.email || ''}">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" name="location" value="${opponent?.location || ''}">
        </div>
        <button type="submit" class="btn btn-primary">${editId ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </form>
    `);

    document.getElementById('opponentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        contact_name: formData.get('contact_name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        location: formData.get('location')
      };

      try {
        if (editId) {
          await API.opponents.update(editId, data);
          this.showToast('Opponent updated', 'success');
        } else {
          await API.opponents.create(data);
          this.showToast('Opponent created', 'success');
        }
        closeModal();
        this.renderOpponents();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  async deleteOpponent(id) {
    if (!confirm('Are you sure?')) return;

    try {
      await API.opponents.delete(id);
      this.showToast('Opponent deleted', 'success');
      this.renderOpponents();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderSeasons() {
    if (!Auth.requireAuth()) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const data = await API.seasons.getAll();

      main.innerHTML = `
        <div class="header-actions">
          <h1>Seasons</h1>
          ${Auth.isAdmin() ? `<button class="btn btn-primary" onclick="App.showSeasonForm()">+ New Season</button>` : ''}
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Year</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.seasons.map(s => `
                <tr>
                  <td>${s.name}</td>
                  <td>${s.year}</td>
                  <td>${s.type}</td>
                  <td>${s.start_date || 'N/A'}</td>
                  <td>${s.end_date || 'N/A'}</td>
                  <td class="actions">
                    ${Auth.isAdmin() ? `
                      <button class="btn btn-outline" onclick="App.showSeasonForm(${s.id})">Edit</button>
                      <button class="btn btn-danger" onclick="App.deleteSeason(${s.id})">Delete</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async showSeasonForm(editId = null) {
    let season = null;
    if (editId) {
      const data = await API.seasons.getAll();
      season = data.seasons.find(s => s.id == editId);
    }

    this.showModal(editId ? 'Edit Season' : 'New Season', `
      <form id="seasonForm">
        <input type="hidden" name="id" value="${editId || ''}">
        <div class="form-group">
          <label>Name *</label>
          <input type="text" name="name" value="${season?.name || ''}" required placeholder="e.g., Fall '25">
        </div>
        <div class="form-group">
          <label>Year *</label>
          <input type="text" name="year" value="${season?.year || ''}" required placeholder="e.g., 2025">
        </div>
        <div class="form-group">
          <label>Type *</label>
          <select name="type" required>
            <option value="fall" ${season?.type === 'fall' ? 'selected' : ''}>Fall</option>
            <option value="winter" ${season?.type === 'winter' ? 'selected' : ''}>Winter</option>
            <option value="spring" ${season?.type === 'spring' ? 'selected' : ''}>Spring</option>
            <option value="summer" ${season?.type === 'summer' ? 'selected' : ''}>Summer</option>
          </select>
        </div>
        <div class="form-group">
          <label>Start Date</label>
          <input type="date" name="start_date" value="${season?.start_date || ''}">
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input type="date" name="end_date" value="${season?.end_date || ''}">
        </div>
        <button type="submit" class="btn btn-primary">${editId ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </form>
    `);

    document.getElementById('seasonForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        year: formData.get('year'),
        type: formData.get('type'),
        start_date: formData.get('start_date'),
        end_date: formData.get('end_date')
      };

      try {
        if (editId) {
          await API.seasons.update(editId, data);
          this.showToast('Season updated', 'success');
        } else {
          await API.seasons.create(data);
          this.showToast('Season created', 'success');
        }
        closeModal();
        this.renderSeasons();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  async deleteSeason(id) {
    if (!confirm('Are you sure?')) return;

    try {
      await API.seasons.delete(id);
      this.showToast('Season deleted', 'success');
      this.renderSeasons();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderFamilies() {
    if (!Auth.requireRole('admin')) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const data = await API.families.getAll();

      main.innerHTML = `
        <h1>Families</h1>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>User Email</th>
                <th>User Name</th>
              </tr>
            </thead>
            <tbody>
              ${data.families.map(f => `
                <tr>
                  <td>${f.name}</td>
                  <td>${f.email || 'N/A'}</td>
                  <td>${f.user_name || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async renderCoaches() {
    if (!Auth.requireRole('admin')) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const [coachesData, usersData, teamsData] = await Promise.all([
        API.coaches.getAll(),
        API.auth.me(),
        API.teams.getAll()
      ]);

      main.innerHTML = `
        <div class="header-actions">
          <h1>Coaches</h1>
          <button class="btn btn-primary" onclick="App.showCoachForm()">+ New Coach</button>
        </div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Teams</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${coachesData.coaches.map(c => `
                <tr>
                  <td>${c.name}</td>
                  <td>${c.email || 'N/A'}</td>
                  <td>${c.phone || 'N/A'}</td>
                  <td>${c.teams || 'None'}</td>
                  <td class="actions">
                    <button class="btn btn-outline" onclick="App.showCoachForm(${c.id})">Edit</button>
                    <button class="btn btn-danger" onclick="App.deleteCoach(${c.id})">Delete</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async showCoachForm(editId = null) {
    let coach = null;
    const [coachesData, teamsData] = await Promise.all([
      API.coaches.getAll(),
      API.teams.getAll()
    ]);

    if (editId) {
      coach = coachesData.coaches.find(c => c.id == editId);
    }

    this.showModal(editId ? 'Edit Coach' : 'New Coach', `
      <form id="coachForm">
        <input type="hidden" name="id" value="${editId || ''}">
        ${!editId ? `
          <div class="form-group">
            <label>User ID *</label>
            <input type="number" name="user_id" required>
          </div>
        ` : ''}
        <div class="form-group">
          <label>Name *</label>
          <input type="text" name="name" value="${coach?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" name="phone" value="${coach?.phone || ''}">
        </div>
        <button type="submit" class="btn btn-primary">${editId ? 'Update' : 'Create'}</button>
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
      </form>
    `);

    document.getElementById('coachForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        user_id: editId ? undefined : parseInt(formData.get('user_id'))
      };

      try {
        if (editId) {
          await API.coaches.update(editId, data);
          this.showToast('Coach updated', 'success');
        } else {
          await API.coaches.create(data);
          this.showToast('Coach created', 'success');
        }
        closeModal();
        this.renderCoaches();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    });
  },

  async deleteCoach(id) {
    if (!confirm('Are you sure?')) return;

    try {
      await API.coaches.delete(id);
      this.showToast('Coach deleted', 'success');
      this.renderCoaches();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async renderSettings() {
    if (!Auth.requireRole('admin')) return;

    const main = document.getElementById('main');
    main.innerHTML = '<div class="loading">Loading...</div>';

    try {
      const data = await API.settings.get();

      main.innerHTML = `
        <h1>Settings</h1>
        
        <div class="card">
          <h2>Travel Time Settings</h2>
          <form id="settingsForm">
            <div class="form-group">
              <label>Same Location Travel Time (minutes)</label>
              <input type="number" name="travel_time_same_location" value="${data.settings.travel_time_same_location || 0}" min="0">
            </div>
            <div class="form-group">
              <label>Different Location Travel Time (minutes)</label>
              <input type="number" name="travel_time_different_location" value="${data.settings.travel_time_different_location || 90}" min="0">
            </div>
            <div class="form-group">
              <label>Default Game Duration (minutes)</label>
              <input type="number" name="default_game_duration" value="${data.settings.default_game_duration || 90}" min="30">
            </div>
            <button type="submit" class="btn btn-primary">Save Settings</button>
          </form>
        </div>

        <div class="card">
          <h2>Import / Export</h2>
          <div class="actions">
            <button class="btn btn-secondary" onclick="App.exportData()">Export Data</button>
            <button class="btn btn-outline" onclick="document.getElementById('importFile').click()">Import Data</button>
            <input type="file" id="importFile" accept=".json" style="display:none" onchange="App.importData(this)">
          </div>
        </div>
      `;

      document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
          await API.settings.update('travel_time_same_location', formData.get('travel_time_same_location'));
          await API.settings.update('travel_time_different_location', formData.get('travel_time_different_location'));
          await API.settings.update('default_game_duration', formData.get('default_game_duration'));
          this.showToast('Settings saved', 'success');
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    } catch (err) {
      main.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  async exportData() {
    try {
      const data = await API.settings.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vsc-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Data exported', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async importData(input) {
    const file = input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await API.settings.import(data);
      this.showToast('Data imported', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
    input.value = '';
  },

  showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
  },

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }
};

window.closeModal = () => {
  document.getElementById('modal').classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => App.init());
