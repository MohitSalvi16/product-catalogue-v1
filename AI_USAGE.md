# AI usage

> **TODO (Mohit): before submitting, read every line of the code and add your own review notes in the last section. The interview will ask you to defend all of it.**

## Tools and models

- **Claude Code** (CLI) on Windows, with **Claude Opus 5.5** (`claude-opus-5-5`), for planning, code, tests, documentation and verification.
- A headless Chrome driven by Playwright to check the app the way a customer would use it. This began as a throwaway script and is now committed as `e2e/journey.mjs`, and CI runs it.

## Agent instruction files

[CLAUDE.md](CLAUDE.md) is committed. It was written during the build, so it describes the conventions that came out of the work and guides later changes. It did not steer the initial build.

## Plan

No separate spec file was written. The direction was the challenge PDF itself, with one instruction to build everything it asked for. The agent then worked in this order:

1. Read the brief, then check the real Fake Store API before designing anything.
2. Choose React + Fastify, with Mailpit for a local inbox so that no account is needed.
3. Build the backend (domain, ports, services, adapters, HTTP), then the frontend, then Docker and CI.
4. Verify against live data, in Docker, and in a real browser.
5. Write up the decisions.

## Key moments that shaped the solution

1. **The instruction.** The whole build came from one prompt: *"Code challenge make the optimised code for the same make all the things."*, along with the challenge PDF. All the detail came from the brief. That made verification the main control on quality, because no one was reviewing each step as it happened.
2. **Probing the API before designing.** Three findings changed the design: there is no search endpoint, an unknown product id returns an empty 200 rather than a 404, and images are hosted on fakestoreapi.com. The first two led to the snapshot repository. The third led to the image proxy, because otherwise the browser would break the rule against calling Fake Store directly.
3. **Choosing a local inbox over a mock.** Mailpit means the enquiry test proves that an email was really delivered over SMTP, while the "no paid services" constraint still holds.
4. **Testing with real data and a real browser**, not only unit tests. The significant bugs below all passed every automated test at the time and only appeared this way.
5. **Auditing the finished work against the brief.** A later prompt, *"now compare the code challenge and give the marks"*, had the agent score the repo against the PDF and run it from a clean clone instead of trusting the earlier result. That found required files that had never been committed and a browser script that could not be installed. Running that script then exposed the connection bug below. A follow-up prompt asked it to close the remaining gaps, which led to the audit findings in the table.

## Where the AI got it wrong, and how it was caught

| What went wrong | How it was caught | Fix |
| --- | --- | --- |
| **Search returned nonsense.** Substring matching met the criteria literally, but `men` returned 13 products, only 4 of them menswear, including a hard drive ("WD Ele**men**ts") and womenswear. All tests passed, because the test data didn't include those words. | Running the search against the live catalogue and reading the results | Match the start of words, with regression tests |
| **The search fix had its own bug.** A term like `!!!` reduces to no words, and `every()` on an empty list is true, so it matched every product. | Reviewing the patch | Require at least one word, with a test |
| **Featured images failed on first load.** 2 of the 5 home page images showed "No image", because several concurrent upstream fetches exceeded the 5s timeout. Every first visitor after a restart would have seen this. | Unexplained 503s in the browser console, then the backend logs and a screenshot | In-memory image cache with shared in-flight requests, and a separate longer image timeout |
| **The verification itself was wrong.** The browser script reported `broken images 0` during that same failure. It counted broken `<img>` tags, but the component replaces a failed image with a placeholder `<div>`, so failures could not show up. | The 503s contradicted the "0", which prompted a look at the screenshot | Count the placeholders instead, then rerun on a cold cache |
| **The image fix was incomplete.** Roughly 1 in 12 connections to Fake Store still failed from Docker, after about 620ms. Node allows 250ms per address when connecting, both IPv4 attempts ran out of time, and IPv6 is unreachable in Docker. A cold start could then return a 503. The client retries its API calls, but an `<img>` does not, so a product could keep showing "No image". | Committing the browser journey: it failed on one image, then on `/api/categories`, while all 49 tests and the smoke test passed. The backend log showed `ETIMEDOUT` from `internalConnectMultiple`, and 25 probes per setting compared 2 failures with 0 | Allow 2s per address at startup, which still fits inside the 5s upstream timeout |
| **The browser script had races of its own.** Its search step treated the "Loading…" paragraph as a finished result, and it counted its own deliberate 400 as a console error. | The failures did not match the API, which returned the right products | Wait past the loading state, and expect that one 400 |
| **Gaps the first build left behind.** The README said every setting was in `.env.example`, but 8 were missing, and 4 of those never reached the container. A malformed product URL showed "Please check the highlighted fields" on a page with no fields. 4xx responses returned raw framework messages. The 5MB image limit was only checked after the download. | Reading the remaining code against `CLAUDE.md` and the README's claims | Each one fixed, and a test now fails if `.env.example` drifts from the config |
| **A wrong claim in these docs.** The first draft blamed the hard drive match on the word "document", which was a guess. | Checking the claim against the catalogue before committing | Corrected to "Elements", the word that really matched |
| **Smaller mistakes.** A guessed Docker tag (`nginx-unprivileged:1.29-alpine`) didn't exist. A numeric `trustProxy` failed type checking. The first npm lockfile was missing the native Rolldown binding, so Vitest couldn't start. | Image manifest check, `tsc`, and the failing test run | Used a tag confirmed to exist, a hop-count function, and a regenerated lockfile |

Also confirmed rather than assumed: seven requests with different spoofed `X-Forwarded-For` values all counted towards the same rate limit, so the limit can't be dodged with that header.

## Human review

TODO (Mohit): what you reviewed, what you changed, and what you disagreed with.
