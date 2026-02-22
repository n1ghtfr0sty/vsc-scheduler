const Auth = {
  currentUser: null,

  async init() {
    try {
      const data = await API.auth.me();
      this.currentUser = data.user;
      this.updateUI();
      return true;
    } catch (err) {
      this.currentUser = null;
      return false;
    }
  },

  async login(email, password) {
    const data = await API.auth.login(email, password);
    this.currentUser = data.user;
    this.updateUI();
    return data.user;
  },

  async register(email, password, name, phone, role) {
    const data = await API.auth.register(email, password, name, phone, role);
    this.currentUser = data.user;
    this.updateUI();
    return data.user;
  },

  async logout() {
    await API.auth.logout();
    this.currentUser = null;
    localStorage.removeItem('token');
    Router.navigate('/');
    this.updateUI();
  },

  isAdmin() {
    return this.currentUser?.role === 'admin';
  },

  isCoach() {
    return this.currentUser?.role === 'coach' || this.currentUser?.role === 'admin';
  },

  isFamily() {
    return this.currentUser?.role === 'family';
  },

  updateUI() {
    const navLinks = document.getElementById('navLinks');
    const navUser = document.getElementById('navUser');

    if (this.currentUser) {
      navLinks.innerHTML = `
        <a href="#/" data-nav="/">Dashboard</a>
        <a href="#/schedule" data-nav="/schedule">Schedule</a>
        ${this.isCoach() ? '<a href="#/games" data-nav="/games">Games</a>' : ''}
        ${this.isCoach() ? '<a href="#/teams" data-nav="/teams">Teams</a>' : ''}
        ${this.isCoach() ? '<a href="#/opponents" data-nav="/opponents">Opponents</a>' : ''}
        ${this.isCoach() ? '<a href="#/seasons" data-nav="/seasons">Seasons</a>' : ''}
        ${this.isAdmin() ? '<a href="#/players" data-nav="/players">Players</a>' : ''}
        ${this.isAdmin() ? '<a href="#/families" data-nav="/families">Families</a>' : ''}
        ${this.isAdmin() ? '<a href="#/coaches" data-nav="/coaches">Coaches</a>' : ''}
        ${this.isAdmin() ? '<a href="#/settings" data-nav="/settings">Settings</a>' : ''}
      `;
      navUser.innerHTML = `
        <span>${this.currentUser.name} (${this.currentUser.role})</span>
        <button class="logout-btn" onclick="Auth.logout()">Logout</button>
      `;
    } else {
      navLinks.innerHTML = '';
      navUser.innerHTML = '';
    }
  },

  requireAuth() {
    if (!this.currentUser) {
      Router.navigate('/');
      return false;
    }
    return true;
  },

  requireRole(...roles) {
    if (!this.currentUser || !roles.includes(this.currentUser.role)) {
      Router.navigate('/');
      return false;
    }
    return true;
  }
};

window.Auth = Auth;
