import type { DomainState, MeasurementParameter, RoleId } from '../../domain/types';
import type { AddonModuleId, MainModuleId } from '../modules/ModuleConfigContext';

export type AssistantTabId =
  | 'overview'
  | 'vineyard'
  | 'cellar'
  | 'aging'
  | 'bottling'
  | 'supplies'
  | 'sales'
  | 'finance'
  | 'traceability';

export const ASSISTANT_TOOL_NAMES = [
  'inspect_vineyard',
  'inspect_cellar',
  'check_aging_and_bottling',
  'check_commercial_stock',
  'inspect_finance_and_planning',
  'search_traceability',
  'prepare_action',
] as const;

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

export type AssistantPrefillPayload =
  | {
      tab: 'overview';
      nonce?: number;
    }
  | {
      tab: 'vineyard';
      subTab?: 'atlas' | 'livret' | 'harvest' | 'reception' | 'phyto_tesa';
      parcelId?: string;
      openModal?: 'count' | 'observation';
      missionId?: string;
      quantity?: number;
      obsText?: string;
      nonce?: number;
    }
  | {
      tab: 'cellar';
      lotId?: string;
      containerId?: string;
      openModal?: 'measurement' | 'tasting' | 'declare_volume';
      parameter?: MeasurementParameter;
      value?: string;
      unit?: string;
      nonce?: number;
    }
  | {
      tab: 'aging';
      openModal?: 'blend' | 'transfer' | 'batonnage';
      blendName?: string;
      destContainerId?: string;
      nonce?: number;
    }
  | {
      tab: 'bottling';
      subTab?: 'stocks' | 'cellar_map' | 'elabel';
      lotId?: string;
      skuId?: string;
      batchCode?: string;
      openModal?: 'bottling';
      bottles?: number;
      nonce?: number;
    }
  | {
      tab: 'supplies';
      openModal?: 'po';
      dryGoodId?: string;
      quantity?: number;
      supplier?: string;
      nonce?: number;
    }
  | {
      tab: 'sales';
      subTab?: 'orders' | 'allocations';
      openModal?: 'order' | 'ship';
      customerId?: string;
      batchId?: string;
      orderId?: string;
      quantity?: number;
      asQuote?: boolean;
      nonce?: number;
    }
  | {
      tab: 'finance';
      subTab?: 'finance' | 'drm' | 'horizon_2027';
      nonce?: number;
    }
  | {
      tab: 'traceability';
      batchId?: string;
      auditFilter?: string;
      nonce?: number;
    };

export type ResultTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'brand';

export interface ResultCardMetric {
  label: string;
  value: string;
  tone?: ResultTone;
}

export interface ResultCardItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  tone?: ResultTone;
  prefill?: AssistantPrefillPayload;
}

export interface ResultCard {
  id: string;
  title: string;
  metrics?: ResultCardMetric[];
  items?: ResultCardItem[];
  note?: string;
  warning?: string;
  requiresHumanValidation?: boolean;
  action?: {
    label: string;
    prefill: AssistantPrefillPayload;
  };
}

export interface AssistantScope {
  role: RoleId;
  roleLabel: string;
  activeTab: AssistantTabId;
  canSeeCosts: boolean;
  canSeeFinance: boolean;
  enabledMainModules: Record<MainModuleId, boolean>;
  enabledAddons: Record<AddonModuleId, boolean>;
}

export interface AssistantToolContext extends AssistantScope {
  state: DomainState;
}

export interface CopilotContentPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: {
    id?: string;
    name?: string;
    args?: Record<string, unknown>;
  };
  functionResponse?: {
    id?: string;
    name?: string;
    response?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface CopilotContent {
  role?: 'user' | 'model' | string;
  parts?: CopilotContentPart[];
}

export interface CopilotToolCallRequest {
  id?: string;
  name: AssistantToolName;
  args: Record<string, unknown>;
}

export interface AssistantFinalAnswer {
  text: string;
  citedIds: string[];
  followUps: string[];
  usedTools?: AssistantToolName[];
}

export interface CopilotServerRequest {
  questionId: string;
  history: CopilotContent[];
  allowedTools: AssistantToolName[];
  scope: AssistantScope;
  toolRound: number;
  lockedModel?: string;
}

export type CopilotServerResponse =
  | {
      kind: 'tool_calls';
      questionId: string;
      model: string;
      lockedModel: string;
      modelContent: CopilotContent;
      calls: CopilotToolCallRequest[];
    }
  | {
      kind: 'answer';
      questionId: string;
      model: string;
      lockedModel: string;
      answer: AssistantFinalAnswer;
    };

export interface CopilotFeedbackPayload {
  questionId: string;
  messageId: string;
  vote: 'up' | 'down';
  model?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  questionId?: string;
  model?: string;
  offlineLocal?: boolean;
  cards?: ResultCard[];
  followUps?: string[];
  usedTools?: AssistantToolName[];
  vote?: 'up' | 'down';
}
