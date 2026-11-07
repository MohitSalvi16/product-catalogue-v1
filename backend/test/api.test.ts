import { describe, expect, it } from 'vitest';
import { MailDeliveryError, ProductSourceError } from '../src/domain/errors.js';
import { buildTestApp } from './helpers.js';

const validEnquiry = { productId: '1', name: 'Sam Doe', email: 'sam@example.com' };

describe('home page data', () => {
  it('returns the chosen products in the chosen order', async () => {
    const { app } = await buildTestApp();
    const response = await app.inject('/api/products/top-rated');

    expect(response.statusCode).toBe(200);
    expect(response.json().items.map((p: { id: string }) => p.id)).toEqual(['2', '4']);
  });
});

describe('category page data', () => {
  it('splits a category into top rated and additional products', async () => {
    const { app } = await buildTestApp();
    const response = await app.inject('/api/categories/electronics');
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.category).toEqual({ slug: 'electronics', name: 'electronics' });
    expect(body.topRated.map((p: { id: string }) => p.id)).toEqual(['2']);
    expect(body.others.map((p: { id: string }) => p.id)).toEqual(['1', '3']);
  });

  it('lists categories with url-safe slugs', async () => {
    const { app } = await buildTestApp();
    const { items } = (await app.inject('/api/categories')).json();

    expect(items.map((c: { slug: string }) => c.slug)).toEqual([
      'electronics',
      'mens-clothing',
      'womens-clothing',
    ]);
  });

  it('returns 404 for an unknown category', async () => {
    const { app } = await buildTestApp();
    const response = await app.inject('/api/categories/nope');

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});

describe('search', () => {
  const search = async (q: string) => {
    const { app } = await buildTestApp();
    return app.inject({ url: '/api/products/search', query: { q } });
  };

  it('only returns products matching the term, ignoring case', async () => {
    const { items } = (await search('JACKET')).json();
    expect(items.map((p: { id: string }) => p.id)).toEqual(['4', '5']);
  });

  it('requires every word to match', async () => {
    const { items } = (await search('rain jacket')).json();
    expect(items.map((p: { id: string }) => p.id)).toEqual(['5']);
  });

  it('matches the start of words, so "men" does not find "women"', async () => {
    const { items } = (await search('men')).json();
    expect(items.map((p: { id: string }) => p.id)).toEqual(['4']);
  });

  it('finds partially typed words', async () => {
    const { items } = (await search('jack')).json();
    expect(items.map((p: { id: string }) => p.id)).toEqual(['4', '5']);
  });

  it('returns an empty list when nothing matches', async () => {
    const response = await search('zzz');
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toEqual([]);
  });

  it('matches nothing for a term with no words in it', async () => {
    expect((await search('!!!')).json().items).toEqual([]);
  });

  it('rejects a blank term', async () => {
    expect((await search('   ')).statusCode).toBe(400);
  });
});

describe('product details', () => {
  it('returns the product with an image url on our own API', async () => {
    const { app } = await buildTestApp();
    const response = await app.inject('/api/products/1');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: '1',
      title: 'Portable Hard Drive',
      imageUrl: '/api/products/1/image',
    });
    expect(response.body).not.toContain('source.example');
  });

  it('returns 404 for an unknown product', async () => {
    const { app } = await buildTestApp();
    expect((await app.inject('/api/products/999')).statusCode).toBe(404);
  });

  it('proxies the image from the source url, not from client input', async () => {
    const { app, images } = await buildTestApp();
    const response = await app.inject('/api/products/1/image');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/png');
    expect(response.body).toBe('png-bytes');
    expect(images.fetch).toHaveBeenCalledWith('https://source.example/1.png');
  });
});

describe('enquiries', () => {
  const post = (app: Awaited<ReturnType<typeof buildTestApp>>['app'], payload: object) =>
    app.inject({ method: 'POST', url: '/api/enquiries', payload });

  it('emails the sales inbox with the product and contact details', async () => {
    const { app, mailer } = await buildTestApp();
    const response = await post(app, {
      ...validEnquiry,
      phone: '0123 456',
      message: 'Is this in stock?',
    });

    expect(response.statusCode).toBe(202);
    expect(mailer.sent).toHaveLength(1);
    const [email] = mailer.sent;
    expect(email).toMatchObject({
      to: 'sales@test.local',
      replyTo: 'sam@example.com',
      subject: 'New enquiry: Portable Hard Drive',
    });
    expect(email?.text).toContain('Sam Doe');
    expect(email?.text).toContain('0123 456');
    expect(email?.text).toContain('Is this in stock?');
  });

  it('accepts an enquiry with only the required fields', async () => {
    const { app, mailer } = await buildTestApp();
    expect((await post(app, validEnquiry)).statusCode).toBe(202);
    expect(mailer.sent[0]?.text).toContain('Phone: Not provided');
  });

  it('reports invalid fields and sends nothing', async () => {
    const { app, mailer } = await buildTestApp();
    const response = await post(app, { productId: '1', name: ' ', email: 'not-an-email' });

    expect(response.statusCode).toBe(400);
    expect(Object.keys(response.json().error.details.fieldErrors).sort()).toEqual(['email', 'name']);
    expect(mailer.sent).toHaveLength(0);
  });

  it('rejects an enquiry for a product that does not exist', async () => {
    const { app, mailer } = await buildTestApp();
    const response = await post(app, { ...validEnquiry, productId: '999' });

    expect(response.statusCode).toBe(404);
    expect(mailer.sent).toHaveLength(0);
  });

  it('never reports success when the email fails', async () => {
    const { app, mailer } = await buildTestApp();
    mailer.failure = new MailDeliveryError('smtp password wrong');
    const response = await post(app, validEnquiry);

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('ENQUIRY_NOT_SENT');
    expect(response.body).not.toContain('smtp');
  });

  it('rate limits repeat submissions', async () => {
    const { app, mailer } = await buildTestApp({ rateLimit: 2 });
    await post(app, validEnquiry);
    await post(app, validEnquiry);
    const response = await post(app, validEnquiry);

    expect(response.statusCode).toBe(429);
    expect(response.json().error.code).toBe('RATE_LIMITED');
    expect(mailer.sent).toHaveLength(2);
  });

  it('rejects malformed JSON in the standard error shape', async () => {
    const { app } = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/enquiries',
      headers: { 'content-type': 'application/json' },
      payload: '{oops',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toEqual({
      code: 'BAD_REQUEST',
      message: 'The request could not be processed',
    });
  });
});

describe('when the product source is down', () => {
  it('answers 503 without leaking the cause', async () => {
    const { app } = await buildTestApp({
      load: async () => {
        throw new ProductSourceError('upstream secret detail');
      },
    });
    const response = await app.inject('/api/products/top-rated');

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('PRODUCT_SOURCE_UNAVAILABLE');
    expect(response.body).not.toContain('secret');
  });
});
