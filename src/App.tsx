import React, { useState, useEffect } from 'react';
import { useStore } from './app/store-context';
import { ROLE_LABELS, lotVolumeMl, batchPosition } from './domain/selectors';
import type { RoleId } from './domain/types';
import { AgingView } from './features/aging/AgingView';
import { BottlingView } from './features/bottling/BottlingView';
import { CellarView } from './features/cellar/CellarView';
import { DemoGuideModal } from './features/demo/DemoGuideModal';
import { AiCopilotDrawer } from './features/ai/AiCopilotDrawer';
import { FinanceView } from './features/finance/FinanceView';
import { OverviewView } from './features/overview/OverviewView';
import { SalesView } from './features/sales/SalesView';
import { GlobalSearchModal } from './features/search/GlobalSearchModal';
import { SuppliesView } from './features/supplies/SuppliesView';
import { TraceabilityView } from './features/traceability/TraceabilityView';
import { VineyardView } from './features/vineyard/VineyardView';

interface RoleMeta {
  description: string;
  primaryTabs: string[];
  permissionsSummary: string;
  badgeClass: string;
}

const ROLE_METADATA: Record<RoleId, RoleMeta> = {
  direction: {
    description: 'Accès intégral de bout en bout (Vignoble, Chai, Mise, Commerce, Finance & Arbitrages qualité).',
    primaryTabs: ['overview', 'vineyard', 'cellar', 'aging', 'bottling', 'supplies', 'sales', 'finance', 'traceability'],
    permissionsSummary: 'Toutes opérations autorisées (Déblocage qualité, Assemblages, Commandes, Facturation)',
    badgeClass: 'badge-green',
  },
  cellar_master: {
    description: 'Pilotage technique du chai : réceptions vendange, vinification, élevage, assemblages, mises et qualité.',
    primaryTabs: ['cellar', 'aging', 'bottling', 'supplies', 'traceability'],
    permissionsSummary: 'Autorisé : Réception, Vinification, Transferts, Assemblages, Mise, Libération qualité · Bloqué : Facturation',
    badgeClass: 'badge-grape',
  },
  vineyard_manager: {
    description: 'Conduite du vignoble : parcelles, observations, missions annuelles, comptage vendange et transport.',
    primaryTabs: ['vineyard', 'overview', 'traceability'],
    permissionsSummary: 'Autorisé : Missions, Observations, Comptages caisses, Transports & Réceptions · Bloqué : Chai & Ventes',
    badgeClass: 'badge-green',
  },
  sales: {
    description: 'Gestion commerciale : disponibilités, devis/commandes, réservations de stock, expéditions et retours.',
    primaryTabs: ['sales', 'bottling', 'overview', 'traceability'],
    permissionsSummary: 'Autorisé : Commandes, Réservations, Expéditions, Retours & Blocage préventif · Bloqué : Opérations de cave',
    badgeClass: 'badge-amber',
  },
  accounting: {
    description: 'Gestion administrative et financière : achats matières sèches, inventaires, factures démo et coûts.',
    primaryTabs: ['finance', 'supplies', 'sales', 'overview'],
    permissionsSummary: 'Autorisé : Achats matières, Inventaires, Factures démo, Avoirs, Règlements & Coûts · Bloqué : Cave & Vigne',
    badgeClass: 'badge-muted',
  },
};

interface StepProcessInfo {
  stepNumber: number;
  totalSteps: number;
  stageTitle: string;
  purpose: string;
  prevTab?: { id: string; label: string };
  nextTab?: { id: string; label: string };
}

const PROCESS_FLOW_INFO: Record<string, StepProcessInfo> = {
  vineyard: {
    stepNumber: 1,
    totalSteps: 6,
    stageTitle: 'Étape 1/6 — Amont Viticole & Vendanges',
    purpose: 'Suivre les parcelles, exécuter les missions de récolte, compter les caisses au terrain et réceptionner la pesée au chai pour créer un lot de moût.',
    prevTab: { id: 'overview', label: 'Cockpit du Domaine' },
    nextTab: { id: 'cellar', label: '2. Chai & Vinification' },
  },
  cellar: {
    stepNumber: 2,
    totalSteps: 6,
    stageTitle: 'Étape 2/6 — Chai & Vinification',
    purpose: 'Piloter l’occupation des cuves, suivre les courbes de fermentation (densité/température), déclarer le volume de vin écoulé et gérer le statut qualité.',
    prevTab: { id: 'vineyard', label: '1. Vignoble & Récolte' },
    nextTab: { id: 'aging', label: '3. Élevage & Assemblage' },
  },
  aging: {
    stepNumber: 3,
    totalSteps: 6,
    stageTitle: 'Étape 3/6 — Élevage en Fûts & Studio d’Assemblage',
    purpose: 'Suivre l’élevage sous bois (ouillages, part des anges), simuler des essais d’assemblage sans écriture puis exécuter l’assemblage officiel avec filiation.',
    prevTab: { id: 'cellar', label: '2. Chai & Vinification' },
    nextTab: { id: 'bottling', label: '4. Conditionnement & Stocks' },
  },
  bottling: {
    stepNumber: 4,
    totalSteps: 6,
    stageTitle: 'Étape 4/6 — Conditionnement, Mise en Bouteille & Lots Habillés',
    purpose: 'Contrôler la disponibilité des 4 matières sèches, convertir le vin vrac (L) en bouteilles habillées avec bilan des pertes et gérer la quarantaine.',
    prevTab: { id: 'aging', label: '3. Élevage & Assemblage' },
    nextTab: { id: 'sales', label: '5. Ventes & Commerce' },
  },
  supplies: {
    stepNumber: 4,
    totalSteps: 6,
    stageTitle: 'Étape 4bis — Approvisionnement Matières Sèches & Inventaires',
    purpose: 'Commander et réceptionner bouteilles vides, bouchons, étiquettes et cartons nécessaires aux mises en bouteille.',
    prevTab: { id: 'bottling', label: '4. Conditionnement & Mise' },
    nextTab: { id: 'sales', label: '5. Ventes & Commerce' },
  },
  sales: {
    stepNumber: 5,
    totalSteps: 6,
    stageTitle: 'Étape 5/6 — Allocation Commerciale, Commandes & Expéditions',
    purpose: 'Vendre uniquement sur le stock disponible (Physique − Réservé − Bloqué), préparer les livraisons (déstockage réel au BL) et émettre les factures démo.',
    prevTab: { id: 'bottling', label: '4. Conditionnement & Stocks' },
    nextTab: { id: 'traceability', label: '6. Traçabilité & Filiation' },
  },
  traceability: {
    stepNumber: 6,
    totalSteps: 6,
    stageTitle: 'Étape 6/6 — Généalogie Amont ↔ Aval & Journal d’Audit',
    purpose: 'Remonter de n’importe quelle bouteille livrée jusqu’aux parcelles d’origine, aux matières sèches utilisées et au journal immuable des opérations.',
    prevTab: { id: 'sales', label: '5. Ventes & Commerce' },
    nextTab: { id: 'finance', label: 'Pilotage Multi-Millésimes' },
  },
  finance: {
    stepNumber: 6,
    totalSteps: 6,
    stageTitle: 'Pilotage Stratégique Multi-Millésimes (2023 → 2027)',
    purpose: 'Analyser les coûts techniques engagés, la trésorerie illustrative et simuler l’impact pluriannuel d’un arrachage/replantation (Horizon 2027).',
    prevTab: { id: 'traceability', label: '6. Traçabilité' },
    nextTab: { id: 'overview', label: 'Retour Vue d’ensemble' },
  },
};

export const App: React.FC = () => {
  const { state, role, setRole, resetDemo, feedback, setFeedback, clearFeedback, isReady } = useStore();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showDemoGuide, setShowDemoGuide] = useState<boolean>(false);
  const [showAiCopilot, setShowAiCopilot] = useState<boolean>(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  // Raccourci clavier Cmd+K / Ctrl+K pour la recherche transversale
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
        <div style={{ textAlign: 'center', maxWidth: '420px', padding: '24px' }}>
          <div className="brand-emblem" style={{ margin: '0 auto 14px auto', width: '48px', height: '48px', fontSize: '22px' }}>
            TC
          </div>
          <div className="serif-display" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-ink)', marginBottom: '6px' }}>
            Domaine des Trois Coteaux
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--color-ink-muted)' }}>
            Initialisation du moteur transactionnel IndexedDB et chargement des 5 millésimes...
          </div>
        </div>
      </div>
    );
  }

  // Calcul des métriques temps réel pour la barre de processus End-to-End
  const fermentingL =
    Object.values(state.lots)
      .filter((l) => l.stage === 'fermenting' || l.stage === 'receiving')
      .reduce((acc, l) => acc + lotVolumeMl(state, l.id), 0) / 1000;

  const agingAndBlendL =
    Object.values(state.lots)
      .filter((l) => l.stage === 'aging' || l.stage === 'ready')
      .reduce((acc, l) => acc + lotVolumeMl(state, l.id), 0) / 1000;

  const totalAvailBottles = Object.values(state.batches).reduce(
    (acc, b) => acc + batchPosition(state, b).available,
    0
  );

  const activeOrdersCount = Object.values(state.orders).filter(
    (o) => o.status === 'confirmed' || o.status === 'partially_shipped'
  ).length;

  const roleMeta = ROLE_METADATA[role];
  const currentProcessInfo = PROCESS_FLOW_INFO[activeTab];

  const navGroups = [
    {
      groupLabel: 'Cockpit & Pilotage',
      items: [{ id: 'overview', label: 'Vue d’ensemble', step: '★' }],
    },
    {
      groupLabel: 'Chaîne Vigne → Bouteille',
      items: [
        { id: 'vineyard', label: 'Vignoble & Récolte', step: '1' },
        { id: 'cellar', label: 'Chai & Vinification', step: '2' },
        { id: 'aging', label: 'Élevage & Assemblage', step: '3' },
        { id: 'bottling', label: 'Conditionnement & Stocks', step: '4' },
        { id: 'supplies', label: 'Matières sèches & Achats', step: '4b' },
      ],
    },
    {
      groupLabel: 'Aval, Filiation & Stratégie',
      items: [
        { id: 'sales', label: 'Ventes & Commerce', step: '5' },
        { id: 'traceability', label: 'Traçabilité', step: '6' },
        { id: 'finance', label: 'Pilotage & Finance démo', step: '7' },
      ],
    },
  ];

  const e2ePipelineSteps = [
    {
      id: 'vineyard',
      num: '1',
      title: 'Amont Viticole',
      metric: `${Object.keys(state.parcels).length} parcelles · 1 vendange`,
    },
    {
      id: 'cellar',
      num: '2',
      title: 'Cuverie & Moûts',
      metric: `${fermentingL.toLocaleString('fr-FR')} L en cuve`,
    },
    {
      id: 'aging',
      num: '3',
      title: 'Fûts & Cuvées',
      metric: `${agingAndBlendL.toLocaleString('fr-FR')} L en chai`,
    },
    {
      id: 'bottling',
      num: '4',
      title: 'Mise & Habillage',
      metric: `${totalAvailBottles} bout. dispo`,
    },
    {
      id: 'sales',
      num: '5',
      title: 'Allocation & BL',
      metric: `${activeOrdersCount} cmd à livrer`,
    },
    {
      id: 'traceability',
      num: '6',
      title: 'Généalogie & Audit',
      metric: `${Object.keys(state.cellarOps).length} actes tracés`,
    },
  ];

  return (
    <div className="app-shell">
      {/* Top Estate Status Banner */}
      <aside aria-label="Bandeau de démonstration" className="demo-banner">
        <div className="demo-banner-left">
          <span className="demo-tag">Grand Cru · Démo Locale</span>
          <span style={{ fontWeight: 600 }}>Domaine des Trois Coteaux (Thos & Loul’s)</span>
          <span style={{ opacity: 0.45 }}>|</span>
          <span style={{ fontSize: '12px', opacity: 0.9 }}>
            Date métier : <strong>24 oct. 2026</strong> · Persistance IndexedDB active
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Role Preview Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="role-select" style={{ fontSize: '12px', opacity: 0.85 }}>
              Rôle prévisualisé :
            </label>
            <select
              id="role-select"
              aria-label="Rôle prévisualisé"
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value as RoleId;
                setRole(nextRole);
                setFeedback({
                  type: 'success',
                  message: `Rôle basculé sur « ${ROLE_LABELS[nextRole]} ». Les habilitations et onglets prioritaires (point vert) sont mis à jour.`,
                });
              }}
              style={{
                background: '#24382E',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.24)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
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
            style={{ background: 'rgba(255,255,255,0.1)', color: '#FFF', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Réinitialiser démo
          </button>
        </div>
      </aside>

      {/* Main Body: Left Sidebar + Right Workspace */}
      <div className="app-body">
        {/* Left Sidebar Navigation */}
        <aside className="app-sidebar" aria-label="Menu latéral du domaine">
          <div>
            <div className="brand-block">
              <div className="brand-crest">
                <div className="brand-emblem">TC</div>
                <div>
                  <div className="brand-title">Trois Coteaux</div>
                  <div className="brand-subtitle">ERP Viticole · Vigne au Verre</div>
                </div>
              </div>
            </div>

            <nav aria-label="Navigation principale">
              {navGroups.map((group) => (
                <div key={group.groupLabel} style={{ marginBottom: '10px' }}>
                  <div className="sidebar-section-label">{group.groupLabel}</div>
                  <div className="sidebar-nav">
                    {group.items.map((item) => {
                      const isRecommended = roleMeta.primaryTabs.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          className={`nav-tab ${activeTab === item.id ? 'active' : ''} ${
                            isRecommended ? 'role-recommended' : ''
                          }`}
                          onClick={() => setActiveTab(item.id)}
                          title={
                            isRecommended
                              ? `${item.label} — Périmètre principal pour ${ROLE_LABELS[role]}`
                              : `${item.label} — Consultation (${ROLE_LABELS[role]})`
                          }
                        >
                          <span className="nav-tab-left">
                            <span className="nav-step-num">{item.step}</span>
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
              background: 'rgba(255, 255, 255, 0.55)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: '11.5px',
              color: 'var(--color-ink-muted)',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--color-ink)', marginBottom: '4px' }}>
              Continuité Multi-Millésimes
            </div>
            <div>2023 (Bouteilles) · 2024 (Fûts)</div>
            <div>2025 (Assemblage) · 2026 (Ferment.)</div>
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-forest)', fontWeight: 600 }}>
              ● Point vert = Métier du rôle actif
            </div>
          </div>
        </aside>

        {/* Right Workspace */}
        <div className="app-workspace">
          {/* Top Command & Search Bar */}
          <header className="workspace-header">
            <button
              type="button"
              className="search-trigger-btn"
              onClick={() => setShowGlobalSearch(true)}
              aria-label="Rechercher dans tout le domaine"
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔍</span>
                <span>Rechercher parcelle, lot, cuve, cuvée, client...</span>
              </span>
              <span className="kbd-shortcut">⌘K</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className={`badge ${roleMeta.badgeClass}`}>
                👤 {ROLE_LABELS[role]}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }} className="tabular">
                <strong>{Object.keys(state.lots).length}</strong> lots ·{' '}
                <strong>{totalAvailBottles}</strong> bout. vendables
              </span>
            </div>
          </header>

          {/* Interactive Role Context Strip (Shows what the selected role actually does!) */}
          <div className="role-context-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: 'var(--color-ink)' }}>
                Périmètre {ROLE_LABELS[role]} :
              </span>
              <span>{roleMeta.permissionsSummary}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                ● Point vert dans le menu latéral = module prioritaire du rôle
              </span>
            </div>
          </div>

          {/* Interactive End-to-End Value Chain Pipeline Bar */}
          <section aria-label="Chaîne de valeur de bout en bout" className="e2e-pipeline-strip">
            <div className="e2e-pipeline-inner">
              {e2ePipelineSteps.map((st, idx) => (
                <React.Fragment key={st.id}>
                  <button
                    type="button"
                    className={`e2e-step-btn ${activeTab === st.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(st.id)}
                  >
                    <span className="e2e-step-badge">{st.num}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="e2e-step-title">{st.title}</div>
                      <div className="e2e-step-metric">{st.metric}</div>
                    </div>
                  </button>
                  {idx < e2ePipelineSteps.length - 1 && (
                    <span className="e2e-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </section>

          {/* Main Content Area */}
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

            {/* Contextual End-to-End Process Guide Banner on Module Pages */}
            {currentProcessInfo && (
              <div className="process-context-banner">
                <div style={{ maxWidth: '760px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span className="badge badge-green">{currentProcessInfo.stageTitle}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-ink-light)' }}>
                      Flux de bout en bout : Vigne → Chai → Bouteille → Client
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-ink-muted)' }}>
                    {currentProcessInfo.purpose}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {currentProcessInfo.prevTab && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => setActiveTab(currentProcessInfo.prevTab!.id)}
                    >
                      ← Étape amont
                    </button>
                  )}
                  {currentProcessInfo.nextTab && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setActiveTab(currentProcessInfo.nextTab!.id)}
                    >
                      Continuer vers l’aval →
                    </button>
                  )}
                </div>
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
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (DESIGN.md: Ma journée / Saisir / Rechercher / Plus) */}
      <nav aria-label="Navigation mobile terrain" className="mobile-bottom-nav">
        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span>☀️</span>
          <span>Ma journée</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${activeTab === 'vineyard' || activeTab === 'cellar' ? 'active' : ''}`}
          onClick={() => setActiveTab(role === 'vineyard_manager' ? 'vineyard' : 'cellar')}
        >
          <span>🍇</span>
          <span>Saisir</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setShowGlobalSearch(true)}
        >
          <span>🔍</span>
          <span>Rechercher</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setShowAiCopilot(true)}
        >
          <span>✨</span>
          <span>Copilote</span>
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
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>
              Réinitialiser la démo locale ?
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--color-ink-muted)', marginBottom: '18px' }}>
              Cette action réinitialise uniquement la base IndexedDB <code>domaine-erp-demo</code> à son état initial (seed v1). Vos autres données de navigation ne sont pas touchées.
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
