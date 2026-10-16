// Reusable right-side slide-over drawer (full-screen sheet on mobile).
// Usage: Drawer.open('Title', htmlString, { onClose })
// Callers MUST escape user content in htmlString (see escapeHtml).

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

const Drawer = {
  root: null,          // current drawer element (null when closed)
  opener: null,        // element focused before opening; focus is restored here
  onClose: null,
  baseline: '',        // serialized form state used by the unsaved-change guard
  FOCUSABLE: 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',

  isOpen() {
    return this.root !== null;
  },

  open(title, html, { onClose = null } = {}) {
    // Replace any drawer already showing without restoring focus to the page behind it.
    if (this.root) this.close(true, { keepOpener: true });
    const opener = this.opener || document.activeElement;

    const root = document.createElement('div');
    root.className = 'drawer-root';
    root.innerHTML = `
      <div class="drawer-backdrop"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
        <div class="drawer-header">
          <h2 id="drawerTitle"></h2>
          <button type="button" class="drawer-close" aria-label="Close">&times;</button>
        </div>
        <div class="drawer-body"></div>
      </aside>
    `;
    root.querySelector('#drawerTitle').textContent = title;
    root.querySelector('.drawer-body').innerHTML = html;
    root.querySelector('.drawer-backdrop').addEventListener('click', () => this.close());
    root.querySelector('.drawer-close').addEventListener('click', () => this.close());
    root.addEventListener('keydown', (e) => this.trapTab(e));

    document.body.appendChild(root);
    document.body.classList.add('drawer-open');
    // Everything behind the drawer is unreachable by keyboard / assistive tech.
    document.getElementById('app')?.setAttribute('inert', '');

    this.root = root;
    this.opener = opener;
    this.onClose = onClose;
    this.keyHandler = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        this.close();
      }
    };
    document.addEventListener('keydown', this.keyHandler);

    this.snapshot();
    requestAnimationFrame(() => root.classList.add('open'));

    const first = root.querySelector('.drawer-body input:not([type="hidden"]), .drawer-body select, .drawer-body textarea');
    (first || root.querySelector('.drawer-close')).focus({ preventScroll: true });
    return root;
  },

  // Record the current form state as "clean". Call after programmatic setup of field values.
  snapshot() {
    this.baseline = this.serialize();
  },

  serialize() {
    const form = this.root?.querySelector('form');
    return form ? new URLSearchParams(new FormData(form)).toString() : '';
  },

  isDirty() {
    return this.root !== null && this.serialize() !== this.baseline;
  },

  // Close the drawer. Unless force is true, asks before discarding unsaved changes.
  // Returns true if the drawer was closed.
  close(force = false, { keepOpener = false } = {}) {
    const root = this.root;
    if (!root) return true;
    if (!force && this.isDirty() && !confirm('Discard unsaved changes?')) return false;

    const onClose = this.onClose;
    const opener = this.opener;
    this.root = null;
    this.onClose = null;
    this.baseline = '';
    document.removeEventListener('keydown', this.keyHandler);
    document.body.classList.remove('drawer-open');
    document.getElementById('app')?.removeAttribute('inert');

    // Animate out, then drop the node.
    root.classList.remove('open');
    root.classList.add('closing');
    setTimeout(() => root.remove(), 250);

    if (keepOpener) {
      this.opener = opener;
    } else {
      this.opener = null;
      if (opener && opener.isConnected && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      }
    }
    if (onClose) onClose();
    return true;
  },

  // Keep Tab / Shift+Tab inside the drawer.
  trapTab(e) {
    if (e.key !== 'Tab' || !this.root) return;
    const items = [...this.root.querySelectorAll(this.FOCUSABLE)].filter(el => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !this.root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !this.root.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
};

window.Drawer = Drawer;
