// Toggle the narrow-screen sidebar drawer. The drawer is only relevant at
// max-width:880px (handled by CSS). This script wires up:
//   - hamburger button click → toggle body.sidebar-open
//   - scrim click           → close drawer
//   - Escape key            → close drawer
//   - resize >880px         → auto-close so the wide layout is clean
//
// Loaded as a classic script (not a module) via <script src="..."> in
// <head>; runs on DOMContentLoaded.

(function () {
  function init() {
    const toggle = document.querySelector('.sidebar-toggle');
    const scrim  = document.querySelector('.sidebar-scrim');
    const body   = document.body;
    if (!toggle || !scrim) return;

    const open  = () => { body.classList.add('sidebar-open');    toggle.setAttribute('aria-expanded', 'true');  };
    const close = () => { body.classList.remove('sidebar-open'); toggle.setAttribute('aria-expanded', 'false'); };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (body.classList.contains('sidebar-open')) close();
      else open();
    });

    scrim.addEventListener('click', close);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && body.classList.contains('sidebar-open')) close();
    });

    // Auto-close when crossing back into wide-screen layout.
    const mq = window.matchMedia('(min-width: 881px)');
    const onChange = (e) => { if (e.matches) close(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);   // Safari fallback
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
