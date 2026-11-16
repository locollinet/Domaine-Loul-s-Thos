import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Square, X } from 'lucide-react';
import { useStore } from '../../app/store-context';
import { askGemini, type CopilotHistoryTurn } from '../../infra/ai';

const INITIAL_GREETING: CopilotHistoryTurn = {
  role: 'model',
  text: 'Bonjour ! Je suis le Copilote IA de l’exploitation. J’ai accès à l’état en direct de vos parcelles, de votre chai et de vos stocks de bouteilles. Comment puis-je vous assister ?',
};

export const AiCopilotDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { state } = useStore();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<CopilotHistoryTurn[]>([INITIAL_GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isOpen, messages, isLoading, errorMsg]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  if (!isOpen || !state) return null;

  const handleCancelRequest = () => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  };

  const handleResetConversation = () => {
    handleCancelRequest();
    setMessages([INITIAL_GREETING]);
    setErrorMsg(null);
    setLastFailedPrompt(null);
    setPrompt('');
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? prompt).trim();
    if (!text || isLoading) return;

    const currentRequestId = ++requestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const priorHistory = messages;
    const nextMessages: CopilotHistoryTurn[] = [...priorHistory, { role: 'user', text }];

    setErrorMsg(null);
    setLastFailedPrompt(null);
    setMessages(nextMessages);
    if (!textToSend) {
      setPrompt('');
    }
    setIsLoading(true);

    try {
      const reply = await askGemini(text, state, priorHistory, controller.signal);
      if (requestIdRef.current !== currentRequestId) return;
      setMessages([...nextMessages, { role: 'model', text: reply.text }]);
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
      setMessages(priorHistory);
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  const quickPrompts = [
    'Fais un bilan des volumes de vin actuellement au chai.',
    'Quels lots sont prêts pour l’assemblage 2025 ?',
    'Où en est la cinétique de fermentation du Blanc 2026 ?',
    'Combien de bouteilles puis-je livrer immédiatement ?',
  ];

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
          maxWidth: '460px',
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
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-forest)',
            color: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={18} style={{ color: '#C4A47A', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Copilote IA Viticole</div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>
                Analyse en direct du domaine · Mode lecture seule
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

        {/* Chat message history */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '88%',
                background: m.role === 'user' ? 'var(--color-forest)' : 'var(--color-surface-soft)',
                color: m.role === 'user' ? 'white' : 'var(--color-ink)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {m.text}
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
              <span style={{ fontStyle: 'italic' }}>Analyse des données du domaine en cours...</span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleCancelRequest}
                style={{ fontSize: '11px', padding: '2px 8px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleSendMessage(lastFailedPrompt)}
                  style={{ fontSize: '11px', padding: '3px 10px', minHeight: '26px' }}
                >
                  Réessayer
                </button>
              )}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompt suggestions */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-light)', marginBottom: '4px' }}>
            Suggestions rapides :
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
