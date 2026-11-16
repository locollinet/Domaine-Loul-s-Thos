export {
  askAssistant,
  CopilotHttpError,
  MAX_HISTORY_TURNS,
  MAX_TOOL_ROUNDS,
  sendAssistantFeedback,
  trimHistorySafely,
  type AskAssistantParams,
  type AskAssistantResult,
  type CopilotStepEvent,
} from '../features/ai/client';
export type {
  AssistantFinalAnswer,
  AssistantPrefillPayload,
  AssistantScope,
  AssistantTabId,
  AssistantToolContext,
  AssistantToolName,
  ChatMessage,
  CopilotContent,
  ResultCard,
} from '../features/ai/types';
