import { DomainError } from '../errors';
import type { DomainState, RoleId } from '../types';
import { cellarHandlers } from './cellar';
import { commercialHandlers } from './commercial';
import type { Command, CommandContext, CommandResult, CommandType } from './types';
import { vineyardHandlers } from './vineyard';

export * from './types';
export { previewBlend, bottlingRequirements, PARAMETERS } from './cellar';
export { MISSION_TRANSITIONS } from './vineyard';

type Handler = (state: DomainState, payload: never, ctx: CommandContext) => CommandResult;

const handlers: Record<CommandType, Handler> = {
  ...cellarHandlers,
  ...vineyardHandlers,
  ...commercialHandlers,
} as unknown as Record<CommandType, Handler>;

const CELLAR: RoleId[] = ['direction', 'cellar_master'];
const VINEYARD: RoleId[] = ['direction', 'vineyard_manager'];
const SALES: RoleId[] = ['direction', 'sales'];
const FINANCE: RoleId[] = ['direction', 'accounting'];

/** Role preview permissions (simulation — NOT authentication). */
export const COMMAND_ROLES: Record<CommandType, RoleId[]> = {
  'blend.execute': CELLAR,
  'bottling.execute': CELLAR,
  'cellar.transfer': CELLAR,
  'cellar.topping': CELLAR,
  'cellar.loss': CELLAR,
  'quality.hold': [...CELLAR, 'sales'],
  'quality.release': CELLAR,
  'measurement.add': CELLAR,
  'measurement.correct': CELLAR,
  'tasting.add': [...CELLAR, 'sales'],
  'cellar.note': CELLAR,
  'itinerary.setStep': CELLAR,
  'lot.setStage': CELLAR,
  'lot.declareVolume': CELLAR,
  'mission.create': VINEYARD,
  'mission.setStatus': VINEYARD,
  'observation.add': [...VINEYARD, 'cellar_master'],
  'harvest.count': VINEYARD,
  'harvest.correctCount': VINEYARD,
  'transport.create': VINEYARD,
  'reception.record': [...CELLAR, 'vineyard_manager'],
  'purchase.create': [...CELLAR, 'accounting'],
  'purchase.receive': [...CELLAR, 'accounting'],
  'inventory.count': [...CELLAR, 'accounting'],
  'return.receive': [...SALES, 'cellar_master'],
  'quarantine.resolve': CELLAR,
  'order.create': SALES,
  'order.confirm': SALES,
  'order.cancel': SALES,
  'shipment.create': [...SALES, 'cellar_master'],
  'invoice.create': FINANCE,
  'creditNote.create': FINANCE,
  'payment.record': FINANCE,
  'cost.add': FINANCE,
  'forecast.add': FINANCE,
  'project.updateBudget': [...FINANCE, 'vineyard_manager'],
};

export function canRun(type: CommandType, role: RoleId): boolean {
  return COMMAND_ROLES[type].includes(role);
}

/**
 * Pure command application : returns a NEW state (copy-on-write).
 * On any error the input state is untouched (the copy is discarded).
 */
export function applyCommand(state: DomainState, command: Command, ctx: CommandContext): { state: DomainState; result: CommandResult } {
  const handler = handlers[command.type];
  if (!handler) throw new DomainError('validation', `Commande inconnue : ${String((command as { type: string }).type)}`);
  if (!canRun(command.type, ctx.actor)) {
    throw new DomainError('forbidden_role', 'Action non autorisée pour le rôle prévisualisé (simulation de rôles, pas une authentification).');
  }
  const draft = structuredClone(state);
  const result = handler(draft, command.payload as never, ctx);
  return { state: draft, result };
}
