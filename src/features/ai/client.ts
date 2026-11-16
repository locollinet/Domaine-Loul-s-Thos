import { getStepDescription } from './helpContent';
import { availableTools, executeAssistantTool } from './tools';
import type {
  AssistantFinalAnswer,
  AssistantToolContext,
  AssistantToolName,
  CopilotContent,
  CopilotContentPart,
  CopilotFeedbackPayload,
  CopilotServerRequest,
  CopilotServerResponse,
  ResultCard,
} from './types';

export const MAX_TOOL_ROUNDS = 4;
export const MAX_HISTORY_TURNS = 16;
const CLIENT_TIMEOUT_MS = 45_000;

export interface CopilotStepEvent {
  toolName: AssistantToolName;
  label: string;
  round: number;
}

export interface AskAssistantParams {
  question: string;
  history: CopilotContent[];
  ctx: AssistantToolContext;
  signal?: AbortSignal;
  onStep?: (step: CopilotStepEvent) => void;
}

export interface AskAssistantResult {
  questionId: string;
  model: string;
  answer: AssistantFinalAnswer;
  cards: ResultCard[];
  updatedHistory: CopilotContent[];
}

export class CopilotHttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'CopilotHttpError';
    this.status = status;
    this.code = code;
  }
}

function isUserTextTurn(turn: CopilotContent): boolean {
  if (turn.role !== 'user' || !Array.isArray(turn.parts) || turn.parts.length === 0) {
    return false;
  }
  const hasText = turn.parts.some((p) => typeof p.text === 'string' && p.text.trim().length > 0);
  const hasFunctionResponse = turn.parts.some((p) => Boolean(p.functionResponse));
  return hasText && !hasFunctionResponse;
}

/**
 * Truncates conversation history to at most `maxTurns` entries while
 * advancing the start index to the next clean user text turn so Gemini
 * never receives an orphan `functionResponse` or `model` turn.
 */
export function trimHistorySafely(
  history: CopilotContent[],
  maxTurns = MAX_HISTORY_TURNS
): CopilotContent[] {
  if (history.length === 0) return [];
  const startBase = Math.max(0, history.length - maxTurns);
  let idx = startBase;
  while (idx < history.length) {
    const turn = history[idx];
    if (turn && isUserTextTurn(turn)) {
      return history.slice(idx);
    }
    idx += 1;
  }
  // Fallback: look backwards in case the last user text turn started slightly earlier
  for (let i = startBase - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn && isUserTextTurn(turn)) {
      return history.slice(i);
    }
  }
  return [];
}

function generateQuestionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function postAssistant(
  url: string,
  body: CopilotServerRequest,
  signal: AbortSignal
): Promise<CopilotServerResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Question-Id': body.questionId,
    },
    body: JSON.stringify(body),
    signal,
  });

  const rawText = await response.text();
  let parsed: unknown = null;
  if (rawText.trim().length > 0) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new CopilotHttpError(
        response.ok
          ? 'Réponse invalide du serveur copilote (JSON attendu).'
          : rawText.slice(0, 240) || `Erreur serveur (${response.status})`,
        response.status
      );
    }
  }

  if (!response.ok) {
    const errObj =
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const message =
      (errObj && typeof errObj['error'] === 'string' && errObj['error']) ||
      `Erreur serveur (${response.status})`;
    const code =
      errObj && typeof errObj['code'] === 'string' ? errObj['code'] : undefined;
    throw new CopilotHttpError(message, response.status, code);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new CopilotHttpError('Réponse vide du serveur copilote.', response.status);
  }

  const res = parsed as Partial<CopilotServerResponse>;
  if (res.kind === 'answer' && res.answer && typeof res.answer.text === 'string') {
    return res as CopilotServerResponse;
  }
  if (
    res.kind === 'tool_calls' &&
    Array.isArray(res.calls) &&
    res.modelContent &&
    typeof res.modelContent === 'object'
  ) {
    return res as CopilotServerResponse;
  }

  throw new CopilotHttpError('Structure de réponse copilote non reconnue.', response.status);
}

/**
 * Multi-turn Function Calling loop against `/api/copilot`.
 * Keeps `modelContent` (with `thoughtSignature`) verbatim across turns and executes
 * deterministic TypeScript tools locally in the browser under the active role.
 */
export async function askAssistant({
  question,
  history,
  ctx,
  signal,
  onStep,
}: AskAssistantParams): Promise<AskAssistantResult> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => {
    timeoutController.abort(new Error('Délai d’attente dépassé côté navigateur.'));
  }, CLIENT_TIMEOUT_MS);

  const onExternalAbort = () => {
    timeoutController.abort(signal?.reason ?? new Error('Requête annulée.'));
  };

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const questionId = generateQuestionId();
  const allowedTools = availableTools(ctx);
  const workingHistory = trimHistorySafely([
    ...history,
    { role: 'user', parts: [{ text: question }] },
  ]);
  const cardsById = new Map<string, ResultCard>();
  const usedTools: AssistantToolName[] = [];
  let lockedModel: string | undefined;

  const scope = {
    role: ctx.role,
    roleLabel: ctx.roleLabel,
    activeTab: ctx.activeTab,
    canSeeCosts: ctx.canSeeCosts,
    canSeeFinance: ctx.canSeeFinance,
    enabledMainModules: ctx.enabledMainModules,
    enabledAddons: ctx.enabledAddons,
  };

  try {
    for (let toolRound = 0; toolRound <= MAX_TOOL_ROUNDS; toolRound += 1) {
      const serverRes = await postAssistant(
        '/api/copilot',
        {
          questionId,
          history: workingHistory,
          allowedTools,
          scope,
          toolRound,
          lockedModel,
        },
        timeoutController.signal
      );

      if (serverRes.kind === 'answer') {
        const finalAnswer: AssistantFinalAnswer = {
          text: serverRes.answer.text.trim() || 'Aucune réponse générée.',
          citedIds: Array.isArray(serverRes.answer.citedIds) ? serverRes.answer.citedIds : [],
          followUps: Array.isArray(serverRes.answer.followUps) ? serverRes.answer.followUps : [],
          usedTools: [...new Set(usedTools)],
        };
        const updatedHistory = trimHistorySafely([
          ...workingHistory,
          { role: 'model', parts: [{ text: finalAnswer.text }] },
        ]);
        return {
          questionId,
          model: serverRes.model,
          answer: finalAnswer,
          cards: [...cardsById.values()],
          updatedHistory,
        };
      }

      if (toolRound >= MAX_TOOL_ROUNDS) {
        throw new CopilotHttpError(
          'Nombre maximal de tours d’outils atteint sans synthèse finale.',
          500,
          'MAX_TOOL_ROUNDS'
        );
      }

      lockedModel = serverRes.lockedModel || serverRes.model;
      // Preserve candidateContent (thought / thoughtSignature / functionCall) verbatim
      workingHistory.push(serverRes.modelContent);

      const responseParts: CopilotContentPart[] = [];
      for (const call of serverRes.calls) {
        onStep?.({
          toolName: call.name,
          label: getStepDescription(call.name),
          round: toolRound + 1,
        });
        usedTools.push(call.name);
        const toolResult = executeAssistantTool(ctx, call.name, call.args ?? {});
        for (const card of toolResult.cards) {
          cardsById.set(card.id, card);
        }
        responseParts.push({
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name: call.name,
            response: toolResult.output,
          },
        });
      }

      workingHistory.push({
        role: 'user',
        parts: responseParts,
      });
    }

    throw new CopilotHttpError('Fin inattendue de la boucle copilote.', 500);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    if (timeoutController.signal.aborted) {
      const reason = timeoutController.signal.reason;
      if (reason instanceof Error) {
        throw new Error(reason.message, { cause: err });
      }
      throw new Error('La requête a été interrompue ou a expiré.', { cause: err });
    }
    if (err instanceof TypeError) {
      throw new CopilotHttpError(
        'Impossible de joindre le serveur du copilote. Vérifiez que le serveur applicatif est démarré.',
        0,
        'NETWORK_ERROR',
        err
      );
    }
    throw err instanceof Error ? err : new Error(String(err), { cause: err });
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

export async function sendAssistantFeedback(payload: CopilotFeedbackPayload): Promise<void> {
  try {
    await fetch('/api/copilot/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Question-Id': payload.questionId,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Feedback is best-effort and must never break UI flow
  }
}
