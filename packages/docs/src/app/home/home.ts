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
  imports: [RouterLink, HeroScene, Reveal, Tilt],
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
