import { afterEach, describe, expect, it, vi } from 'vitest';
import { SmtpMailer } from '../src/adapters/mail/SmtpMailer.js';
import { createFakeStoreLoader } from '../src/adapters/products/fakeStore.js';
import { loadFixtureProducts } from '../src/adapters/products/fixture.js';
import { HttpImageFetcher } from '../src/adapters/products/httpImageFetcher.js';
import { loadConfig } from '../src/config.js';
import { MailDeliveryError, ProductSourceError } from '../src/domain/errors.js';

const fakeStoreProduct = {
  id: 1,
  title: ' Mens Cotton Jacket ',
  price: 55.99,
  description: 'A jacket',
  category: "men's clothing",
  image: 'https://fakestoreapi.com/img/1.png',
  rating: { rate: 4.7, count: 500 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Fake Store loader', () => {
  const load = createFakeStoreLoader('https://fake.test', 100);

  it('maps the payload to the domain model', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([fakeStoreProduct])));

    expect(await load()).toEqual([
      {
        id: '1',
        title: 'Mens Cotton Jacket',
        description: 'A jacket',
        price: 55.99,
        category: { slug: 'mens-clothing', name: "men's clothing" },
        imageUrl: 'https://fakestoreapi.com/img/1.png',
      },
    ]);
  });

  it('rejects a payload that does not match the contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ id: 'nope' }])));
    await expect(load()).rejects.toBeInstanceOf(ProductSourceError);
  });

  it('wraps upstream failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await expect(load()).rejects.toBeInstanceOf(ProductSourceError);
  });
});

describe('fixture source', () => {
  it('covers the default top rated ids and every category', async () => {
    const products = await loadFixtureProducts();
    const { TOP_RATED_PRODUCT_IDS } = loadConfig({});
    const chosen = products.filter((p) => TOP_RATED_PRODUCT_IDS.includes(p.id));
    const allCategories = new Set(products.map((p) => p.category.slug));

    expect(chosen).toHaveLength(5);
    expect(new Set(chosen.map((p) => p.category.slug))).toEqual(allCategories);
  });
});

describe('HttpImageFetcher', () => {
  const images = new HttpImageFetcher(100);

  it('refuses a response that is not an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })),
    );
    await expect(images.fetch('https://x.test/a.png')).rejects.toBeInstanceOf(ProductSourceError);
  });
});

describe('SmtpMailer', () => {
  it('sends from the configured address', async () => {
    const sendMail = vi.fn(async () => ({ envelope: { from: '', to: [] }, messageId: '1' }));
    await new SmtpMailer({ sendMail }, 'shop@test.local').send({
      to: 'sales@test.local',
      subject: 'Hello',
      text: 'Body',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'shop@test.local',
      to: 'sales@test.local',
      subject: 'Hello',
      text: 'Body',
    });
  });

  it('wraps transport failures', async () => {
    const sendMail = vi.fn(async () => {
      throw new Error('connection refused');
    });
    const mailer = new SmtpMailer({ sendMail }, 'shop@test.local');

    await expect(mailer.send({ to: 'a@b.c', subject: 's', text: 't' })).rejects.toBeInstanceOf(
      MailDeliveryError,
    );
  });
});

describe('config', () => {
  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ SALES_INBOX_EMAIL: 'nope' })).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ TOP_RATED_PRODUCT_IDS: '1,1' })).toThrow(/unique/);
  });

  it('parses the top rated ids', () => {
    expect(loadConfig({ TOP_RATED_PRODUCT_IDS: '7, 8' }).TOP_RATED_PRODUCT_IDS).toEqual(['7', '8']);
  });
});
