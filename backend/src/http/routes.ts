import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Product } from '../domain/product.js';
import type { ImageFetcher } from '../ports/ImageFetcher.js';
import type { CatalogueService } from '../services/CatalogueService.js';
import type { EnquiryService } from '../services/EnquiryService.js';

export interface RouteDependencies {
  catalogue: CatalogueService;
  enquiries: EnquiryService;
  images: ImageFetcher;
  enquiryRateLimitPerMinute: number;
}

const productIdParams = z.object({ id: z.string().regex(/^[\w-]{1,64}$/) });
const categoryParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) });
const searchQuery = z.object({ q: z.string().trim().min(1).max(100) });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const enquiryBody = z.object({
  productId: productIdParams.shape.id,
  name: z.string().trim().min(1, 'Please enter your name').max(100),
  email: z.email('Please enter a valid email address').max(254),
  phone: optionalText(30),
  message: optionalText(2000),
});

/** The client only ever sees our image URL, so it never talks to the data source. */
function toProductDto(product: Product) {
  return { ...product, imageUrl: `/api/products/${encodeURIComponent(product.id)}/image` };
}

export function registerRoutes(app: FastifyInstance, deps: RouteDependencies) {
  const { catalogue, enquiries, images, enquiryRateLimitPerMinute } = deps;

  app.get('/api/health', async () => ({ status: 'ok' }));

  app.get('/api/categories', async () => ({ items: await catalogue.listCategories() }));

  app.get('/api/categories/:slug', async (request) => {
    const { slug } = categoryParams.parse(request.params);
    const { category, topRated, others } = await catalogue.getCategoryPage(slug);
    return {
      category,
      topRated: topRated.map(toProductDto),
      others: others.map(toProductDto),
    };
  });

  app.get('/api/products/top-rated', async () => ({
    items: (await catalogue.getTopRated()).map(toProductDto),
  }));

  app.get('/api/products/search', async (request) => {
    const { q } = searchQuery.parse(request.query);
    return { items: (await catalogue.search(q)).map(toProductDto) };
  });

  app.get('/api/products/:id', async (request) => {
    const { id } = productIdParams.parse(request.params);
    return toProductDto(await catalogue.getProduct(id));
  });

  app.get('/api/products/:id/image', async (request, reply) => {
    const { id } = productIdParams.parse(request.params);
    const product = await catalogue.getProduct(id);
    const { contentType, body } = await images.fetch(product.imageUrl);
    return reply
      .header('content-type', contentType)
      .header('cache-control', 'public, max-age=86400')
      .send(body);
  });

  app.post(
    '/api/enquiries',
    {
      bodyLimit: 16 * 1024,
      config: { rateLimit: { max: enquiryRateLimitPerMinute, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      await enquiries.submit(enquiryBody.parse(request.body));
      return reply.status(202).send({ status: 'received' });
    },
  );
}
