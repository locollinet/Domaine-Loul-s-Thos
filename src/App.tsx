import React, { useState, useEffect } from 'react';
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
  Navigation,
  Lock,
  Sliders,
} from 'lucide-react';
import { useStore } from './app/store-context';
import { ROLE_LABELS } from './domain/selectors';
import type { RoleId } from './domain/types';
import { AgingView } from './features/aging/AgingView';
import { BottlingView } from './features/bottling/BottlingView';
import { CellarView } from './features/cellar/CellarView';
import { DemoGuideModal } from './features/demo/DemoGuideModal';
import { AiCopilotDrawer } from './features/ai/AiCopilotDrawer';
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
  const [restrictedFieldMode, setRestrictedFieldMode] = useState<boolean>(false);
  const [showDemoGuide, setShowDemoGuide] = useState<boolean>(false);
  const [showAiCopilot, setShowAiCopilot] = useState<boolean>(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState<boolean>(false);
  const [showModuleConfigurator, setShowModuleConfigurator] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  // Raccourci clavier Cmd+K / Ctrl+K
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

  const navGroups = [
    {
      groupLabel: 'Cockpit',
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
      groupLabel: 'Allocations & Maison',
      items: [
        { id: 'sales', label: 'Ventes & Commerce', icon: Award },
        { id: 'traceability', label: 'Traçabilité', icon: GitBranch },
        { id: 'finance', label: 'Pilotage & Finance démo', icon: TrendingUp },
      ].filter((item) => isMainEnabled(item.id as MainModuleId)),
    },
  ].filter((g) => g.items.length > 0);

  // Fil conducteur compact par icônes (filtré selon les modules souscrits par le domaine)
  const compactSteps = [
    { id: 'vineyard', short: '1. Vigne', icon: Grape },
    { id: 'cellar', short: '2. Cuverie', icon: Wine },
    { id: 'aging', short: '3. Fûts', icon: Layers },
    { id: 'bottling', short: '4. Mise', icon: Package },
    { id: 'sales', short: '5. Allocations', icon: Award },
    { id: 'traceability', short: '6. Filiation', icon: GitBranch },
  ].filter((st) => isMainEnabled(st.id as MainModuleId));

  return (
    <div className="app-shell">
      <div className="app-body">
        {/* Left Sidebar — Masquée en Mode Restreint Ouvrier / Transporteur 5h00 */}
        {!restrictedFieldMode && (
          <aside className="app-sidebar" aria-label="Menu latéral du domaine">
            <div>
              <div className="brand-block">
                <div className="brand-crest">
                  <div className="brand-emblem">TC</div>
                  <div>
                    <div className="brand-title">Trois Coteaux</div>
                    <div className="brand-subtitle">Haute Bourgogne · Démo</div>
                  </div>
                </div>
              </div>

              <nav aria-label="Navigation principale">
                {navGroups.map((group) => (
                  <div key={group.groupLabel} style={{ marginBottom: '8px' }}>
                    <div className="sidebar-section-label">{group.groupLabel}</div>
                    <div className="sidebar-nav">
                      {group.items.map((item) => {
                        const IconComp = item.icon;
                        const isRecommended = recommendedTabs.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            className={`nav-tab ${activeTab === item.id ? 'active' : ''} ${
                              isRecommended ? 'role-recommended' : ''
                            }`}
                            onClick={() => setActiveTab(item.id)}
                            title={
                              isRecommended
                                ? `${item.label} — Écran clé pour ${ROLE_LABELS[role]}`
                                : item.label
                            }
                          >
                            <span className="nav-tab-left">
                              <IconComp className="nav-icon" size={16} strokeWidth={1.85} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
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
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(196, 164, 122, 0.18)',
                fontSize: '11px',
                color: 'rgba(250, 248, 245, 0.65)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: '#C4A47A' }}>24 Octobre 2026</span>
                <span style={{ fontSize: '10px', opacity: 0.75 }}>5 Millésimes</span>
              </div>
              <div style={{ fontSize: '10.5px', opacity: 0.7 }}>
                ● Pastille or = focus persona actif
              </div>
            </div>
          </aside>
        )}

        {/* Right Workspace */}
        <div className="app-workspace">
          {restrictedFieldMode ? (
            <header
              style={{
                background: '#141814',
                color: '#FAF8F5',
                padding: '10px 24px',
                borderBottom: '2px solid #F97316',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: '#F97316',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Lock size={12} /> ACCÈS RESTREINT TERRAIN 05h00
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Profil Ouvrier / Vendangeur / Transporteur — Accès ERP complet verrouillé (Seuls le GPS et les priorités de coupe sont actifs)
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-gold"
                onClick={() => setRestrictedFieldMode(false)}
              >
                Quitter la vue restreinte (Retour ERP)
              </button>
            </header>
          ) : (
            /* UN SEUL En-tête Aérien & Iconique (Zéro empilement de bandeaux) */
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
                  const isActive = activeTab === st.id;
                  return (
                    <React.Fragment key={st.id}>
                      <button
                        type="button"
                        className={`compact-step-pill ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveTab(st.id)}
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
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setActiveTab('vineyard');
                    setRestrictedFieldMode(true);
                  }}
                  title="Verrouiller l'interface en mode Ouvrier / Transporteur 5h00 (uniquement GPS & priorités vendange)"
                >
                  <Navigation size={12} style={{ color: '#F97316' }} />
                  <span>Vue Terrain 5h</span>
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
          )}

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

            {restrictedFieldMode ? (
              <VineyardView
                restrictedFieldMode={true}
                onToggleRestrictedMode={() => setRestrictedFieldMode(false)}
              />
            ) : (
              <>
                {activeTab === 'overview' && <OverviewView onNavigate={setActiveTab} />}
                {activeTab === 'vineyard' && (
                  <VineyardView
                    restrictedFieldMode={false}
                    onToggleRestrictedMode={() => setRestrictedFieldMode(true)}
                  />
                )}
                {activeTab === 'cellar' && <CellarView />}
                {activeTab === 'aging' && <AgingView />}
                {activeTab === 'bottling' && <BottlingView />}
                {activeTab === 'supplies' && <SuppliesView />}
                {activeTab === 'sales' && <SalesView />}
                {activeTab === 'finance' && <FinanceView />}
                {activeTab === 'traceability' && <TraceabilityView />}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Navigation mobile terrain" className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={16} />
          <span>Cockpit</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'vineyard' ? 'active' : ''}`}
          onClick={() => setActiveTab('vineyard')}
        >
          <Grape size={16} />
          <span>Vigne</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'cellar' ? 'active' : ''}`}
          onClick={() => setActiveTab('cellar')}
        >
          <Wine size={16} />
          <span>Chai</span>
        </button>
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
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {confirmReset && (
        <div className="modal-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '10px' }}>
              Réinitialiser la démo locale ?
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--color-ink-muted)', marginBottom: '18px' }}>
              Cette action réinitialise uniquement la base IndexedDB <code>domaine-erp-demo</code> à son état initial.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                Annuler
              </button>
              <button
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
