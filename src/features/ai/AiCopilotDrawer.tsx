import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Unlock,
  WifiOff,
  X,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { useModuleConfig } from '../modules/ModuleConfigContext';
import { askAssistant, sendAssistantFeedback } from './client';
import { getContextualSuggestions, runOfflineDeterministicFallback } from './helpContent';
import { buildAssistantScope } from './permissions';
import type {
  AssistantPrefillPayload,
  AssistantTabId,
  AssistantToolContext,
  ChatMessage,
  CopilotContent,
  ResultCard,
  ResultTone,
} from './types';

const TAB_LABELS: Record<AssistantTabId, string> = {
  overview: 'Vue d’ensemble',
  vineyard: 'Vignoble & Récolte',
  cellar: 'Chai & Vinification',
  aging: 'Élevage & Assemblage',
  bottling: 'Conditionnement & Stocks',
  supplies: 'Matières sèches & Achats',
  sales: 'Ventes & Commerce',
  finance: 'Pilotage & Finance',
  traceability: 'Traçabilité',
};

const INITIAL_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'model',
  text: 'Bonjour ! Je suis le Copilote IA du domaine. Mes réponses s’appuient sur des outils métier déterministes adaptés à votre rôle — sans jamais modifier la base sans votre validation.',
};

function toneBadgeClass(tone?: ResultTone): string {
  switch (tone) {
    case 'ok':
      return 'badge badge-green';
    case 'warn':
      return 'badge badge-amber';
    case 'bad':
      return 'badge badge-crimson';
    case 'brand':
      return 'badge badge-gold';
    default:
      return 'badge badge-muted';
  }
}

export const AiCopilotDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  activeTab?: AssistantTabId;
  onNavigatePrefill?: (prefill: AssistantPrefillPayload) => void;
}> = ({ isOpen, onClose, activeTab = 'overview', onNavigatePrefill }) => {
  const { state, role } = useStore();
  const { config } = useModuleConfig();

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [stepLabel, setStepLabel] = useState<string>('Analyse des données du domaine en cours...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const rawHistoryRef = useRef<CopilotContent[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scope = useMemo(
    () =>
      buildAssistantScope(
        role,
        activeTab,
        config.enabledMainModules,
        config.enabledAddons
      ),
    [role, activeTab, config.enabledMainModules, config.enabledAddons]
  );

  const quickPrompts = useMemo(() => getContextualSuggestions(scope), [scope]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading, errorMsg]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  if (!isOpen || !state) return null;

  const toolCtx: AssistantToolContext = {
    state,
    ...scope,
  };

  const handleCancelRequest = () => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  };

  const handleResetConversation = () => {
    handleCancelRequest();
    rawHistoryRef.current = [];
    setMessages([INITIAL_GREETING]);
    setErrorMsg(null);
    setLastFailedPrompt(null);
    setPrompt('');
  };

  const runLocalFallback = (text: string, baseMessages: ChatMessage[]) => {
    const localRes = runOfflineDeterministicFallback(text, toolCtx);
    const modelMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'model',
      text: localRes.answer.text,
      offlineLocal: true,
      cards: localRes.cards,
      followUps: localRes.answer.followUps,
      usedTools: localRes.answer.usedTools,
    };
    setMessages([...baseMessages, modelMsg]);
    setErrorMsg(null);
    setLastFailedPrompt(null);
  };

  const handleSendMessage = async (textToSend?: string, forceLocal = false) => {
    const text = (textToSend ?? prompt).trim();
    if (!text || isLoading) return;

    const currentRequestId = ++requestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const priorMessages = messages;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    const nextMessages = [...priorMessages, userMsg];

    setErrorMsg(null);
    setLastFailedPrompt(null);
    setMessages(nextMessages);
    if (!textToSend) {
      setPrompt('');
    }

    if (forceLocal || !isOnline) {
      runLocalFallback(text, nextMessages);
      return;
    }

    setStepLabel('Analyse des données du domaine en cours...');
    setIsLoading(true);

    try {
      const result = await askAssistant({
        question: text,
        history: rawHistoryRef.current,
        ctx: toolCtx,
        signal: controller.signal,
        onStep: (step) => {
          if (requestIdRef.current === currentRequestId) {
            setStepLabel(`${step.label} (étape ${step.round})`);
          }
        },
      });
      if (requestIdRef.current !== currentRequestId) return;

      rawHistoryRef.current = result.updatedHistory;
      const modelMsg: ChatMessage = {
        id: `m-${result.questionId}`,
        role: 'model',
        text: result.answer.text,
        questionId: result.questionId,
        model: result.model,
        cards: result.cards,
        followUps: result.answer.followUps,
        usedTools: result.answer.usedTools,
      };
      setMessages([...nextMessages, modelMsg]);
    } catch (err: unknown) {
      if (requestIdRef.current !== currentRequestId) return;
      if (err instanceof DOMException && err.name === 'AbortError') {
        setErrorMsg('Analyse interrompue.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Erreur de communication avec le copilote.';
      setErrorMsg(msg);
      setLastFailedPrompt(text);
      // Keep conversation clean so retrying does not duplicate the failed turn
      setMessages(priorMessages);
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleVote = (messageId: string, questionId: string | undefined, model: string | undefined, vote: 'up' | 'down') => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, vote } : m))
    );
    if (questionId) {
      void sendAssistantFeedback({
        questionId,
        messageId,
        vote,
        model,
      });
    }
  };

  const triggerPrefill = (prefill: AssistantPrefillPayload) => {
    if (!onNavigatePrefill) return;
    onNavigatePrefill({ ...prefill, nonce: Date.now() });
    onClose();
  };

  const renderCard = (card: ResultCard) => (
    <div
      key={card.id}
      style={{
        marginTop: '8px',
        padding: '10px 12px',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-strong)',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--color-ink)' }}>
          {card.title}
        </div>
        {card.requiresHumanValidation && (
          <span className="badge badge-gold" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={11} /> Validation humaine requise
          </span>
        )}
      </div>

      {card.warning && (
        <div
          className="alert alert-warning"
          style={{ margin: 0, padding: '6px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{card.warning}</span>
        </div>
      )}

      {card.metrics && card.metrics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {card.metrics.slice(0, 3).map((metric, idx) => (
            <span
              key={idx}
              className={toneBadgeClass(metric.tone)}
              style={{ fontSize: '11px', padding: '3px 8px' }}
            >
              <strong>{metric.label} :</strong>&nbsp;{metric.value}
            </span>
          ))}
        </div>
      )}

      {card.items && card.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {card.items.slice(0, 8).map((item) => {
            const clickable = Boolean(item.prefill && onNavigatePrefill);
            return (
              <div
                key={item.id}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable && item.prefill ? () => triggerPrefill(item.prefill!) : undefined}
                onKeyDown={
                  clickable && item.prefill
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          triggerPrefill(item.prefill!);
                        }
                      }
                    : undefined
                }
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '11.5px', color: 'var(--color-ink)' }}>
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {item.badge && (
                  <span className={toneBadgeClass(item.tone)} style={{ fontSize: '10px', flexShrink: 0 }}>
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {card.note && (
        <div style={{ fontSize: '10.5px', color: 'var(--color-ink-light)' }}>
          {card.note}
        </div>
      )}

      {card.action && onNavigatePrefill && (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => triggerPrefill(card.action!.prefill)}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}
        >
          <span>{card.action.label}</span>
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );

  const lastModelMsgId = [...messages].reverse().find((m) => m.role === 'model')?.id;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(23, 40, 32, 0.45)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 120,
      }}
      onClick={onClose}
    >
      <aside
        aria-label="Panneau Copilote IA"
        style={{
          width: '100%',
          maxWidth: '490px',
          height: '100%',
          background: 'var(--color-surface)',
          boxShadow: '-4px 0 12px rgba(23, 40, 32, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-forest)',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <Sparkles size={18} style={{ color: '#C4A47A', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Copilote IA Viticole</div>
              <div
                style={{
                  fontSize: '11px',
                  opacity: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  flexWrap: 'wrap',
                }}
              >
                {scope.canSeeCosts ? <Unlock size={10} /> : <Lock size={10} />}
                <span>
                  {scope.roleLabel} · {TAB_LABELS[activeTab]} · {scope.canSeeCosts ? 'Coûts & finances visibles' : 'Coûts masqués'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleResetConversation}
              title="Nouvelle conversation"
              aria-label="Nouvelle conversation"
              style={{
                color: 'white',
                padding: '6px',
                cursor: 'pointer',
                opacity: 0.85,
                background: 'transparent',
                border: 'none',
              }}
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le copilote"
              style={{
                color: 'white',
                padding: '6px',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Offline / Local mode banner */}
        {!isOnline && (
          <div
            style={{
              padding: '8px 14px',
              background: 'var(--color-amber-soft)',
              color: 'var(--color-amber)',
              borderBottom: '1px solid var(--color-amber-border)',
              fontSize: '11.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 600,
            }}
          >
            <WifiOff size={14} style={{ flexShrink: 0 }} />
            <span>Mode hors-ligne (chai / cave) — Réponses déterministes locales actives sans serveur.</span>
          </div>
        )}

        {/* Chat message history */}
        <div
          aria-live="polite"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                background: m.role === 'user' ? 'var(--color-forest)' : 'var(--color-surface-soft)',
                color: m.role === 'user' ? 'white' : 'var(--color-ink)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '13px',
                lineHeight: '1.5',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>

              {m.cards && m.cards.length > 0 && (
                <div style={{ marginTop: '6px' }}>{m.cards.map(renderCard)}</div>
              )}

              {m.role === 'model' && m.id === lastModelMsgId && m.followUps && m.followUps.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                  {m.followUps.map((fu, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '11px', padding: '3px 8px', minHeight: '24px' }}
                      onClick={() => handleSendMessage(fu)}
                      disabled={isLoading}
                    >
                      {fu}
                    </button>
                  ))}
                </div>
              )}

              {m.role === 'model' && m.id !== INITIAL_GREETING.id && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '10.5px',
                    color: 'var(--color-ink-light)',
                  }}
                >
                  <span>
                    {m.offlineLocal
                      ? 'Mode local déterministe'
                      : m.model
                      ? `${m.model}${m.usedTools?.length ? ` · ${m.usedTools.length} outil(s)` : ''}`
                      : 'Copilote IA'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      aria-label="Réponse utile"
                      onClick={() => handleVote(m.id, m.questionId, m.model, 'up')}
                      style={{
                        background: m.vote === 'up' ? 'var(--color-forest-soft)' : 'transparent',
                        color: m.vote === 'up' ? 'var(--color-forest)' : 'var(--color-ink-muted)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '4px',
                        padding: '2px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <ThumbsUp size={11} />
                    </button>
                    <button
                      type="button"
                      aria-label="Réponse à améliorer"
                      onClick={() => handleVote(m.id, m.questionId, m.model, 'down')}
                      style={{
                        background: m.vote === 'down' ? 'var(--color-crimson-soft)' : 'transparent',
                        color: m.vote === 'down' ? 'var(--color-crimson)' : 'var(--color-ink-muted)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '4px',
                        padding: '2px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <ThumbsDown size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div
              style={{
                alignSelf: 'flex-start',
                background: 'var(--color-surface-soft)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--color-ink-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontStyle: 'italic' }}>{stepLabel}</span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleCancelRequest}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  minHeight: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Square size={10} fill="currentColor" />
                <span>Arrêter</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              className="alert alert-error"
              role="alert"
              style={{
                fontSize: '12px',
                margin: '4px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span>{errorMsg}</span>
              {lastFailedPrompt && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleSendMessage(lastFailedPrompt)}
                    style={{ fontSize: '11px', padding: '3px 10px', minHeight: '26px' }}
                  >
                    Réessayer
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleSendMessage(lastFailedPrompt, true)}
                    style={{ fontSize: '11px', padding: '3px 10px', minHeight: '26px' }}
                  >
                    Répondre en mode local
                  </button>
                </div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-bg)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-light)', marginBottom: '4px' }}>
            Suggestions contextuelles ({TAB_LABELS[activeTab]}) :
          </div>
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '11px', whiteSpace: 'nowrap', padding: '4px 8px', minHeight: '26px' }}
                onClick={() => handleSendMessage(qp)}
                disabled={isLoading}
              >
                {qp}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              placeholder="Posez une question sur le domaine..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="form-input"
              style={{ flex: 1, minHeight: '38px' }}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !prompt.trim()}
              style={{ minHeight: '38px', padding: '0 16px' }}
            >
              Envoyer
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
};
