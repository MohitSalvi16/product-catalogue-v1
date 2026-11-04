import { ProductSourceError } from '../../domain/errors.js';
import type { ImageData, ImageFetcher } from '../../ports/ImageFetcher.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Only ever called with URLs from the data source, never with client input. */
export class HttpImageFetcher implements ImageFetcher {
  constructor(private readonly timeoutMs: number) {}

  async fetch(url: string): Promise<ImageData> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok) throw new Error(`Image host responded ${response.status}`);
      if (!contentType.startsWith('image/')) throw new Error(`Unexpected type ${contentType}`);

      // Checked again below, because the header is optional.
      if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
        throw new Error('Image too large');
      }

      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > MAX_IMAGE_BYTES) throw new Error('Image too large');
      return { contentType, body };
    } catch (error) {
      throw new ProductSourceError('Could not load product image', { cause: error });
    }
  }
}
