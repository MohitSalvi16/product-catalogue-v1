import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net';
import pino from 'pino';
import { createDependencies } from './composition.js';
import { loadConfig } from './config.js';
import { buildApp } from './http/app.js';

// Node's default of 250ms per address is too short for slower links: every address
// times out and fetch fails long before UPSTREAM_TIMEOUT_MS. Two attempts fit inside it.
setDefaultAutoSelectFamilyAttemptTimeout(2_000);

const config = loadConfig();
const logger = pino({ level: config.LOG_LEVEL });

const app = await buildApp(createDependencies(config, logger), {
  loggerInstance: logger,
  trustProxy: (_address, hop) => hop < config.TRUST_PROXY_HOPS,
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ port: config.PORT, host: config.HOST });
