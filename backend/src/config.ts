import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  // Reverse proxies in front of the API. Decides which address rate limiting sees.
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),

  PRODUCT_SOURCE: z.enum(['fakestore', 'fixture']).default('fakestore'),
  FAKE_STORE_BASE_URL: z.url().default('https://fakestoreapi.com'),
  PRODUCT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  // Longer than the JSON budget: images are large and several load at once on a cold cache.
  IMAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),

  TOP_RATED_PRODUCT_IDS: z
    .string()
    .default('1,5,9,14,15')
    .transform((ids) => ids.split(',').map((id) => id.trim()).filter(Boolean))
    .refine((ids) => ids.length > 0, 'At least one product id is required')
    .refine((ids) => new Set(ids).size === ids.length, 'Product ids must be unique'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Catalogue <no-reply@catalogue.local>'),
  SALES_INBOX_EMAIL: z.email().default('sales@catalogue.local'),
  ENQUIRY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
});

export type Config = z.infer<typeof envSchema>;

/** Fails at startup rather than on the first customer enquiry. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
