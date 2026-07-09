# Responsive Navigation Redesign — Design Spec

**Date:** 2026-07-08
**Status:** Approved (user selected options via brainstorming Q&A)

## Problem

The navbar renders up to 12 button-style links for an admin. On desktop this is
cluttered; below 768px the current CSS stacks the navbar vertically and wraps
all buttons into a centered blob that can consume half a phone screen.

## Decisions (from brainstorming)

1. **Hybrid layout** — desktop keeps a small set of primary buttons plus a
   "More ▾" dropdown; mobile collapses everything into a hamburger (☰)
   slide-down panel.
2. **Primary desktop links:** Dashboard, Schedule, Games ("scheduling trio").
   All other permitted links (Teams, Players, Families, Coaches, Opponents,
   Seasons, Events, Settings, Users) go into More ▾.
3. **Mobile user info:** user name and Logout live at the bottom of the
   hamburger panel below a divider. The mobile top bar is brand + ☰ only.

## Behavior

### Desktop (>768px)
- Bar: brand | Dashboard, Schedule, Games (permission-filtered) | More ▾ | user + Logout.
- More ▾ renders only when the role permits at least one overflow link.
- More ▾ opens on click (not hover), closes on outside click, Escape, or
  choosing a link.

### Mobile (≤768px)
- Bar: brand + ☰ toggle only. Desktop links and nav-user hidden.
- ☰ toggles a full-width slide-down panel: all permitted links as a flat list
  (the trio is not special on mobile), divider, user name, Logout.
- Panel closes on link tap, outside tap, Escape, or navigation.
- The existing ≤768px "stack and wrap" navbar rules are removed.

### Unchanged
- Permission filtering per link (`Auth.can(resource, 'view')`), Users link
  admin-only.
- Pending users: no links (hamburger shows only name + Logout).
- Logged out: no links, no user section.
- Active-page highlighting: router toggles `.active` on all `[data-nav]`
  elements, which now includes dropdown and panel items.

## Implementation

No libraries, no build step. Follows existing conventions (globals on
`window`, inline `onclick` allowed by CSP `script-src-attr 'unsafe-inline'`).

1. **public/index.html** — add ☰ toggle button and empty mobile panel
   container inside `<nav>`.
2. **public/js/auth.js** — refactor `updateUI()`:
   - Define nav links once as a data array `{label, path, resource}`
     (single source of truth; kills duplicated template strings).
   - Render three targets: primary trio, More ▾ dropdown, mobile panel.
   - Add one global listener (installed once) for outside-click and Escape
     to close open menus.
3. **public/css/style.css** — dropdown + hamburger + slide-down panel styles
   using existing CSS variables (gold hover, dark card background); replace
   the ≤768px navbar rules.

## Testing (manual — no test framework in project)

- Resize through 768px breakpoint; verify bar ↔ hamburger switch.
- Roles: admin (12 links; More ▾ present), coach/family (fewer links;
  More ▾ only if overflow permitted), pending (no links), logged out.
- Menus close on outside click, Escape, and navigation.
- Active highlighting works in bar, dropdown, and panel.
- No CSP console errors.
