import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Grape,
  Wine,
  Layers,
  Package,
  ShoppingBag,
  Award,
  TrendingUp,
  GitBranch,
  Search,
  Sparkles,
  Play,
  RotateCcw,
  UserCheck,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { useStore } from './app/store-context';
import { ROLE_LABELS } from './domain/selectors';
import type { RoleId } from './domain/types';
import { AgingView } from './features/aging/AgingView';
import { BottlingView } from './features/bottling/BottlingView';
import { CellarView } from './features/cellar/CellarView';
import { DemoGuideModal } from './features/demo/DemoGuideModal';
import { AiCopilotDrawer } from './features/ai/AiCopilotDrawer';
import type { AssistantPrefillPayload, AssistantTabId } from './features/ai/types';
import { FinanceView } from './features/finance/FinanceView';
import {
  ModuleConfigProvider,
  useModuleConfig,
  type MainModuleId,
} from './features/modules/ModuleConfigContext';
import { ModuleConfiguratorModal } from './features/modules/ModuleConfiguratorModal';
import { OverviewView } from './features/overview/OverviewView';
import { SalesView } from './features/sales/SalesView';
import { GlobalSearchModal } from './features/search/GlobalSearchModal';
import { SuppliesView } from './features/supplies/SuppliesView';
import { TraceabilityView } from './features/traceability/TraceabilityView';
import { VineyardView } from './features/vineyard/VineyardView';

const ROLE_PRIMARY_TABS: Record<RoleId, string[]> = {
  direction: ['overview', 'vineyard', 'cellar', 'aging', 'bottling', 'sales', 'finance', 'traceability'],
  cellar_master: ['cellar', 'aging', 'bottling', 'supplies', 'traceability'],
  vineyard_manager: ['vineyard', 'overview', 'traceability'],
  sales: ['sales', 'bottling', 'overview'],
  accounting: ['finance', 'supplies', 'sales'],
};

const AppInner: React.FC = () => {
  const { state, role, setRole, resetDemo, feedback, clearFeedback, isReady } = useStore();
  const { isMainEnabled } = useModuleConfig();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [pendingPrefill, setPendingPrefill] = useState<AssistantPrefillPayload | null>(null);
  const prefillSeqRef = useRef(0);
  const [showDemoGuide, setShowDemoGuide] = useState<boolean>(false);
  const [showAiCopilot, setShowAiCopilot] = useState<boolean>(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState<boolean>(false);
  const [showModuleConfigurator, setShowModuleConfigurator] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  // Remonter doucement en haut uniquement si l'utilisateur était défilé plus bas
  useEffect(() => {
    try {
      if (window.scrollY > 24) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      // Ignore in test environment
    }
  }, [activeTab]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearch((prev) => !prev);
      } else if (e.key === 'Escape' && showGlobalSearch) {
        setShowGlobalSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGlobalSearch]);

  if (!isReady || !state) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
          <div className="brand-emblem" style={{ margin: '0 auto 14px auto', width: '48px', height: '48px', fontSize: '22px' }}>
            TC
          </div>
          <div className="serif-display" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '6px' }}>
            Domaine des Trois Coteaux
          </div>
          <div style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
            Ouverture du chai et chargement des 5 millésimes...
          </div>
        </div>
      </div>
    );
  }

  const recommendedTabs = ROLE_PRIMARY_TABS[role] ?? [];

  const effectiveActiveTab =
    activeTab === 'overview' || isMainEnabled(activeTab as MainModuleId)
      ? activeTab
      : 'overview';

  const navigateClean = (tab: string) => {
    setPendingPrefill(null);
    if (tab !== 'overview' && !isMainEnabled(tab as MainModuleId)) {
      setActiveTab('overview');
      return;
    }
    setActiveTab(tab);
  };

  const handleNavigatePrefill = (prefill: AssistantPrefillPayload) => {
    if (!isMainEnabled(prefill.tab as MainModuleId)) {
      navigateClean('overview');
      return;
    }
    const nextNonce = prefill.nonce ?? ++prefillSeqRef.current;
    setPendingPrefill({ ...prefill, nonce: nextNonce });
    setActiveTab(prefill.tab);
  };

  // Compteurs vivants dans la barre latérale (pour guider l'œil sans jargon)
  const untransportedCrates = Object.values(state.harvestCounts).filter((c) => c.transportId === null && c.quantity > 0).length;
  const activeLotsCount = Object.values(state.lots).length;
  const agingLotsCount = Object.values(state.lots).filter((l) => l.stage === 'aging' || l.stage === 'ready').length;
  const batchesCount = Object.values(state.batches).length;
  const lowDryGoodsCount = Object.values(state.dryGoods).filter((g) => g.onHand <= g.reorderPoint).length;
  const pendingOrdersCount = Object.values(state.orders).filter((o) => o.status === 'confirmed' || o.status === 'quote' || o.status === 'partially_shipped').length;
  const unInvoicedCount = Object.values(state.shipments).filter((s) => s.invoiceId === null).length;

  const navCounts: Record<string, { label: string; alert?: boolean }> = {
    vineyard: untransportedCrates > 0
      ? { label: `${untransportedCrates} !`, alert: true }
      : { label: `${Object.keys(state.parcels).length}` },
    cellar: { label: `${activeLotsCount}` },
    aging: { label: `${agingLotsCount}` },
    bottling: { label: `${batchesCount}` },
    supplies: lowDryGoodsCount > 0
      ? { label: `${lowDryGoodsCount} !`, alert: true }
      : { label: `${Object.keys(state.dryGoods).length}` },
    sales: { label: `${pendingOrdersCount}` },
    finance: unInvoicedCount > 0
      ? { label: `${unInvoicedCount} !`, alert: true }
      : { label: `${Object.keys(state.invoices).length}` },
    traceability: { label: `${Object.keys(state.cellarOps).length}` },
  };

  const navGroups = [
    {
      groupLabel: 'Tableau de bord',
      items: [{ id: 'overview', label: 'Vue d’ensemble', icon: LayoutDashboard }],
    },
    {
      groupLabel: 'De la Vigne au Verre',
      items: [
        { id: 'vineyard', label: 'Vignoble & Récolte', icon: Grape },
        { id: 'cellar', label: 'Chai & Vinification', icon: Wine },
        { id: 'aging', label: 'Élevage & Assemblage', icon: Layers },
        { id: 'bottling', label: 'Conditionnement & Stocks', icon: Package },
        { id: 'supplies', label: 'Matières sèches & Achats', icon: ShoppingBag },
      ].filter((item) => isMainEnabled(item.id as MainModuleId)),
    },
    {
      groupLabel: 'Clients, Cave & Maison',
      items: [
        { id: 'sales', label: 'Ventes & Commerce', icon: Award },
        { id: 'traceability', label: 'Traçabilité', icon: GitBranch },
        { id: 'finance', label: 'Pilotage & Finance', icon: TrendingUp },
      ].filter((item) => isMainEnabled(item.id as MainModuleId)),
    },
  ].filter((g) => g.items.length > 0);

  // Fil conducteur compact par icônes (filtré selon les modules souscrits par le domaine)
  const compactSteps = [
    { id: 'vineyard', short: '1. Vigne', icon: Grape },
    { id: 'cellar', short: '2. Cuverie', icon: Wine },
    { id: 'aging', short: '3. Fûts', icon: Layers },
    { id: 'bottling', short: '4. Mise', icon: Package },
    { id: 'sales', short: '5. Ventes', icon: Award },
    { id: 'traceability', short: '6. Filiation', icon: GitBranch },
  ].filter((st) => isMainEnabled(st.id as MainModuleId));

  return (
    <div className="app-shell">
      <div className="app-body">
        {/* Left Sidebar */}
        <aside className="app-sidebar" aria-label="Menu latéral du domaine">
          <div>
            <div className="brand-block">
              <div className="brand-crest">
                <div className="brand-emblem">TC</div>
                <div>
                  <div className="brand-title">Trois Coteaux</div>
                  <div className="brand-subtitle">Grands Domaines & Terroirs · Démo</div>
                </div>
              </div>
            </div>

            <nav aria-label="Navigation principale">
              {navGroups.map((group) => (
                <div key={group.groupLabel} style={{ marginBottom: '4px' }}>
                  <div className="sidebar-section-label">{group.groupLabel}</div>
                  <div className="sidebar-nav">
                    {group.items.map((item) => {
                      const IconComp = item.icon;
                      const isRecommended = recommendedTabs.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          className={`nav-tab ${effectiveActiveTab === item.id ? 'active' : ''} ${
                            isRecommended ? 'role-recommended' : ''
                          }`}
                          onClick={() => navigateClean(item.id)}
                          title={
                            isRecommended
                              ? `${item.label} — Écran clé pour ${ROLE_LABELS[role]}`
                              : item.label
                          }
                        >
                          <span className="nav-tab-left" style={{ width: '100%' }}>
                            <IconComp className="nav-icon" size={15} strokeWidth={1.85} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            {navCounts[item.id] && (
                              <span
                                aria-hidden="true"
                                className={`nav-count-pill ${navCounts[item.id]?.alert ? 'is-alert' : ''}`}
                              >
                                {navCounts[item.id]?.label}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div
            className="sidebar-footer-info"
            style={{
              padding: '9px 11px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(196, 164, 122, 0.18)',
              fontSize: '11px',
              color: 'rgba(250, 248, 245, 0.7)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 600, color: '#C4A47A' }}>24 Octobre 2026</span>
              <span style={{ fontSize: '10px', opacity: 0.78 }}>5 Millésimes</span>
            </div>
            <div style={{ fontSize: '10.5px', color: '#6EE7B7', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
              <span>✓</span>
              <span>Hors-Ligne (PWA) · IndexedDB actif</span>
            </div>
          </div>
        </aside>

        {/* Right Workspace */}
        <div className="app-workspace">
          {/* UN SEUL En-tête Aérien & Iconique (Zéro empilement de bandeaux) */}
          <header className="workspace-header" aria-label="Bandeau de démonstration">
              {/* Search Pill */}
              <button
                type="button"
                className="search-trigger-btn"
                onClick={() => setShowGlobalSearch(true)}
                aria-label="Rechercher dans tout le domaine"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Search size={14} style={{ color: 'var(--color-gold-dark)' }} />
                  <span>Climat, lot, fût, client...</span>
                </span>
                <span className="kbd-shortcut">⌘K</span>
              </button>

              {/* Compact End-to-End Iconic Breadcrumb */}
              <div className="compact-e2e-pills" aria-label="Chaîne de valeur de bout en bout">
                {compactSteps.map((st, idx) => {
                  const StepIcon = st.icon;
                  const isActive = effectiveActiveTab === st.id;
                  return (
                    <React.Fragment key={st.id}>
                      <button
                        type="button"
                        className={`compact-step-pill ${isActive ? 'active' : ''}`}
                        onClick={() => navigateClean(st.id)}
                        title={`Accéder à l’étape ${st.short}`}
                      >
                        <StepIcon size={13} style={{ color: isActive ? 'var(--color-gold-dark)' : 'currentColor' }} />
                        <span>{st.short}</span>
                      </button>
                      {idx < compactSteps.length - 1 && (
                        <ChevronRight size={11} style={{ color: 'var(--color-ink-light)', flexShrink: 0 }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Persona Selector + Iconic Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '3px 10px',
                  }}
                >
                  <UserCheck size={13} style={{ color: 'var(--color-gold-dark)' }} />
                  <label htmlFor="role-select" style={{ fontSize: '11px', color: 'var(--color-ink-muted)', fontWeight: 600 }}>
                    Persona :
                  </label>
                  <select
                    id="role-select"
                    aria-label="Rôle prévisualisé"
                    value={role}
                    onChange={(e) => setRole(e.target.value as RoleId)}
                    style={{
                      background: 'transparent',
                      color: 'var(--color-ink)',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none',
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
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowModuleConfigurator(true)}
                  title="Configurer les modules souscrits par le domaine (Packs commerciaux & extensions à la carte)"
                >
                  <Sliders size={12} style={{ color: 'var(--color-burgundy)' }} />
                  <span>Modules</span>
                </button>

                <button
                  className="btn btn-sm btn-gold"
                  onClick={() => setShowDemoGuide(true)}
                  title="Lancer le scénario guidé de bout en bout (10 étapes)"
                >
                  <Play size={12} fill="currentColor" />
                  <span>Scénario Démo</span>
                </button>

                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowAiCopilot(true)}
                  title="Ouvrir le Copilote IA Œnologique"
                >
                  <Sparkles size={13} style={{ color: '#C4A47A' }} />
                  <span>Copilote IA</span>
                </button>

                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setConfirmReset(true)}
                  title="Réinitialiser les données de démonstration"
                  aria-label="Réinitialiser démo"
                  style={{ padding: '5px 8px' }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </header>

          {/* Main Content Area */}
          <main className="app-main animate-fade-in">
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

            <>
                {effectiveActiveTab === 'overview' && (
                  <OverviewView
                    onNavigate={navigateClean}
                    onNavigatePrefill={handleNavigatePrefill}
                  />
                )}
                {effectiveActiveTab === 'vineyard' && (
                  <VineyardView
                    prefill={pendingPrefill?.tab === 'vineyard' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'cellar' && (
                  <CellarView
                    prefill={pendingPrefill?.tab === 'cellar' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'aging' && (
                  <AgingView
                    prefill={pendingPrefill?.tab === 'aging' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'bottling' && (
                  <BottlingView
                    prefill={pendingPrefill?.tab === 'bottling' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'supplies' && (
                  <SuppliesView
                    prefill={pendingPrefill?.tab === 'supplies' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'sales' && (
                  <SalesView
                    prefill={pendingPrefill?.tab === 'sales' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'finance' && (
                  <FinanceView
                    prefill={pendingPrefill?.tab === 'finance' ? pendingPrefill : undefined}
                  />
                )}
                {effectiveActiveTab === 'traceability' && (
                  <TraceabilityView
                    prefill={pendingPrefill?.tab === 'traceability' ? pendingPrefill : undefined}
                  />
                )}
              </>
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Navigation mobile terrain" className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-item ${effectiveActiveTab === 'overview' ? 'active' : ''}`}
          onClick={() => navigateClean('overview')}
        >
          <LayoutDashboard size={16} />
          <span>Cockpit</span>
        </button>
        {isMainEnabled('vineyard') && (
          <button
            type="button"
            className={`mobile-nav-item ${effectiveActiveTab === 'vineyard' ? 'active' : ''}`}
            onClick={() => navigateClean('vineyard')}
          >
            <Grape size={16} />
            <span>Vigne</span>
          </button>
        )}
        {isMainEnabled('cellar') && (
          <button
            type="button"
            className={`mobile-nav-item ${effectiveActiveTab === 'cellar' ? 'active' : ''}`}
            onClick={() => navigateClean('cellar')}
          >
            <Wine size={16} />
            <span>Chai</span>
          </button>
        )}
        {(!isMainEnabled('vineyard') || !isMainEnabled('cellar')) && isMainEnabled('sales') && (
          <button
            type="button"
            className={`mobile-nav-item ${effectiveActiveTab === 'sales' ? 'active' : ''}`}
            onClick={() => navigateClean('sales')}
          >
            <Award size={16} />
            <span>Ventes</span>
          </button>
        )}
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setShowGlobalSearch(true)}
        >
          <Search size={16} />
          <span>Chercher</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setShowAiCopilot(true)}
        >
          <Sparkles size={16} />
          <span>IA</span>
        </button>
      </nav>

      {/* Global Transverse Search Modal (⌘K) */}
      {showGlobalSearch && (
        <GlobalSearchModal
          onClose={() => setShowGlobalSearch(false)}
          onNavigate={navigateClean}
          onNavigatePrefill={handleNavigatePrefill}
        />
      )}

      {/* Reset Confirmation Modal */}
      {confirmReset && (
        <Modal
          eyebrow="Données locales"
          title="Réinitialiser la démo locale ?"
          subtitle="Cette action restaure uniquement les données d’exemple locales à leur état initial."
          onClose={() => setConfirmReset(false)}
          maxWidth="480px"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    Object.keys(localStorage).forEach((k) => {
                      if (k.startsWith('domaine-erp-')) {
                        localStorage.removeItem(k);
                      }
                    });
                  } catch {
                    // Ignore storage error
                  }
                  await resetDemo();
                  setConfirmReset(false);
                }}
              >
                Confirmer la réinitialisation
              </button>
            </>
          }
        >
          <p style={{ fontSize: '13.5px', color: 'var(--color-ink)', lineHeight: 1.55 }}>
            La base locale <code>domaine-erp-demo</code> (modifications, comptages, réceptions et paramétrages) sera remise à zéro avec les 5 millésimes de démonstration.
          </p>
        </Modal>
      )}

      {/* Guided Tour Modal */}
      <DemoGuideModal
        isOpen={showDemoGuide}
        onClose={() => setShowDemoGuide(false)}
        onNavigate={navigateClean}
        onNavigatePrefill={handleNavigatePrefill}
      />

      {/* AI Copilot Drawer */}
      <AiCopilotDrawer
        isOpen={showAiCopilot}
        onClose={() => setShowAiCopilot(false)}
        activeTab={effectiveActiveTab as AssistantTabId}
        onNavigatePrefill={handleNavigatePrefill}
      />

      {/* Configurateur d'Offre & Modules à la Carte */}
      {showModuleConfigurator && (
        <ModuleConfiguratorModal onClose={() => setShowModuleConfigurator(false)} />
      )}
    </div>
  );
};

export const App: React.FC = () => (
  <ModuleConfigProvider>
    <AppInner />
  </ModuleConfigProvider>
);
