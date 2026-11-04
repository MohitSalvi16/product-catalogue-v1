import { describe, expect, it, vi } from 'vitest';
import { CachingImageFetcher } from '../src/adapters/products/CachingImageFetcher.js';

const image = { contentType: 'image/png', body: Buffer.from('png') };

describe('CachingImageFetcher', () => {
  it('shares one fetch between concurrent and later requests', async () => {
    const fetch = vi.fn(async () => image);
    const images = new CachingImageFetcher({ fetch }, 10);

    await Promise.all([images.fetch('a'), images.fetch('a')]);
    await images.fetch('a');

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    const fetch = vi.fn(async () => image).mockRejectedValueOnce(new Error('timeout'));
    const images = new CachingImageFetcher({ fetch }, 10);

    await expect(images.fetch('a')).rejects.toThrow('timeout');
    await expect(images.fetch('a')).resolves.toBe(image);
  });

  it('evicts the oldest entry at capacity', async () => {
    const fetch = vi.fn(async () => image);
    const images = new CachingImageFetcher({ fetch }, 2);

    await images.fetch('a');
    await images.fetch('b');
    await images.fetch('c');
    await images.fetch('c');
    expect(fetch).toHaveBeenCalledTimes(3);

    await images.fetch('a');
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
