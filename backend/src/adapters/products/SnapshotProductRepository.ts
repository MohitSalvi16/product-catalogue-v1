import { matchesSearch, type Category, type Product } from '../../domain/product.js';
import type { Logger } from '../../ports/Logger.js';
import type { ProductFilter, ProductRepository } from '../../ports/ProductRepository.js';

/**
 * Serves a small catalogue from an in-memory snapshot of a bulk loader.
 *
 * - Refreshes after `ttlMs`, with concurrent callers sharing a single load.
 * - If a refresh fails the stale snapshot keeps serving, and the next attempt
 *   waits a full TTL so an outage does not put the upstream timeout on every request.
 * - With no snapshot at all the loader's error propagates.
 *
 * This suits sources that can only list everything. A source with real querying
 * should implement ProductRepository directly.
 */
export class SnapshotProductRepository implements ProductRepository {
  private snapshot: { products: Product[]; loadedAt: number } | undefined;
  private loading: Promise<Product[]> | undefined;

  constructor(
    private readonly load: () => Promise<Product[]>,
    private readonly ttlMs: number,
    private readonly logger: Logger,
    private readonly now: () => number = Date.now,
  ) {}

  async findAll(filter: ProductFilter = {}): Promise<Product[]> {
    const { categorySlug, search } = filter;
    return (await this.products()).filter(
      (product) =>
        (categorySlug === undefined || product.category.slug === categorySlug) &&
        (search === undefined || matchesSearch(product, search)),
    );
  }

  async findById(id: string): Promise<Product | null> {
    return (await this.products()).find((product) => product.id === id) ?? null;
  }

  async listCategories(): Promise<Category[]> {
    const bySlug = new Map((await this.products()).map((p) => [p.category.slug, p.category]));
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private async products(): Promise<Product[]> {
    const { snapshot } = this;
    if (snapshot && this.now() - snapshot.loadedAt < this.ttlMs) return snapshot.products;

    this.loading ??= this.load()
      .then((products) => {
        this.snapshot = { products, loadedAt: this.now() };
        return products;
      })
      .finally(() => {
        this.loading = undefined;
      });

    try {
      return await this.loading;
    } catch (error) {
      if (!snapshot) throw error;
      this.logger.warn({ err: error }, 'Product refresh failed, serving stale snapshot');
      snapshot.loadedAt = this.now();
      return snapshot.products;
    }
  }
}
