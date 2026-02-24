const Auth = {
  currentUser: null,
  // permissions is an object like { games: { view, create, edit, delete }, ... }
  // null means admin (admin bypasses all checks via can())
  permissions: {},

  async init() {
    try {
      const data = await API.auth.me();
      this.currentUser = data.user;
      this.permissions = data.permissions || {};
      this.updateUI();
      return true;
    } catch (err) {
      this.currentUser = null;
      this.permissions = {};
      return false;
    }
  },

  async login(email, password) {
    const data = await API.auth.login(email, password);
    this.currentUser = data.user;
    this.permissions = data.permissions || {};
    this.updateUI();
    return data.user;
  },

  // Role is not sent on register — backend always assigns 'pending'
  async register(email, password, name, phone) {
    const data = await API.auth.register(email, password, name, phone);
    this.currentUser = data.user;
    this.permissions = data.permissions || {};
    this.updateUI();
    return data.user;
  },

  async logout() {
    await API.auth.logout();
    this.currentUser = null;
    this.permissions = {};
    localStorage.removeItem('token');
    Router.navigate('/');
    this.updateUI();
  },

  // Returns true if the current user has a specific permission on a resource.
  // Admins (permissions === null) always return true.
  can(resource, action) {
    if (this.currentUser?.role === 'admin') return true;
    return !!this.permissions[resource]?.[action];
  },

  isPending() {
    return this.currentUser?.role === 'pending';
  },

  isAdmin() {
    return this.currentUser?.role === 'admin';
  },

  updateUI() {
    const navLinks = document.getElementById('navLinks');
    const navUser = document.getElementById('navUser');

    if (this.currentUser) {
      if (this.isPending()) {
        // Pending users see no nav links — they only see the pending approval page
        navLinks.innerHTML = '';
      } else {
        navLinks.innerHTML = `
          <a href="#/" data-nav="/">Dashboard</a>
          <a href="#/schedule" data-nav="/schedule">Schedule</a>
          ${this.can('games', 'view')    ? '<a href="#/games" data-nav="/games">Games</a>' : ''}
          ${this.can('teams', 'view')    ? '<a href="#/teams" data-nav="/teams">Teams</a>' : ''}
          ${this.can('opponents', 'view')? '<a href="#/opponents" data-nav="/opponents">Opponents</a>' : ''}
          ${this.can('seasons', 'view')  ? '<a href="#/seasons" data-nav="/seasons">Seasons</a>' : ''}
          ${this.can('players', 'view')  ? '<a href="#/players" data-nav="/players">Players</a>' : ''}
          ${this.can('families', 'view') ? '<a href="#/families" data-nav="/families">Families</a>' : ''}
          ${this.can('coaches', 'view')  ? '<a href="#/coaches" data-nav="/coaches">Coaches</a>' : ''}
          ${this.can('settings', 'view') ? '<a href="#/settings" data-nav="/settings">Settings</a>' : ''}
          ${this.isAdmin()               ? '<a href="#/users" data-nav="/users">Users</a>' : ''}
        `;
      }
      navUser.innerHTML = `
        <span>${this.currentUser.name} (${this.currentUser.role})</span>
        <button class="logout-btn" onclick="Auth.logout()">Logout</button>
      `;
    } else {
      navLinks.innerHTML = '';
      navUser.innerHTML = '';
    }
  },

  // Redirects to login if not authenticated, or to /pending if account is pending.
  requireAuth() {
    if (!this.currentUser) {
      Router.navigate('/');
      return false;
    }
    if (this.isPending()) {
      Router.navigate('/pending');
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
