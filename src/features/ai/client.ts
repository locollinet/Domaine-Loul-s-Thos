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
const CLIENT_TIMEOUT_MS = 30_000;

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
  onToken?: (partialText: string) => void;
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

interface PrefetchPlan {
  name: AssistantToolName;
  args: Record<string, unknown>;
}

function normalizeForRouting(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Selects at most one deterministic read tool matching the user question/tab so
 * Round 0 already carries verified domain data (avoiding a full extra LLM round-trip).
 * Never runs sensitive financial tools if `availableTools(ctx)` forbids them.
 */
function selectPrefetchPlan(
  question: string,
  ctx: AssistantToolContext,
  allowedTools: AssistantToolName[]
): PrefetchPlan | null {
  const q = normalizeForRouting(question);
  if (!q) return null;

  // Let Gemini extract structured args cleanly for form/navigation actions
  if (/\b(prepar\w*|pre-?rempli\w*|ouvr\w*|navigu\w*)\b/.test(q)) {
    return null;
  }
  // Unauthorized finance/cost prompt -> let model deny directly in 1 turn without noisy cards
  if (!ctx.canSeeCosts && /\b(cout\w*|prix|factur\w*|tresorer\w*|finance\w*|budget|marge|avoir|reglement)\b/.test(q)) {
    return null;
  }
  // Autonomous oenological dosage requests -> let model refuse directly in 1 turn
  if (
    /\b(dose\w*|ajouter|gramm\w*|sulfite\w*|collage|levur\w*)\b/.test(q) ||
    (/\bso2\b/.test(q) && !/\b(releve|manquant|ferment|analyse|historique|phyto)\b/.test(q))
  ) {
    return null;
  }

  const has = (name: AssistantToolName) => allowedTools.includes(name);

  if (
    has('search_traceability') &&
    /\b(retrac\w*|origine|filiation|tracabilit\w*|provient|genealog\w*|journal|audit)\b|d'ou vient|d ou vient/.test(q)
  ) {
    const codeMatch = /\b([ml]\d{2}-[a-z0-9-]+)\b/i.exec(question);
    return {
      name: 'search_traceability',
      args: { ...(codeMatch ? { query: codeMatch[1]!.toUpperCase() } : {}), limit: 8 },
    };
  }

  if (
    has('check_aging_and_bottling') &&
    /\b(assemblag\w*|mise|bouteilles?\b.*2024|etiquett\w*|bouchon\w*|carton\w*|matieres? sech\w*|faisabilit\w*|prets?)\b/.test(q)
  ) {
    return {
      name: 'check_aging_and_bottling',
      args: {
        ...(q.includes('2025') || q.includes('assemblage') ? { checkBlend2025: true } : {}),
        ...(q.includes('2024') ? { vintage: 2024 } : q.includes('2025') ? { vintage: 2025 } : {}),
        ...(q.includes('blanc 2024') ? { skuQuery: 'Blanc 2024' } : {}),
      },
    };
  }

  if (
    has('check_commercial_stock') &&
    /\b(bouteill\w*|livrer|vendabl\w*|command\w*|devis|client\w*|expedit\w*|m23|table des coteaux|saint-vincent)\b/.test(q)
  ) {
    return {
      name: 'check_commercial_stock',
      args: { limit: 8 },
    };
  }

  if (
    has('inspect_finance_and_planning') &&
    /\b(tresorer\w*|factur\w*|avoir\w*|reglement\w*|cout\w*|financ\w*|budget|2027|renouvellement|prevision\w*|certitude)\b/.test(q)
  ) {
    return {
      name: 'inspect_finance_and_planning',
      args: { limit: 8 },
    };
  }

  if (
    has('inspect_vineyard') &&
    /\b(parcell\w*|vendang\w*|caiss\w*|recolt\w*|poids|kg|phyto\w*|tesa|cuivre|dar|znt|surfac\w*|arpent\w*|mission\w*|reception\w*|ticket|tk-)\b/.test(q)
  ) {
    return {
      name: 'inspect_vineyard',
      args: { includePendingCounts: true, limit: 8 },
    };
  }

  if (
    has('inspect_cellar') &&
    /\b(chai|cuv\w*|foudr\w*|barriqu\w*|fut\w*|ferment\w*|cinetiqu\w*|densit\w*|temperatur\w*|releve\w*|mesur\w*|manquant\w*|trou\w*|maintenanc\w*|disponibl\w*|volume\w*|blanc 2026|rouge 2026|l26-|l25-|l24-|c-0\d)\b/.test(q)
  ) {
    const lotMatch = /\b(l\d{2}-[a-z]-[a-z0-9]+|blanc\s+20\d{2}|rouge\s+20\d{2})\b/i.exec(question);
    const wantsMaintenance = q.includes('maintenanc') && !q.includes('disponibl');
    const wantsMeasurements =
      /\b(ferment\w*|cinetiqu\w*|densit\w*|temperatur\w*|releve\w*|mesur\w*|manquant\w*|trou\w*|analyt\w*|tav|so2)\b/.test(q);
    return {
      name: 'inspect_cellar',
      args: {
        ...(lotMatch ? { lotQuery: lotMatch[1] } : {}),
        ...(wantsMaintenance ? { onlyMaintenanceContainers: true } : {}),
        includeMeasurements: wantsMeasurements,
        limit: 8,
      },
    };
  }

  switch (ctx.activeTab) {
    case 'vineyard':
      return has('inspect_vineyard') ? { name: 'inspect_vineyard', args: { includePendingCounts: true, limit: 8 } } : null;
    case 'cellar':
      return has('inspect_cellar') ? { name: 'inspect_cellar', args: { includeMeasurements: false, limit: 8 } } : null;
    case 'aging':
    case 'bottling':
    case 'supplies':
      return has('check_aging_and_bottling') ? { name: 'check_aging_and_bottling', args: {} } : null;
    case 'sales':
      return has('check_commercial_stock') ? { name: 'check_commercial_stock', args: { limit: 8 } } : null;
    case 'finance':
      return has('inspect_finance_and_planning') ? { name: 'inspect_finance_and_planning', args: { limit: 8 } } : null;
    case 'traceability':
      return has('search_traceability') ? { name: 'search_traceability', args: { limit: 8 } } : null;
    default:
      if (has('inspect_cellar') && /\b(bilan|resum\w*|aujourd|domaine|etat|priorit\w*|alert\w*)\b/.test(q)) {
        return { name: 'inspect_cellar', args: { includeMeasurements: false, limit: 6 } };
      }
      return null;
  }
}

function validateServerResponse(parsed: unknown, status: number): CopilotServerResponse {
  if (!parsed || typeof parsed !== 'object') {
    throw new CopilotHttpError('Réponse vide du serveur copilote.', status);
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
  throw new CopilotHttpError('Structure de réponse copilote non reconnue.', status);
}

async function readSseCopilotStream(
  response: Response,
  onToken?: (partialText: string) => void
): Promise<CopilotServerResponse> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamedText = '';
  let donePayload: CopilotServerResponse | null = null;

  const processBlock = (block: string) => {
    const trimmed = block.trim();
    if (!trimmed) return;
    let eventName = 'message';
    const dataLines: string[] = [];

    for (const line of trimmed.split(/\r?\n/)) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (dataLines.length === 0) return;
    const rawData = dataLines.join('\n');
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return;
    }

    if (eventName === 'delta' && parsed && typeof parsed === 'object') {
      const deltaText = (parsed as Record<string, unknown>)['text'];
      if (typeof deltaText === 'string' && deltaText.length > 0) {
        streamedText += deltaText;
        onToken?.(streamedText);
      }
      return;
    }

    if (eventName === 'error' && parsed && typeof parsed === 'object') {
      const errObj = parsed as Record<string, unknown>;
      const status = typeof errObj['status'] === 'number' ? errObj['status'] : 500;
      const code = typeof errObj['code'] === 'string' ? errObj['code'] : undefined;
      const message =
        typeof errObj['error'] === 'string' ? errObj['error'] : `Erreur serveur (${status})`;
      throw new CopilotHttpError(message, status, code);
    }

    if (eventName === 'done') {
      donePayload = validateServerResponse(parsed, response.status);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: !done });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          processBlock(part);
        }
      }
      if (done) break;
    }
    if (buffer.trim().length > 0) {
      processBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }

  if (!donePayload) {
    throw new CopilotHttpError('Flux de réponse copilote interrompu.', response.status);
  }
  return donePayload;
}

async function postAssistant(
  url: string,
  body: CopilotServerRequest,
  signal: AbortSignal,
  onToken?: (partialText: string) => void
): Promise<CopilotServerResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
      'X-Question-Id': body.questionId,
    },
    body: JSON.stringify(body),
    signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  if (response.ok && contentType.includes('text/event-stream') && response.body) {
    return readSseCopilotStream(response, onToken);
  }

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

  return validateServerResponse(parsed, response.status);
}

/**
 * Multi-turn Function Calling loop against `/api/copilot`.
 * Preloads the primary deterministic read context locally (< 1 ms) when appropriate
 * so most questions complete in a single streamed LLM call, while preserving verbatim
 * `modelContent` (`thoughtSignature`) whenever additional tool calls are needed.
 */
export async function askAssistant({
  question,
  history,
  ctx,
  signal,
  onStep,
  onToken,
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
  const cardsById = new Map<string, ResultCard>();
  const usedTools: AssistantToolName[] = [];

  // Optional 0ms local read pre-fetch for instant single-round synthesis
  let roundZeroPrompt = question;
  const prefetchPlan = selectPrefetchPlan(question, ctx, allowedTools);
  if (prefetchPlan) {
    const prefetchRes = executeAssistantTool(ctx, prefetchPlan.name, prefetchPlan.args);
    usedTools.push(prefetchPlan.name);
    for (const card of prefetchRes.cards) {
      cardsById.set(card.id, card);
    }
    roundZeroPrompt = `${question}\n\n[DONNÉES PRÉCHARGÉES (${prefetchPlan.name})]\n${JSON.stringify(prefetchRes.output)}`;
  }

  const baseCleanHistory = trimHistorySafely([
    ...history,
    { role: 'user', parts: [{ text: question }] },
  ]);
  const workingHistory = trimHistorySafely([
    ...history,
    { role: 'user', parts: [{ text: roundZeroPrompt }] },
  ]);
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
        timeoutController.signal,
        onToken
      );

      if (serverRes.kind === 'answer') {
        const finalAnswer: AssistantFinalAnswer = {
          text: serverRes.answer.text.trim() || 'Aucune réponse générée.',
          citedIds: Array.isArray(serverRes.answer.citedIds) ? serverRes.answer.citedIds : [],
          followUps: Array.isArray(serverRes.answer.followUps) ? serverRes.answer.followUps : [],
          usedTools: [...new Set(usedTools)],
        };
        // Persist concise question text (never bloated prefetched JSON) in multi-turn history
        const updatedHistory = trimHistorySafely([
          ...baseCleanHistory,
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
