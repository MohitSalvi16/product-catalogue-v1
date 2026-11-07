import { NotFoundError } from '../domain/errors.js';
import type { Category, Product } from '../domain/product.js';
import type { Logger } from '../ports/Logger.js';
import type { ProductRepository } from '../ports/ProductRepository.js';

export interface CategoryPage {
  category: Category;
  topRated: Product[];
  others: Product[];
}

export class CatalogueService {
  constructor(
    private readonly products: ProductRepository,
    private readonly topRatedIds: readonly string[],
    private readonly logger: Logger,
  ) {}

  listCategories(): Promise<Category[]> {
    return this.products.listCategories();
  }

  search(term: string): Promise<Product[]> {
    return this.products.findAll({ search: term });
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product) throw new NotFoundError(`Product ${id} not found`);
    return product;
  }

  /** The chosen products, in the order they were chosen. */
  async getTopRated(): Promise<Product[]> {
    const found = await Promise.all(this.topRatedIds.map((id) => this.products.findById(id)));
    const topRated = found.filter((product) => product !== null);
    if (topRated.length < this.topRatedIds.length) {
      const missing = this.topRatedIds.filter((id) => !topRated.some((p) => p.id === id));
      this.logger.warn({ missing }, 'Top rated products are missing from the data source');
    }
    return topRated;
  }

  async getCategoryPage(slug: string): Promise<CategoryPage> {
    const categories = await this.products.listCategories();
    const category = categories.find((candidate) => candidate.slug === slug);
    if (!category) throw new NotFoundError(`Category ${slug} not found`);

    const products = await this.products.findAll({ categorySlug: slug });
    const rank = (product: Product) => this.topRatedIds.indexOf(product.id);
    return {
      category,
      topRated: products.filter((p) => rank(p) !== -1).sort((a, b) => rank(a) - rank(b)),
      others: products.filter((p) => rank(p) === -1),
    };
  }
}
