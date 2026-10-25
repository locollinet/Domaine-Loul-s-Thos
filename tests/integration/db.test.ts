import { beforeEach, describe, expect, it } from 'vitest';
import { DomaineDbAdapter } from '../../src/infra/db';
import { DomainError } from '../../src/domain/errors';

describe('DomaineDbAdapter & Local Transactional Integrity', () => {
  let db: DomaineDbAdapter;

  beforeEach(async () => {
    db = new DomaineDbAdapter();
    await db.resetToSeed();
  });

  it('initializes with seed and persists commands atomically', async () => {
    const initialState = await db.loadOrCreateState();
    expect(initialState.batches['batch-2023-old']!.physical).toBe(36);

    const clock = '2026-10-24T10:00:00.000Z';
    const key = 'cmd-order-test-1';

    // Quote creation
    const { state: s1, result: r1, duplicate: d1 } = await db.executeCommand({
      idempotencyKey: key,
      actor: 'sales',
      command: {
        type: 'order.create',
        payload: {
          customerId: 'cust-priv',
          asQuote: true,
          lines: [
            { skuId: 'sku-red-2023-750', batchId: 'batch-2023-old', quantity: 6, unitPriceHtCents: 2400 },
          ],
        },
      },
    }, clock);

    expect(d1).toBe(false);
    expect(r1.createdIds.length).toBe(1);
    const orderId = r1.createdIds[0]!;
    expect(s1.orders[orderId]!.status).toBe('quote');

    // Re-sending with exact same key and payload returns duplicate: true without effect
    const { state: s2, duplicate: d2 } = await db.executeCommand({
      idempotencyKey: key,
      actor: 'sales',
      command: {
        type: 'order.create',
        payload: {
          customerId: 'cust-priv',
          asQuote: true,
          lines: [
            { skuId: 'sku-red-2023-750', batchId: 'batch-2023-old', quantity: 6, unitPriceHtCents: 2400 },
          ],
        },
      },
    }, clock);

    expect(d2).toBe(true);
    expect(Object.keys(s2.orders).length).toBe(Object.keys(s1.orders).length);

    // Re-sending with same key but DIFFERENT payload throws idempotency_conflict
    await expect(db.executeCommand({
      idempotencyKey: key,
      actor: 'sales',
      command: {
        type: 'order.create',
        payload: {
          customerId: 'cust-priv',
          asQuote: false,
          lines: [
            { skuId: 'sku-red-2023-750', batchId: 'batch-2023-old', quantity: 12, unitPriceHtCents: 2400 },
          ],
        },
      },
    }, clock)).rejects.toThrow(DomainError);

    // Verify journal and replay
    const replayed = await db.replay(await db.resetToSeed());
    expect(replayed).toBeDefined();
  });

  it('aborts transaction and preserves state on business refusal', async () => {
    const s0 = await db.loadOrCreateState();
    const initialBatches = structuredClone(s0.batches);

    // Try to ship without an order line
    await expect(db.executeCommand({
      idempotencyKey: 'fail-ship-1',
      actor: 'cellar_master',
      command: {
        type: 'shipment.create',
        payload: {
          orderId: 'non-existent-order',
          lines: [],
        },
      },
    }, '2026-10-24T10:00:00.000Z')).rejects.toThrow();

    const s1 = await db.loadOrCreateState();
    expect(s1.batches).toEqual(initialBatches);
  });
});
