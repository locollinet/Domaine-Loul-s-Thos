import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/commands';
import { DomainError } from '../src/domain/errors';
import { createSeedState } from '../src/seed/seed';
import { lotVolumeMl, batchPosition, invoiceBalance } from '../src/domain/selectors';

describe('Fixture Scenario & Invariants (Port from validate_fixture.py)', () => {
  it('executes the full demo scenario with exact conservation and checks', () => {
    let state = createSeedState();
    const ctx = { now: '2026-10-24T10:00:00.000Z', actor: 'direction' as const };

    // Initial volumes check
    expect(lotVolumeMl(state, 'lot-2024-aging')).toBe(200000);
    expect(lotVolumeMl(state, 'lot-2025-a')).toBe(600000);
    expect(lotVolumeMl(state, 'lot-2025-b')).toBe(400000);
    expect(lotVolumeMl(state, 'lot-2026-white')).toBe(150000);
    expect(lotVolumeMl(state, 'lot-2026-red')).toBe(180000);

    // 1. Blend 2025: 300L of lot-2025-a (in tank-02) + 200L of lot-2025-b (in tank-03) -> 500L in tank-04
    const blendRes = applyCommand(state, {
      type: 'blend.execute',
      payload: {
        name: 'Rouge 2025 Assemblage — Démo',
        cuveeId: 'cuvee-red',
        destinationContainerId: 'tank-04',
        inputs: [
          { lotId: 'lot-2025-a', containerId: 'tank-02', volumeMl: 300000 },
          { lotId: 'lot-2025-b', containerId: 'tank-03', volumeMl: 200000 },
        ],
      },
    }, ctx);
    state = blendRes.state;
    const blendLotId = blendRes.result.createdIds[0]!;

    expect(lotVolumeMl(state, 'lot-2025-a')).toBe(300000);
    expect(lotVolumeMl(state, 'lot-2025-b')).toBe(200000);
    expect(lotVolumeMl(state, blendLotId)).toBe(500000);
    // Cost allocation check: 80000 * 300/600 = 40000, 60000 * 200/400 = 30000 => 70000 cents
    expect(state.lots[blendLotId]!.cost.knownCents).toBe(70000);
    expect(state.lots['lot-2025-a']!.cost.knownCents).toBe(40000);
    expect(state.lots['lot-2025-b']!.cost.knownCents).toBe(30000);

    // 2. Bottling: 500L -> 660 bottles of 75cl (495L) + 5L loss. Additional cost: 33000 cents.
    // Check failure if dry goods insufficient
    const stateLowGoods = structuredClone(state);
    stateLowGoods.dryGoods['closure']!.onHand = 1;
    expect(() => applyCommand(stateLowGoods, {
      type: 'bottling.execute',
      payload: {
        lotId: blendLotId,
        containerId: 'tank-04',
        skuId: 'sku-red-2025-750',
        inputVolumeMl: 500000,
        bottles: 660,
        lossMl: 5000,
        serviceCostCents: 33000,
      },
    }, ctx)).toThrow(DomainError);

    // Check failure if loss does not match input volume conservation
    expect(() => applyCommand(state, {
      type: 'bottling.execute',
      payload: {
        lotId: blendLotId,
        containerId: 'tank-04',
        skuId: 'sku-red-2025-750',
        inputVolumeMl: 500000,
        bottles: 660,
        lossMl: 0, // 660*750 = 495000 != 500000
        serviceCostCents: 33000,
      },
    }, ctx)).toThrow(DomainError);

    // Apply valid bottling
    const bottleRes = applyCommand(state, {
      type: 'bottling.execute',
      payload: {
        lotId: blendLotId,
        containerId: 'tank-04',
        skuId: 'sku-red-2025-750',
        inputVolumeMl: 500000,
        bottles: 660,
        lossMl: 5000,
        serviceCostCents: 33000,
      },
    }, ctx);
    state = bottleRes.state;
    const batchId = bottleRes.result.createdIds[0]!;

    expect(lotVolumeMl(state, blendLotId)).toBe(0);
    expect(state.lots[blendLotId]!.stage).toBe('bottled');
    expect(state.batches[batchId]!.physical).toBe(660);
    // Materials consumed check:
    expect(state.dryGoods['bottle-750']!.onHand).toBe(340); // 1000 - 660
    expect(state.dryGoods['closure']!.onHand).toBe(340);
    expect(state.dryGoods['label-2025']!.onHand).toBe(340);
    expect(state.dryGoods['carton-6']!.onHand).toBe(90); // 200 - 110 cartons

    // 3. Order & Reservation: 120 bottles
    // If quality held, ordering fails
    const stateHeld = structuredClone(state);
    stateHeld.batches[batchId]!.quality = 'held';
    expect(() => applyCommand(stateHeld, {
      type: 'order.create',
      payload: {
        customerId: 'cust-resto',
        asQuote: false,
        lines: [{ skuId: 'sku-red-2025-750', batchId, quantity: 120, unitPriceHtCents: 2000 }],
      },
    }, ctx)).toThrow(DomainError);

    // If quantity exceeds available (e.g. 661), fails
    expect(() => applyCommand(state, {
      type: 'order.create',
      payload: {
        customerId: 'cust-resto',
        asQuote: false,
        lines: [{ skuId: 'sku-red-2025-750', batchId, quantity: 661, unitPriceHtCents: 2000 }],
      },
    }, ctx)).toThrow(DomainError);

    const orderRes = applyCommand(state, {
      type: 'order.create',
      payload: {
        customerId: 'cust-resto',
        asQuote: false,
        lines: [{ skuId: 'sku-red-2025-750', batchId, quantity: 120, unitPriceHtCents: 2000 }],
      },
    }, ctx);
    state = orderRes.state;
    const orderId = orderRes.result.createdIds[0]!;
    const orderLineId = state.orders[orderId]!.lines[0]!.id;

    let pos = batchPosition(state, state.batches[batchId]!);
    expect(pos.physical).toBe(660);
    expect(pos.reserved).toBe(120);
    expect(pos.available).toBe(540);

    // 4. Shipment: ship 72 of the 120 reserved bottles
    const shipRes = applyCommand(state, {
      type: 'shipment.create',
      payload: {
        orderId,
        lines: [{ orderLineId, quantity: 72 }],
      },
    }, ctx);
    state = shipRes.state;
    const shipId = shipRes.result.createdIds[0]!;

    pos = batchPosition(state, state.batches[batchId]!);
    expect(pos.physical).toBe(588);
    expect(pos.reserved).toBe(48);
    expect(pos.available).toBe(540);

    // 2023 stock remains unaffected
    expect(state.batches['batch-2023-old']!.physical).toBe(36);

    // 5. Demo invoice: 72 bottles @ 20€ HT = 1440.00€ HT, VAT 20% = 288.00€ => 1728.00€ TTC
    const invRes = applyCommand(state, {
      type: 'invoice.create',
      payload: { shipmentId: shipId },
    }, ctx);
    state = invRes.state;
    const invId = invRes.result.createdIds[0]!;
    const invoice = state.invoices[invId]!;

    expect(invoice.htCents).toBe(144000);
    expect(invoice.vatCents).toBe(28800);
    expect(invoice.ttcCents).toBe(172800);

    // Invoice creation does not modify stock
    pos = batchPosition(state, state.batches[batchId]!);
    expect(pos.physical).toBe(588);

    // 6. Payment: 1000.00€ paid -> balance 728.00€ TTC
    const payRes = applyCommand(state, {
      type: 'payment.record',
      payload: { invoiceId: invId, amountCents: 100000, method: 'virement-simulé' },
    }, ctx);
    state = payRes.state;

    const bal = invoiceBalance(state, invId);
    expect(bal.paid).toBe(100000);
    expect(bal.balance).toBe(72800);
  });
});
