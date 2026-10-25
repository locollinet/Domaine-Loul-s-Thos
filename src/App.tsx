import React, { useState } from 'react';
import { useStore } from './app/store-context';
import { ROLE_LABELS } from './domain/selectors';
import type { RoleId } from './domain/types';
import { AgingView } from './features/aging/AgingView';
import { BottlingView } from './features/bottling/BottlingView';
import { CellarView } from './features/cellar/CellarView';
import { DemoGuideModal } from './features/demo/DemoGuideModal';
import { AiCopilotDrawer } from './features/ai/AiCopilotDrawer';
import { FinanceView } from './features/finance/FinanceView';
import { OverviewView } from './features/overview/OverviewView';
import { SalesView } from './features/sales/SalesView';
import { SuppliesView } from './features/supplies/SuppliesView';
import { TraceabilityView } from './features/traceability/TraceabilityView';
import { VineyardView } from './features/vineyard/VineyardView';

export const App: React.FC = () => {
  const { state, role, setRole, resetDemo, feedback, clearFeedback, isReady } = useStore();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showDemoGuide, setShowDemoGuide] = useState<boolean>(false);
  const [showAiCopilot, setShowAiCopilot] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  if (!isReady || !state) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-forest)', marginBottom: '8px' }}>
            Chargement de l’ERP Domaine des Trois Coteaux (fictif)...
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
            Initialisation de la base IndexedDB locale et du seed v1.
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Vue d’ensemble' },
    { id: 'vineyard', label: 'Vignoble & Récolte' },
    { id: 'cellar', label: 'Chai & Vinification' },
    { id: 'aging', label: 'Élevage & Assemblage' },
    { id: 'bottling', label: 'Conditionnement & Stocks' },
    { id: 'supplies', label: 'Matières sèches & Achats' },
    { id: 'sales', label: 'Ventes & Commerce' },
    { id: 'finance', label: 'Pilotage & Finance démo' },
    { id: 'traceability', label: 'Traçabilité' },
  ];

  return (
    <div className="app-shell">
      {/* Top Demo Banner */}
      <aside aria-label="Bandeau de démonstration" className="demo-banner">
        <div className="demo-banner-left">
          <span className="demo-tag">Démo locale</span>
          <span>Domaine des Trois Coteaux — fictif</span>
          <span style={{ opacity: 0.6 }}>|</span>
          <span style={{ fontSize: '12px' }}>
            Horloge fixe : <strong>24 oct. 2026</strong>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Role Preview Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="role-select" style={{ fontSize: '12px', opacity: 0.8 }}>Rôle prévisualisé :</label>
            <select
              id="role-select"
              aria-label="Rôle prévisualisé"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleId)}
              style={{
                background: '#2B3E34',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {Object.entries(ROLE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-sm btn-accent"
            onClick={() => setShowDemoGuide(true)}
            style={{ fontWeight: 600 }}
          >
            ★ Scénario Démo (10 min)
          </button>

          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAiCopilot(true)}
            style={{ fontWeight: 600, background: '#2E6F56' }}
          >
            ✨ Copilote IA
          </button>

          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setConfirmReset(true)}
            style={{ background: '#364B40', color: '#FFF', border: 'none' }}
          >
            Réinitialiser démo
          </button>
        </div>
      </aside>

      {/* Navbar */}
      <header className="app-navbar">
        <div className="nav-brand">
          <svg width="22" height="22" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#694456" />
            <path d="M12 20 L16 10 L20 20 Z" fill="#F6F5F0" />
          </svg>
          <span>Trois Coteaux</span>
        </div>

        <nav aria-label="Navigation principale" className="nav-links">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main workspace */}
      <main className="app-main">
        {feedback && (
          <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-error'}`}>
            <span>{feedback.message}</span>
            <button
              onClick={clearFeedback}
              style={{ fontWeight: 700, marginLeft: '12px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        )}

        {activeTab === 'overview' && <OverviewView onNavigate={setActiveTab} />}
        {activeTab === 'vineyard' && <VineyardView />}
        {activeTab === 'cellar' && <CellarView />}
        {activeTab === 'aging' && <AgingView />}
        {activeTab === 'bottling' && <BottlingView />}
        {activeTab === 'supplies' && <SuppliesView />}
        {activeTab === 'sales' && <SalesView />}
        {activeTab === 'finance' && <FinanceView />}
        {activeTab === 'traceability' && <TraceabilityView />}
      </main>

      {/* Reset Confirmation Modal */}
      {confirmReset && (
        <div className="modal-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
              Réinitialiser la démo locale ?
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '16px' }}>
              Cette action réinitialise uniquement la base IndexedDB <code>domaine-erp-demo</code> à son état de seed initial. Vos autres données de navigation ne sont pas touchées.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                Annuler
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  await resetDemo();
                  setConfirmReset(false);
                }}
              >
                Confirmer la réinitialisation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Tour Modal */}
      <DemoGuideModal
        isOpen={showDemoGuide}
        onClose={() => setShowDemoGuide(false)}
        onNavigate={(tab) => {
          setActiveTab(tab);
        }}
      />

      {/* AI Copilot Drawer */}
      <AiCopilotDrawer
        isOpen={showAiCopilot}
        onClose={() => setShowAiCopilot(false)}
      />
    </div>
  );
};
