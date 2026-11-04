import { vi } from 'vitest';
import { SnapshotProductRepository } from '../src/adapters/products/SnapshotProductRepository.js';
import { toCategory, type Product } from '../src/domain/product.js';
import { buildApp } from '../src/http/app.js';
import type { ImageFetcher } from '../src/ports/ImageFetcher.js';
import type { Logger } from '../src/ports/Logger.js';
import type { Mailer, MailMessage } from '../src/ports/Mailer.js';
import { CatalogueService } from '../src/services/CatalogueService.js';
import { EnquiryService } from '../src/services/EnquiryService.js';

export const silentLogger: Logger = { info: () => {}, warn: () => {} };

export function product(id: string, category: string, title = `Product ${id}`): Product {
  return {
    id,
    title,
    description: `Description of ${title}`,
    price: 10,
    category: toCategory(category),
    imageUrl: `https://source.example/${id}.png`,
  };
}

export const products = [
  product('1', 'electronics', 'Portable Hard Drive'),
  product('2', 'electronics', 'Gaming Monitor'),
  product('3', 'electronics', 'Budget SSD'),
  product('4', "men's clothing", 'Cotton Jacket'),
  product('5', "women's clothing", 'Rain Jacket'),
];

export class RecordingMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  failure: Error | undefined;

  async send(message: MailMessage) {
    if (this.failure) throw this.failure;
    this.sent.push(message);
  }
}

/** The real app and services over in-memory adapters. */
export async function buildTestApp(options: { load?: () => Promise<Product[]>; rateLimit?: number } = {}) {
  const load = options.load ?? (async () => products);
  const repository = new SnapshotProductRepository(load, 60_000, silentLogger);
  const catalogue = new CatalogueService(repository, ['2', '4'], silentLogger);
  const mailer = new RecordingMailer();
  const images: ImageFetcher = {
    fetch: vi.fn(async () => ({ contentType: 'image/png', body: Buffer.from('png-bytes') })),
  };
  const enquiries = new EnquiryService(catalogue, mailer, 'sales@test.local', silentLogger);
  const app = await buildApp({
    catalogue,
    enquiries,
    images,
    enquiryRateLimitPerMinute: options.rateLimit ?? 100,
  });
  return { app, mailer, images };
}
