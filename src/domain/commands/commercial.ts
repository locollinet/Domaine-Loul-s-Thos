import { ensure } from '../errors';
import { isNonNegativeInt, isPositiveInt, vatCents } from '../quantities';
import { batchPosition, getOrThrow, invoiceBalance, nextId } from '../selectors';
import type { DomainState, RoleId } from '../types';
import type { Command, CommandContext, CommandResult } from './types';

type Payload<T extends Command['type']> = Extract<Command, { type: T }>['payload'];

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function reserveLines(state: DomainState, lines: { batchId: string; quantity: number }[]): void {
  const wanted = new Map<string, number>();
  for (const l of lines) wanted.set(l.batchId, (wanted.get(l.batchId) ?? 0) + l.quantity);
  for (const [batchId, q] of wanted) {
    const b = getOrThrow(state.batches, batchId, 'Lot de mise');
    ensure(b.quality === 'released', 'quality_hold', `${b.code} est bloqué qualité : réservation refusée.`);
    const pos = batchPosition(state, b);
    ensure(q <= pos.available, 'insufficient_stock', `${b.code} : ${pos.available} bouteille(s) disponible(s), ${q} demandée(s).`);
  }
}

// ------------------------------------------------------------------ Orders

function orderCreate(state: DomainState, p: Payload<'order.create'>, ctx: CommandContext): CommandResult {
  getOrThrow(state.customers, p.customerId, 'Client');
  ensure(p.lines.length > 0, 'validation', 'Au moins une ligne.');
  for (const l of p.lines) {
    const sku = getOrThrow(state.skus, l.skuId, 'Article');
    const b = getOrThrow(state.batches, l.batchId, 'Lot de mise');
    ensure(b.skuId === sku.id, 'validation', `Le lot ${b.code} ne correspond pas à l’article ${sku.label}.`);
    ensure(isPositiveInt(l.quantity), 'invalid_quantity', 'Quantité invalide (entier > 0).', 'quantity');
    ensure(isNonNegativeInt(l.unitPriceHtCents), 'invalid_quantity', 'Prix invalide.', 'unitPriceHtCents');
  }
  if (!p.asQuote) reserveLines(state, p.lines);
  const id = nextId(state, 'order');
  const n = state.counters['order'] ?? 0;
  state.orders[id] = {
    id,
    code: `${p.asQuote ? 'DV' : 'CO'}-26-${String(n).padStart(3, '0')}`,
    customerId: p.customerId,
    createdAt: ctx.now,
    status: p.asQuote ? 'quote' : 'confirmed',
    lines: p.lines.map((l) => ({
      id: nextId(state, 'oline'),
      skuId: l.skuId,
      batchId: l.batchId,
      quantity: l.quantity,
      unitPriceHtCents: l.unitPriceHtCents,
      reserved: p.asQuote ? 0 : l.quantity,
      shipped: 0,
    })),
  };
  return { message: p.asQuote ? 'Devis enregistré (aucune réservation).' : 'Commande confirmée et réservée.', createdIds: [id] };
}

function orderConfirm(state: DomainState, p: Payload<'order.confirm'>): CommandResult {
  const o = getOrThrow(state.orders, p.orderId, 'Commande');
  ensure(o.status === 'quote', 'invalid_state', 'Seul un devis peut être confirmé.');
  reserveLines(state, o.lines);
  for (const l of o.lines) l.reserved = l.quantity;
  o.status = 'confirmed';
  o.code = o.code.replace(/^DV/, 'CO');
  return { message: 'Devis confirmé : bouteilles réservées.', createdIds: [] };
}

function orderCancel(state: DomainState, p: Payload<'order.cancel'>): CommandResult {
  const o = getOrThrow(state.orders, p.orderId, 'Commande');
  ensure(o.status === 'quote' || o.status === 'confirmed', 'invalid_state', 'Commande déjà (partiellement) livrée : annulation refusée.');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif requis.', 'reason');
  for (const l of o.lines) l.reserved = 0;
  o.status = 'cancelled';
  return { message: 'Commande annulée, réservations libérées.', createdIds: [] };
}

function shipmentCreate(state: DomainState, p: Payload<'shipment.create'>, ctx: CommandContext): CommandResult {
  const o = getOrThrow(state.orders, p.orderId, 'Commande');
  ensure(o.status === 'confirmed' || o.status === 'partially_shipped', 'invalid_state', 'Commande non livrable dans son état actuel.');
  const lines = p.lines.filter((l) => l.quantity !== 0);
  ensure(lines.length > 0, 'validation', 'Aucune quantité à livrer.');
  const perBatch = new Map<string, number>();
  for (const l of lines) {
    const ol = o.lines.find((x) => x.id === l.orderLineId);
    ensure(ol, 'not_found', 'Ligne de commande introuvable.');
    ensure(isPositiveInt(l.quantity), 'invalid_quantity', 'Quantité livrée invalide.', 'quantity');
    ensure(l.quantity <= ol.reserved, 'insufficient_stock', `Quantité supérieure au reliquat réservé (${ol.reserved}).`);
    const b = getOrThrow(state.batches, ol.batchId, 'Lot de mise');
    ensure(b.quality === 'released', 'quality_hold', `${b.code} est bloqué qualité : expédition refusée.`);
    perBatch.set(b.id, (perBatch.get(b.id) ?? 0) + l.quantity);
  }
  for (const [batchId, q] of perBatch) {
    ensure(q <= state.batches[batchId]!.physical, 'insufficient_stock', 'Stock physique insuffisant.');
  }
  for (const l of lines) {
    const ol = o.lines.find((x) => x.id === l.orderLineId)!;
    ol.reserved -= l.quantity;
    ol.shipped += l.quantity;
    state.batches[ol.batchId]!.physical -= l.quantity;
  }
  o.status = o.lines.every((l) => l.shipped === l.quantity) ? 'shipped' : 'partially_shipped';
  const id = nextId(state, 'shipment');
  const n = state.counters['shipment'] ?? 0;
  state.shipments[id] = {
    id,
    code: `BL-26-${String(n).padStart(3, '0')}`,
    orderId: o.id,
    shippedAt: ctx.now,
    lines: lines.map((l) => ({ orderLineId: l.orderLineId, batchId: o.lines.find((x) => x.id === l.orderLineId)!.batchId, quantity: l.quantity })),
    invoiceId: null,
    returned: [],
  };
  return { message: `Livraison ${state.shipments[id]!.code} enregistrée.`, createdIds: [id] };
}

// ------------------------------------------------------------------ Demo finance

function invoiceCreate(state: DomainState, p: Payload<'invoice.create'>, ctx: CommandContext): CommandResult {
  const s = getOrThrow(state.shipments, p.shipmentId, 'Livraison');
  ensure(s.invoiceId === null, 'invalid_state', 'Livraison déjà facturée.');
  const o = state.orders[s.orderId]!;
  const lines = s.lines.map((l) => {
    const ol = o.lines.find((x) => x.id === l.orderLineId)!;
    const sku = state.skus[ol.skuId]!;
    return { label: `${sku.label} — lot ${state.batches[l.batchId]!.code}`, quantity: l.quantity, unitPriceHtCents: ol.unitPriceHtCents, htCents: l.quantity * ol.unitPriceHtCents };
  });
  const ht = lines.reduce((a, l) => a + l.htCents, 0);
  const vat = vatCents(ht, state.demoVatBasisPoints);
  const id = nextId(state, 'invoice');
  const n = state.counters['invoice'] ?? 0;
  const issued = ctx.now.slice(0, 10);
  const customer = state.customers[o.customerId]!;
  state.invoices[id] = {
    id,
    code: `FD-26-${String(n).padStart(3, '0')}`,
    shipmentId: s.id,
    customerId: o.customerId,
    issuedAt: issued,
    dueAt: addDays(issued, customer.paymentTermsDays),
    lines,
    htCents: ht,
    vatBasisPoints: state.demoVatBasisPoints,
    vatCents: vat,
    ttcCents: ht + vat,
  };
  s.invoiceId = id;
  return { message: `Facture de démonstration ${state.invoices[id]!.code} émise (aucun déstockage).`, createdIds: [id] };
}

function creditNoteCreate(state: DomainState, p: Payload<'creditNote.create'>, ctx: CommandContext): CommandResult {
  const inv = getOrThrow(state.invoices, p.invoiceId, 'Facture');
  ensure(isPositiveInt(p.htCents), 'invalid_quantity', 'Montant HT invalide.', 'htCents');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif requis.', 'reason');
  const creditedHt = Object.values(state.creditNotes).filter((c) => c.invoiceId === inv.id).reduce((a, c) => a + c.htCents, 0);
  ensure(p.htCents <= inv.htCents - creditedHt, 'validation', `Avoir limité au HT restant (${((inv.htCents - creditedHt) / 100).toFixed(2)} €).`, 'htCents');
  const vat = vatCents(p.htCents, inv.vatBasisPoints);
  const bal = invoiceBalance(state, inv.id);
  ensure(p.htCents + vat <= bal.balance, 'validation', 'Avoir supérieur au solde restant dû (remboursement hors démo).', 'htCents');
  const id = nextId(state, 'credit');
  const n = state.counters['credit'] ?? 0;
  state.creditNotes[id] = { id, code: `AV-26-${String(n).padStart(3, '0')}`, invoiceId: inv.id, issuedAt: ctx.now.slice(0, 10), reason: p.reason.trim(), htCents: p.htCents, vatCents: vat, ttcCents: p.htCents + vat };
  return { message: 'Avoir de démonstration émis (stock inchangé).', createdIds: [id] };
}

function paymentRecord(state: DomainState, p: Payload<'payment.record'>, ctx: CommandContext): CommandResult {
  getOrThrow(state.invoices, p.invoiceId, 'Facture');
  ensure(isPositiveInt(p.amountCents), 'invalid_quantity', 'Montant invalide.', 'amountCents');
  const bal = invoiceBalance(state, p.invoiceId);
  ensure(p.amountCents <= bal.balance, 'validation', `Montant supérieur au solde (${(bal.balance / 100).toFixed(2)} €).`, 'amountCents');
  const id = nextId(state, 'payment');
  state.payments[id] = { id, invoiceId: p.invoiceId, receivedAt: ctx.now.slice(0, 10), amountCents: p.amountCents, method: p.method };
  return { message: 'Règlement simulé enregistré.', createdIds: [id] };
}

// ------------------------------------------------------------------ Returns

function returnReceive(state: DomainState, p: Payload<'return.receive'>, ctx: CommandContext): CommandResult {
  const s = getOrThrow(state.shipments, p.shipmentId, 'Livraison');
  const b = getOrThrow(state.batches, p.batchId, 'Lot de mise');
  ensure(isPositiveInt(p.quantity), 'invalid_quantity', 'Quantité retournée invalide.', 'quantity');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif requis.', 'reason');
  const shipped = s.lines.filter((l) => l.batchId === b.id).reduce((a, l) => a + l.quantity, 0);
  const already = s.returned.filter((r) => r.batchId === b.id).reduce((a, r) => a + r.quantity, 0);
  ensure(p.quantity <= shipped - already, 'validation', `Retour limité à ${shipped - already} bouteille(s) livrée(s) non encore retournée(s).`, 'quantity');
  b.quarantine += p.quantity;
  s.returned.push({ batchId: b.id, quantity: p.quantity });
  const id = nextId(state, 'return');
  state.returns[id] = { id, shipmentId: s.id, batchId: b.id, quantity: p.quantity, receivedAt: ctx.now, reason: p.reason.trim(), status: 'quarantine' };
  return { message: `${p.quantity} bouteille(s) réintégrée(s) en quarantaine (non vendables).`, createdIds: [id] };
}

const QUARANTINE_ROLES: RoleId[] = ['direction', 'cellar_master'];

function quarantineResolve(state: DomainState, p: Payload<'quarantine.resolve'>, ctx: CommandContext): CommandResult {
  const b = getOrThrow(state.batches, p.batchId, 'Lot de mise');
  ensure(QUARANTINE_ROLES.includes(ctx.actor), 'forbidden_role', 'Décision réservée au maître de chai ou à la direction (rôle simulé).');
  ensure(isPositiveInt(p.quantity) && p.quantity <= b.quarantine, 'invalid_quantity', `Quantité en quarantaine : ${b.quarantine}.`, 'quantity');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif requis.', 'reason');
  b.quarantine -= p.quantity;
  if (p.decision === 'restock') b.physical += p.quantity;
  b.qualityHistory.push({ at: ctx.now, action: 'release', reason: `Quarantaine ${p.decision === 'restock' ? 'remise en stock' : 'mise au rebut'} : ${p.quantity} — ${p.reason}`, actor: ctx.actor });
  return { message: p.decision === 'restock' ? 'Bouteilles remises en stock vendable.' : 'Bouteilles sorties (rebut, sortie identifiée).', createdIds: [] };
}

// ------------------------------------------------------------------ Purchasing & inventory

function purchaseCreate(state: DomainState, p: Payload<'purchase.create'>, ctx: CommandContext): CommandResult {
  ensure(p.supplier.trim().length > 0, 'validation', 'Fournisseur requis.', 'supplier');
  ensure(p.lines.length > 0, 'validation', 'Au moins une ligne.');
  for (const l of p.lines) {
    getOrThrow(state.dryGoods, l.dryGoodId, 'Matière sèche');
    ensure(isPositiveInt(l.ordered), 'invalid_quantity', 'Quantité commandée invalide.', 'ordered');
    ensure(isNonNegativeInt(l.unitCostCents), 'invalid_quantity', 'Prix unitaire invalide.', 'unitCostCents');
  }
  const id = nextId(state, 'po');
  const n = state.counters['po'] ?? 0;
  state.purchaseOrders[id] = {
    id,
    code: `CF-26-${String(n).padStart(3, '0')}`,
    supplier: p.supplier.trim(),
    orderedAt: ctx.now.slice(0, 10),
    expectedAt: p.expectedAt,
    lines: p.lines.map((l) => ({ ...l, received: 0 })),
    status: 'open',
  };
  return { message: 'Commande fournisseur créée (aucun stock physique ajouté).', createdIds: [id] };
}

function purchaseReceive(state: DomainState, p: Payload<'purchase.receive'>, ctx: CommandContext): CommandResult {
  const po = getOrThrow(state.purchaseOrders, p.purchaseOrderId, 'Commande fournisseur');
  ensure(po.status === 'open' || po.status === 'partially_received', 'invalid_state', 'Commande fournisseur close.');
  const lines = p.lines.filter((l) => l.quantity !== 0);
  ensure(lines.length > 0, 'validation', 'Aucune quantité reçue.');
  for (const l of lines) {
    const pl = po.lines.find((x) => x.dryGoodId === l.dryGoodId);
    ensure(pl, 'validation', 'Article absent de la commande.');
    ensure(isPositiveInt(l.quantity), 'invalid_quantity', 'Quantité reçue invalide.', 'quantity');
    ensure(l.quantity <= pl.ordered - pl.received, 'validation', `Quantité supérieure au reste à recevoir (${pl.ordered - pl.received}).`, 'quantity');
  }
  for (const l of lines) {
    const pl = po.lines.find((x) => x.dryGoodId === l.dryGoodId)!;
    const g = state.dryGoods[l.dryGoodId]!;
    // Weighted average unit cost, rounded to the cent (documented demo method).
    g.unitCostCents = g.unitCostCents === null || g.onHand === 0 ? pl.unitCostCents : Math.round((g.unitCostCents * g.onHand + pl.unitCostCents * l.quantity) / (g.onHand + l.quantity));
    g.onHand += l.quantity;
    pl.received += l.quantity;
  }
  po.status = po.lines.every((l) => l.received === l.ordered) ? 'received' : 'partially_received';
  const id = nextId(state, 'sreceipt');
  state.supplierReceipts[id] = { id, purchaseOrderId: po.id, receivedAt: ctx.now, lines };
  return { message: po.status === 'received' ? 'Réception complète.' : 'Réception partielle : solde à recevoir conservé.', createdIds: [id] };
}

function inventoryCount(state: DomainState, p: Payload<'inventory.count'>, ctx: CommandContext): CommandResult {
  const g = getOrThrow(state.dryGoods, p.dryGoodId, 'Matière sèche');
  ensure(isNonNegativeInt(p.counted), 'invalid_quantity', 'Quantité comptée invalide.', 'counted');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif / contexte d’inventaire requis.', 'reason');
  const id = nextId(state, 'inv');
  state.inventoryCounts[id] = { id, dryGoodId: g.id, countedAt: ctx.now, expected: g.onHand, counted: p.counted, reason: p.reason.trim(), actor: ctx.actor };
  const delta = p.counted - g.onHand;
  g.onHand = p.counted;
  return { message: delta === 0 ? 'Inventaire conforme.' : `Écart d’inventaire enregistré (${delta > 0 ? '+' : ''}${delta}).`, createdIds: [id] };
}

// ------------------------------------------------------------------ Costs & planning

function costAdd(state: DomainState, p: Payload<'cost.add'>, ctx: CommandContext): CommandResult {
  ensure(isPositiveInt(p.amountCents), 'invalid_quantity', 'Montant invalide.', 'amountCents');
  ensure(p.source.trim().length > 0, 'validation', 'Source du coût requise.', 'source');
  const target = p.target.kind === 'lot' ? getOrThrow(state.lots, p.target.lotId, 'Lot') : getOrThrow(state.batches, p.target.batchId, 'Lot de mise');
  target.cost = { knownCents: target.cost.knownCents + p.amountCents, incomplete: target.cost.incomplete };
  const id = nextId(state, 'cost');
  state.costEntries[id] = { id, target: p.target, category: p.category, amountCents: p.amountCents, date: ctx.now.slice(0, 10), source: p.source.trim() };
  return { message: 'Coût connu ajouté.', createdIds: [id] };
}

function forecastAdd(state: DomainState, p: Payload<'forecast.add'>): CommandResult {
  ensure(p.label.trim().length > 0, 'validation', 'Libellé requis.', 'label');
  ensure(isPositiveInt(p.amountCents), 'invalid_quantity', 'Montant invalide.', 'amountCents');
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(p.date), 'validation', 'Date invalide.', 'date');
  ensure(p.certainty !== 'certain', 'validation', 'Une ligne saisie manuellement est engagée ou estimée ; le « certain » provient des documents.');
  const id = nextId(state, 'fc');
  state.forecast[id] = { ...p, id, label: p.label.trim() };
  return { message: 'Ligne de prévision ajoutée (n’affecte pas le réalisé).', createdIds: [id] };
}

function projectUpdate(state: DomainState, p: Payload<'project.updateBudget'>, ctx: CommandContext): CommandResult {
  const pr = getOrThrow(state.projects, p.projectId, 'Projet');
  ensure(p.change.trim().length > 0, 'validation', 'Motif de révision requis.', 'change');
  for (const l of p.budgetLines) {
    ensure(l.label.trim().length > 0, 'validation', 'Libellé de ligne requis.');
    ensure(isNonNegativeInt(l.amountCents), 'invalid_quantity', 'Montant invalide.');
  }
  const before = pr.budgetLines.reduce((a, l) => a + l.amountCents, 0);
  const after = p.budgetLines.reduce((a, l) => a + l.amountCents, 0);
  pr.budgetLines = p.budgetLines;
  pr.history.push({ at: ctx.now, change: `${p.change.trim()} (budget ${(before / 100).toFixed(0)} € → ${(after / 100).toFixed(0)} €)` });
  return { message: 'Budget prévisionnel révisé (historique conservé).', createdIds: [] };
}

export const commercialHandlers = {
  'order.create': orderCreate,
  'order.confirm': orderConfirm,
  'order.cancel': orderCancel,
  'shipment.create': shipmentCreate,
  'invoice.create': invoiceCreate,
  'creditNote.create': creditNoteCreate,
  'payment.record': paymentRecord,
  'return.receive': returnReceive,
  'quarantine.resolve': quarantineResolve,
  'purchase.create': purchaseCreate,
  'purchase.receive': purchaseReceive,
  'inventory.count': inventoryCount,
  'cost.add': costAdd,
  'forecast.add': forecastAdd,
  'project.updateBudget': projectUpdate,
};
