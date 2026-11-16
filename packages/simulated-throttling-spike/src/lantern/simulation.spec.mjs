import { describe, expect, it } from 'vitest';
import { sentWhileAnotherWasInFlight, warmOrigins } from './simulation.mjs';

function request(url, start, end, connectionReused) {
  return {
    url,
    parsedURL: { securityOrigin: new URL(url).origin, scheme: 'https' },
    networkRequestTime: start,
    networkEndTime: end,
    connectionReused,
  };
}

describe('warmOrigins', () => {
  it('is the origins whose first request of the step reused a connection', () => {
    const requests = [
      request('https://app.example/api/route', 10, 60, true),
      request('https://app.example/api/details', 70, 220, false),
      request('https://api.example/data', 10, 60, false),
    ];
    expect(warmOrigins(requests)).toEqual(new Set(['https://app.example']));
  });
});

describe('sentWhileAnotherWasInFlight', () => {
  const first = request('https://app.example/a', 10, 60, true);
  const parallel = request('https://app.example/b', 20, 80, true);
  const sequential = request('https://app.example/c', 70, 120, true);

  it('is true for a request sent while another one was loading', () => {
    expect(sentWhileAnotherWasInFlight(parallel, [first, parallel])).toBe(true);
  });

  it('is false for a request sent after the previous response', () => {
    expect(sentWhileAnotherWasInFlight(sequential, [first, sequential])).toBe(
      false,
    );
    expect(sentWhileAnotherWasInFlight(first, [first, sequential])).toBe(false);
  });
});
