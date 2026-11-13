import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../shared/reveal';

/**
 * Four steps from install to a measured route change. When the strip scrolls into view a line
 * draws itself through the step markers, which pop in one after another;
 * afterwards a pulse keeps travelling along the line.
 */
@Component({
  selector: 'docs-how-it-works',
  imports: [RouterLink, Reveal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.scss',
})
export class HowItWorks {
  /** Line icons for the steps, on a 24px grid. */
  readonly icons: Record<string, string[]> = {
    terminal: ['m4 17 6-6-6-6', 'M12 19h8'],
    config: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
    pointer: ['M5 3l14 7-6 1.8L10 18z'],
    chart: ['M3 3v18h18', 'M8 17V9', 'M13 17V5', 'M18 17v-3'],
  };

  readonly steps = [
    {
      icon: 'terminal',
      title: 'Install',
      code: 'npm i @push-based/lighthouse-soft-navigation',
      body: 'Next to Lighthouse 13.6, with Chrome 149 or newer.',
      link: '/docs/getting-started/installation',
    },
    {
      icon: 'config',
      title: 'Pass the config',
      code: 'softNavigationConfig()',
      body: 'Give it to startFlow. Every other step runs exactly as before.',
      link: '/docs/reference/api',
    },
    {
      icon: 'pointer',
      title: 'Click a route',
      code: 'flow.navigate(() => page.click(…))',
      body: 'A navigation step that stays in the document is a soft navigation.',
      link: '/docs/guides/steps',
    },
    {
      icon: 'chart',
      title: 'Read the step',
      code: 'FCP · LCP · Performance',
      body: 'Stock metrics and scoring, measured from the click.',
      link: '/docs/guides/results',
    },
  ];
}
