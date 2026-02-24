const API = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('API Request:', endpoint, 'Token:', token ? 'yes' : 'no');

    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include'
    });

    console.log('API Response:', endpoint, response.status);

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response:', response.status, response.statusText);
      throw new Error('Authentication required. Please log in again.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  auth: {
    async register(email, password, name, phone) {
      return API.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, phone })
      });
    },
    async login(email, password) {
      return API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    },
    async logout() {
      return API.request('/api/auth/logout', { method: 'POST' });
    },
    async me() {
      return API.request('/api/auth/me');
    }
  },

  families: {
    async getAll() {
      return API.request('/api/families');
    },
    async getMy() {
      return API.request('/api/families/my');
    },
    async update(id, data) {
      return API.request(`/api/families/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
  },

  players: {
    async getAll() {
      return API.request('/api/players');
    },
    async create(data) {
      return API.request('/api/players', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    async update(id, data) {
      return API.request(`/api/players/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async delete(id) {
      return API.request(`/api/players/${id}`, { method: 'DELETE' });
    },
    async addToTeam(playerId, teamId) {
      return API.request(`/api/players/${playerId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ team_id: teamId })
      });
    },
    async removeFromTeam(playerId, teamId) {
      return API.request(`/api/players/${playerId}/teams/${teamId}`, { method: 'DELETE' });
    }
  },

  teams: {
    async getAll() {
      return API.request('/api/teams');
    },
    async getMy() {
      return API.request('/api/teams/my');
    },
    async getPlayers(teamId) {
      return API.request(`/api/teams/${teamId}/players`);
    },
    async create(data) {
      return API.request('/api/teams', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    async update(id, data) {
      return API.request(`/api/teams/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async delete(id) {
      return API.request(`/api/teams/${id}`, { method: 'DELETE' });
    }
  },

  coaches: {
    async getAll() {
      return API.request('/api/coaches');
    },
    async create(data) {
      return API.request('/api/coaches', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    async update(id, data) {
      return API.request(`/api/coaches/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async delete(id) {
      return API.request(`/api/coaches/${id}`, { method: 'DELETE' });
    },
    async assignToTeam(coachId, teamId) {
      return API.request(`/api/coaches/${coachId}/teams`, {
        method: 'POST',
        body: JSON.stringify({ team_id: teamId })
      });
    },
    async removeFromTeam(coachId, teamId) {
      return API.request(`/api/coaches/${coachId}/teams/${teamId}`, { method: 'DELETE' });
    }
  },

  opponents: {
    async getAll() {
      return API.request('/api/opponents');
    },
    async create(data) {
      return API.request('/api/opponents', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    async update(id, data) {
      return API.request(`/api/opponents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async delete(id) {
      return API.request(`/api/opponents/${id}`, { method: 'DELETE' });
    }
  },

  seasons: {
    async getAll() {
      return API.request('/api/seasons');
    },
    async create(data) {
      return API.request('/api/seasons', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    async update(id, data) {
      return API.request(`/api/seasons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async delete(id) {
      return API.request(`/api/seasons/${id}`, { method: 'DELETE' });
    }
  },

  games: {
    async getAll(params = {}) {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/games${query ? '?' + query : ''}`);
    },
    async checkConflicts(params) {
      const query = new URLSearchParams(params).toString();
      return API.request(`/api/games/conflicts?${query}`);
    },
    async create(data) {
      return API.request('/api/games', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    async update(id, data) {
      return API.request(`/api/games/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    async delete(id) {
      return API.request(`/api/games/${id}`, { method: 'DELETE' });
    }
  },

  users: {
    async getAll() {
      return API.request('/api/users');
    },
    async updateRole(id, role) {
      return API.request(`/api/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role })
      });
    },
    async updatePermissions(id, permissions) {
      return API.request(`/api/users/${id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions })
      });
    }
  },

  settings: {
    async get() {
      return API.request('/api/settings');
    },
    async update(key, value) {
      return API.request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ key, value })
      });
    },
    async export() {
      return API.request('/api/settings/export');
    },
    async import(data) {
      return API.request('/api/settings/import', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  }
};
