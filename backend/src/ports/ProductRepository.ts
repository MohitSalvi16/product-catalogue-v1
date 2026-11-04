import type { Category, Product } from '../domain/product.js';

export interface ProductFilter {
  categorySlug?: string;
  search?: string;
}

/**
 * The boundary to the product data source. Filtering lives behind it so a
 * database or search-engine adapter can push the work down to its own store.
 */
export interface ProductRepository {
  findAll(filter?: ProductFilter): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  listCategories(): Promise<Category[]>;
}
