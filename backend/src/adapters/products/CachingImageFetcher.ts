import type { ImageData, ImageFetcher } from '../../ports/ImageFetcher.js';

/**
 * Keeps recent images in memory, oldest out first, so the image host is hit once
 * per image rather than once per visitor. Storing the promise means concurrent
 * requests share a fetch. Failures are dropped so the next request retries.
 */
export class CachingImageFetcher implements ImageFetcher {
  private readonly cache = new Map<string, Promise<ImageData>>();

  constructor(
    private readonly inner: ImageFetcher,
    private readonly maxEntries: number,
  ) {}

  fetch(url: string): Promise<ImageData> {
    const cached = this.cache.get(url);
    if (cached) return cached;

    const image = this.inner.fetch(url);
    image.catch(() => this.cache.delete(url));

    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(url, image);
    return image;
  }
}
