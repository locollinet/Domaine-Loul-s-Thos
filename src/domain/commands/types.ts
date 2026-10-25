import type {
  CrateType,
  CostEntry,
  ForecastLine,
  Id,
  IsoInstant,
  MeasurementParameter,
  MissionOperation,
  MissionStatus,
  RoleId,
  WineColor,
} from '../types';

export interface BlendInput {
  lotId: Id;
  containerId: Id;
  volumeMl: number;
}

export type Command =
  // ---- L1 / L4 cellar
  | { type: 'blend.execute'; payload: { name: string; cuveeId: Id | null; inputs: BlendInput[]; destinationContainerId: Id } }
  | {
      type: 'bottling.execute';
      payload: {
        lotId: Id;
        containerId: Id;
        skuId: Id;
        inputVolumeMl: number;
        bottles: number;
        lossMl: number;
        serviceCostCents: number;
      };
    }
  | { type: 'cellar.transfer'; payload: { lotId: Id; fromContainerId: Id; toContainerId: Id; volumeMl: number; lossMl: number; reason: string } }
  | { type: 'cellar.topping'; payload: { lotId: Id; sourceContainerId: Id; targetContainerId: Id; volumeMl: number } }
  | { type: 'cellar.loss'; payload: { lotId: Id; containerId: Id; volumeMl: number; reason: string } }
  | { type: 'quality.hold'; payload: { target: 'lot' | 'batch'; id: Id; reason: string } }
  | { type: 'quality.release'; payload: { target: 'lot' | 'batch'; id: Id; reason: string } }
  // ---- L3 winemaking
  | {
      type: 'measurement.add';
      payload: { lotId: Id; containerId: Id | null; parameter: MeasurementParameter; value: number; unit: string; sampledAt: IsoInstant };
    }
  | { type: 'measurement.correct'; payload: { measurementId: Id; value: number; reason: string } }
  | { type: 'tasting.add'; payload: { lotId: Id; notes: string } }
  | { type: 'cellar.note'; payload: { lotId: Id; label: string; details: string } }
  | { type: 'itinerary.setStep'; payload: { lotId: Id; key: string; status: 'done' | 'skipped' | 'todo'; note: string | null } }
  | { type: 'lot.setStage'; payload: { lotId: Id; stage: 'fermenting' | 'aging' | 'ready'; reason: string } }
  | { type: 'lot.declareVolume'; payload: { lotId: Id; containerId: Id; volumeMl: number; note: string } }
  // ---- L2 vineyard & harvest
  | {
      type: 'mission.create';
      payload: { parcelId: Id; operation: MissionOperation; teamId: Id | null; title: string; instructions: string; plannedStart: string; plannedEnd: string };
    }
  | { type: 'mission.setStatus'; payload: { missionId: Id; to: MissionStatus; reason: string | null } }
  | { type: 'observation.add'; payload: { parcelId: Id; missionId: Id | null; text: string; measure: { label: string; value: number; unit: string } | null } }
  | { type: 'harvest.count'; payload: { missionId: Id; crateType: CrateType; quantity: number } }
  | { type: 'harvest.correctCount'; payload: { countId: Id; expectedVersion: number; quantity: number; reason: string } }
  | { type: 'transport.create'; payload: { countIds: Id[] } }
  | {
      type: 'reception.record';
      payload: {
        transportId: Id;
        ticket: string;
        grossG: number;
        tareG: number;
        control: string;
        destination: { kind: 'existing'; lotId: Id } | { kind: 'new'; name: string; color: WineColor; vintage: number };
      };
    }
  // ---- L5 supply
  | { type: 'purchase.create'; payload: { supplier: string; expectedAt: string; lines: { dryGoodId: Id; ordered: number; unitCostCents: number }[] } }
  | { type: 'purchase.receive'; payload: { purchaseOrderId: Id; lines: { dryGoodId: Id; quantity: number; supplierLot: string | null }[] } }
  | { type: 'inventory.count'; payload: { dryGoodId: Id; counted: number; reason: string } }
  | { type: 'return.receive'; payload: { shipmentId: Id; batchId: Id; quantity: number; reason: string } }
  | { type: 'quarantine.resolve'; payload: { batchId: Id; quantity: number; decision: 'restock' | 'scrap'; reason: string } }
  // ---- L1 / L6 sales & demo finance
  | {
      type: 'order.create';
      payload: { customerId: Id; asQuote: boolean; lines: { skuId: Id; batchId: Id; quantity: number; unitPriceHtCents: number }[] };
    }
  | { type: 'order.confirm'; payload: { orderId: Id } }
  | { type: 'order.cancel'; payload: { orderId: Id; reason: string } }
  | { type: 'shipment.create'; payload: { orderId: Id; lines: { orderLineId: Id; quantity: number }[] } }
  | { type: 'invoice.create'; payload: { shipmentId: Id } }
  | { type: 'creditNote.create'; payload: { invoiceId: Id; htCents: number; reason: string } }
  | { type: 'payment.record'; payload: { invoiceId: Id; amountCents: number; method: 'virement-simulé' | 'chèque-simulé' } }
  | { type: 'cost.add'; payload: { target: CostEntry['target']; category: CostEntry['category']; amountCents: number; source: string } }
  | { type: 'forecast.add'; payload: Omit<ForecastLine, 'id'> }
  | { type: 'project.updateBudget'; payload: { projectId: Id; budgetLines: { label: string; amountCents: number }[]; change: string } };

export type CommandType = Command['type'];

export interface CommandEnvelope<C extends Command = Command> {
  /** Generated once by the UI ; a retry reuses it. */
  idempotencyKey: string;
  command: C;
  actor: RoleId;
}

export interface CommandContext {
  /** Business instant (demo clock — fixed demo date). */
  now: IsoInstant;
  actor: RoleId;
}

export interface CommandResult {
  message: string;
  createdIds: Id[];
}
