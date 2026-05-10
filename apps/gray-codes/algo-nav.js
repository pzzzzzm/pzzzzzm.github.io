// Shared algorithm-picker dropdown for the gray-codes apps.
// Single source of truth for the algorithm list (name / tag / href / dim
// state). Each app's index.html imports `renderAlgoPicker` and points it
// at a mount element with the page's own `currentId` — no duplicated
// dropdown HTML across pages.

export const algorithms = [
  {
    id: 'soda',
    name: 'Pivot Gray Codes for Spanning Trees of K<sub>n</sub>',
    tag:  'SODA 2026',
    href: '../soda-spanning-trees/',
  },
  {
    id: 'iwoca',
    name: 'Rotation Gray Codes for Stamp Foldings &amp; Semi-meanders',
    tag:  'IWOCA 2023 · TCS',
    href: '../iwoca-stamp-folding/',
  },
  {
    id: 'lucas',
    name: 'Lucas / Fibonacci words',
    tag:  'CPM 2025',
    dim: true,
  },
  {
    id: 'motzkin',
    name: 'Grand Motzkin / Dyck',
    tag:  'LATIN 2026',
    dim: true,
  },
  {
    id: 'fib',
    name: 'Fibonacci q-decreasing',
    tag:  'WALCOM 2024',
    dim: true,
  },
];

const CHEVRON_SVG = '<svg class="algo-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>';

function optionHTML(a, currentId) {
  const inner =
    `<span class="algo-name">${a.name}</span>` +
    `<span class="algo-tag">${a.tag}</span>`;
  if (a.dim) return `<span class="algo dim">${inner}</span>`;
  const cls = a.id === currentId ? 'algo current' : 'algo';
  return `<a class="${cls}" href="${a.href}">${inner}</a>`;
}

// Mount the dropdown into `mount`. `currentId` selects which algorithm's
// summary text + tag appear in the closed-state header (and which entry
// gets the .current highlight in the expanded list).
export function renderAlgoPicker(mount, currentId) {
  const current = algorithms.find(a => a.id === currentId);
  if (!mount || !current) return;
  mount.innerHTML = `
    <details class="algo-select">
      <summary class="algo-summary">
        <span class="algo-summary-text">
          <span class="algo-name">${current.name}</span>
          <span class="algo-tag">${current.tag}</span>
        </span>
        ${CHEVRON_SVG}
      </summary>
      <nav class="algos">
        ${algorithms.map(a => optionHTML(a, currentId)).join('')}
      </nav>
    </details>
  `;
}
