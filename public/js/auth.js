// Single source of truth for nav links. `primary: true` links stay visible on
// the desktop bar; the rest collapse into the "More ▾" dropdown. On mobile all
// links render as one flat list in the hamburger panel.
// `resource: null` = visible to any non-pending logged-in user.
const NAV_LINKS = [
  { label: 'Dashboard', path: '/',          resource: null,        primary: true },
  { label: 'Schedule',  path: '/schedule',  resource: null,        primary: true },
  { label: 'Games',     path: '/games',     resource: 'games',     primary: true },
  { label: 'Teams',     path: '/teams',     resource: 'teams' },
  { label: 'Opponents', path: '/opponents', resource: 'opponents' },
  { label: 'Seasons',   path: '/seasons',   resource: 'seasons' },
  { label: 'Players',   path: '/players',   resource: 'players' },
  { label: 'Families',  path: '/families',  resource: 'families' },
  { label: 'Coaches',   path: '/coaches',   resource: 'coaches' },
  { label: 'Events',    path: '/events',    resource: 'events' },
  { label: 'Settings',  path: '/settings',  resource: 'settings' },
  { label: 'Users',     path: '/users',     adminOnly: true },
];

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

  isCoach() {
    return this.currentUser?.role === 'coach';
  },

  isFamily() {
    return this.currentUser?.role === 'family';
  },

  // Nav links the current user is allowed to see (empty for pending users).
  visibleNavLinks() {
    if (!this.currentUser || this.isPending()) return [];
    return NAV_LINKS.filter(l => {
      if (l.adminOnly) return this.isAdmin();
      if (!l.resource) return true;
      return this.can(l.resource, 'view');
    });
  },

  renderNavLink(link) {
    return `<a href="#${link.path}" data-nav="${link.path}" onclick="Auth.closeMenus()">${link.label}</a>`;
  },

  updateUI() {
    const navLinks = document.getElementById('navLinks');
    const navUser = document.getElementById('navUser');
    const navToggle = document.getElementById('navToggle');
    const navPanel = document.getElementById('navMobilePanel');

    this.closeMenus();

    if (this.currentUser) {
      const visible = this.visibleNavLinks();
      const primary = visible.filter(l => l.primary);
      const overflow = visible.filter(l => !l.primary);

      // Desktop bar: primary links + "More ▾" dropdown for the rest
      navLinks.innerHTML = `
        ${primary.map(l => this.renderNavLink(l)).join('')}
        ${overflow.length ? `
          <div class="nav-dropdown">
            <button class="nav-more-btn" onclick="Auth.toggleMoreMenu(event)">More &#9662;</button>
            <div class="nav-dropdown-menu hidden" id="navMoreMenu">
              ${overflow.map(l => this.renderNavLink(l)).join('')}
            </div>
          </div>` : ''}
      `;
      navUser.innerHTML = `
        <span>${escapeHtml(this.currentUser.name)} (${this.currentUser.role})</span>
        <button class="logout-btn" onclick="Auth.logout()">Logout</button>
      `;

      // Mobile hamburger panel: all links flat, then user info + logout
      navToggle.classList.remove('hidden');
      navPanel.innerHTML = `
        ${visible.map(l => this.renderNavLink(l)).join('')}
        <div class="nav-panel-divider"></div>
        <div class="nav-panel-user">
          <span>${escapeHtml(this.currentUser.name)} (${this.currentUser.role})</span>
          <button class="logout-btn" onclick="Auth.logout()">Logout</button>
        </div>
      `;
    } else {
      navLinks.innerHTML = '';
      navUser.innerHTML = '';
      navToggle.classList.add('hidden');
      navPanel.innerHTML = '';
    }
  },

  toggleMoreMenu(e) {
    e.stopPropagation();
    document.getElementById('navMobilePanel').classList.remove('open');
    document.getElementById('navMoreMenu')?.classList.toggle('hidden');
  },

  toggleMobileNav(e) {
    e.stopPropagation();
    document.getElementById('navMoreMenu')?.classList.add('hidden');
    const panel = document.getElementById('navMobilePanel');
    const open = panel.classList.toggle('open');
    document.getElementById('navToggle').setAttribute('aria-expanded', open);
  },

  closeMenus() {
    document.getElementById('navMoreMenu')?.classList.add('hidden');
    document.getElementById('navMobilePanel')?.classList.remove('open');
    document.getElementById('navToggle')?.setAttribute('aria-expanded', 'false');
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

// Close open nav menus when clicking outside them or pressing Escape.
// Installed once; menu elements are re-rendered by updateUI but these
// listeners live on document so they survive re-renders.
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-dropdown')) {
    document.getElementById('navMoreMenu')?.classList.add('hidden');
  }
  if (!e.target.closest('#navMobilePanel') && !e.target.closest('#navToggle')) {
    Auth.closeMenus();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') Auth.closeMenus();
});
