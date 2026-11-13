import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ALL_DOC_PAGES } from '../docs/nav';
import { HeroScene } from './hero-scene';
import { Reveal } from '../shared/reveal';
import { Tilt } from '../shared/tilt';
import { PACKAGE_VERSION } from '../../content/version.generated';

/** The code in the hero, as the copy button hands it out. */
const SNIPPET = `import { softNavigationConfig } from '@push-based/lighthouse-soft-navigation';

const flow = await startFlow(page, { config: softNavigationConfig() });

// A click that only changes the route is a navigation step.
await flow.navigate(() => page.click('a.product-link'), {
  throttlingMethod: 'devtools',
});
`;

@Component({
  selector: 'docs-home',
  imports: [RouterLink, HeroScene, Reveal, Tilt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly pages = ALL_DOC_PAGES;
  readonly version = PACKAGE_VERSION;

  /** The headline, one word at a time so each can rise into place. */
  readonly titleWords = [
    { text: 'Soft' },
    { text: 'navigations,' },
    { text: 'measured' },
    { text: 'as', accent: true },
    { text: 'navigations.', accent: true },
  ];

  readonly copied = signal(false);

  constructor() {
    const title =
      'lighthouse-soft-navigation · Soft navigations, measured as navigations';
    const description =
      'Measure soft navigations as navigation steps of a Lighthouse user flow, with FCP, LCP and a Performance score, on stock Lighthouse.';
    const meta = inject(Meta);
    inject(Title).setTitle(title);
    meta.updateTag({ name: 'description', content: description });
    meta.updateTag({ property: 'og:title', content: title });
    meta.updateTag({ property: 'og:description', content: description });
  }

  async copySnippet() {
    try {
      await navigator.clipboard.writeText(SNIPPET);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      // Clipboard access can be denied; the code stays selectable.
    }
  }
}
