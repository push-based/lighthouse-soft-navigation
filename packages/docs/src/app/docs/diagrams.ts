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

export const DIAGRAMS: Record<string, () => string> = {
  'hard-vs-soft': hardVsSoft,
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
