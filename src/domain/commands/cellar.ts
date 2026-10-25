import { DomainError, ensure } from '../errors';
import { addCosts, isNonNegativeInt, isPositiveInt, splitCost } from '../quantities';
import { deposit, getOrThrow, lotVolumeMl, nextId, withdraw } from '../selectors';
import type { CellarOperation, DomainState, KnownCost, MeasurementParameter, QualityHold, RoleId } from '../types';
import type { Command, CommandContext, CommandResult } from './types';

type Payload<T extends Command['type']> = Extract<Command, { type: T }>['payload'];

export function logOp(state: DomainState, ctx: CommandContext, op: Omit<CellarOperation, 'id' | 'at' | 'actor' | 'source'>): void {
  const id = nextId(state, 'op');
  state.cellarOps[id] = { ...op, id, at: ctx.now, actor: ctx.actor, source: 'manual' };
}

function fmtL(ml: number): string {
  return `${(ml / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} L`;
}

// ------------------------------------------------------------------ Blend

export interface BlendPreview {
  totalMl: number;
  vintage: number;
  color: string;
  cost: KnownCost;
  lines: { lotId: string; volumeMl: number; remainingMl: number; costCents: number; share: number }[];
}

/** Pure preview (trial) : validates and computes, never mutates. */
export function previewBlend(state: DomainState, p: Payload<'blend.execute'>): BlendPreview {
  ensure(p.name.trim().length > 0, 'validation', 'Nom du lot assemblé requis.', 'name');
  ensure(p.inputs.length >= 2, 'validation', 'Un assemblage demande au moins deux lots sources.');
  const lotIds = new Set(p.inputs.map((i) => i.lotId));
  ensure(lotIds.size === p.inputs.length, 'validation', 'Chaque lot source ne peut apparaître qu’une fois.');
  let total = 0;
  const vintages = new Set<number>();
  const colors = new Set<string>();
  const costs: KnownCost[] = [];
  const lines: BlendPreview['lines'] = [];
  for (const input of p.inputs) {
    const lot = getOrThrow(state.lots, input.lotId, 'Lot');
    ensure(isPositiveInt(input.volumeMl), 'invalid_quantity', `Volume invalide pour ${lot.code}.`);
    ensure(lot.quality === 'released', 'quality_hold', `${lot.code} est bloqué qualité : assemblage refusé.`);
    ensure(lot.stage === 'aging' || lot.stage === 'ready', 'invalid_state', `${lot.code} n’est pas prêt à assembler (stade ${lot.stage}).`);
    const occ = state.occupancies[input.containerId];
    ensure(occ && occ.lotId === lot.id, 'invalid_state', `${lot.code} n’est pas dans le contenant choisi.`);
    ensure(input.volumeMl <= occ.volumeMl, 'insufficient_volume', `${lot.code} : ${fmtL(occ.volumeMl)} disponibles dans ce contenant.`);
    const lotVol = lotVolumeMl(state, lot.id);
    const [moved] = splitCost(lot.cost, input.volumeMl, lotVol);
    costs.push(moved);
    total += input.volumeMl;
    vintages.add(lot.vintage);
    colors.add(lot.color);
    lines.push({ lotId: lot.id, volumeMl: input.volumeMl, remainingMl: lotVol - input.volumeMl, costCents: moved.knownCents, share: 0 });
  }
  // Demo scope (fixture): intra-vintage, same colour. Not an appellation rule.
  ensure(vintages.size === 1, 'validation', 'Démo : assemblage limité à un même millésime (hypothèse de démo, pas une règle d’appellation).');
  ensure(colors.size === 1, 'validation', 'Démo : assemblage limité à une même couleur.');
  const dest = getOrThrow(state.containers, p.destinationContainerId, 'Contenant de destination');
  ensure(!p.inputs.some((i) => i.containerId === dest.id), 'validation', 'Le contenant de destination doit être distinct des sources.');
  ensure(dest.state === 'available', 'invalid_state', `${dest.code} est en maintenance.`);
  ensure(!state.occupancies[dest.id], 'invalid_state', `${dest.code} n’est pas vide.`);
  ensure(total <= dest.capacityMl, 'capacity_exceeded', `${dest.code} : capacité ${fmtL(dest.capacityMl)} < ${fmtL(total)}.`);
  for (const l of lines) l.share = l.volumeMl / total;
  return { totalMl: total, vintage: [...vintages][0]!, color: [...colors][0]!, cost: addCosts(...costs), lines };
}

function blendExecute(state: DomainState, p: Payload<'blend.execute'>, ctx: CommandContext): CommandResult {
  const preview = previewBlend(state, p);
  const outId = nextId(state, 'lot');
  const n = state.counters['lot'] ?? 0;
  const origins = new Map<string, Set<string>>();
  for (const input of p.inputs) {
    const lot = state.lots[input.lotId]!;
    const lotVol = lotVolumeMl(state, lot.id);
    const [, remaining] = splitCost(lot.cost, input.volumeMl, lotVol);
    withdraw(state, lot.id, input.containerId, input.volumeMl);
    lot.cost = remaining;
    for (const o of lot.origins) {
      const s = origins.get(o.parcelId) ?? new Set<string>();
      o.receptionIds.forEach((r) => s.add(r));
      origins.set(o.parcelId, s);
    }
    logOp(state, ctx, { lotId: lot.id, type: 'blend', label: 'Sortie vers assemblage', details: `${fmtL(input.volumeMl)} vers ${p.name}` });
  }
  const first = state.lots[p.inputs[0]!.lotId]!;
  state.lots[outId] = {
    id: outId,
    code: `L${String(preview.vintage).slice(2)}-ASS-${String(n).padStart(2, '0')}`,
    name: p.name.trim(),
    cuveeId: p.cuveeId ?? first.cuveeId,
    vintage: preview.vintage,
    color: first.color,
    stage: 'ready',
    quality: 'released',
    qualityHistory: [],
    origins: [...origins.entries()].map(([parcelId, r]) => ({ parcelId, receptionIds: [...r] })),
    parents: p.inputs.map((i) => ({ lotId: i.lotId, volumeMl: i.volumeMl })),
    mention: 'Mention à valider — non déduite de la généalogie',
    cost: preview.cost,
    createdAt: ctx.now,
    createdBy: 'blend',
    grapesReceivedG: 0,
    itinerary: [],
    expectedReady: null,
  };
  deposit(state, outId, p.destinationContainerId, preview.totalMl, ctx.now);
  logOp(state, ctx, {
    lotId: outId,
    type: 'blend',
    label: 'Assemblage réalisé',
    details: p.inputs.map((i) => `${state.lots[i.lotId]!.code} ${fmtL(i.volumeMl)}`).join(' + '),
  });
  return { message: `Assemblage exécuté : ${fmtL(preview.totalMl)} dans ${state.containers[p.destinationContainerId]!.code}.`, createdIds: [outId] };
}

// ------------------------------------------------------------------ Bottling

export interface BottlingRequirement {
  dryGoodId: string;
  required: number;
  onHand: number;
}

export function bottlingRequirements(state: DomainState, skuId: string, bottles: number): BottlingRequirement[] {
  const sku = getOrThrow(state.skus, skuId, 'Article');
  const cartons = Math.ceil(bottles / sku.bottlesPerCarton);
  return sku.bom.map((b) => ({
    dryGoodId: b.dryGoodId,
    required: b.quantity * (b.per === 'bottle' ? bottles : cartons),
    onHand: state.dryGoods[b.dryGoodId]?.onHand ?? 0,
  }));
}

function bottlingExecute(state: DomainState, p: Payload<'bottling.execute'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  const sku = getOrThrow(state.skus, p.skuId, 'Article');
  ensure(isPositiveInt(p.bottles), 'invalid_quantity', 'Nombre de bouteilles invalide.', 'bottles');
  ensure(isNonNegativeInt(p.lossMl), 'invalid_quantity', 'Perte invalide.', 'lossMl');
  ensure(isPositiveInt(p.inputVolumeMl), 'invalid_quantity', 'Volume consommé invalide.', 'inputVolumeMl');
  ensure(isNonNegativeInt(p.serviceCostCents), 'invalid_quantity', 'Coût de prestation invalide.');
  ensure(lot.quality === 'released', 'quality_hold', `${lot.code} est bloqué qualité : mise refusée.`);
  ensure(sku.vintage === lot.vintage, 'validation', 'Le millésime de l’article ne correspond pas au lot.');
  ensure(
    p.inputVolumeMl === p.bottles * sku.sizeMl + p.lossMl,
    'conservation',
    `Conservation : ${fmtL(p.inputVolumeMl)} ≠ ${p.bottles} × ${sku.sizeMl / 10} cl + ${fmtL(p.lossMl)} de perte.`,
  );
  const occ = state.occupancies[p.containerId];
  ensure(occ && occ.lotId === lot.id, 'invalid_state', 'Le contenant ne contient pas ce lot.');
  ensure(p.inputVolumeMl <= occ.volumeMl, 'insufficient_volume', `Volume insuffisant : ${fmtL(occ.volumeMl)} dans le contenant.`);
  const reqs = bottlingRequirements(state, sku.id, p.bottles);
  const missing = reqs.filter((r) => r.required > r.onHand);
  if (missing.length) {
    throw new DomainError(
      'insufficient_stock',
      `Matières sèches insuffisantes : ${missing.map((m) => `${state.dryGoods[m.dryGoodId]?.name ?? m.dryGoodId} (${m.onHand}/${m.required})`).join(', ')}. Aucun vin ni fourniture consommé.`,
    );
  }
  // All checks passed — apply atomically on the working copy.
  const lotVol = lotVolumeMl(state, lot.id);
  const [wineCost, remaining] = splitCost(lot.cost, p.inputVolumeMl, lotVol);
  withdraw(state, lot.id, p.containerId, p.inputVolumeMl);
  lot.cost = remaining;
  let dryCost: KnownCost = { knownCents: 0, incomplete: false };
  for (const r of reqs) {
    const g = state.dryGoods[r.dryGoodId]!;
    g.onHand -= r.required;
    dryCost = addCosts(dryCost, g.unitCostCents === null ? { knownCents: 0, incomplete: true } : { knownCents: g.unitCostCents * r.required, incomplete: false });
  }
  if (lotVolumeMl(state, lot.id) === 0) lot.stage = 'bottled';
  const batchId = nextId(state, 'batch');
  const n = state.counters['batch'] ?? 0;
  state.batches[batchId] = {
    id: batchId,
    code: `M${String(lot.vintage).slice(2)}-${String(n).padStart(3, '0')}`,
    skuId: sku.id,
    lotId: lot.id,
    vintage: lot.vintage,
    bottledAt: ctx.now,
    bottles: p.bottles,
    inputVolumeMl: p.inputVolumeMl,
    lossMl: p.lossMl,
    physical: p.bottles,
    quarantine: 0,
    quality: 'released',
    qualityHistory: [],
    cost: addCosts(wineCost, dryCost, { knownCents: p.serviceCostCents, incomplete: false }),
    dryGoodsUsed: reqs.map((r) => ({ dryGoodId: r.dryGoodId, quantity: r.required })),
    source: 'bottling',
  };
  logOp(state, ctx, {
    lotId: lot.id,
    type: 'bottling',
    label: 'Mise en bouteilles',
    details: `${fmtL(p.inputVolumeMl)} → ${p.bottles} × ${sku.sizeMl / 10} cl, perte déclarée ${fmtL(p.lossMl)}`,
  });
  return { message: `Mise exécutée : ${p.bottles} bouteilles (${state.batches[batchId]!.code}).`, createdIds: [batchId] };
}

// ------------------------------------------------------------------ Movements

function transfer(state: DomainState, p: Payload<'cellar.transfer'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  ensure(p.fromContainerId !== p.toContainerId, 'validation', 'Source et destination identiques.');
  ensure(isPositiveInt(p.volumeMl), 'invalid_quantity', 'Volume transféré invalide.', 'volumeMl');
  ensure(isNonNegativeInt(p.lossMl), 'invalid_quantity', 'Perte invalide.', 'lossMl');
  ensure(p.lossMl === 0 || p.reason.trim().length > 0, 'validation', 'Motif requis pour une perte.', 'reason');
  withdraw(state, lot.id, p.fromContainerId, p.volumeMl + p.lossMl);
  deposit(state, lot.id, p.toContainerId, p.volumeMl, ctx.now);
  const from = state.containers[p.fromContainerId]!.code;
  const to = state.containers[p.toContainerId]!.code;
  logOp(state, ctx, {
    lotId: lot.id,
    type: 'transfer',
    label: 'Transfert',
    details: `${from} → ${to} : ${fmtL(p.volumeMl)}${p.lossMl ? `, perte ${fmtL(p.lossMl)} (${p.reason})` : ''}`,
  });
  return { message: `Transfert enregistré (${from} → ${to}).`, createdIds: [] };
}

function topping(state: DomainState, p: Payload<'cellar.topping'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  ensure(p.sourceContainerId !== p.targetContainerId, 'validation', 'Ouillage : source et cible identiques.');
  ensure(isPositiveInt(p.volumeMl), 'invalid_quantity', 'Volume d’ouillage invalide.', 'volumeMl');
  const src = state.occupancies[p.sourceContainerId];
  ensure(src, 'invalid_state', 'Ouillage sans source : le contenant source est vide.');
  ensure(src.lotId === lot.id, 'validation', 'Démo : ouillage avec le même lot uniquement (sinon assemblage).');
  const tgt = state.occupancies[p.targetContainerId];
  ensure(tgt && tgt.lotId === lot.id, 'invalid_state', 'Le contenant cible ne contient pas ce lot.');
  withdraw(state, lot.id, p.sourceContainerId, p.volumeMl);
  deposit(state, lot.id, p.targetContainerId, p.volumeMl, ctx.now);
  logOp(state, ctx, {
    lotId: lot.id,
    type: 'topping',
    label: 'Ouillage',
    details: `${state.containers[p.sourceContainerId]!.code} → ${state.containers[p.targetContainerId]!.code} : ${fmtL(p.volumeMl)}`,
  });
  return { message: 'Ouillage enregistré.', createdIds: [] };
}

function loss(state: DomainState, p: Payload<'cellar.loss'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  ensure(isPositiveInt(p.volumeMl), 'invalid_quantity', 'Volume de perte invalide.', 'volumeMl');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif de perte requis.', 'reason');
  withdraw(state, lot.id, p.containerId, p.volumeMl);
  logOp(state, ctx, { lotId: lot.id, type: 'loss', label: 'Perte déclarée', details: `${fmtL(p.volumeMl)} — ${p.reason}` });
  return { message: 'Perte enregistrée.', createdIds: [] };
}

const RELEASE_ROLES: RoleId[] = ['direction', 'cellar_master'];

function quality(state: DomainState, p: Payload<'quality.hold'>, ctx: CommandContext, action: 'hold' | 'release'): CommandResult {
  ensure(p.reason.trim().length > 0, 'validation', 'Motif requis.', 'reason');
  if (action === 'release') ensure(RELEASE_ROLES.includes(ctx.actor), 'forbidden_role', 'Libération réservée au maître de chai ou à la direction (rôle simulé).');
  const entry: QualityHold = { at: ctx.now, action, reason: p.reason, actor: ctx.actor };
  const target = p.target === 'lot' ? getOrThrow(state.lots, p.id, 'Lot') : getOrThrow(state.batches, p.id, 'Lot de mise');
  const wanted = action === 'hold' ? 'held' : 'released';
  ensure(target.quality !== wanted, 'invalid_state', action === 'hold' ? 'Déjà bloqué.' : 'Déjà libéré.');
  target.quality = wanted;
  target.qualityHistory.push(entry);
  if (p.target === 'lot') {
    logOp(state, ctx, { lotId: p.id, type: 'quality', label: action === 'hold' ? 'Blocage qualité' : 'Libération qualité', details: p.reason });
  }
  return { message: action === 'hold' ? 'Blocage enregistré.' : 'Libération enregistrée.', createdIds: [] };
}

// ------------------------------------------------------------------ Measurements & follow-up

export const PARAMETERS: Record<MeasurementParameter, { label: string; units: string[] }> = {
  density: { label: 'Masse volumique', units: ['g/L'] },
  temperature: { label: 'Température', units: ['°C'] },
  sugar: { label: 'Sucres', units: ['g/L'] },
  tav: { label: 'TAV', units: ['% vol'] },
  ph: { label: 'pH', units: ['pH'] },
  ta: { label: 'Acidité totale', units: ['g/L H2SO4', 'g/L ac. tartrique'] },
  va: { label: 'Acidité volatile', units: ['g/L H2SO4'] },
  free_so2: { label: 'SO₂ libre', units: ['mg/L'] },
  malic: { label: 'Acide malique', units: ['g/L'] },
};

function measurementAdd(state: DomainState, p: Payload<'measurement.add'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  const def = PARAMETERS[p.parameter];
  ensure(def, 'validation', 'Paramètre inconnu.', 'parameter');
  ensure(typeof p.value === 'number' && Number.isFinite(p.value), 'validation', 'Valeur manquante ou invalide.', 'value');
  ensure(def.units.includes(p.unit), 'validation', `Unité incompatible pour ${def.label} (attendu : ${def.units.join(' ou ')}).`, 'unit');
  if (p.containerId) {
    const occ = state.occupancies[p.containerId];
    ensure(occ && occ.lotId === lot.id, 'validation', 'Le contenant indiqué ne contient pas ce lot.', 'containerId');
  }
  ensure(!Number.isNaN(Date.parse(p.sampledAt)), 'validation', 'Date de prélèvement invalide.', 'sampledAt');
  ensure(Date.parse(p.sampledAt) <= Date.parse(ctx.now) + 24 * 3600 * 1000, 'validation', 'Date de prélèvement dans le futur.', 'sampledAt');
  const id = nextId(state, 'meas');
  state.measurements[id] = {
    id,
    lotId: lot.id,
    containerId: p.containerId,
    parameter: p.parameter,
    value: p.value,
    unit: p.unit,
    sampledAt: p.sampledAt,
    recordedAt: ctx.now,
    source: 'manual',
    author: ctx.actor,
    supersededBy: null,
    corrects: null,
    correctionReason: null,
  };
  return { message: `${def.label} enregistré.`, createdIds: [id] };
}

function measurementCorrect(state: DomainState, p: Payload<'measurement.correct'>, ctx: CommandContext): CommandResult {
  const m = getOrThrow(state.measurements, p.measurementId, 'Relevé');
  ensure(m.supersededBy === null, 'conflict', 'Ce relevé a déjà été corrigé : corriger la version courante.');
  ensure(Number.isFinite(p.value), 'validation', 'Valeur invalide.', 'value');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif de correction requis.', 'reason');
  const id = nextId(state, 'meas');
  state.measurements[id] = { ...m, id, value: p.value, recordedAt: ctx.now, author: ctx.actor, source: 'manual', corrects: m.id, supersededBy: null, correctionReason: p.reason };
  m.supersededBy = id;
  return { message: 'Relevé corrigé (original conservé).', createdIds: [id] };
}

function tastingAdd(state: DomainState, p: Payload<'tasting.add'>, ctx: CommandContext): CommandResult {
  getOrThrow(state.lots, p.lotId, 'Lot');
  ensure(p.notes.trim().length > 0, 'validation', 'Notes de dégustation requises.', 'notes');
  const id = nextId(state, 'tasting');
  state.tastings[id] = { id, lotId: p.lotId, tastedAt: ctx.now, author: ctx.actor, notes: p.notes.trim(), source: 'manual' };
  return { message: 'Dégustation enregistrée.', createdIds: [id] };
}

function note(state: DomainState, p: Payload<'cellar.note'>, ctx: CommandContext): CommandResult {
  getOrThrow(state.lots, p.lotId, 'Lot');
  ensure(p.label.trim().length > 0, 'validation', 'Intitulé requis.', 'label');
  logOp(state, ctx, { lotId: p.lotId, type: 'note', label: p.label.trim(), details: p.details.trim() });
  return { message: 'Opération consignée.', createdIds: [] };
}

function itinerary(state: DomainState, p: Payload<'itinerary.setStep'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  const step = lot.itinerary.find((s) => s.key === p.key);
  ensure(step, 'not_found', 'Étape inconnue.');
  ensure(p.status !== 'skipped' || (p.note ?? '').trim().length > 0, 'validation', 'Motif requis pour sauter une étape.', 'note');
  step.status = p.status;
  step.doneAt = p.status === 'todo' ? null : ctx.now.slice(0, 10);
  step.note = p.note;
  logOp(state, ctx, { lotId: lot.id, type: 'itinerary', label: `Étape « ${step.label} »`, details: `${p.status === 'done' ? 'réalisée' : p.status === 'skipped' ? 'sautée' : 'rouverte'}${p.note ? ` — ${p.note}` : ''}` });
  return { message: 'Étape mise à jour.', createdIds: [] };
}

const STAGE_FLOW: Record<string, string[]> = { receiving: ['fermenting'], fermenting: ['aging'], aging: ['ready'], ready: ['aging'] };

function setStage(state: DomainState, p: Payload<'lot.setStage'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  ensure((STAGE_FLOW[lot.stage] ?? []).includes(p.stage), 'invalid_state', `Transition ${lot.stage} → ${p.stage} non autorisée.`);
  ensure(p.reason.trim().length > 0, 'validation', 'Motif requis (décision humaine).', 'reason');
  ensure(lotVolumeMl(state, lot.id) > 0, 'invalid_state', 'Lot sans volume.');
  const from = lot.stage;
  lot.stage = p.stage;
  logOp(state, ctx, { lotId: lot.id, type: 'note', label: 'Changement de stade', details: `${from} → ${p.stage} — ${p.reason}` });
  return { message: 'Stade mis à jour.', createdIds: [] };
}

function declareVolume(state: DomainState, p: Payload<'lot.declareVolume'>, ctx: CommandContext): CommandResult {
  const lot = getOrThrow(state.lots, p.lotId, 'Lot');
  ensure(lot.createdBy === 'reception' && lot.grapesReceivedG > 0, 'invalid_state', 'Volume déclarable uniquement pour un lot alimenté par une réception de raisin.');
  ensure(lot.stage === 'receiving' || lot.stage === 'fermenting', 'invalid_state', 'Le lot n’est plus en élaboration.');
  ensure(isPositiveInt(p.volumeMl), 'invalid_quantity', 'Volume mesuré invalide.', 'volumeMl');
  ensure(p.note.trim().length > 0, 'validation', 'Préciser la mesure (ex. jauge, écoulage).', 'note');
  deposit(state, lot.id, p.containerId, p.volumeMl, ctx.now);
  if (lot.stage === 'receiving') lot.stage = 'fermenting';
  logOp(state, ctx, { lotId: lot.id, type: 'reception', label: 'Volume mesuré déclaré', details: `${fmtL(p.volumeMl)} — ${p.note} (mesure saisie, non calculée depuis les kg)` });
  return { message: 'Volume mesuré enregistré.', createdIds: [] };
}

export const cellarHandlers = {
  'blend.execute': blendExecute,
  'bottling.execute': bottlingExecute,
  'cellar.transfer': transfer,
  'cellar.topping': topping,
  'cellar.loss': loss,
  'quality.hold': (s: DomainState, p: Payload<'quality.hold'>, c: CommandContext) => quality(s, p, c, 'hold'),
  'quality.release': (s: DomainState, p: Payload<'quality.release'>, c: CommandContext) => quality(s, p, c, 'release'),
  'measurement.add': measurementAdd,
  'measurement.correct': measurementCorrect,
  'tasting.add': tastingAdd,
  'cellar.note': note,
  'itinerary.setStep': itinerary,
  'lot.setStage': setStage,
  'lot.declareVolume': declareVolume,
};
