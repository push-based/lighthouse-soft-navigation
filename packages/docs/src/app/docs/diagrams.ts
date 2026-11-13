/**
 * Diagrams drawn inline in the docs, placed with `<!-- diagram: name -->` in
 * Markdown. They are SVG that uses the site's colour roles, so they follow the
 * theme, and they animate in through the reveal styles in `_diagrams.scss`.
 */

type Kind = 'info' | 'accent' | 'success' | 'warning' | 'plain';

/** A box with a title and an optional note, revealed in order `n`. */
function box(
  x: number,
  y: number,
  w: number,
  title: string,
  note: string | null,
  kind: Kind,
  n: number,
  h = note ? 56 : 40,
): string {
  const titleY = note ? 24 : h / 2 + 5;
  return `<g class="dg-box dg-pop dg-box-${kind}" style="--n:${n}" transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="10"/><text x="${w / 2}" y="${titleY}" text-anchor="middle" class="dg-strong">${title}</text>${
    note
      ? `<text x="${w / 2}" y="${titleY + 18}" text-anchor="middle" class="dg-note">${note}</text>`
      : ''
  }</g>`;
}

/** A straight arrow from (x1, y1) to (x2, y2), horizontal or vertical, drawn in order `n`. */
function arrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  n: number,
): string {
  const horizontal = y1 === y2;
  const dir = horizontal ? Math.sign(x2 - x1) : Math.sign(y2 - y1);
  const head = horizontal
    ? `M${x2 - 7 * dir} ${y2 - 5} L${x2} ${y2} L${x2 - 7 * dir} ${y2 + 5}`
    : `M${x2 - 5} ${y2 - 7 * dir} L${x2} ${y2} L${x2 + 5} ${y2 - 7 * dir}`;
  return `<path class="dg-link" style="--n:${n}" pathLength="1" d="M${x1} ${y1} L${x2} ${y2}"/><path class="dg-link dg-arrowhead" style="--n:${n}" pathLength="1" d="${head}"/>`;
}

/** A label above an arrow. */
const label = (x: number, y: number, text: string) =>
  `<text class="dg-note" x="${x}" y="${y}" text-anchor="middle">${text}</text>`;

/** Two lanes: what a page load and a soft navigation go through after a click. */
function hardVsSoft(): string {
  const w = 132;
  const gap = 28;
  const lane = (y: number, steps: [string, string, Kind][], n0: number) =>
    steps
      .map(([title, note, kind], i) => {
        const x = 130 + i * (w + gap);
        const link = i ? arrow(x - gap + 2, y + 28, x - 3, y + 28, n0 + i) : '';
        return link + box(x, y, w, title, note, kind, n0 + i);
      })
      .join('');
  return `<figure class="diagram diagram-svg" role="img" aria-label="After a click, a page load requests a new document, parses it, paints and fires the load event. A soft navigation updates the URL with pushState, fetches data and renders the new view into the same document: there is no document request and no load event.">
<svg viewBox="0 0 770 196" class="dg-svg">
<text class="dg-lane" x="0" y="44">Page load</text>
<text class="dg-note" x="0" y="62">new document</text>
${lane(
  16,
  [
    ['Click', 'user input', 'plain'],
    ['GET /products', 'document request', 'info'],
    ['Parse, render', 'new document', 'info'],
    ['FCP, LCP, load', 'page load events', 'success'],
  ],
  0,
)}
<text class="dg-lane" x="0" y="144">Soft navigation</text>
<text class="dg-note" x="0" y="162">same document</text>
${lane(
  116,
  [
    ['Click', 'user input', 'plain'],
    ['pushState', 'URL changes', 'accent'],
    ['fetch /api', 'data, scripts', 'accent'],
    ['Render the view', 'soft FCP, LCP', 'success'],
  ],
  4,
)}
</svg>
</figure>`;
}

/** How the package decides whether a navigation step is a soft navigation. */
function detection(): string {
  return `<figure class="diagram diagram-svg" role="img" aria-label="During a navigation step, if the main frame navigates within the document and no document starts loading, the step is a soft navigation. If the main frame does not navigate within the document, or a document starts loading, stock Lighthouse measures a page load.">
<svg viewBox="0 0 740 220" class="dg-svg">
${box(0, 30, 150, 'Navigation step', 'callback or start…end', 'plain', 0)}
${arrow(152, 58, 196, 58, 1)}
${box(198, 30, 200, 'Navigated within', 'the document?', 'info', 1)}
${label(430, 50, 'yes')}
${arrow(400, 58, 458, 58, 2)}
${box(460, 30, 200, 'A document starts', 'loading?', 'info', 2)}
${label(682, 50, 'no')}
${arrow(662, 58, 700, 58, 3)}
<g class="dg-box dg-pop dg-box-accent" style="--n:4" transform="translate(560 120)"><rect width="176" height="56" rx="10"/><text x="88" y="24" text-anchor="middle" class="dg-strong">Soft navigation</text><text x="88" y="42" text-anchor="middle" class="dg-note">measured from the click</text></g>
<path class="dg-link" style="--n:3" pathLength="1" d="M700 58 H720 V118"/><path class="dg-link dg-arrowhead" style="--n:3" pathLength="1" d="M715 111 L720 118 L725 111"/>
${label(286, 108, 'no')}
${arrow(298, 88, 298, 140, 3)}
${label(572, 108, 'yes')}
<path class="dg-link" style="--n:3" pathLength="1" d="M560 88 V100 H400 V146"/>
<path class="dg-link dg-arrowhead" style="--n:3" pathLength="1" d="M395 139 L400 146 L405 139"/>
${box(198, 150, 260, 'Page load', 'stock Lighthouse, unchanged', 'warning', 4)}
</svg>
</figure>`;
}

/** The time line of a soft navigation step, and what the metrics are measured from. */
function timeline(): string {
  const marks: [number, string, string, string][] = [
    [40, 'Step starts', 'trace recording', 'var(--text-subtle)'],
    [170, 'Click', 'time origin', 'var(--accent)'],
    [270, 'URL change', 'DCL, load', 'var(--color-info-500)'],
    [400, 'FCP', 'first new paint', 'var(--color-success-500)'],
    [520, 'LCP', 'largest new paint', 'var(--color-success-500)'],
    [690, 'Quiet', 'network and CPU', 'var(--text-subtle)'],
  ];
  const ticks = marks
    .map(
      ([x, title, note, color], i) =>
        `<g class="dg-pop" style="--n:${i};--dg-stroke:${color}"><line class="dg-tick" x1="${x}" y1="${70}" x2="${x}" y2="${92}"/><circle class="dg-dot" cx="${x}" cy="81" r="5"/><text class="dg-strong" x="${x}" y="122" text-anchor="middle">${title}</text><text class="dg-note" x="${x}" y="140" text-anchor="middle">${note}</text></g>`,
    )
    .join('');
  return `<figure class="diagram diagram-svg" role="img" aria-label="A soft navigation step on a time line: the trace starts, then the click that is the time origin, the URL change that stands in for DOMContentLoaded and load, the first contentful paint, the largest contentful paint, and finally network and CPU quiet. The metrics are measured from the click.">
<svg viewBox="0 0 740 160" class="dg-svg">
<rect class="dg-span dg-pop" style="--n:1" x="170" y="20" width="520" height="30" rx="8"/>
<text class="dg-note" x="430" y="40" text-anchor="middle">FCP, LCP, Speed Index, TBT and TTI are measured from the click</text>
<line class="dg-axis" x1="10" y1="81" x2="730" y2="81"/>
${ticks}
</svg>
</figure>`;
}

/** A small "package" or "stock" badge. */
const badge = (x: number, y: number, pkg: boolean) =>
  `<g class="dg-badge${pkg ? ' dg-badge-package' : ''}" transform="translate(${x} ${y})"><rect width="${pkg ? 60 : 46}" height="18" rx="9"/><text x="${pkg ? 30 : 23}" y="13" text-anchor="middle">${pkg ? 'package' : 'stock'}</text></g>`;

/** The parts of a Lighthouse run, and which ones the package replaces. */
function pipeline(): string {
  const w = 160;
  const gap = 36;
  const stages: [string, string, boolean][] = [
    ['Gatherers', 'SoftNavigation, Trace', true],
    ['Navigation runner', 'waits for the events', false],
    ['Trace processor', 'time origin, FCP, LCP', false],
    ['Metric audits', 'FCP, LCP, SI, TBT, TTI', false],
    ['Other audits', 'document audits wrapped', true],
  ];
  const nodes = stages
    .map(([title, note, pkg], i) => {
      const x = i * (w + gap) - (i > 2 ? 3 * (w + gap) : 0);
      const y = i > 2 ? 130 : 20;
      return `${box(x, y, w, title, note, pkg ? 'accent' : 'plain', i, 64)}<g class="dg-pop" style="--n:${i}">${badge(x + w - (pkg ? 66 : 52), y - 9, pkg)}</g>`;
    })
    .join('');
  return `<figure class="diagram diagram-svg" role="img" aria-label="The package replaces the gatherers and wraps the audits that need the document request. The navigation runner, the trace processor and the metric audits are stock Lighthouse.">
<svg viewBox="-4 0 ${3 * w + 2 * gap + 8} 214" class="dg-svg">
${arrow(w + 2, 52, w + gap - 3, 52, 1)}
${arrow(2 * w + gap + 2, 52, 2 * (w + gap) - 3, 52, 2)}
<path class="dg-link" style="--n:3" pathLength="1" d="M${2 * (w + gap) + w / 2} 84 V104 H${w / 2} V119"/><path class="dg-link dg-arrowhead" style="--n:3" pathLength="1" d="M${w / 2 - 5} 112 L${w / 2} 119 L${w / 2 + 5} 112"/>
${arrow(w + 2, 162, w + gap - 3, 162, 4)}
${nodes}
<g class="dg-pop" style="--n:5" transform="translate(${2 * (w + gap)} 130)"><rect class="dg-span" width="${w}" height="64" rx="10"/><text x="${w / 2}" y="28" text-anchor="middle" class="dg-strong">Flow result</text><text x="${w / 2}" y="46" text-anchor="middle" class="dg-note">a navigation step</text></g>
${arrow(2 * w + gap + 2, 162, 2 * (w + gap) - 3, 162, 5)}
</svg>
</figure>`;
}

export const DIAGRAMS: Record<string, () => string> = {
  'hard-vs-soft': hardVsSoft,
  detection,
  timeline,
  pipeline,
};

/** The Lighthouse icon for a measurement mode, inline, for use in tables and text. */
export function modeIcon(mode: string): string | null {
  const extra =
    mode === 'timespan'
      ? '<path d="M12 7v5l3.5 2"/>'
      : mode === 'snapshot'
        ? '<path d="m14.3 8 5.2 9M9.7 8h10.4M7.4 12l5.2-9M9.7 16 4.5 7M14.3 16H3.9M16.6 12l-5.2 9"/>'
        : mode === 'navigation'
          ? ''
          : null;
  if (extra === null) {
    return null;
  }
  return `<svg class="img-icon mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/>${extra}</svg>`;
}
