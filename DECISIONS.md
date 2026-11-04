# Decisions and assumptions

## Assumptions

**Top rated products**

- "I have chosen" means a person picks them, so top rated is a curated list and not computed from Fake Store's `rating` field. That field is ignored entirely, which also avoids showing a low score on a "top rated" product.
- The list is `TOP_RATED_PRODUCT_IDS`, in display order. Changing it needs a restart, which is fine until there is an admin tool.
- There is one list of five, not a list per category. A category page's top rated section shows the chosen products in that category, and everything else appears under "More products".
- The default picks cover all four categories so that every category page has a top rated section. A test checks this. A category with no chosen products hides the section.
- If a chosen product disappears from the source, the page shows the rest and logs a warning rather than failing.

**Search**

- It covers title, description and category name, because that is the text a customer can see.
- Matching is case-insensitive, each word in the term must match, and a word matches the start of a word in the product. So `jack` finds "jacket" and `men` does not find "women". The downside is that `pack` does not find "backpack". I prefer that to the alternative: with substring matching, `men` returned 13 products, including a hard drive (via "WD Elements") and a ring (via "engagement").
- A blank term does nothing in the UI and is a 400 from the API.

**Enquiry**

- Contact details are name and email (required), phone and message (optional). Email is required so that sales can reply, and it is set as `Reply-To`.
- Only the sales inbox gets an email. The criteria do not ask for a confirmation to the customer, and sending one would let anyone trigger emails to any address.
- "Thank you" appears only after the email has been accepted by the SMTP server. If that fails, the customer sees an error and keeps what they typed.
- The form is its own page (`/products/:id/enquire`), so it can be linked to and tested without modal state.

**Data and display**

- Prices are USD, since Fake Store does not specify. No tax or stock is shown.
- No customer accounts. Browsing and enquiring are both anonymous.
- Category names come from the source as they are, including its spelling "jewelery".
- A malformed id in a URL (`/products/not!valid`) is a 400 from the API, because it is invalid input, but the customer sees the normal "not found" message, because to them the page does not exist.
- Product images count as product data. They are hosted on fakestoreapi.com, so linking to them directly would mean the browser calling Fake Store. The backend proxies them, and the nginx Content Security Policy blocks any other origin as a backstop.

## Requirements dropped or simplified

Nothing in the acceptance criteria was dropped. These were left out or simplified on purpose:

| Cut | Why | Consequence |
| --- | --- | --- |
| Enquiries are not stored | No database keeps the PoC simple to run | If email fails the customer must retry, and there is no record of enquiries beyond the inbox. This is the first thing I would fix. |
| No pagination | 20 products | The API wraps lists in `{ items }`, so paging can be added without breaking clients |
| Spam protection is rate limiting only | It stops the cheap abuse without needing a third-party account | A distributed bot gets through. Rate limits are also per instance, in memory. |
| No admin UI for top rated | Not in the criteria | Changing the list means a config change and a restart |
| Types are duplicated in `frontend/src/api/client.ts` | One small file does not justify a shared package or codegen | The two can drift. The smoke test catches some of that, not all. |
| No infrastructure as code | It is optional and would not help the entrepreneur try the product | See the AWS notes in the README |
| A failed image is not retried | The backend drops the failure, so the next page load works, and the connection fix made this rare | During a Fake Store outage a tile shows "No image" until the page is reloaded |
| Minimal styling | Creative work is in progress, and it would be replaced | Styling is tokens plus one small stylesheet |

## How the design supports growth

The brief names three things that will change, and each one has a boundary:

- **Product data source:** `ProductRepository` uses our own `Product` model. Fake Store's shape stops at `adapters/products/fakeStore.ts`, where it is validated with zod, so a changed payload fails there and not somewhere in the UI. Filtering is behind the interface, so a database or search engine can do its own querying. Product ids are strings, because the next source may not use numbers. The fixture source is a working second adapter, not only a theoretical one.
- **Look and feel:** tokens in `theme.css`, and components carry no business logic. Image URLs and category slugs come from our API, so pages have no knowledge of the source.
- **Email provider:** `Mailer` is one method. SMTP already covers SES, SendGrid and similar through configuration.

Other choices that make growth easier:

- Services are tested through ports, so tests don't need rewriting when an adapter changes.
- The backend holds no state that matters. The caches can be rebuilt, so it can run as several containers, with the rate limiter as the exception (see above).
- The client and API share an origin through nginx (Vite's proxy in development), so there is no CORS configuration to maintain.

Boundaries I deliberately did not add, because nothing needs them yet: a top-rated provider interface, a separate DTO layer, and a monorepo tool.

**Resilience.** Fake Store is a free third party, and the product snapshot cache exists because of that. Connections are allowed 2s per address, not Node's default 250ms, because that limit caused occasional failures on slower links. It is a fixed value in `index.ts` and not configuration, because it is a workaround for a platform default that nobody needs to tune per environment. It serves the last good catalogue during an outage and limits how often we call the API. It also gives search a data set to work on, because Fake Store has no search endpoint, and it avoids a trap: an unknown `/products/:id` returns an empty 200 and not a 404.

## What I would do next with another day

1. **Store enquiries before sending** (a table plus an outbox retry), so a mail outage cannot lose a lead. This is the only gap that costs the business money directly.
2. **Spam protection:** a honeypot field now, and a shared rate limit store once there is more than one instance.
3. **Generate client types** from an OpenAPI description of the backend.
4. **Move image delivery** to S3 and CloudFront once the catalogue is real, replacing the proxy and its in-memory cache.
5. **Observability:** a readiness check on the data source, metrics on upstream failures, and alerts on failed enquiries.
