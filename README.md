# Product Catalogue

A proof of concept that is meant to be kept: customers browse and search a catalogue and send an enquiry to the sales inbox. The product source, the look and feel and the email provider are all expected to change, so each one sits behind its own boundary.

**Stack:** React + TypeScript (Vite) client, Node.js + TypeScript (Fastify) backend.

Also in this repo: [DECISIONS.md](DECISIONS.md) (assumptions, cuts, growth, next steps) and [AI_USAGE.md](AI_USAGE.md) (how AI was used and where it went wrong).

## Run it

You need Docker with Compose. No accounts, API keys or `.env` file are required.

```bash
docker compose up --build
```

The first build took about 2 minutes on the development machine.

| What | URL |
| --- | --- |
| Catalogue | http://localhost:8080 |
| Sales inbox (Mailpit) | http://localhost:8025 |

To try the enquiry flow, open a product, click **Enquire** and submit the form. The email appears in Mailpit.

If Fake Store is down or blocked on your network, use the bundled snapshot of its catalogue. Product images still come from Fake Store, so they show a placeholder if it is unreachable.

```bash
PRODUCT_SOURCE=fixture docker compose up --build
```

If port 8080 or 8025 is taken, set `WEB_PORT` or `MAILPIT_UI_PORT`.

### Without Docker

Needs Node 22+. Run each in its own terminal. Enquiries need an SMTP server on `localhost:1025`, and the rest works without one.

```bash
cd backend && npm ci && npm run dev     # http://localhost:3000
cd frontend && npm ci && npm run dev    # http://localhost:5173
```

## Configuration

Everything is optional and is documented in [.env.example](.env.example). Copy it to `.env` to change a value. The two most likely changes are:

- `TOP_RATED_PRODUCT_IDS`: the chosen products, in display order.
- `SALES_INBOX_EMAIL` and the `SMTP_*` values: where enquiries go.

Invalid configuration stops the backend at startup with a message saying what is wrong.

## Test

```bash
cd backend && npm ci && npm test      # 38 tests: API, services, adapters, config
cd frontend && npm ci && npm test     # 11 tests: each acceptance criterion through the real UI
node e2e/smoke.mjs                    # against a running stack: nginx, backend and real email delivery

# Every acceptance criterion in a real browser, against a running stack
cd e2e && npm ci && npx playwright install chromium && npm run journey
```

The backend suite runs the real Fastify app and services over in-memory adapters. The frontend suite renders the whole app and stubs only `fetch`. The smoke test crosses every boundary at the HTTP level: it submits an enquiry through nginx and reads the delivered email back from Mailpit. The journey does the same as a customer would, in Chromium, and also checks that the browser only talks to our own origin. CI runs all four (`.github/workflows/ci.yml`), using the fixture source and skipping image checks so that it does not depend on Fake Store.

Enquiries are limited to 5 a minute per client, so rerunning these back to back can hit the limit. Wait a minute if it does.

## Why this stack

- **React web app:** a reviewer can run it with one command, and a web client is the quickest way for the entrepreneur to try the product and share it. Native apps would add simulator setup for no benefit at this stage.
- **Node.js + TypeScript:** one language across the repo, and the strictness pays off at the boundaries where data is most likely to change shape.
- **Fastify over Express:** async error handling, request logging and `inject()` for testing come built in, which removes the need for several add-ons.

## How it is structured

```
browser ──> nginx ──/api──> Fastify routes ──> services ──> ports ──> adapters ──> Fake Store
            (static)        validation,        business     interfaces             SMTP (Mailpit, SES)
                            DTOs, errors       rules
```

```
backend/src/
  domain/       Product, Category, search rule, error types. No dependencies.
  ports/        Interfaces the services depend on: ProductRepository, Mailer, ImageFetcher.
  services/     CatalogueService (top rated, category split), EnquiryService.
  adapters/     Fake Store, fixture, snapshot cache, image fetching, SMTP.
  http/         Routes, validation, the single error format.
  composition.ts   The only file that chooses adapters.
frontend/src/
  api/client.ts    The only file that knows the API.
  pages/ components/
  styles/theme.css The look and feel, as design tokens.
```

### What changing each thing involves

| Change | Work needed |
| --- | --- |
| Product data source | Implement `ProductRepository`, or a loader for `SnapshotProductRepository`, and select it in `composition.ts`. The fixture source shows this working. |
| Email provider | Any SMTP relay, including Amazon SES, is configuration only. An HTTP API provider is a new `Mailer` in `adapters/mail`. |
| Look and feel | Start with `frontend/src/styles/theme.css`. Components use its tokens. |

### API

| Method and path | Purpose |
| --- | --- |
| `GET /api/products/top-rated` | Chosen products, in order |
| `GET /api/categories` | All categories |
| `GET /api/categories/:slug` | A category with `topRated` and `others` |
| `GET /api/products/search?q=` | Products matching the term |
| `GET /api/products/:id` | Product details |
| `GET /api/products/:id/image` | Product image, proxied so the client never calls the source |
| `POST /api/enquiries` | Emails the sales inbox. Rate limited per client. |
| `GET /api/health` | Liveness |

Errors always look like `{ "error": { "code", "message", "details?" } }`.

## Deploying to AWS

No infrastructure is included (see [DECISIONS.md](DECISIONS.md)), but the design is compatible with AWS. Both images are stateless containers that suit ECS Fargate behind an ALB, and enquiries can move to SES SMTP by changing environment values. Set `TRUST_PROXY_HOPS` to match the proxies in front of the backend.

## Time spent

> **TODO (Mohit): replace this with your real total before submitting, including your own review.**

| Activity | Time |
| --- | --- |
| Planning (AI session) | ~5 min |
| Building (AI session) | ~12 min |
| Testing and fixing (AI session) | ~8 min |
| Docs (AI session) | ~5 min |
| Human review and walkthrough | TODO |
