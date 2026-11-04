// End-to-end check of the critical path against a running `docker compose` stack.
// Goes through nginx like a browser would and reads the delivered email from Mailpit.
// Usage: node e2e/smoke.mjs
import assert from 'node:assert/strict';

const WEB = process.env.WEB_URL ?? 'http://localhost:8080';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';

const getJson = async (url) => {
  const response = await fetch(url);
  assert.equal(response.status, 200, `GET ${url}`);
  return response.json();
};

const steps = {
  'serves the client, with deep links falling back to it': async () => {
    const response = await fetch(`${WEB}/products/1`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<div id="root">/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  },

  'home page has 5 top rated products': async () => {
    const { items } = await getJson(`${WEB}/api/products/top-rated`);
    assert.equal(items.length, 5);
  },

  'category page has top rated and additional products': async () => {
    const { topRated, others } = await getJson(`${WEB}/api/categories/electronics`);
    assert.ok(topRated.length > 0);
    assert.ok(others.length > 0);
    assert.ok(topRated.concat(others).every((p) => p.category.slug === 'electronics'));
  },

  'search only returns matches': async () => {
    const { items } = await getJson(`${WEB}/api/products/search?q=hard%20drive`);
    assert.ok(items.length > 0);
    for (const { title, description } of items) {
      const text = `${title} ${description}`.toLowerCase();
      assert.ok(text.includes('hard') && text.includes('drive'), title);
    }
  },

  'product details never expose the source image url': async () => {
    const product = await getJson(`${WEB}/api/products/1`);
    assert.equal(product.imageUrl, '/api/products/1/image');
  },

  'enquiry reaches the sales inbox': async () => {
    const reference = `smoke-${Date.now()}`;
    const response = await fetch(`${WEB}/api/enquiries`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: '1',
        name: 'Smoke Test',
        email: 'customer@example.com',
        message: reference,
      }),
    });
    assert.notEqual(response.status, 429, 'Enquiry rate limit reached. Wait a minute and rerun');
    assert.equal(response.status, 202);

    const { messages } = await getJson(`${MAILPIT}/api/v1/search?query=${reference}`);
    assert.equal(messages.length, 1, 'email not found in Mailpit');
    assert.equal(messages[0].To[0].Address, 'sales@catalogue.local');
    assert.match(messages[0].Subject, /^New enquiry: /);
  },
};

try {
  for (const [name, step] of Object.entries(steps)) {
    await step();
    console.log(`ok - ${name}`);
  }
} catch (error) {
  console.error(`FAILED - ${error.message}`);
  process.exitCode = 1;
}
