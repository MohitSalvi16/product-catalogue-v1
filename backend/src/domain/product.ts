/**
 * The catalogue's own model. Nothing outside `adapters/products` knows what a
 * Fake Store payload looks like, so changing the data source does not ripple
 * through the services, the API or the client.
 */
export interface Category {
  slug: string;
  name: string;
}

export interface Product {
  /** Opaque string: the next data source may not use numeric ids. */
  id: string;
  title: string;
  description: string;
  price: number;
  category: Category;
  /** Where the source hosts the image. Never exposed to the client directly. */
  imageUrl: string;
}

export function toCategory(name: string): Category {
  const slug = name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { slug, name };
}

function toWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Every word of the term must start a word in the product's text. Case-insensitive.
 * Prefixes keep partial typing working ("jack" finds "jacket") without the false
 * hits of a substring match ("men" would otherwise find "women" and "elements").
 */
export function matchesSearch(product: Product, term: string): boolean {
  const prefixes = toWords(term);
  const words = toWords(`${product.title} ${product.description} ${product.category.name}`);
  return prefixes.length > 0 && prefixes.every((p) => words.some((word) => word.startsWith(p)));
}
