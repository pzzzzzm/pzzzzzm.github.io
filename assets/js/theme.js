// Site-wide light/dark theme switch.
// Applied as <html data-theme="light" | "dark">; persisted in localStorage
// under "pzz-theme" so the choice carries across pages of the site.
//
// Include this file synchronously in <head> (NOT deferred) BEFORE any
// stylesheet so the data-theme attribute is set before styles compute,
// preventing a light-to-dark flash on dark-mode pages.
//
// HTML hook: any <button class="theme-toggle"> on the page becomes a
// toggle automatically — no per-page wiring needed.

(function () {
  const KEY = 'pzz-theme';
  const html = document.documentElement;

  function getTheme() {
    return localStorage.getItem(KEY) || 'light';
  }

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    // Best-effort hook for Bootstrap 5.3+ apps (no-op on 5.2 etc.).
    html.setAttribute('data-bs-theme', theme);
  }

  function refreshButtons() {
    const t = getTheme();
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-label',
        t === 'dark' ? 'switch to light theme' : 'switch to dark theme');
      btn.setAttribute('title',
        t === 'dark' ? 'switch to light theme' : 'switch to dark theme');
    });
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, next);
    applyTheme(next);
    refreshButtons();
  }

  // Apply ASAP, before any stylesheet — this is what kills the FOUC.
  applyTheme(getTheme());

  // Wire up buttons once the DOM is ready.
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }
  onReady(() => {
    refreshButtons();
    // Event delegation so dynamically inserted buttons also work.
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-toggle');
      if (btn) toggleTheme();
    });
    // React to changes in other tabs.
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) {
        applyTheme(getTheme());
        refreshButtons();
      }
    });
  });
})();
