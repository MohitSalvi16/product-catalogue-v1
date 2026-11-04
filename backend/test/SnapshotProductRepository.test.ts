import { describe, expect, it, vi } from 'vitest';
import { SnapshotProductRepository } from '../src/adapters/products/SnapshotProductRepository.js';
import { product, silentLogger } from './helpers.js';

const TTL = 1000;

function setup(load: () => Promise<ReturnType<typeof product>[]>) {
  const clock = { time: 0 };
  const loader = vi.fn(load);
  const repository = new SnapshotProductRepository(loader, TTL, silentLogger, () => clock.time);
  return { clock, loader, repository };
}

describe('SnapshotProductRepository', () => {
  it('loads once within the TTL and again after it', async () => {
    const { clock, loader, repository } = setup(async () => [product('1', 'a')]);

    await repository.findAll();
    await repository.findById('1');
    expect(loader).toHaveBeenCalledTimes(1);

    clock.time = TTL;
    await repository.findAll();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shares one load between concurrent callers', async () => {
    const { loader, repository } = setup(async () => [product('1', 'a')]);

    await Promise.all([repository.findAll(), repository.findAll(), repository.listCategories()]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('serves the stale snapshot when a refresh fails, then backs off for a TTL', async () => {
    const { clock, loader, repository } = setup(async () => [product('1', 'a')]);
    await repository.findAll();

    loader.mockRejectedValue(new Error('upstream down'));
    clock.time = TTL;
    expect(await repository.findById('1')).not.toBeNull();
    expect(loader).toHaveBeenCalledTimes(2);

    await repository.findAll();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('propagates the failure when there is no snapshot, and retries next time', async () => {
    const { loader, repository } = setup(async () => {
      throw new Error('upstream down');
    });

    await expect(repository.findAll()).rejects.toThrow('upstream down');
    loader.mockResolvedValue([product('1', 'a')]);
    expect(await repository.findAll()).toHaveLength(1);
  });
});
