import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The hero illustration: a browser window that soft navigates. The cursor
 * clicks a card, the URL changes without a new document, the next view
 * renders in place, and the metrics of the soft navigation step pop in below.
 * The whole scene tilts with the pointer through the `--px`/`--py` variables
 * set by the `docsTilt` directive on the hero.
 *
 * The animation is pure CSS so the server and the client render the same
 * markup, and it stops under `prefers-reduced-motion`.
 */
@Component({
  selector: 'docs-hero-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.scss',
  host: {
    role: 'img',
    'aria-label':
      'A browser window: a click on a product card changes the URL from / to /products without loading a document, the product list renders in place, and the step reports FCP, LCP and a Performance score.',
  },
})
export class HeroScene {
  readonly metrics = [
    { label: 'FCP', value: '0.4 s' },
    { label: 'LCP', value: '0.7 s' },
    { label: 'Performance', value: '97', score: true },
  ];

  readonly cards = [0, 1, 2];
  readonly rows = [0, 1, 2, 3];
}
