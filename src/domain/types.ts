/**
 * Shared domain model. Units are encoded in field names:
 * - `Ml`  : integer millilitres of wine
 * - `G`   : integer grams of grapes
 * - `Cents`: integer euro cents
 * - bottles / dry goods: integer units
 * Instants are ISO-8601 UTC strings; business dates are `YYYY-MM-DD` (Europe/Paris).
 */

export type Id = string;
export type IsoInstant = string;
export type IsoDate = string;

export type QuantityStatus = 'measured' | 'estimated';

/** Known cost: `incomplete` means at least one contribution is unknown (unknown ≠ zero). */
export interface KnownCost {
  knownCents: number;
  incomplete: boolean;
}

export type RoleId = 'direction' | 'cellar_master' | 'vineyard_manager' | 'sales' | 'accounting';

export interface Organization {
  id: Id;
  name: string;
  timeZone: string;
  currency: 'EUR';
}

// ---------------------------------------------------------------- Vineyard

export interface Parcel {
  id: Id;
  code: string;
  name: string;
  owner: string;
  cadastralRef: string | null;
  /** Descriptive planting (several blocks possible). */
  grape: string;
  color: WineColor | 'mixed';
  /** Area in m² ; null = unknown. */
  areaM2: { value: number; status: QuantityStatus } | null;
  plantedYear: number | null;
  /** Fictive demo : no GPS invented. */
  gps: null | { lat: number; lng: number; source: string };
  access: string | null;
  notes: string;
  /** Position in the illustrative schematic map (not geography). */
  schematic: { x: number; y: number; w: number; h: number };
}

export interface Team {
  id: Id;
  name: string;
  members: number;
}

export type MissionStatus = 'planned' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type MissionOperation = 'harvest' | 'pruning' | 'lifting' | 'treatment_record' | 'observation';

export interface MissionStatusChange {
  at: IsoInstant;
  from: MissionStatus;
  to: MissionStatus;
  reason: string | null;
  actor: RoleId;
}

export interface Mission {
  id: Id;
  campaign: number;
  parcelId: Id;
  operation: MissionOperation;
  teamId: Id | null;
  title: string;
  instructions: string;
  plannedStart: IsoDate;
  plannedEnd: IsoDate;
  status: MissionStatus;
  history: MissionStatusChange[];
}

export interface Observation {
  id: Id;
  parcelId: Id;
  missionId: Id | null;
  observedAt: IsoInstant;
  recordedAt: IsoInstant;
  author: RoleId;
  text: string;
  measure: { label: string; value: number; unit: string } | null;
  source: 'preloaded' | 'manual';
}

export type CrateType = 'crate-20' | 'bin-300';

export interface HarvestCount {
  id: Id;
  missionId: Id;
  parcelId: Id;
  crateType: CrateType;
  quantity: number;
  countedAt: IsoInstant;
  recordedAt: IsoInstant;
  author: RoleId;
  /** Current version, starts at 1 ; corrections increment it. */
  version: number;
  corrections: CountCorrection[];
  transportId: Id | null;
  source: 'preloaded' | 'manual';
}

export interface CountCorrection {
  at: IsoInstant;
  before: number;
  after: number;
  reason: string;
  actor: RoleId;
  fromVersion: number;
}

export interface TransportLine {
  countId: Id;
  parcelId: Id;
  crateType: CrateType;
  quantity: number;
}

export interface Transport {
  id: Id;
  code: string;
  campaign: number;
  lines: TransportLine[];
  createdAt: IsoInstant;
  status: 'in_transit' | 'received';
  receptionId: Id | null;
}

export interface Reception {
  id: Id;
  transportId: Id;
  ticket: string;
  grossG: number;
  tareG: number;
  netG: number;
  weighedAt: IsoInstant;
  destinationLotId: Id;
  /** Volume produced is a separate explicit measure (never derived from kg). */
  control: string;
}

// ---------------------------------------------------------------- Cellar

export type WineColor = 'white' | 'red';
export type LotStage = 'receiving' | 'fermenting' | 'aging' | 'ready' | 'bottled' | 'empty';
export type QualityState = 'released' | 'held';

export interface QualityHold {
  at: IsoInstant;
  action: 'hold' | 'release';
  reason: string;
  actor: RoleId;
}

export interface LotParent {
  lotId: Id;
  volumeMl: number;
}

export interface LotOrigin {
  parcelId: Id;
  /** Reception ids when the lot was fed by a harvest reception. */
  receptionIds: Id[];
}

export interface WineLot {
  id: Id;
  code: string;
  name: string;
  cuveeId: Id | null;
  vintage: number;
  color: WineColor;
  stage: LotStage;
  quality: QualityState;
  qualityHistory: QualityHold[];
  origins: LotOrigin[];
  parents: LotParent[];
  /** Declared mention; never derived from genealogy. */
  mention: string;
  cost: KnownCost;
  createdAt: IsoInstant;
  createdBy: 'preloaded' | 'blend' | 'reception';
  /** Grapes received into this lot (g). Never converted to litres. */
  grapesReceivedG: number;
  itinerary: ItineraryStep[];
  expectedReady: { date: IsoDate; note: string } | null;
}

export interface ItineraryStep {
  key: string;
  label: string;
  status: 'todo' | 'done' | 'skipped';
  doneAt: IsoDate | null;
  note: string | null;
}

export type ContainerKind = 'tank' | 'barrel' | 'vat';

export interface Container {
  id: Id;
  code: string;
  kind: ContainerKind;
  capacityMl: number;
  location: string;
  state: 'available' | 'maintenance';
  plan: { row: number; col: number };
}

/** Demo hypothesis : one lot per container at a time. Lot volume = Σ occupancies. */
export interface Occupancy {
  containerId: Id;
  lotId: Id;
  volumeMl: number;
  since: IsoInstant;
}

export interface Measurement {
  id: Id;
  lotId: Id;
  containerId: Id | null;
  parameter: MeasurementParameter;
  value: number;
  unit: string;
  sampledAt: IsoInstant;
  recordedAt: IsoInstant;
  source: 'preloaded' | 'manual' | 'lab-not-connected';
  author: RoleId;
  supersededBy: Id | null;
  corrects: Id | null;
  correctionReason: string | null;
}

export type MeasurementParameter = 'density' | 'temperature' | 'sugar' | 'tav' | 'ph' | 'ta' | 'va' | 'free_so2' | 'malic';

export interface Tasting {
  id: Id;
  lotId: Id;
  tastedAt: IsoInstant;
  author: RoleId;
  notes: string;
  source: 'preloaded' | 'manual';
}

export type CellarOpType =
  | 'note'
  | 'transfer'
  | 'topping'
  | 'loss'
  | 'blend'
  | 'bottling'
  | 'reception'
  | 'itinerary'
  | 'quality';

export interface CellarOperation {
  id: Id;
  lotId: Id;
  type: CellarOpType;
  at: IsoInstant;
  label: string;
  details: string;
  actor: RoleId | 'seed';
  source: 'preloaded' | 'manual';
}

export interface Cuvee {
  id: Id;
  name: string;
  color: WineColor;
}

// ---------------------------------------------------------------- Dry goods & purchasing

export interface DryGood {
  id: Id;
  name: string;
  unit: 'unit';
  onHand: number;
  /** Average known purchase cost (cents per unit), null if unknown. */
  unitCostCents: number | null;
  reorderPoint: number;
}

export interface PurchaseOrderLine {
  dryGoodId: Id;
  ordered: number;
  received: number;
  unitCostCents: number;
}

export interface PurchaseOrder {
  id: Id;
  code: string;
  supplier: string;
  orderedAt: IsoDate;
  expectedAt: IsoDate;
  lines: PurchaseOrderLine[];
  status: 'open' | 'partially_received' | 'received' | 'cancelled';
}

export interface SupplierReceipt {
  id: Id;
  purchaseOrderId: Id;
  receivedAt: IsoInstant;
  lines: { dryGoodId: Id; quantity: number; supplierLot: string | null }[];
}

export interface InventoryCount {
  id: Id;
  dryGoodId: Id;
  countedAt: IsoInstant;
  expected: number;
  counted: number;
  reason: string;
  actor: RoleId;
}

// ---------------------------------------------------------------- Bottling

export interface Sku {
  id: Id;
  cuveeId: Id;
  vintage: number;
  sizeMl: number;
  label: string;
  /** Dry goods bill of materials per bottle / per carton. */
  bom: { dryGoodId: Id; per: 'bottle' | 'carton'; quantity: number }[];
  bottlesPerCarton: number;
}

export interface BottlingBatch {
  id: Id;
  code: string;
  skuId: Id;
  lotId: Id | null;
  vintage: number;
  bottledAt: IsoInstant;
  bottles: number;
  inputVolumeMl: number;
  lossMl: number;
  /** Physical bottles in sellable stock (excluding quarantine). */
  physical: number;
  /** Returned bottles held in quarantine (physically present, not sellable). */
  quarantine: number;
  quality: QualityState;
  qualityHistory: QualityHold[];
  cost: KnownCost;
  dryGoodsUsed: { dryGoodId: Id; quantity: number }[];
  source: 'preloaded' | 'bottling';
}

// ---------------------------------------------------------------- Sales & demo finance

export interface Customer {
  id: Id;
  name: string;
  kind: 'b2b' | 'private';
  city: string;
  paymentTermsDays: number;
}

export interface OrderLine {
  id: Id;
  skuId: Id;
  batchId: Id;
  quantity: number;
  unitPriceHtCents: number;
  reserved: number;
  shipped: number;
}

export interface CustomerOrder {
  id: Id;
  code: string;
  customerId: Id;
  createdAt: IsoInstant;
  status: 'quote' | 'confirmed' | 'partially_shipped' | 'shipped' | 'cancelled';
  lines: OrderLine[];
}

export interface Shipment {
  id: Id;
  code: string;
  orderId: Id;
  shippedAt: IsoInstant;
  lines: { orderLineId: Id; batchId: Id; quantity: number }[];
  invoiceId: Id | null;
  returned: { batchId: Id; quantity: number }[];
}

export interface DemoInvoice {
  id: Id;
  code: string;
  shipmentId: Id;
  customerId: Id;
  issuedAt: IsoDate;
  dueAt: IsoDate;
  lines: { label: string; quantity: number; unitPriceHtCents: number; htCents: number }[];
  htCents: number;
  vatBasisPoints: number;
  vatCents: number;
  ttcCents: number;
}

export interface CreditNote {
  id: Id;
  code: string;
  invoiceId: Id;
  issuedAt: IsoDate;
  reason: string;
  htCents: number;
  vatCents: number;
  ttcCents: number;
}

export interface Payment {
  id: Id;
  invoiceId: Id;
  receivedAt: IsoDate;
  amountCents: number;
  method: 'virement-simulé' | 'chèque-simulé';
}

export interface CustomerReturn {
  id: Id;
  shipmentId: Id;
  batchId: Id;
  quantity: number;
  receivedAt: IsoInstant;
  reason: string;
  status: 'quarantine';
}

// ---------------------------------------------------------------- Planning

export interface CostEntry {
  id: Id;
  target: { kind: 'lot'; lotId: Id } | { kind: 'batch'; batchId: Id };
  category: 'grapes' | 'cellar' | 'bottling' | 'dry_goods' | 'other';
  amountCents: number;
  date: IsoDate;
  source: string;
}

export interface ForecastLine {
  id: Id;
  date: IsoDate;
  label: string;
  amountCents: number;
  /** certain = invoiced/settled dates ; engaged = signed commitment ; estimated = hypothesis. */
  certainty: 'certain' | 'engaged' | 'estimated';
  direction: 'in' | 'out';
  source: string;
}

export interface RenewalProject {
  id: Id;
  year: number;
  name: string;
  parcelId: Id | null;
  status: 'scenario';
  authorization: 'not-provided';
  budgetLines: { label: string; amountCents: number }[];
  assumptions: string[];
  history: { at: IsoInstant; change: string }[];
}

// ---------------------------------------------------------------- Root state

export interface DomainState {
  schemaVersion: number;
  seedVersion: number;
  organization: Organization;
  referenceDate: IsoInstant;
  parcels: Record<Id, Parcel>;
  teams: Record<Id, Team>;
  missions: Record<Id, Mission>;
  observations: Record<Id, Observation>;
  harvestCounts: Record<Id, HarvestCount>;
  transports: Record<Id, Transport>;
  receptions: Record<Id, Reception>;
  cuvees: Record<Id, Cuvee>;
  lots: Record<Id, WineLot>;
  containers: Record<Id, Container>;
  occupancies: Record<Id, Occupancy>; // keyed by containerId
  measurements: Record<Id, Measurement>;
  tastings: Record<Id, Tasting>;
  cellarOps: Record<Id, CellarOperation>;
  dryGoods: Record<Id, DryGood>;
  purchaseOrders: Record<Id, PurchaseOrder>;
  supplierReceipts: Record<Id, SupplierReceipt>;
  inventoryCounts: Record<Id, InventoryCount>;
  skus: Record<Id, Sku>;
  batches: Record<Id, BottlingBatch>;
  customers: Record<Id, Customer>;
  priceList: Record<Id, number>; // skuId -> HT cents
  orders: Record<Id, CustomerOrder>;
  shipments: Record<Id, Shipment>;
  invoices: Record<Id, DemoInvoice>;
  creditNotes: Record<Id, CreditNote>;
  payments: Record<Id, Payment>;
  returns: Record<Id, CustomerReturn>;
  costEntries: Record<Id, CostEntry>;
  forecast: Record<Id, ForecastLine>;
  projects: Record<Id, RenewalProject>;
  /** Fictive VAT rate used by demo documents (basis points). */
  demoVatBasisPoints: number;
  counters: Record<string, number>;
}
