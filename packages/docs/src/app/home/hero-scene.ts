import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The hero illustration: the same two-step user flow run twice. On stock
 * Lighthouse the soft navigation step waits for a page load and fails with
 * NO_FCP. Then the config is switched on, and the step is measured: FCP, LCP
 * and a Performance score. The whole scene tilts with the pointer through the
 * `--px`/`--py` variables set by the `docsTilt` directive on the hero.
 *
 * The animation is pure CSS so the server and the client render the same
 * markup. Under `prefers-reduced-motion` it shows the measured step.
 */
@Component({
  selector: 'docs-hero-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.scss',
  host: {
    role: 'img',
    'aria-label':
      'A user flow with two steps. The page load scores 88. On stock Lighthouse the soft navigation step waits for a page load and fails with NO_FCP. With the config it is measured: FCP 0.4 seconds, LCP 0.7 seconds and a Performance score of 97.',
  },
})
export class HeroScene {}
