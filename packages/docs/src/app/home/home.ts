import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { DOCS_NAV, SECTION_ICONS } from '../docs/nav';
import { HeroScene } from './hero-scene';
import { Reveal } from '../shared/reveal';
import { Tilt } from '../shared/tilt';
import { HowItWorks } from './how-it-works';
import { ReportPreview } from './report-preview';
import { PACKAGE_VERSION } from '../../content/version.generated';

/** Typing speed of the hero terminal, per character, and the pause between commands. */
const CHAR_MS = 34;
const GAP_MS = 420;
const FIRST_COMMAND_MS = 900;

const COMMANDS = [
  'npm i @push-based/lighthouse-soft-navigation',
  'node flow.mjs',
];

@Component({
  selector: 'docs-home',
  imports: [RouterLink, HeroScene, Reveal, Tilt, HowItWorks, ReportPreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  readonly sections = DOCS_NAV;
  readonly sectionIcons = SECTION_ICONS;
  readonly version = PACKAGE_VERSION;
  readonly install = COMMANDS[0];

  /** The headline, one word at a time so each can rise into place. */
  readonly titleWords = [
    { text: 'Soft' },
    { text: 'navigations,' },
    { text: 'measured' },
    { text: 'as', accent: true },
    { text: 'navigations.', accent: true },
  ];

  /** The hero terminal: each command types itself out after the previous one. */
  readonly commands = (() => {
    const lines: { text: string; chars: number; start: number }[] = [];
    let start = FIRST_COMMAND_MS;
    for (const text of COMMANDS) {
      lines.push({ text, chars: text.length, start });
      start += text.length * CHAR_MS + GAP_MS;
    }
    return lines;
  })();

  /** When the last command has been typed and its output can begin. */
  readonly outputStart = (() => {
    const last = this.commands[this.commands.length - 1];
    return last.start + last.chars * CHAR_MS + 500;
  })();

  readonly copied = signal(false);

  /** Bumped by the replay button; the terminal re-renders and types again. */
  readonly runs = signal(0);

  replay() {
    this.runs.update((n) => n + 1);
  }

  readonly benefits = [
    {
      icon: 'gauge',
      title: 'A score for every route change',
      body: 'A click that only changes the route is a navigation step with FCP, LCP, Speed Index, TBT and a Performance score, instead of a NO_FCP error.',
    },
    {
      icon: 'zap',
      title: 'One config, no flag',
      body: 'Pass softNavigationConfig() to startFlow. The package recognises a soft navigation from what the browser does, so your steps stay as they are.',
    },
    {
      icon: 'layers',
      title: 'Stock Lighthouse underneath',
      body: "The metrics come from Lighthouse's own audits and scoring curves. The package only supplies the events they need, with the click as time origin.",
    },
    {
      icon: 'check',
      title: 'Every category scored',
      body: 'Audits of the document response do not apply to a route change and report notApplicable, so no audit errors and no missing scores.',
    },
    {
      icon: 'mix',
      title: 'Mixes with every step',
      body: 'Page loads, timespans and snapshots run exactly as before. Measure the route change, then the interactions on the new page, in one flow.',
    },
    {
      icon: 'pr',
      title: 'Built to land in Lighthouse',
      body: 'Each override maps to a change in Lighthouse itself, and the result has the shape upstream support will produce. Swapping later is mechanical.',
    },
  ];

  /** Line icons for the benefits, on a 24px grid. */
  readonly icons: Record<string, string[]> = {
    gauge: ['M3.5 18a9 9 0 1 1 17 0', 'm12 15 3.5-3.5', 'M12 15h.01'],
    zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
    layers: ['m12 2 10 5-10 5L2 7l10-5z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
    check: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'm8 12 3 3 5-6'],
    mix: ['M16 3h5v5', 'M4 20 21 3', 'M21 16v5h-5', 'M15 15l6 6', 'M4 4l5 5'],
    pr: [
      'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M13 6h3a2 2 0 0 1 2 2v7',
      'M6 9v12',
    ],
  };

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

  async copyInstall() {
    try {
      await navigator.clipboard.writeText(this.install);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  }
}
