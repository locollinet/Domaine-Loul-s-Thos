/**
 * Seed versionné — Domaine des Trois Coteaux (FICTIF).
 * Base : `.agents/skills/prepare-domaine-demo/demo-fixture.json` (fixtureVersion 1), enrichie
 * (parcelles, équipes, missions, contenants, mesures, clients…) sans casser ses invariants.
 * Toutes les données sont des données de démonstration déclarées : aucun client, GPS, coordonnée
 * ou conformité réels. Les historiques sont préchargés (source: 'preloaded').
 */
import type {
  CellarOperation,
  Container,
  DomainState,
  HarvestCount,
  ItineraryStep,
  Measurement,
  MeasurementParameter,
  Mission,
  Parcel,
  WineLot,
} from '../domain/types';

export const SEED_VERSION = 1;
export const SCHEMA_VERSION = 1;
export const REFERENCE_DATE = '2026-10-24T08:00:00.000Z'; // 24/10/2026 10:00 Europe/Paris

const P = 'preloaded' as const;

export const WHITE_TEMPLATE: Omit<ItineraryStep, 'status' | 'doneAt' | 'note'>[] = [
  { key: 'reception', label: 'Réception' },
  { key: 'pressing', label: 'Pressurage' },
  { key: 'settling', label: 'Clarification / débourbage (selon méthode)' },
  { key: 'fermentation', label: 'Fermentation alcoolique' },
  { key: 'mlf', label: 'FML (facultative, selon choix)' },
  { key: 'aging', label: 'Élevage / préparation' },
];
export const RED_TEMPLATE: Omit<ItineraryStep, 'status' | 'doneAt' | 'note'>[] = [
  { key: 'reception', label: 'Réception' },
  { key: 'prep', label: 'Préparation des raisins (variable)' },
  { key: 'maceration', label: 'Macération / fermentation' },
  { key: 'draining', label: 'Écoulage / pressurage' },
  { key: 'mlf', label: 'FML (facultative, selon choix)' },
  { key: 'aging', label: 'Élevage' },
];

function steps(template: typeof WHITE_TEMPLATE, done: Record<string, string>): ItineraryStep[] {
  return template.map((s) => ({ ...s, status: done[s.key] ? 'done' : 'todo', doneAt: done[s.key] ?? null, note: null }));
}

function rec<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

const parcels: Parcel[] = [
  {
    id: 'origin-a', code: 'HR', name: 'Les Hauts Rangs — fictif', owner: 'Domaine (fictif)', cadastralRef: null,
    grape: 'Bloc nord : cépage blanc · bloc sud : cépage rouge (fictif)', color: 'mixed',
    areaM2: { value: 18500, status: 'estimated' }, plantedYear: 1998, gps: null,
    access: 'Chemin d’exploitation côté nord (description fictive, aucun lien de navigation fourni)',
    notes: 'Unité de culture à deux blocs. Surface estimée : rendement non fiable.', schematic: { x: 10, y: 8, w: 34, h: 26 },
  },
  {
    id: 'origin-b', code: 'CC', name: 'La Combe Claire — fictif', owner: 'Domaine (fictif)', cadastralRef: null,
    grape: 'Cépage rouge (fictif)', color: 'red', areaM2: { value: 12000, status: 'measured' }, plantedYear: 2006, gps: null,
    access: null, notes: 'Position absente : pas de point inventé.', schematic: { x: 50, y: 8, w: 26, h: 22 },
  },
  {
    id: 'parcel-c', code: 'CP', name: 'Le Clos du Puits — fictif', owner: 'Domaine (fictif)', cadastralRef: null,
    grape: 'Cépage rouge, maturité tardive (fictif)', color: 'red', areaM2: { value: 7600, status: 'measured' }, plantedYear: 2012, gps: null,
    access: 'Portail sud (fictif)', notes: '', schematic: { x: 80, y: 8, w: 16, h: 30 },
  },
  {
    id: 'parcel-d', code: 'TB', name: 'Les Terrasses Basses — fictif', owner: 'Domaine (fictif)', cadastralRef: null,
    grape: 'Cépage blanc (fictif)', color: 'white', areaM2: null, plantedYear: 1989, gps: null,
    access: null, notes: 'Surface inconnue (≠ 0).', schematic: { x: 10, y: 40, w: 30, h: 20 },
  },
  {
    id: 'parcel-e1', code: 'PP-1', name: 'Les Pierres Plates — fictif', owner: 'Domaine (fictif)', cadastralRef: null,
    grape: 'Cépage rouge (fictif)', color: 'red', areaM2: { value: 5000, status: 'estimated' }, plantedYear: 2001, gps: null,
    access: null, notes: 'Même nom qu’une parcelle en fermage : identités distinctes.', schematic: { x: 46, y: 36, w: 22, h: 16 },
  },
  {
    id: 'parcel-e2', code: 'PP-2', name: 'Les Pierres Plates — fictif', owner: 'Propriétaire bailleur (fictif)', cadastralRef: null,
    grape: 'Cépage rouge (fictif)', color: 'red', areaM2: { value: 4200, status: 'estimated' }, plantedYear: 1995, gps: null,
    access: null, notes: 'Fermage fictif : propriétaire différent, unité distincte.', schematic: { x: 46, y: 56, w: 22, h: 14 },
  },
  {
    id: 'parcel-f', code: 'VM', name: 'La Vigne du Moulin — fictif', owner: 'Domaine (fictif)', cadastralRef: null,
    grape: 'Cépage blanc, vieille plantation (fictif)', color: 'white', areaM2: { value: 6300, status: 'measured' }, plantedYear: 1972, gps: null,
    access: null, notes: 'Candidate au renouvellement 2027 (scénario, aucune autorisation fournie).', schematic: { x: 74, y: 44, w: 22, h: 26 },
  },
];

const missions: Mission[] = [
  {
    id: 'mission-h-a', campaign: 2026, parcelId: 'origin-a', operation: 'harvest', teamId: 'team-a', title: 'Vendange bloc nord (blanc)',
    instructions: 'Caisses 20 kg. Tri à la parcelle selon consigne du jour (fictif).', plannedStart: '2026-09-15', plannedEnd: '2026-09-16', status: 'completed',
    history: [
      { at: '2026-09-15T05:30:00.000Z', from: 'planned', to: 'in_progress', reason: null, actor: 'vineyard_manager' },
      { at: '2026-09-16T14:00:00.000Z', from: 'in_progress', to: 'completed', reason: 'Bloc terminé, validé par le chef de culture', actor: 'vineyard_manager' },
    ],
  },
  {
    id: 'mission-h-b', campaign: 2026, parcelId: 'origin-b', operation: 'harvest', teamId: 'team-a', title: 'Vendange Combe Claire',
    instructions: 'Caisses 20 kg.', plannedStart: '2026-09-28', plannedEnd: '2026-09-29', status: 'completed',
    history: [
      { at: '2026-09-28T05:30:00.000Z', from: 'planned', to: 'in_progress', reason: null, actor: 'vineyard_manager' },
      { at: '2026-09-29T15:00:00.000Z', from: 'in_progress', to: 'completed', reason: 'Parcelle terminée', actor: 'vineyard_manager' },
    ],
  },
  {
    id: 'mission-h-c', campaign: 2026, parcelId: 'parcel-c', operation: 'harvest', teamId: 'team-b', title: 'Vendange tardive Clos du Puits',
    instructions: 'Rangs 1 à 24. Caisses 20 kg. Récolte partielle possible : ne pas clôturer sans validation.', plannedStart: '2026-10-23', plannedEnd: '2026-10-25', status: 'in_progress',
    history: [{ at: '2026-10-23T06:00:00.000Z', from: 'planned', to: 'in_progress', reason: null, actor: 'vineyard_manager' }],
  },
  {
    id: 'mission-p-d', campaign: 2027, parcelId: 'parcel-d', operation: 'pruning', teamId: 'team-b', title: 'Prétaille Terrasses Basses',
    instructions: 'Même moteur de mission que la vendange (réutilisation).', plannedStart: '2026-11-23', plannedEnd: '2026-11-27', status: 'planned', history: [],
  },
  {
    id: 'mission-o-e', campaign: 2026, parcelId: 'parcel-e2', operation: 'observation', teamId: null, title: 'Tour d’observation fin de saison',
    instructions: 'Noter état du feuillage (observation humaine).', plannedStart: '2026-10-20', plannedEnd: '2026-10-24', status: 'blocked',
    history: [
      { at: '2026-10-20T07:00:00.000Z', from: 'planned', to: 'in_progress', reason: null, actor: 'vineyard_manager' },
      { at: '2026-10-21T09:00:00.000Z', from: 'in_progress', to: 'blocked', reason: 'Accès impraticable après la pluie (fictif)', actor: 'vineyard_manager' },
    ],
  },
];

function count(id: string, missionId: string, parcelId: string, quantity: number, at: string, transportId: string | null): HarvestCount {
  return { id, missionId, parcelId, crateType: 'crate-20', quantity, countedAt: at, recordedAt: at, author: 'vineyard_manager', version: 1, corrections: [], transportId, source: P };
}

const harvestCounts = [
  count('count-h-a-1', 'mission-h-a', 'origin-a', 7, '2026-09-15T09:10:00.000Z', 'transport-2026-a'),
  count('count-h-a-2', 'mission-h-a', 'origin-a', 5, '2026-09-16T08:40:00.000Z', 'transport-2026-a'),
  count('count-h-b-1', 'mission-h-b', 'origin-b', 14, '2026-09-28T10:00:00.000Z', 'transport-2026-b'),
  count('count-h-c-1', 'mission-h-c', 'parcel-c', 8, '2026-10-23T09:30:00.000Z', null),
  count('count-h-c-2', 'mission-h-c', 'parcel-c', 4, '2026-10-23T11:45:00.000Z', null),
];

function container(id: string, code: string, kind: Container['kind'], capacityL: number, location: string, row: number, col: number, state: Container['state'] = 'available'): Container {
  return { id, code, kind, capacityMl: capacityL * 1000, location, state, plan: { row, col } };
}

const containers: Container[] = [
  container('tank-01', 'C-01', 'tank', 800, 'Cuverie', 1, 1),
  container('tank-02', 'C-02', 'tank', 1000, 'Cuverie', 1, 2),
  container('tank-03', 'C-03', 'tank', 600, 'Cuverie', 1, 3),
  container('tank-04', 'C-04', 'tank', 500, 'Cuverie', 1, 4),
  container('tank-05', 'C-05', 'tank', 300, 'Cuverie', 2, 1),
  container('vat-06', 'C-06', 'vat', 500, 'Cuverie', 2, 2),
  container('tank-07', 'C-07', 'tank', 400, 'Cuverie', 2, 3, 'maintenance'),
  container('tank-08', 'C-08', 'tank', 300, 'Cuverie', 2, 4),
  container('demo-barrel-1', 'F-01', 'barrel', 225, 'Chai à barriques', 3, 1),
  container('demo-barrel-2', 'F-02', 'barrel', 225, 'Chai à barriques', 3, 2),
  container('barrel-03', 'F-03', 'barrel', 225, 'Chai à barriques', 3, 3),
  container('barrel-04', 'F-04', 'barrel', 225, 'Chai à barriques', 3, 4),
];

function lot(l: Partial<WineLot> & Pick<WineLot, 'id' | 'code' | 'name' | 'vintage' | 'color' | 'stage' | 'quality'>): WineLot {
  return {
    cuveeId: null, qualityHistory: [], origins: [], parents: [], mention: 'Mention à valider (fictive)', cost: { knownCents: 0, incomplete: true },
    createdAt: '2026-01-01T00:00:00.000Z', createdBy: 'preloaded', grapesReceivedG: 0, itinerary: [], expectedReady: null, ...l,
  };
}

const lots: WineLot[] = [
  lot({
    id: 'lot-2023-red', code: 'L23-R-01', name: 'Rouge 2023', cuveeId: 'cuvee-red', vintage: 2023, color: 'red', stage: 'bottled', quality: 'released',
    origins: [{ parcelId: 'origin-b', receptionIds: [] }], createdAt: '2023-09-25T08:00:00.000Z',
    mention: 'Historique abrégé (fictif) : amont non détaillé',
  }),
  lot({
    id: 'lot-2024-aging', code: 'L24-B-01', name: 'Blanc 2024 en barriques', cuveeId: 'cuvee-white', vintage: 2024, color: 'white', stage: 'aging', quality: 'released',
    origins: [{ parcelId: 'origin-a', receptionIds: [] }], createdAt: '2024-09-18T08:00:00.000Z',
    itinerary: steps(WHITE_TEMPLATE, { reception: '2024-09-18', pressing: '2024-09-18', settling: '2024-09-19', fermentation: '2024-10-20' }),
    expectedReady: { date: '2027-03-31', note: 'Date illustrative, révisable — pas une norme' },
  }),
  lot({
    id: 'lot-2025-a', code: 'L25-R-A', name: 'Rouge 2025 — Hauts Rangs', cuveeId: 'cuvee-red', vintage: 2025, color: 'red', stage: 'ready', quality: 'released',
    origins: [{ parcelId: 'origin-a', receptionIds: [] }], cost: { knownCents: 80000, incomplete: false }, createdAt: '2025-09-20T08:00:00.000Z',
    itinerary: steps(RED_TEMPLATE, { reception: '2025-09-20', prep: '2025-09-20', maceration: '2025-10-08', draining: '2025-10-09', mlf: '2025-12-02', aging: '2026-09-30' }),
  }),
  lot({
    id: 'lot-2025-b', code: 'L25-R-B', name: 'Rouge 2025 — Combe Claire', cuveeId: 'cuvee-red', vintage: 2025, color: 'red', stage: 'ready', quality: 'released',
    origins: [{ parcelId: 'origin-b', receptionIds: [] }], cost: { knownCents: 60000, incomplete: false }, createdAt: '2025-09-30T08:00:00.000Z',
    itinerary: steps(RED_TEMPLATE, { reception: '2025-09-30', prep: '2025-09-30', maceration: '2025-10-15', draining: '2025-10-16', aging: '2026-09-30' }),
  }),
  lot({
    id: 'lot-2026-white', code: 'L26-B-01', name: 'Blanc 2026 — Hauts Rangs', cuveeId: 'cuvee-white', vintage: 2026, color: 'white', stage: 'fermenting', quality: 'held',
    qualityHistory: [{ at: '2026-09-16T15:00:00.000Z', action: 'hold', reason: 'En élaboration — non commercialisable', actor: 'cellar_master' }],
    origins: [{ parcelId: 'origin-a', receptionIds: ['reception-2026-a'] }], createdAt: '2026-09-16T15:00:00.000Z', createdBy: 'reception', grapesReceivedG: 231500,
    itinerary: steps(WHITE_TEMPLATE, { reception: '2026-09-16', pressing: '2026-09-16', settling: '2026-09-17' }),
  }),
  lot({
    id: 'lot-2026-red', code: 'L26-R-01', name: 'Rouge 2026 — Combe Claire', cuveeId: 'cuvee-red', vintage: 2026, color: 'red', stage: 'fermenting', quality: 'held',
    qualityHistory: [{ at: '2026-09-29T16:00:00.000Z', action: 'hold', reason: 'En élaboration — non commercialisable', actor: 'cellar_master' }],
    origins: [{ parcelId: 'origin-b', receptionIds: ['reception-2026-b'] }], createdAt: '2026-09-29T16:00:00.000Z', createdBy: 'reception', grapesReceivedG: 268000,
    itinerary: steps(RED_TEMPLATE, { reception: '2026-09-29', prep: '2026-09-29' }),
  }),
];

const occupancies = [
  { containerId: 'demo-barrel-1', lotId: 'lot-2024-aging', volumeMl: 120000, since: '2024-11-05T09:00:00.000Z' },
  { containerId: 'demo-barrel-2', lotId: 'lot-2024-aging', volumeMl: 80000, since: '2024-11-05T09:00:00.000Z' },
  { containerId: 'tank-02', lotId: 'lot-2025-a', volumeMl: 600000, since: '2025-10-09T09:00:00.000Z' },
  { containerId: 'tank-03', lotId: 'lot-2025-b', volumeMl: 400000, since: '2025-10-16T09:00:00.000Z' },
  { containerId: 'tank-05', lotId: 'lot-2026-white', volumeMl: 150000, since: '2026-09-17T09:00:00.000Z' },
  { containerId: 'vat-06', lotId: 'lot-2026-red', volumeMl: 180000, since: '2026-09-29T17:00:00.000Z' },
];

function series(prefix: string, lotId: string, containerId: string, parameter: MeasurementParameter, unit: string, points: [string, number][]): Measurement[] {
  return points.map(([date, value], i) => ({
    id: `${prefix}-${i + 1}`, lotId, containerId, parameter, value, unit, sampledAt: `${date}T07:00:00.000Z`, recordedAt: `${date}T09:00:00.000Z`,
    source: P, author: 'cellar_master', supersededBy: null, corrects: null, correctionReason: null,
  }));
}

const measurements: Measurement[] = [
  ...series('m-w-d', 'lot-2026-white', 'tank-05', 'density', 'g/L', [['2026-09-20', 1088], ['2026-09-27', 1062], ['2026-10-04', 1038], ['2026-10-11', 1019], ['2026-10-18', 1004], ['2026-10-23', 996]]),
  ...series('m-w-t', 'lot-2026-white', 'tank-05', 'temperature', '°C', [['2026-09-20', 16], ['2026-09-27', 18], ['2026-10-04', 18], ['2026-10-11', 17], ['2026-10-18', 17], ['2026-10-23', 16]]),
  ...series('m-r-d', 'lot-2026-red', 'vat-06', 'density', 'g/L', [['2026-10-01', 1092], ['2026-10-05', 1070], ['2026-10-09', 1041], ['2026-10-13', 1018], ['2026-10-17', 1002]]),
  ...series('m-r-t', 'lot-2026-red', 'vat-06', 'temperature', '°C', [['2026-10-01', 20], ['2026-10-05', 26], ['2026-10-09', 28], ['2026-10-13', 25], ['2026-10-17', 22]]),
  ...series('m-24-so2', 'lot-2024-aging', 'demo-barrel-1', 'free_so2', 'mg/L', [['2026-06-12', 28], ['2026-09-15', 24]]),
  ...series('m-25a-tav', 'lot-2025-a', 'tank-02', 'tav', '% vol', [['2026-09-10', 13.2]]),
  ...series('m-25b-tav', 'lot-2025-b', 'tank-03', 'tav', '% vol', [['2026-09-10', 12.8]]),
];
// Gap example: no red measurement since 17/10 → displayed as gap, never interpolated.

function op(id: string, lotId: string, type: CellarOperation['type'], at: string, label: string, details: string): CellarOperation {
  return { id, lotId, type, at, label, details, actor: 'seed', source: P };
}

const cellarOps: CellarOperation[] = [
  op('op-s-1', 'lot-2024-aging', 'transfer', '2024-11-05T09:00:00.000Z', 'Entonnage', 'Cuve → F-01 (120 L) et F-02 (80 L)'),
  op('op-s-2', 'lot-2024-aging', 'topping', '2026-09-15T09:00:00.000Z', 'Ouillage', 'Historique fictif'),
  op('op-s-3', 'lot-2025-a', 'note', '2026-09-30T09:00:00.000Z', 'Élevage terminé (décision humaine)', 'Lot déclaré prêt à assembler'),
  op('op-s-4', 'lot-2025-b', 'note', '2026-09-30T09:00:00.000Z', 'Élevage terminé (décision humaine)', 'Lot déclaré prêt à assembler'),
  op('op-s-5', 'lot-2026-white', 'reception', '2026-09-16T15:00:00.000Z', 'Réception de vendange', 'T-2026-A — net 231,5 kg'),
  op('op-s-6', 'lot-2026-white', 'reception', '2026-09-17T09:00:00.000Z', 'Volume mesuré déclaré', '150 L après débourbage (mesure fictive)'),
  op('op-s-7', 'lot-2026-red', 'reception', '2026-09-29T16:00:00.000Z', 'Réception de vendange', 'T-2026-B — net 268 kg'),
  op('op-s-8', 'lot-2026-red', 'reception', '2026-09-29T17:00:00.000Z', 'Volume encuvé déclaré', '180 L (mesure fictive)'),
];

export function createSeedState(): DomainState {
  return {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    organization: { id: 'demo-three-hills', name: 'Domaine des Trois Coteaux — fictif', timeZone: 'Europe/Paris', currency: 'EUR' },
    referenceDate: REFERENCE_DATE,
    parcels: rec(parcels),
    teams: rec([
      { id: 'team-a', name: 'Équipe A (fictive)', members: 6 },
      { id: 'team-b', name: 'Équipe B (fictive)', members: 4 },
    ]),
    missions: rec(missions),
    observations: rec([
      {
        id: 'obs-s-1', parcelId: 'parcel-c', missionId: 'mission-h-c', observedAt: '2026-10-22T08:00:00.000Z', recordedAt: '2026-10-22T08:30:00.000Z', author: 'vineyard_manager',
        text: 'Maturité saisie par le chef de culture (valeur fictive).', measure: { label: 'Sucres (réfractomètre)', value: 228, unit: 'g/L' }, source: P,
      },
      {
        id: 'obs-s-2', parcelId: 'parcel-e2', missionId: 'mission-o-e', observedAt: '2026-10-21T09:00:00.000Z', recordedAt: '2026-10-21T09:05:00.000Z', author: 'vineyard_manager',
        text: 'Accès boueux, tour reporté.', measure: null, source: P,
      },
    ]),
    harvestCounts: rec(harvestCounts),
    transports: rec([
      {
        id: 'transport-2026-a', code: 'T-2026-A', campaign: 2026, createdAt: '2026-09-16T13:00:00.000Z', status: 'received', receptionId: 'reception-2026-a',
        lines: [
          { countId: 'count-h-a-1', parcelId: 'origin-a', crateType: 'crate-20', quantity: 7 },
          { countId: 'count-h-a-2', parcelId: 'origin-a', crateType: 'crate-20', quantity: 5 },
        ],
      },
      {
        id: 'transport-2026-b', code: 'T-2026-B', campaign: 2026, createdAt: '2026-09-29T14:00:00.000Z', status: 'received', receptionId: 'reception-2026-b',
        lines: [{ countId: 'count-h-b-1', parcelId: 'origin-b', crateType: 'crate-20', quantity: 14 }],
      },
    ]),
    receptions: rec([
      { id: 'reception-2026-a', transportId: 'transport-2026-a', ticket: 'TK-0916-01', grossG: 262500, tareG: 31000, netG: 231500, weighedAt: '2026-09-16T14:30:00.000Z', destinationLotId: 'lot-2026-white', control: 'Contrôle visuel OK (fictif)' },
      { id: 'reception-2026-b', transportId: 'transport-2026-b', ticket: 'TK-0929-01', grossG: 304000, tareG: 36000, netG: 268000, weighedAt: '2026-09-29T15:30:00.000Z', destinationLotId: 'lot-2026-red', control: 'Contrôle visuel OK (fictif)' },
    ]),
    cuvees: rec([
      { id: 'cuvee-red', name: 'Coteaux Rouges — fictif', color: 'red' },
      { id: 'cuvee-white', name: 'Coteaux Blancs — fictif', color: 'white' },
    ]),
    lots: rec(lots),
    containers: rec(containers),
    occupancies: Object.fromEntries(occupancies.map((o) => [o.containerId, o])),
    measurements: rec(measurements),
    tastings: rec([
      { id: 'tasting-s-1', lotId: 'lot-2024-aging', tastedAt: '2026-09-15T10:00:00.000Z', author: 'cellar_master', notes: 'Observation humaine fictive : élevage à poursuivre.', source: P },
      { id: 'tasting-s-2', lotId: 'lot-2025-a', tastedAt: '2026-10-10T10:00:00.000Z', author: 'cellar_master', notes: 'Observation humaine fictive : candidat à l’assemblage.', source: P },
    ]),
    cellarOps: rec(cellarOps),
    dryGoods: rec([
      { id: 'bottle-750', name: 'Bouteille 75 cl', unit: 'unit', onHand: 1000, unitCostCents: 25, reorderPoint: 300 },
      { id: 'closure', name: 'Bouchon', unit: 'unit', onHand: 1000, unitCostCents: 10, reorderPoint: 300 },
      { id: 'label-2025', name: 'Étiquette rouge 2025', unit: 'unit', onHand: 1000, unitCostCents: 5, reorderPoint: 0 },
      { id: 'carton-6', name: 'Carton de 6', unit: 'unit', onHand: 200, unitCostCents: 60, reorderPoint: 50 },
      { id: 'label-2024-white', name: 'Étiquette blanc 2024', unit: 'unit', onHand: 0, unitCostCents: null, reorderPoint: 0 },
    ]),
    purchaseOrders: rec([
      {
        id: 'po-s-1', code: 'CF-26-H01', supplier: 'Imprimerie Exemple — fictif', orderedAt: '2026-10-10', expectedAt: '2026-11-05', status: 'open',
        lines: [{ dryGoodId: 'label-2024-white', ordered: 300, received: 0, unitCostCents: 6 }],
      },
    ]),
    supplierReceipts: {},
    inventoryCounts: {},
    skus: rec([
      {
        id: 'sku-red-2025-750', cuveeId: 'cuvee-red', vintage: 2025, sizeMl: 750, label: 'Coteaux Rouges 2025 — 75 cl', bottlesPerCarton: 6,
        bom: [
          { dryGoodId: 'bottle-750', per: 'bottle', quantity: 1 },
          { dryGoodId: 'closure', per: 'bottle', quantity: 1 },
          { dryGoodId: 'label-2025', per: 'bottle', quantity: 1 },
          { dryGoodId: 'carton-6', per: 'carton', quantity: 1 },
        ],
      },
      { id: 'sku-red-2023-750', cuveeId: 'cuvee-red', vintage: 2023, sizeMl: 750, label: 'Coteaux Rouges 2023 — 75 cl', bottlesPerCarton: 6, bom: [] },
      {
        id: 'sku-white-2024-750', cuveeId: 'cuvee-white', vintage: 2024, sizeMl: 750, label: 'Coteaux Blancs 2024 — 75 cl', bottlesPerCarton: 6,
        bom: [
          { dryGoodId: 'bottle-750', per: 'bottle', quantity: 1 },
          { dryGoodId: 'closure', per: 'bottle', quantity: 1 },
          { dryGoodId: 'label-2024-white', per: 'bottle', quantity: 1 },
          { dryGoodId: 'carton-6', per: 'carton', quantity: 1 },
        ],
      },
    ]),
    batches: rec([
      {
        id: 'batch-2023-old', code: 'M23-001', skuId: 'sku-red-2023-750', lotId: 'lot-2023-red', vintage: 2023, bottledAt: '2025-03-12T09:00:00.000Z', bottles: 36,
        inputVolumeMl: 0, lossMl: 0, physical: 36, quarantine: 0, quality: 'released', qualityHistory: [], cost: { knownCents: 0, incomplete: true }, dryGoodsUsed: [], source: P,
      },
    ]),
    customers: rec([
      { id: 'cust-cave', name: 'Cave Exemple — fictif', kind: 'b2b', city: 'Ville fictive', paymentTermsDays: 30 },
      { id: 'cust-resto', name: 'Restaurant Démo — fictif', kind: 'b2b', city: 'Ville fictive', paymentTermsDays: 45 },
      { id: 'cust-priv', name: 'Particulier A — fictif', kind: 'private', city: '—', paymentTermsDays: 0 },
    ]),
    priceList: { 'sku-red-2025-750': 2000, 'sku-red-2023-750': 2400, 'sku-white-2024-750': 2200 },
    orders: rec([
      {
        id: 'order-s-quote', code: 'DV-26-H01', customerId: 'cust-resto', createdAt: '2026-10-15T09:00:00.000Z', status: 'quote',
        lines: [{ id: 'oline-s-1', skuId: 'sku-red-2023-750', batchId: 'batch-2023-old', quantity: 12, unitPriceHtCents: 2400, reserved: 0, shipped: 0 }],
      },
    ]),
    shipments: {},
    invoices: {},
    creditNotes: {},
    payments: {},
    returns: {},
    costEntries: rec([
      { id: 'cost-s-1', target: { kind: 'lot', lotId: 'lot-2025-a' }, category: 'grapes', amountCents: 80000, date: '2025-12-31', source: 'Coût connu fictif (vendange + chai), incomplet' },
      { id: 'cost-s-2', target: { kind: 'lot', lotId: 'lot-2025-b' }, category: 'grapes', amountCents: 60000, date: '2025-12-31', source: 'Coût connu fictif (vendange + chai), incomplet' },
    ]),
    forecast: rec([
      { id: 'fc-s-1', date: '2026-11-05', label: 'Étiquettes blanc 2024 (CF-26-H01)', amountCents: 1800, certainty: 'engaged', direction: 'out', source: 'Commande fournisseur' },
      { id: 'fc-s-2', date: '2026-12-15', label: 'Hypothèse ventes fêtes — rouge 2025', amountCents: 600000, certainty: 'estimated', direction: 'in', source: 'Hypothèse commerciale fictive' },
      { id: 'fc-s-3', date: '2027-02-15', label: 'Renouvellement 2027 — acompte plants (scénario)', amountCents: 300000, certainty: 'estimated', direction: 'out', source: 'Projet renewal-2027' },
    ]),
    projects: rec([
      {
        id: 'renewal-2027', year: 2027, name: 'Renouvellement fictif à étudier — La Vigne du Moulin', parcelId: 'parcel-f', status: 'scenario', authorization: 'not-provided',
        budgetLines: [
          { label: 'Arrachage (estimation)', amountCents: 400000 },
          { label: 'Préparation du sol (estimation)', amountCents: 250000 },
          { label: 'Plants et plantation (estimation)', amountCents: 900000 },
        ],
        assumptions: ['Aucune autorisation réelle générée ni fournie.', 'Montants fictifs, à remplacer par des devis.', 'Première récolte non prise en compte dans la trésorerie.'],
        history: [{ at: '2026-10-01T08:00:00.000Z', change: 'Création du scénario (fictif)' }],
      },
    ]),
    demoVatBasisPoints: 2000,
    counters: {},
  };
}
