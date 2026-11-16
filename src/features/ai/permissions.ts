import { ROLE_LABELS } from '../../domain/selectors';
import type { RoleId } from '../../domain/types';
import {
  PRESET_CONFIGS,
  type AddonModuleId,
  type MainModuleId,
} from '../modules/ModuleConfigContext';
import type { AssistantScope, AssistantTabId } from './types';

/**
 * Only direction and accounting roles can access internal lot costs,
 * dry-good purchase unit costs, invoices and financial forecasts.
 */
const COST_AND_FINANCE_ROLES: readonly RoleId[] = ['direction', 'accounting'];

export function canRoleSeeCosts(role: RoleId): boolean {
  return COST_AND_FINANCE_ROLES.includes(role);
}

export function canRoleSeeFinance(role: RoleId): boolean {
  return COST_AND_FINANCE_ROLES.includes(role);
}

export function buildAssistantScope(
  role: RoleId,
  activeTab: AssistantTabId,
  enabledMainModules?: Record<MainModuleId, boolean>,
  enabledAddons?: Record<AddonModuleId, boolean>
): AssistantScope {
  return {
    role,
    roleLabel: ROLE_LABELS[role],
    activeTab,
    canSeeCosts: canRoleSeeCosts(role),
    canSeeFinance: canRoleSeeFinance(role),
    enabledMainModules: enabledMainModules ?? { ...PRESET_CONFIGS.full_prestige.enabledMainModules },
    enabledAddons: enabledAddons ?? { ...PRESET_CONFIGS.full_prestige.enabledAddons },
  };
}

/**
 * All internal cost, purchase pricing and financial keys that must be stripped
 * recursively before sending any tool output to the model or building cards
 * when the active role is not authorized to see costs / finance.
 */
export const SENSITIVE_COST_KEYS = new Set<string>([
  'cost',
  'knownCents',
  'incomplete',
  'unitCostCents',
  'serviceCostCents',
  'costCents',
  'amountCents',
  'htCents',
  'vatCents',
  'ttcCents',
  'paidCents',
  'creditedCents',
  'balanceCents',
  'budgetCents',
  'budgetTotalCents',
  'budgetLines',
  'costEntries',
  'lotCosts',
  'invoices',
  'forecast',
  'forecastByCertainty',
  'projects',
  'coutConnuEuros',
  'coutPartielEuros',
  'totalInvoicedTtcCents',
  'totalOpenBalanceCents',
  'hourlyGrossEur',
]);

export interface SanitizeOptions {
  canSeeCosts: boolean;
  canSeeFinance: boolean;
}

/**
 * Recursively clones and strips sensitive financial/cost fields when the
 * caller's role is restricted. Guarantees zero cost leakage to Gemini or UI cards.
 */
export function sanitizeForRole<T>(value: T, opts: SanitizeOptions): T {
  if (opts.canSeeCosts && opts.canSeeFinance) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForRole(item, opts)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_COST_KEYS.has(k)) {
        continue;
      }
      out[k] = sanitizeForRole(v, opts);
    }
    return out as T;
  }

  return value;
}
