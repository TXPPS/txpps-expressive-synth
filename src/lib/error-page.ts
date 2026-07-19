export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TXPPS TX-80</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#1a1a17" />
    <style>
      body { font: 15px/1.5 "Inter Tight", system-ui, sans-serif; background: #1a1a17; color: #ebe6dc; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      .brand { letter-spacing: 0.14em; text-transform: uppercase; font-size: 0.7rem; color: #9a9488; margin-bottom: 0.75rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #7dff9a; }
      p { color: #9a9488; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid #4a463c; background: #2a2822; color: #ebe6dc; }
      .primary { border-color: #7dff9a; color: #7dff9a; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">TXPPS TX-80</div>
      <h1>Panel fault</h1>
      <p>Something went wrong loading the instrument. Refresh or return to the main panel.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a href="/">Main panel</a>
      </div>
    </div>
  </body>
</html>`;
}
