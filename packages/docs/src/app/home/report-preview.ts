import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../shared/reveal';

type Rating = 'pass' | 'average' | 'fail';

interface Gauge {
  category: string;
  /** A 0–100 score for navigations; passed and total audits for timespans and snapshots. */
  score?: number;
  passed?: number;
  total?: number;
}

interface Step {
  mode: 'navigation' | 'timespan' | 'snapshot';
  /** A navigation step that is a soft navigation. */
  soft?: boolean;
  name: string;
  kind: string;
  gauges: Gauge[];
}

/** Circumference of the gauge ring (r = 20). */
const RING = 125.66;

/**
 * A sample user flow report with a page load, a soft navigation and a timespan: one card per step, with Lighthouse-style gauges
 * that fill and count up when the report scrolls into view.
 */
@Component({
  selector: 'docs-report-preview',
  imports: [RouterLink, Reveal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-preview.html',
  styleUrl: './report-preview.scss',
})
export class ReportPreview {
  readonly ring = RING;

  readonly steps: Step[] = [
    {
      mode: 'navigation',
      name: 'Open the shop',
      kind: 'Navigation report · page load',
      gauges: [
        { category: 'Performance', score: 88 },
        { category: 'Accessibility', score: 100 },
        { category: 'Best practices', score: 96 },
        { category: 'SEO', score: 92 },
      ],
    },
    {
      mode: 'navigation',
      soft: true,
      name: 'Open the product list',
      kind: 'Navigation report · soft navigation',
      gauges: [
        { category: 'Performance', score: 97 },
        { category: 'Accessibility', score: 100 },
        { category: 'Best practices', score: 100 },
        { category: 'SEO', score: 100 },
      ],
    },
    {
      mode: 'timespan',
      name: 'Add to cart',
      kind: 'Timespan report',
      gauges: [
        { category: 'Performance', passed: 9, total: 10 },
        { category: 'Best practices', passed: 6, total: 6 },
      ],
    },
  ];

  ratio(gauge: Gauge): number {
    return gauge.score !== undefined
      ? gauge.score / 100
      : (gauge.passed ?? 0) / (gauge.total ?? 1);
  }

  /** Lighthouse thresholds: 90+ passes, 50+ is average; fractions pass only when every audit does. */
  rating(gauge: Gauge): Rating {
    const r = this.ratio(gauge);
    if (gauge.score !== undefined) {
      return r >= 0.9 ? 'pass' : r >= 0.5 ? 'average' : 'fail';
    }
    return r === 1 ? 'pass' : r >= 0.5 ? 'average' : 'fail';
  }

  value(gauge: Gauge): number {
    return gauge.score ?? gauge.passed ?? 0;
  }

  label(gauge: Gauge): string {
    return gauge.score !== undefined
      ? `${gauge.category}: ${gauge.score}`
      : `${gauge.category}: ${gauge.passed} of ${gauge.total} audits passed`;
  }
}
