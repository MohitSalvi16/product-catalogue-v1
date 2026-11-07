// Every acceptance criterion through a real browser, against a running `docker compose` stack.
// Usage: npm ci && npx playwright install chromium && npm run journey
//   BROWSER_CHANNEL=chrome  use an installed Chrome instead of downloading Chromium
//   CHECK_IMAGES=0          skip image checks, for when the image host is unreachable
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:8080';
const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const checkImages = process.env.CHECK_IMAGES !== '0';

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const externalRequests = [];
const consoleErrors = [];
page.on('request', (request) => {
  if (!request.url().startsWith(WEB)) externalRequests.push(request.url());
});
page.on('console', (message) => {
  const { url } = message.location();
  const isImage = url.endsWith('/image');
  // Two steps get a 400 on purpose, and the browser logs every failed request.
  const isExpected = /enquiries|not!valid/.test(url) && message.text().includes('400');
  if (message.type() === 'error' && !isExpected && (checkImages || !isImage)) {
    consoleErrors.push(`${message.text()} ${url}`);
  }
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

let failures = 0;
function check(name, passed, detail = '') {
  if (!passed) failures += 1;
  console.log(`${passed ? 'ok' : 'FAILED'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const titles = (scope = page) => scope.locator('.product-tile__title').allTextContents();

async function search(term) {
  await page.getByRole('searchbox').fill(term);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('heading', { name: `Results for “${term}”` }).waitFor();
  // Skips the "Loading…" paragraph, which would otherwise read as an empty result.
  await page.locator('.product-tile, main p:not([role="status"])').first().waitFor();
  return titles();
}

async function homePage() {
  await page.goto(WEB);
  await page.locator('.product-tile').first().waitFor();
  await page.waitForLoadState('networkidle');
  const products = await titles();
  check('home shows 5 featured products', products.length === 5, `${products.length}`);
  if (checkImages) {
    const missing = await page.locator('.product-image--missing').count();
    check('home images all load', missing === 0, `${missing} missing`);
  }
  return products;
}

async function categoryPages() {
  const nav = page.getByRole('navigation', { name: 'Categories' });
  const names = await nav.getByRole('link').allTextContents();
  check('nav lists the categories', names.length === 4, names.join(', '));

  for (const name of names) {
    await nav.getByRole('link', { name, exact: true }).click();
    const topRated = page.getByRole('region', { name: 'Top rated' });
    const more = page.getByRole('region', { name: 'More products' });
    await topRated.waitFor();
    await more.waitFor();
    const counts = [(await titles(topRated)).length, (await titles(more)).length];
    check(`category "${name}" has top rated and more`, counts.every(Boolean), counts.join(' + '));
  }
}

async function searchResults() {
  const jackets = await search('jacket');
  check('search finds matches', jackets.length > 0, `${jackets.length}`);

  const men = await search('men');
  check('search "men" skips womenswear', men.length > 0 && !men.some((t) => /women/i.test(t)));

  const none = await search('zzzznothing');
  const message = await page.getByText('No products match').count();
  check('search with no match says so', none.length === 0 && message === 1);
}

async function productPage(featured) {
  await page.goto(WEB);
  await page.locator('.product-tile').nth(2).click();
  await page.getByRole('link', { name: 'Enquire' }).waitFor();
  check('tile opens the details page', (await page.locator('h1').textContent()) === featured[2]);
}

async function enquiry() {
  const reference = `journey-${Date.now()}`;
  await page.getByRole('link', { name: 'Enquire' }).click();
  await page.getByLabel('Name').fill('Journey Test');
  await page.getByLabel('Email').fill('buyer@example.com');
  await page.getByLabel('Phone (optional)').fill('0123 456 789');
  await page.getByLabel('Message (optional)').fill(reference);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.getByRole('heading', { name: 'Thank you' }).waitFor();
  check('customer sees Thank you', true);

  const { messages } = await (await fetch(`${MAILPIT}/api/v1/search?query=${reference}`)).json();
  check('sales inbox received the email', messages.length === 1);
  const email = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
  const details = ['Journey Test', 'buyer@example.com', '0123 456 789', reference];
  check('email has the contact details', details.every((text) => email.Text.includes(text)));
  check('replies go to the customer', email.ReplyTo?.[0]?.Address === 'buyer@example.com');
}

async function invalidEnquiry() {
  await page.goto(`${WEB}/products/1/enquire`);
  await page.getByLabel('Name').fill('Journey Test');
  await page.getByLabel('Email').fill('a@b');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.getByText('Please enter a valid email address').waitFor();
  check('server validation appears on the field', true);
}

async function malformedUrl() {
  await page.goto(`${WEB}/products/not!valid`);
  await page.getByText('We could not find that product').waitFor();
  check('a malformed product url says not found', true);
}

async function mobileWidth() {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto(WEB);
  await page.locator('.product-tile').first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check('no horizontal overflow at mobile width', !overflow);
}

try {
  const featured = await homePage();
  await categoryPages();
  await searchResults();
  await productPage(featured);
  await enquiry();
  await invalidEnquiry();
  await malformedUrl();
  await mobileWidth();
  check('browser only talks to our origin', externalRequests.length === 0, externalRequests[0]);
  check('no console errors', consoleErrors.length === 0, consoleErrors[0]);
} catch (error) {
  failures += 1;
  console.error(`FAILED - ${error.message}`);
} finally {
  await browser.close();
}

process.exitCode = failures ? 1 : 0;
