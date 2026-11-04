# Agent instructions

Product catalogue PoC designed to grow. Read README.md for the structure and DECISIONS.md for why things are the way they are.

## Commands

- Backend: `cd backend && npm run typecheck && npm test`
- Frontend: `cd frontend && npm run typecheck && npm test`
- Whole stack: `docker compose up --build --detach --wait && node e2e/smoke.mjs`
- Real browser, against a running stack: `cd e2e && npm ci && npx playwright install chromium && npm run journey`

## Rules

- Keep the boundaries. Services depend on `ports/`, never on adapters. Only `composition.ts` chooses adapters. Nothing outside `adapters/products` may know the Fake Store payload.
- The client must never call the product source, images included. All product data goes through `/api`.
- Styling uses the tokens in `frontend/src/styles/theme.css`. No hard-coded colours or spacing elsewhere.
- Validate all input at the HTTP boundary with zod, and all upstream data in the adapter.
- Errors use the single format in `http/errorHandler.ts`. Never return internals to the client.
- Never log customer contact details, and never commit secrets. New configuration goes in `config.ts` and `.env.example`.
- "Thank you" must only ever follow a successful send.

## Testing

- Test behaviour through the API or the rendered app, using in-memory adapters or a stubbed `fetch`. Avoid mocking internals.
- Passing tests are not enough for user-facing changes. Check them against real data and in a real browser. The significant bugs in this project all passed the tests first (see AI_USAGE.md).
- Record new assumptions in DECISIONS.md.
