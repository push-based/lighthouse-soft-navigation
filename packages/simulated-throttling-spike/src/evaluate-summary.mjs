/**
 * Per configuration: for FCP and LCP, the median of the absolute error against DevTools throttling
 * over every run, and the share of runs within 20 % of it. Speed Index and TTI get the median
 * absolute error only, since neither is defined the same way under both methods for a soft
 * navigation (see the README). TBT is left out: a reference of 0 ms makes any value an infinite
 * error.
 */
export function summarize(rows, configurations) {
  const lines = [
    '| Configuration | FCP, median abs. error | LCP, median abs. error | FCP and LCP within 20 % | Speed Index, median abs. error | TTI, median abs. error |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const configuration of configurations) {
    const errors = (id) =>
      rows
        .filter((row) => row.reference[id])
        .map((row) => {
          const value = row.lantern[configuration]?.[id];
          return typeof value === 'number'
            ? Math.abs(value - row.reference[id]) / row.reference[id]
            : null;
        });
    const cell = (id) => {
      const values = errors(id);
      const numbers = values.filter((value) => value !== null);
      if (!numbers.length) return 'error';
      const failed = values.length - numbers.length;
      return `${Math.round(median(numbers) * 100)} %${failed ? ` (${failed} failed)` : ''}`;
    };
    const paints = [...errors('fcp'), ...errors('lcp')];
    const within = paints.filter(
      (error) => error !== null && error <= 0.2,
    ).length;
    lines.push(
      `| ${configuration} | ${cell('fcp')} | ${cell('lcp')} | ${paints.length ? Math.round((within / paints.length) * 100) : 0} % | ${cell('si')} | ${cell('tti')} |`,
    );
  }
  return lines.join('\n');
}

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
