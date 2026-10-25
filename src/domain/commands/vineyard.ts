import { ensure } from '../errors';
import { isNonNegativeInt, isPositiveInt } from '../quantities';
import { getOrThrow, nextId } from '../selectors';
import type { DomainState, MissionStatus } from '../types';
import { logOp } from './cellar';
import type { Command, CommandContext, CommandResult } from './types';

type Payload<T extends Command['type']> = Extract<Command, { type: T }>['payload'];

export const MISSION_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  planned: ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'completed', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

function missionCreate(state: DomainState, p: Payload<'mission.create'>, _ctx: CommandContext): CommandResult {
  getOrThrow(state.parcels, p.parcelId, 'Parcelle');
  if (p.teamId) getOrThrow(state.teams, p.teamId, 'Équipe');
  ensure(p.title.trim().length > 0, 'validation', 'Intitulé requis.', 'title');
  ensure(p.plannedStart <= p.plannedEnd, 'validation', 'La fin prévue précède le début.', 'plannedEnd');
  const id = nextId(state, 'mission');
  state.missions[id] = {
    id,
    campaign: Number(p.plannedStart.slice(0, 4)),
    parcelId: p.parcelId,
    operation: p.operation,
    teamId: p.teamId,
    title: p.title.trim(),
    instructions: p.instructions.trim(),
    plannedStart: p.plannedStart,
    plannedEnd: p.plannedEnd,
    status: 'planned',
    history: [],
  };
  return { message: 'Mission planifiée.', createdIds: [id] };
}

function missionSetStatus(state: DomainState, p: Payload<'mission.setStatus'>, ctx: CommandContext): CommandResult {
  const m = getOrThrow(state.missions, p.missionId, 'Mission');
  ensure(MISSION_TRANSITIONS[m.status].includes(p.to), 'invalid_state', `Transition ${m.status} → ${p.to} non autorisée.`);
  if (p.to === 'blocked' || p.to === 'cancelled') ensure((p.reason ?? '').trim().length > 0, 'validation', 'Motif requis.', 'reason');
  m.history.push({ at: ctx.now, from: m.status, to: p.to, reason: p.reason, actor: ctx.actor });
  m.status = p.to;
  return { message: 'Statut de mission mis à jour (réalisé conservé).', createdIds: [] };
}

function observationAdd(state: DomainState, p: Payload<'observation.add'>, ctx: CommandContext): CommandResult {
  getOrThrow(state.parcels, p.parcelId, 'Parcelle');
  if (p.missionId) getOrThrow(state.missions, p.missionId, 'Mission');
  ensure(p.text.trim().length > 0, 'validation', 'Observation vide.', 'text');
  if (p.measure) ensure(Number.isFinite(p.measure.value) && p.measure.unit.trim() !== '', 'validation', 'Mesure invalide (valeur + unité).', 'measure');
  const id = nextId(state, 'obs');
  state.observations[id] = {
    id,
    parcelId: p.parcelId,
    missionId: p.missionId,
    observedAt: ctx.now,
    recordedAt: ctx.now,
    author: ctx.actor,
    text: p.text.trim(),
    measure: p.measure,
    source: 'manual',
  };
  return { message: 'Observation enregistrée.', createdIds: [id] };
}

function harvestCount(state: DomainState, p: Payload<'harvest.count'>, ctx: CommandContext): CommandResult {
  const m = getOrThrow(state.missions, p.missionId, 'Mission');
  ensure(m.operation === 'harvest', 'validation', 'Comptage réservé aux missions de récolte.');
  ensure(m.status === 'in_progress', 'invalid_state', 'La mission doit être en cours pour saisir un comptage.');
  ensure(isPositiveInt(p.quantity), 'invalid_quantity', 'Nombre de contenants invalide (entier > 0).', 'quantity');
  const id = nextId(state, 'count');
  state.harvestCounts[id] = {
    id,
    missionId: m.id,
    parcelId: m.parcelId,
    crateType: p.crateType,
    quantity: p.quantity,
    countedAt: ctx.now,
    recordedAt: ctx.now,
    author: ctx.actor,
    version: 1,
    corrections: [],
    transportId: null,
    source: 'manual',
  };
  return { message: `${p.quantity} contenant(s) enregistrés sur cet appareil.`, createdIds: [id] };
}

function correctCount(state: DomainState, p: Payload<'harvest.correctCount'>, ctx: CommandContext): CommandResult {
  const c = getOrThrow(state.harvestCounts, p.countId, 'Comptage');
  ensure(c.version === p.expectedVersion, 'conflict', `Conflit : le comptage a été modifié (version ${c.version}, attendue ${p.expectedVersion}).`);
  ensure(c.transportId === null, 'invalid_state', 'Comptage déjà chargé dans un transport : correction refusée (écart à traiter en réception).');
  ensure(isNonNegativeInt(p.quantity), 'invalid_quantity', 'Quantité corrigée invalide.', 'quantity');
  ensure(p.quantity !== c.quantity, 'validation', 'Quantité identique.');
  ensure(p.reason.trim().length > 0, 'validation', 'Motif de correction requis.', 'reason');
  c.corrections.push({ at: ctx.now, before: c.quantity, after: p.quantity, reason: p.reason.trim(), actor: ctx.actor, fromVersion: c.version });
  c.quantity = p.quantity;
  c.version += 1;
  return { message: 'Comptage corrigé (original et motif conservés).', createdIds: [] };
}

function transportCreate(state: DomainState, p: Payload<'transport.create'>, ctx: CommandContext): CommandResult {
  ensure(p.countIds.length > 0, 'validation', 'Sélectionner au moins un comptage.');
  ensure(new Set(p.countIds).size === p.countIds.length, 'validation', 'Comptage en double.');
  const counts = p.countIds.map((id) => getOrThrow(state.harvestCounts, id, 'Comptage'));
  for (const c of counts) {
    ensure(c.transportId === null, 'invalid_state', `Comptage ${c.id} déjà transporté.`);
    ensure(c.quantity > 0, 'invalid_quantity', `Comptage ${c.id} à zéro.`);
  }
  const campaigns = new Set(counts.map((c) => state.missions[c.missionId]!.campaign));
  ensure(campaigns.size === 1, 'validation', 'Un transport ne mélange pas les campagnes.');
  const id = nextId(state, 'transport');
  const n = state.counters['transport'] ?? 0;
  state.transports[id] = {
    id,
    code: `T-${[...campaigns][0]}-${String(n).padStart(3, '0')}`,
    campaign: [...campaigns][0]!,
    lines: counts.map((c) => ({ countId: c.id, parcelId: c.parcelId, crateType: c.crateType, quantity: c.quantity })),
    createdAt: ctx.now,
    status: 'in_transit',
    receptionId: null,
  };
  for (const c of counts) c.transportId = id;
  return { message: `Transport ${state.transports[id]!.code} créé (${counts.length} ligne(s) d’origine).`, createdIds: [id] };
}

function receptionRecord(state: DomainState, p: Payload<'reception.record'>, ctx: CommandContext): CommandResult {
  const t = getOrThrow(state.transports, p.transportId, 'Transport');
  ensure(t.status === 'in_transit', 'invalid_state', 'Transport déjà réceptionné.');
  ensure(p.ticket.trim().length > 0, 'validation', 'Numéro de ticket requis.', 'ticket');
  ensure(isPositiveInt(p.grossG), 'invalid_quantity', 'Poids brut invalide.', 'grossG');
  ensure(isNonNegativeInt(p.tareG), 'invalid_quantity', 'Tare invalide.', 'tareG');
  ensure(p.tareG < p.grossG, 'validation', 'La tare ne peut pas dépasser ni égaler le poids brut.', 'tareG');
  const netG = p.grossG - p.tareG;
  let lotId: string;
  if (p.destination.kind === 'existing') {
    const lot = getOrThrow(state.lots, p.destination.lotId, 'Lot');
    ensure(lot.createdBy === 'reception' && (lot.stage === 'receiving' || lot.stage === 'fermenting'), 'invalid_state', 'Le lot de destination n’accepte plus de vendange.');
    ensure(lot.vintage === t.campaign, 'validation', 'Millésime du lot différent de la campagne du transport.');
    lotId = lot.id;
  } else {
    ensure(p.destination.name.trim().length > 0, 'validation', 'Nom du nouveau lot requis.', 'name');
    ensure(p.destination.vintage === t.campaign, 'validation', 'Le millésime doit correspondre à la campagne.');
    lotId = nextId(state, 'lot');
    const n = state.counters['lot'] ?? 0;
    state.lots[lotId] = {
      id: lotId,
      code: `L${String(t.campaign).slice(2)}-${p.destination.color === 'white' ? 'B' : 'R'}-${String(n).padStart(2, '0')}`,
      name: p.destination.name.trim(),
      cuveeId: null,
      vintage: t.campaign,
      color: p.destination.color,
      stage: 'receiving',
      quality: 'held',
      qualityHistory: [{ at: ctx.now, action: 'hold', reason: 'En élaboration — non commercialisable', actor: ctx.actor }],
      origins: [],
      parents: [],
      mention: 'Mention à valider',
      cost: { knownCents: 0, incomplete: true },
      createdAt: ctx.now,
      createdBy: 'reception',
      grapesReceivedG: 0,
      itinerary: [],
      expectedReady: null,
    };
  }
  const lot = state.lots[lotId]!;
  const receptionId = nextId(state, 'reception');
  for (const line of t.lines) {
    const o = lot.origins.find((x) => x.parcelId === line.parcelId);
    if (o) {
      if (!o.receptionIds.includes(receptionId)) o.receptionIds.push(receptionId);
    } else lot.origins.push({ parcelId: line.parcelId, receptionIds: [receptionId] });
  }
  lot.grapesReceivedG += netG;
  state.receptions[receptionId] = {
    id: receptionId,
    transportId: t.id,
    ticket: p.ticket.trim(),
    grossG: p.grossG,
    tareG: p.tareG,
    netG,
    weighedAt: ctx.now,
    destinationLotId: lotId,
    control: p.control.trim(),
  };
  t.status = 'received';
  t.receptionId = receptionId;
  logOp(state, ctx, { lotId, type: 'reception', label: 'Réception de vendange', details: `${t.code} — net ${(netG / 1000).toLocaleString('fr-FR')} kg (ticket ${p.ticket.trim()})` });
  return { message: `Réception enregistrée : net ${(netG / 1000).toLocaleString('fr-FR')} kg.`, createdIds: [receptionId, lotId] };
}

export const vineyardHandlers = {
  'mission.create': missionCreate,
  'mission.setStatus': missionSetStatus,
  'observation.add': observationAdd,
  'harvest.count': harvestCount,
  'harvest.correctCount': correctCount,
  'transport.create': transportCreate,
  'reception.record': receptionRecord,
};
