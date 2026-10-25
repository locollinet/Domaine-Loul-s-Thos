import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/domain/commands';
import { DomainError } from '../src/domain/errors';
import { createSeedState } from '../src/seed/seed';

describe('Quality Matrix Invariants (from QUALITY.md & DOMAIN.md)', () => {
  it('refuses tare >= gross with explicit validation error', () => {
    const state = createSeedState();
    const ctx = { now: '2026-10-24T10:00:00.000Z', actor: 'cellar_master' as const };

    expect(() => applyCommand(state, {
      type: 'reception.record',
      payload: {
        transportId: 'transport-2026-a',
        ticket: 'TK-ERR',
        grossG: 100000,
        tareG: 100000, // tare == gross
        control: 'Contrôle',
        destination: { kind: 'existing', lotId: 'lot-2026-white' },
      },
    }, ctx)).toThrow(DomainError);

    expect(() => applyCommand(state, {
      type: 'reception.record',
      payload: {
        transportId: 'transport-2026-a',
        ticket: 'TK-ERR',
        grossG: 90000,
        tareG: 100000, // tare > gross
        control: 'Contrôle',
        destination: { kind: 'existing', lotId: 'lot-2026-white' },
      },
    }, ctx)).toThrow(DomainError);
  });

  it('tracks harvest counts, increments version on correction and rejects stale version edits', () => {
    let state = createSeedState();
    const ctx = { now: '2026-10-24T10:00:00.000Z', actor: 'vineyard_manager' as const };

    // Saisie d'un comptage sur mission-h-c (in_progress)
    const countRes = applyCommand(state, {
      type: 'harvest.count',
      payload: {
        missionId: 'mission-h-c',
        crateType: 'crate-20',
        quantity: 8,
      },
    }, ctx);
    state = countRes.state;
    const countId = countRes.result.createdIds[0]!;

    const c0 = state.harvestCounts[countId]!;
    expect(c0.quantity).toBe(8);
    expect(c0.version).toBe(1);

    // Corriger 8 -> 6
    const corrRes = applyCommand(state, {
      type: 'harvest.correctCount',
      payload: {
        countId,
        expectedVersion: 1,
        quantity: 6,
        reason: 'Erreur de décompte au chargement',
      },
    }, ctx);
    state = corrRes.state;
    const c1 = state.harvestCounts[countId]!;
    expect(c1.quantity).toBe(6);
    expect(c1.version).toBe(2);
    expect(c1.corrections.length).toBe(1);
    expect(c1.corrections[0]!.before).toBe(8);
    expect(c1.corrections[0]!.after).toBe(6);

    // Conflit : tentative de correction en supposant la version 1
    expect(() => applyCommand(state, {
      type: 'harvest.correctCount',
      payload: {
        countId,
        expectedVersion: 1,
        quantity: 5,
        reason: 'Modification concurrente',
      },
    }, ctx)).toThrow(DomainError);
  });

  it('enforces role authorization on quality release', () => {
    const state = createSeedState();
    // Sales role cannot release a held lot
    expect(() => applyCommand(state, {
      type: 'quality.release',
      payload: { target: 'lot', id: 'lot-2026-white', reason: 'Essai libération par commercial' },
    }, { now: '2026-10-24T10:00:00.000Z', actor: 'sales' })).toThrow(DomainError);

    // Cellar master can release
    const res = applyCommand(state, {
      type: 'quality.release',
      payload: { target: 'lot', id: 'lot-2026-white', reason: 'Fin des fermentations et analyses conformes' },
    }, { now: '2026-10-24T10:00:00.000Z', actor: 'cellar_master' });

    expect(res.state.lots['lot-2026-white']!.quality).toBe('released');
  });
});
