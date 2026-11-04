import { z } from 'zod';
import { ProductSourceError } from '../../domain/errors.js';
import { toCategory, type Product } from '../../domain/product.js';

const fakeStoreProducts = z.array(
  z.object({
    id: z.number(),
    title: z.string(),
    price: z.number(),
    description: z.string(),
    category: z.string(),
    image: z.url(),
  }),
);

/**
 * Loads the whole catalogue in one call. Fake Store has no search endpoint and
 * answers an unknown /products/:id with an empty 200, so listing is also the
 * most reliable way to tell whether a product exists.
 */
export function createFakeStoreLoader(baseUrl: string, timeoutMs: number) {
  return async function loadFakeStoreProducts(): Promise<Product[]> {
    try {
      const response = await fetch(`${baseUrl}/products`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`Fake Store responded ${response.status}`);
      return fakeStoreProducts.parse(await response.json()).map(
        ({ id, title, price, description, category, image }): Product => ({
          id: String(id),
          title: title.trim(),
          description,
          price,
          category: toCategory(category),
          imageUrl: image,
        }),
      );
    } catch (error) {
      throw new ProductSourceError('Could not load products from Fake Store', { cause: error });
    }
  };
}
