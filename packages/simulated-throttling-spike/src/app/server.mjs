import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { createSecureServer } from 'node:http2';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * A single page app without a framework, with one soft navigation per scenario. The page loads
 * from `/?scenario=<id>`, and a click on `#go` runs the scenario: it changes the URL with the
 * History API, requests what the view needs and renders it, the way a client-side router does.
 *
 * Every scenario is a pattern of a real router: data requested from script, in sequence or in
 * parallel, an image as the largest content, a long task, a lazily loaded chunk, and an API on
 * another origin.
 */

/** Server time of each API response, in ms. */
export const DELAYS = { route: 50, details: 150, chunk: 100, image: 50 };

/** @typedef {{ id: string, description: string, http2?: boolean }} Scenario */

/** @type {Scenario[]} */
export const SCENARIOS = [
  {
    id: 'sequential',
    description:
      'Two `fetch`es in sequence: the heading is the FCP, the paragraph after the second response the LCP.',
  },
  {
    id: 'parallel',
    description: 'Two `fetch`es in parallel, rendered together.',
  },
  {
    id: 'image',
    description: 'A `fetch`, then an image that is the LCP.',
  },
  {
    id: 'long-task',
    description: 'A `fetch`, then about 150 ms of script before the render.',
  },
  {
    id: 'lazy-chunk',
    description:
      'A script chunk loaded with `import()`, which then requests its data.',
  },
  {
    id: 'cold-origin',
    description:
      'Two `fetch`es in sequence to an API origin the page load did not contact.',
  },
  {
    id: 'xhr',
    description: 'Two XHRs in sequence, which Lantern already links.',
  },
  {
    id: 'sequential-h2',
    description: '`sequential` over HTTP/2.',
    http2: true,
  },
];

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Simulated throttling fixture</title>
    <style>
      body { font: 16px/1.5 sans-serif; margin: 0; padding: 16px; }
      nav a { display: inline-block; min-width: 48px; padding: 12px; }
      main { min-height: 60vh; }
      img { display: block; width: 100%; max-width: 600px; height: auto; }
    </style>
  </head>
  <body>
    <nav>
      <a id="home" href="/">Home</a>
      <a id="go" href="/view">View</a>
    </nav>
    <main><h1>Home</h1><p>The page as it loaded.</p></main>
    <script type="module">
      const scenario = new URLSearchParams(location.search).get('scenario');
      const api = document.documentElement.dataset.api || '';
      const main = document.querySelector('main');
      const json = (url) => fetch(url).then((r) => r.json());
      const xhr = (url) =>
        new Promise((resolve) => {
          const request = new XMLHttpRequest();
          request.open('GET', url);
          request.responseType = 'json';
          request.onload = () => resolve(request.response);
          request.send();
        });
      const heading = (text) => Object.assign(document.createElement('h1'), { textContent: text });
      const paragraph = (text) => Object.assign(document.createElement('p'), { textContent: text });
      // A fixed amount of work, about 150 ms on a laptop without throttling. Waiting on the clock
      // instead would take 150 ms under CPU throttling too.
      const busy = () => {
        let x = 0;
        for (let i = 0; i < 16_000_000; i++) x = (x * 1664525 + 1013904223) >>> 0;
        return x;
      };

      const views = {
        async sequential(base = '') {
          const route = await json(base + '/api/route');
          main.replaceChildren(heading(route.title));
          const details = await json(base + '/api/details');
          main.append(paragraph(details.text));
        },
        async parallel() {
          const [route, details] = await Promise.all([json('/api/route'), json('/api/details')]);
          main.replaceChildren(heading(route.title), paragraph(details.text));
        },
        async image() {
          const route = await json('/api/route');
          const image = Object.assign(document.createElement('img'), {
            src: '/image.png', width: 400, height: 260, alt: '',
          });
          main.replaceChildren(heading(route.title), image);
        },
        async 'long-task'() {
          const route = await json('/api/route');
          busy();
          main.replaceChildren(heading(route.title), paragraph(route.text));
        },
        async 'lazy-chunk'() {
          const { render } = await import('/chunk.js');
          await render(main);
        },
        'cold-origin'() {
          return views.sequential(api);
        },
        async xhr() {
          const route = await xhr('/api/route');
          main.replaceChildren(heading(route.title));
          const details = await xhr('/api/details');
          main.append(paragraph(details.text));
        },
        'sequential-h2'() {
          return views.sequential();
        },
      };

      document.querySelector('#go').addEventListener('click', (event) => {
        event.preventDefault();
        history.pushState({}, '', '/view' + location.search);
        views[scenario]();
      });
    </script>
  </body>
</html>`;

const chunk = `export async function render(main) {
  const route = await fetch('/api/route').then((r) => r.json());
  const heading = document.createElement('h1');
  heading.textContent = route.title;
  const paragraph = document.createElement('p');
  paragraph.textContent = route.text;
  main.replaceChildren(heading, paragraph);
}
`;

const text = Array.from(
  { length: 12 },
  () => 'Content of the view that fills the viewport.',
).join(' ');

const image = noisePng(400, 260);

/**
 * @param {{ api?: string }} [options] `api` is the origin of the `cold-origin` scenario's API.
 * @return {(request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void}
 */
function handler({ api } = {}) {
  return (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const send = (status, type, body, delay = 0) =>
      setTimeout(() => {
        response.writeHead(status, {
          'content-type': type,
          'access-control-allow-origin': '*',
          'cache-control': 'no-store',
        });
        response.end(body);
      }, delay);

    switch (url.pathname) {
      case '/api/route':
        return send(
          200,
          'application/json',
          JSON.stringify({ title: 'View', text }),
          DELAYS.route,
        );
      case '/api/details':
        return send(
          200,
          'application/json',
          JSON.stringify({ text }),
          DELAYS.details,
        );
      case '/chunk.js':
        return send(200, 'text/javascript', chunk, DELAYS.chunk);
      case '/image.png':
        return send(200, 'image/png', image, DELAYS.image);
      case '/favicon.ico':
        return send(204, 'text/plain', '');
      default:
        return send(
          200,
          'text/html; charset=utf-8',
          api
            ? page.replace(
                '<html lang="en">',
                `<html lang="en" data-api="${api}">`,
              )
            : page,
        );
    }
  };
}

/** @param {import('node:net').Server} server */
function listen(server, scheme) {
  // Node closes an idle connection after 5 s. A real server keeps it longer, and the step only
  // starts a few seconds after the page load, so the page's connections would be gone.
  server.keepAliveTimeout = 120_000;
  server.timeout = 120_000;
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (
        server.address()
      );
      resolve(`${scheme}://127.0.0.1:${port}`);
    });
  });
}

/** @param {import('node:net').Server} server */
function close(server) {
  return new Promise((done) => server.close(() => done(undefined)));
}

/**
 * Starts the app over HTTP/1.1 and HTTP/2, and a second HTTP/1.1 origin that serves the API of the
 * `cold-origin` scenario. The HTTP/2 server uses a self-signed certificate made with `openssl`, so
 * Chrome has to run with `--ignore-certificate-errors`.
 *
 * @return {Promise<{ urlOf: (scenario: Scenario) => string, close: () => Promise<void> }>}
 */
export async function startApp() {
  const apiServer = createServer(handler());
  const api = await listen(apiServer, 'http');

  const http1 = createServer(handler({ api }));
  const http1Origin = await listen(http1, 'http');

  const certificates = mkdtempSync(join(tmpdir(), 'spike-cert-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-keyout',
      join(certificates, 'key.pem'),
      '-out',
      join(certificates, 'cert.pem'),
    ],
    { stdio: 'ignore' },
  );
  const http2 = createSecureServer(
    {
      key: readFileSync(join(certificates, 'key.pem')),
      cert: readFileSync(join(certificates, 'cert.pem')),
    },
    handler({ api }),
  );
  rmSync(certificates, { recursive: true, force: true });
  const http2Origin = await listen(http2, 'https');

  return {
    urlOf: (scenario) =>
      `${scenario.http2 ? http2Origin : http1Origin}/?scenario=${scenario.id}`,
    close: async () => {
      await Promise.all([close(apiServer), close(http1), close(http2)]);
    },
  };
}

/** An RGB PNG of random pixels, which does not compress, so its size is close to `width * height * 3`. */
function noisePng(width, height) {
  const row = width * 3 + 1;
  const raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0;
    for (let x = 1; x < row; x++)
      raw[y * row + x] = (x * 7919 + y * 104729) % 251;
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
