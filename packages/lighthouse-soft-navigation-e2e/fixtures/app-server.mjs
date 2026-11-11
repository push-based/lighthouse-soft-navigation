import { createServer } from 'node:http';

/**
 * A single page app without a framework: links change the URL with the History API, fetch their
 * content and render it, the way a client-side router does.
 */
const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Fixture for soft navigations" />
    <title>Soft navigation fixture</title>
    <style>
      body { font: 16px/1.5 sans-serif; margin: 0; padding: 16px; }
      nav a { display: inline-block; min-width: 48px; padding: 12px; }
      main { min-height: 60vh; }
    </style>
  </head>
  <body>
    <nav>
      <a id="home-link" href="/" data-route>Home</a>
      <a id="products-link" href="/products" data-route>Products</a>
      <a id="page-load-link" href="/about">About</a>
    </nav>
    <main></main>
    <script>
      const main = document.querySelector('main');

      async function render(pathname) {
        const route = await fetch('/api/route?path=' + encodeURIComponent(pathname)).then((r) => r.json());
        const heading = document.createElement('h1');
        heading.textContent = route.title;
        main.replaceChildren(heading);

        // The largest content arrives with a second request, after the first paint.
        const details = await fetch('/api/details?path=' + encodeURIComponent(pathname)).then((r) => r.json());
        const paragraph = document.createElement('p');
        paragraph.textContent = details.text;
        main.append(paragraph);
      }

      for (const link of document.querySelectorAll('a[data-route]')) {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          history.pushState({}, '', link.href);
          render(location.pathname);
        });
      }

      // Routers commonly normalise the URL while the page loads.
      history.replaceState({}, '', location.href);
      render(location.pathname);
    </script>
  </body>
</html>`;

const text = (title) =>
  Array.from(
    { length: 12 },
    () => `${title} content that fills the viewport.`,
  ).join(' ');

const titles = { '/': 'Home', '/products': 'Products', '/about': 'About' };

function json(response, body, delay) {
  setTimeout(() => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  }, delay);
}

/** @return {Promise<{origin: string, close: () => Promise<void>}>} */
export function startAppServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const title = titles[url.searchParams.get('path') ?? ''] ?? 'Not found';

    if (url.pathname === '/api/route') return json(response, { title }, 50);
    if (url.pathname === '/api/details')
      return json(response, { text: text(title) }, 150);
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204);
      return response.end();
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = /** @type {import('node:net').AddressInfo} */ (
        server.address()
      );
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
