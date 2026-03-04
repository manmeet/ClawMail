# ClawMail Web

Next.js shell for executive inbox UX.

## Included
- Dark inbox layout (sidebar, thread list, reading pane, persistent agent panel)
- Keyboard-first controls (`j/k`, `Shift+D`, `Cmd/Ctrl+K`, etc.)
- Command palette overlay
- Responsive desktop/mobile layout

## Run
```bash
npm install
npm run dev
```

## API base URL
- Default is same-origin `/api`.
- In local dev, Next rewrites `/api/*` to `http://127.0.0.1:8080/*`.
- Optional overrides:
  - `NEXT_PUBLIC_API_BASE_URL` to bypass same-origin routing.
  - `API_PROXY_TARGET` to change rewrite target (default: `http://127.0.0.1:8080`).
