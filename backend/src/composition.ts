import { createSmtpTransport, SmtpMailer } from './adapters/mail/SmtpMailer.js';
import { CachingImageFetcher } from './adapters/products/CachingImageFetcher.js';
import { createFakeStoreLoader } from './adapters/products/fakeStore.js';
import { loadFixtureProducts } from './adapters/products/fixture.js';
import { HttpImageFetcher } from './adapters/products/httpImageFetcher.js';
import { SnapshotProductRepository } from './adapters/products/SnapshotProductRepository.js';
import type { Config } from './config.js';
import type { RouteDependencies } from './http/routes.js';
import type { Logger } from './ports/Logger.js';
import { CatalogueService } from './services/CatalogueService.js';
import { EnquiryService } from './services/EnquiryService.js';

const IMAGE_CACHE_ENTRIES = 200;

/** The one place that picks adapters. Swapping a provider is a change here plus a new adapter. */
export function createDependencies(config: Config, logger: Logger): RouteDependencies {
  const load =
    config.PRODUCT_SOURCE === 'fixture'
      ? loadFixtureProducts
      : createFakeStoreLoader(config.FAKE_STORE_BASE_URL, config.UPSTREAM_TIMEOUT_MS);

  const products = new SnapshotProductRepository(
    load,
    config.PRODUCT_CACHE_TTL_SECONDS * 1000,
    logger,
  );
  const catalogue = new CatalogueService(products, config.TOP_RATED_PRODUCT_IDS, logger);

  const transport = createSmtpTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    user: config.SMTP_USER,
    pass: config.SMTP_PASS,
  });
  const mailer = new SmtpMailer(transport, config.MAIL_FROM);

  return {
    catalogue,
    enquiries: new EnquiryService(catalogue, mailer, config.SALES_INBOX_EMAIL, logger),
    images: new CachingImageFetcher(new HttpImageFetcher(config.IMAGE_TIMEOUT_MS), IMAGE_CACHE_ENTRIES),
    enquiryRateLimitPerMinute: config.ENQUIRY_RATE_LIMIT_PER_MINUTE,
  };
}
