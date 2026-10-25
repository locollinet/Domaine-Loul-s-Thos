import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { askGemini, getGeminiApiKey, setGeminiApiKey } from '../../infra/ai';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const AiCopilotDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { state } = useStore();
  const [apiKey, setApiKey] = useState(getGeminiApiKey() || '');
  const [isEditingKey, setIsEditingKey] = useState(!getGeminiApiKey());
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: 'Bonjour ! Je suis le Copilote IA de l’exploitation. J’ai accès à l’état en direct de vos parcelles, de votre chai et de vos stocks de bouteilles. Comment puis-je vous assister ?',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !state) return null;

  const hasKey = Boolean(getGeminiApiKey());

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    setGeminiApiKey(apiKey);
    setIsEditingKey(false);
    setErrorMsg(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text || isLoading) return;

    setErrorMsg(null);
    const newHistory: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(newHistory);
    setPrompt('');
    setIsLoading(true);

    try {
      const reply = await askGemini(text, state, messages);
      setMessages([...newHistory, { role: 'model', text: reply }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de communication avec Gemini.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✨</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>Copilote IA Viticole</div>
              <div style={{ fontSize: '11px', opacity: 0.85 }}>Connecté à Google AI Studio (Gemini 3.8 Flash)</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'white', fontSize: '18px', padding: '4px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* API Key Banner / Config */}
        <div style={{ padding: '10px 16px', background: 'var(--color-surface-soft)', borderBottom: '1px solid var(--color-border)' }}>
          {isEditingKey ? (
            <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="ai-studio-key" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                Clé API Google AI Studio (stockée localement dans votre navigateur) :
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  id="ai-studio-key"
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="form-input"
                  style={{ minHeight: '32px', fontSize: '12px' }}
                  required
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  Enregistrer
                </button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                Obtenez une clé gratuitement sur{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--color-forest)', textDecoration: 'underline' }}
                >
                  aistudio.google.com
                </a>.
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'var(--color-forest)', fontWeight: 600 }}>
                ● Clé AI Studio active ({apiKey.slice(0, 6)}••••)
              </span>
              <button
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '11px', padding: '2px 8px', minHeight: '26px' }}
                onClick={() => setIsEditingKey(true)}
              >
                Changer la clé
              </button>
            </div>
          )}
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
                padding: '8px 14px',
                fontSize: '12px',
                color: 'var(--color-ink-muted)',
                fontStyle: 'italic',
              }}
            >
              Analyse des données du domaine en cours...
            </div>
          )}

          {errorMsg && (
            <div className="alert alert-error" style={{ fontSize: '12px', margin: '4px 0' }}>
              {errorMsg}
            </div>
          )}
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
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '11px', whiteSpace: 'nowrap', padding: '4px 8px', minHeight: '26px' }}
                onClick={() => handleSendMessage(qp)}
                disabled={!hasKey || isLoading}
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
              placeholder={hasKey ? 'Posez une question sur le domaine...' : 'Renseignez d’abord votre clé ci-dessus'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="form-input"
              style={{ flex: 1, minHeight: '38px' }}
              disabled={!hasKey || isLoading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!hasKey || isLoading || !prompt.trim()}
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
