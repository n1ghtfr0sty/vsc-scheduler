const Router = {
  routes: {},

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  },

  route(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = path;
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0];

    let handler = this.routes[path];
    
    if (!handler) {
      const dynamicRoutes = Object.keys(this.routes).filter(r => r.includes(':'));
      for (const route of dynamicRoutes) {
        const params = this.matchRoute(route, path);
        if (params) {
          handler = () => this.routes[route](params);
          break;
        }
      }
    }

    if (handler) {
      handler();
    } else {
      this.routes['/']();
    }

    document.querySelectorAll('[data-nav]').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === path);
    });
  },

  matchRoute(route, path) {
    const routeParts = route.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) return null;
    
    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  },

  getParams() {
    const hash = window.location.hash.slice(1);
    const [path, query] = hash.split('?');
    const params = {};
    if (query) {
      new URLSearchParams(query).forEach((value, key) => {
        params[key] = value;
      });
    }
    return params;
  }
};

window.Router = Router;
