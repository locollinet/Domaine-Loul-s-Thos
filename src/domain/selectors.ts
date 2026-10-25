import { DomainError, ensure } from './errors';
import type { BottlingBatch, Container, DomainState, Id, Occupancy, RoleId, WineLot } from './types';

export function nextId(state: DomainState, prefix: string): string {
  const n = (state.counters[prefix] ?? 0) + 1;
  state.counters[prefix] = n;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

export function getOrThrow<T>(map: Record<Id, T>, id: Id, label: string): T {
  const v = map[id];
  if (v === undefined) throw new DomainError('not_found', `${label} introuvable (${id}).`);
  return v;
}

export function lotOccupancies(state: DomainState, lotId: Id): Occupancy[] {
  return Object.values(state.occupancies)
    .filter((o) => o.lotId === lotId)
    .sort((a, b) => a.containerId.localeCompare(b.containerId));
}

/** Lot volume is always derived from occupancies (never edited directly). */
export function lotVolumeMl(state: DomainState, lotId: Id): number {
  return lotOccupancies(state, lotId).reduce((s, o) => s + o.volumeMl, 0);
}

export function containerFreeMl(state: DomainState, c: Container): number {
  return c.capacityMl - (state.occupancies[c.id]?.volumeMl ?? 0);
}

export interface BatchPosition {
  physical: number;
  reserved: number;
  /** Physically present but not sellable : held quality (whole batch) — never double-subtracted with reservations. */
  blocked: number;
  quarantine: number;
  available: number;
}

export function batchReserved(state: DomainState, batchId: Id): number {
  let r = 0;
  for (const o of Object.values(state.orders)) {
    if (o.status === 'cancelled' || o.status === 'quote') continue;
    for (const l of o.lines) if (l.batchId === batchId) r += l.reserved;
  }
  return r;
}

export function batchPosition(state: DomainState, batch: BottlingBatch): BatchPosition {
  const reserved = batchReserved(state, batch.id);
  const held = batch.quality === 'held';
  return {
    physical: batch.physical,
    reserved,
    blocked: held ? batch.physical : 0,
    quarantine: batch.quarantine,
    available: held ? 0 : Math.max(0, batch.physical - reserved),
  };
}

export function lotLabel(lot: WineLot): string {
  return `${lot.code} · ${lot.name}`;
}

/** Withdraw `volumeMl` of a lot from a given container (removes empty occupancy). */
export function withdraw(state: DomainState, lotId: Id, containerId: Id, volumeMl: number): void {
  const occ = state.occupancies[containerId];
  ensure(occ && occ.lotId === lotId, 'invalid_state', `Le contenant ${containerId} ne contient pas ce lot.`);
  ensure(volumeMl <= occ.volumeMl, 'insufficient_volume', `Volume insuffisant dans ${state.containers[containerId]?.code ?? containerId}.`);
  occ.volumeMl -= volumeMl;
  if (occ.volumeMl === 0) delete state.occupancies[containerId];
}

export function deposit(state: DomainState, lotId: Id, containerId: Id, volumeMl: number, at: string): void {
  const c = getOrThrow(state.containers, containerId, 'Contenant');
  ensure(c.state === 'available', 'invalid_state', `${c.code} est indisponible (maintenance).`);
  const occ = state.occupancies[containerId];
  ensure(!occ || occ.lotId === lotId, 'invalid_state', `${c.code} contient déjà un autre lot (hypothèse démo : un lot par contenant).`);
  const current = occ?.volumeMl ?? 0;
  ensure(current + volumeMl <= c.capacityMl, 'capacity_exceeded', `Capacité de ${c.code} dépassée.`);
  if (occ) occ.volumeMl += volumeMl;
  else state.occupancies[containerId] = { containerId, lotId, volumeMl, since: at };
}

/** Lots that descend from `lotId` (blends) — used for quality impact. */
export function descendants(state: DomainState, lotId: Id): Id[] {
  const out: Id[] = [];
  const queue = [lotId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const l of Object.values(state.lots)) {
      if (l.parents.some((p) => p.lotId === cur) && !out.includes(l.id)) {
        out.push(l.id);
        queue.push(l.id);
      }
    }
  }
  return out;
}

export function ancestors(state: DomainState, lotId: Id): Id[] {
  const out: Id[] = [];
  const queue = [lotId];
  while (queue.length) {
    const cur = queue.shift()!;
    const lot = state.lots[cur];
    if (!lot) continue;
    for (const p of lot.parents) {
      if (!out.includes(p.lotId)) {
        out.push(p.lotId);
        queue.push(p.lotId);
      }
    }
  }
  return out;
}

export const ROLE_LABELS: Record<RoleId, string> = {
  direction: 'Direction',
  cellar_master: 'Maître de chai',
  vineyard_manager: 'Chef de culture',
  sales: 'Commercial',
  accounting: 'Gestion / comptabilité (démo)',
};

export function invoiceBalance(state: DomainState, invoiceId: Id) {
  const inv = getOrThrow(state.invoices, invoiceId, 'Facture');
  const credited = Object.values(state.creditNotes)
    .filter((c) => c.invoiceId === invoiceId)
    .reduce((s, c) => s + c.ttcCents, 0);
  const paid = Object.values(state.payments)
    .filter((p) => p.invoiceId === invoiceId)
    .reduce((s, p) => s + p.amountCents, 0);
  return { ttc: inv.ttcCents, credited, paid, balance: inv.ttcCents - credited - paid };
}
