import React from 'react';
import { useStore } from '../../app/store-context';
import { lotVolumeMl, batchPosition, ROLE_LABELS } from '../../domain/selectors';
import type { RoleId } from '../../domain/types';

export const OverviewView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { state, role } = useStore();
  if (!state) return null;

  const totalWineInCellarL =
    Object.values(state.lots)
      .filter((l) => l.stage !== 'bottled' && l.stage !== 'empty')
      .reduce((acc, l) => acc + lotVolumeMl(state, l.id), 0) / 1000;

  const batches = Object.values(state.batches);
  const totalPhysicalBottles = batches.reduce((acc, b) => acc + b.physical, 0);
  const totalReservedBottles = batches.reduce((acc, b) => acc + batchPosition(state, b).reserved, 0);
  const totalAvailableBottles = batches.reduce((acc, b) => acc + batchPosition(state, b).available, 0);

  const pendingOrders = Object.values(state.orders).filter(
    (o) => o.status === 'confirmed' || o.status === 'partially_shipped'
  );
  const heldLots = Object.values(state.lots).filter((l) => l.quality === 'held');

  // Détection temps réel de l'avancement du parcours de bout en bout
  const hasAssembled2025 = Object.values(state.lots).some((l) => l.createdBy === 'blend');
  const hasBottled2025 = Object.values(state.batches).some((b) => b.source === 'bottling');
  const hasShippedOrder = Object.keys(state.shipments).length > 0;

  // Horizons multi-millésimes avec navigation vers la source
  const vintages = [
    {
      year: 2023,
      label: 'Millésime 2023',
      badge: 'Stock commercial',
      badgeClass: 'badge-green',
      stage: 'Bouteilles en stock commercial',
      detail: '36 bouteilles anciennes prêtes à la vente (Cuvée Les Pierres Blanches)',
      targetTab: 'bottling',
      cta: 'Voir le lot habillé →',
    },
    {
      year: 2024,
      label: 'Millésime 2024',
      badge: 'Élevage sous bois',
      badgeClass: 'badge-amber',
      stage: 'Élevage en fûts (blanc)',
      detail: '200 L en barriques de chêne F-01 & F-02 (ouillage & part des anges suivis)',
      targetTab: 'aging',
      cta: 'Ouvrir le parc à fûts →',
    },
    {
      year: 2025,
      label: 'Millésime 2025',
      badge: hasBottled2025 ? 'Mis en bouteille' : hasAssembled2025 ? 'Assemblé' : 'Prêt à assembler',
      badgeClass: 'badge-grape',
      stage: 'Prêt à assembler (rouge)',
      detail: hasAssembled2025
        ? 'Lot assemblé LOT-2025-R-ASM créé avec filiation complète'
        : '2 lots rouges élevés prêts à assembler (600 L en C-01 + 400 L en C-02)',
      targetTab: hasAssembled2025 ? 'bottling' : 'aging',
      cta: hasAssembled2025 ? 'Aller à la mise →' : 'Assembler le 2025 →',
    },
    {
      year: 2026,
      label: 'Millésime 2026',
      badge: 'Récolte & Ferment.',
      badgeClass: 'badge-amber',
      stage: 'En cours d’élaboration (blanc & rouge)',
      detail: 'Fermentations actives (150 L Blanc C-05 + 180 L Rouge C-06) & fin de vendange',
      targetTab: 'cellar',
      cta: 'Suivre les cuves →',
    },
    {
      year: 2027,
      label: 'Horizon 2027',
      badge: 'Investissement',
      badgeClass: 'badge-muted',
      stage: 'Projet de renouvellement parcellaire',
      detail: 'Scénario prévisionnel d’arrachage / replantation (La Vigne du Moulin, 1,20 ha)',
      targetTab: 'finance',
      cta: 'Simuler l’impact 2027 →',
    },
  ];

  const roleActionHint: Record<RoleId, { title: string; desc: string; tab: string; btn: string }> = {
    direction: {
      title: 'Arbitrage & Pilotage Global du Domaine',
      desc: 'Validez l’assemblage du Rouge 2025, supervisez la mise de 660 bouteilles et consultez l’impact trésorerie 2027.',
      tab: 'aging',
      btn: 'Piloter l’assemblage 2025 →',
    },
    cellar_master: {
      title: 'Priorité Maître de Chai : Relevé C-06 & Assemblage 2025',
      desc: 'Le lot Rouge 2026 (C-06) attend une prise de densité. Les lots 2025 (C-01 & C-02) sont prêts pour l’assemblage.',
      tab: 'cellar',
      btn: 'Ouvrir le Chai & les Cuves →',
    },
    vineyard_manager: {
      title: 'Priorité Chef de Culture : Vendange tardive Le Clos du Puits',
      desc: 'La mission mission-h-c compte 12 caisses au terrain. Poursuivez le comptage ou enregistrez la réception au chai.',
      tab: 'vineyard',
      btn: 'Ouvrir Vignoble & Vendanges →',
    },
    sales: {
      title: 'Priorité Commerciale : Allocation & Expéditions',
      desc: `${totalAvailableBottles} bouteilles sont disponibles à la vente immédiate sans sur-engagement.`,
      tab: 'sales',
      btn: 'Gérer Commandes & Stocks →',
    },
    accounting: {
      title: 'Priorité Gestion : Réception Matières Sèches & Facturation',
      desc: 'Contrôlez les seuils d’étiquettes et cartons avant mise, et suivez les règlements clients.',
      tab: 'finance',
      btn: 'Ouvrir Finance & Coûts →',
    },
  };

  const currentRoleHint = roleActionHint[role] ?? roleActionHint.direction;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Editorial Hero Header */}
      <div className="page-header" style={{ marginBottom: '4px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="badge badge-green">Samedi 24 octobre 2026</span>
            <span className="badge badge-grape">Campagne 2026–2027</span>
            <span style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
               Côteaux Calcaires · Vins Tranquilles Blancs & Rouges
            </span>
          </div>
          <h1 className="page-title">
            Vue d’ensemble — {state.organization.name}
          </h1>
          <p className="page-subtitle">
            Poste de commandement opérationnel : de la parcelle jusqu’à l’expédition client, avec filiation intégrale.
          </p>
        </div>

        {/* Active Role Priority Card */}
        <div
          style={{
            background: 'var(--color-forest-soft)',
            border: '1px solid var(--color-forest-border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            maxWidth: '430px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-forest)' }}>
            Focus métier actif · {ROLE_LABELS[role]}
          </div>
          <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)', marginTop: '2px' }}>
            {currentRoleHint.title}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px', marginBottom: '8px' }}>
            {currentRoleHint.desc}
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => onNavigate(currentRoleHint.tab)}>
            {currentRoleHint.btn}
          </button>
        </div>
      </div>

      {/* KPI Architectural Cards (Every card clicks through to its source) */}
      <div className="grid-4">
        <div
          className="kpi-card card-interactive"
          onClick={() => onNavigate('cellar')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div className="kpi-label">Vin en cuverie & fûts</div>
            <div className="kpi-value tabular">
              {totalWineInCellarL.toLocaleString('fr-FR')}{' '}
              <span style={{ fontSize: '16px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>L</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--color-forest)', fontWeight: 600 }}>
            <span>{Object.keys(state.lots).length} lots tracés au chai</span>
            <span>Explorer →</span>
          </div>
        </div>

        <div
          className="kpi-card kpi-grape card-interactive"
          onClick={() => onNavigate('bottling')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div className="kpi-label">Bouteilles physiques</div>
            <div className="kpi-value tabular">{totalPhysicalBottles.toLocaleString('fr-FR')}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            <span>
              Dont <strong>{totalReservedBottles}</strong> réservées ·{' '}
              <strong style={{ color: 'var(--color-forest)' }}>{totalAvailableBottles}</strong> dispo
            </span>
            <span style={{ color: 'var(--color-grape)', fontWeight: 600 }}>Stocks →</span>
          </div>
        </div>

        <div
          className="kpi-card card-interactive"
          onClick={() => onNavigate('sales')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div className="kpi-label">Commandes à livrer</div>
            <div className="kpi-value tabular">{pendingOrders.length}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            <span>Allocation & préparation BL</span>
            <span style={{ color: 'var(--color-forest)', fontWeight: 600 }}>Ventes →</span>
          </div>
        </div>

        <div
          className="kpi-card kpi-amber card-interactive"
          onClick={() => onNavigate('cellar')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div className="kpi-label">Lots en retenue qualité</div>
            <div className="kpi-value tabular" style={{ color: 'var(--color-amber)' }}>
              {heldLots.length}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: 'var(--color-amber)', fontWeight: 600 }}>
            <span>Bloqués pour mise ou vente</span>
            <span>Contrôler →</span>
          </div>
        </div>
      </div>

      {/* END-TO-END INTERACTIVE WORKFLOW GUIDE (Clear step-by-step onboarding) */}
      <div className="card" style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #FAF9F5 100%)' }}>
        <div className="card-header">
          <div>
            <span className="badge badge-grape" style={{ marginBottom: '4px' }}>
              Processus Guidé End-to-End
            </span>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-ink)' }}>
              Parcours Opérationnel de Bout en Bout (De la Vigne au Client)
            </h2>
          </div>
          <span style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
            Cliquez sur une étape pour agir directement dans le module concerné
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: '12px' }}>
          {/* Step 1 */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-green">Étape 1 · Vignoble</span>
                <span style={{ fontSize: '11px', color: 'var(--color-amber)', fontWeight: 600 }}>● En cours</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Vendanger & Réceptionner</div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                Compter les caisses sur <em>Le Clos du Puits</em> (12 caisses) et réceptionner la pesée au chai sans conversion magique kg→L.
              </p>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('vineyard')}>
              1. Ouvrir Vignoble & Récolte →
            </button>
          </div>

          {/* Step 2 */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-amber">Étape 2 · Vinification</span>
                <span style={{ fontSize: '11px', color: 'var(--color-amber)', fontWeight: 600 }}>● Vigilance C-06</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>Suivre les Fermentations 2026</div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                Inspecter le plan de cuverie (C-01 à C-07), la courbe de densité et saisir le relevé manquant sur <code>LOT-2026-R1</code>.
              </p>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('cellar')}>
              2. Ouvrir le Chai →
            </button>
          </div>

          {/* Step 3 */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: hasAssembled2025 ? '1px solid var(--color-forest-border)' : '2px solid var(--color-forest)',
              background: hasAssembled2025 ? 'var(--color-forest-soft)' : 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-grape">Étape 3 · Assemblage</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-forest)' }}>
                  {hasAssembled2025 ? '✓ Réalisé (500 L)' : '★ Prêt à agir'}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>1. Assembler les lots 2025</div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                Prévisualiser l’essai (sans consommation), puis assembler 300 L (<code>LOT-2025-R1</code>) + 200 L (<code>LOT-2025-R2</code>) vers C-03.
              </p>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => onNavigate('aging')}>
              Ouvrir Élevage →
            </button>
          </div>

          {/* Step 4 */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: hasBottled2025 ? '1px solid var(--color-forest-border)' : '1px solid var(--color-border)',
              background: hasBottled2025 ? 'var(--color-forest-soft)' : 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-green">Étape 4 · Conditionnement</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-forest)' }}>
                  {hasBottled2025 ? '✓ 660 bout. créées' : 'Étape suivante'}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>2. Conditionner le vin assemblé</div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                Mettre en bouteilles 500 L → 660 bouteilles (495 L) + 5 L perte, avec déduction atomique des 4 matières sèches.
              </p>
            </div>
            <button className="btn btn-sm btn-accent" onClick={() => onNavigate('bottling')}>
              Ouvrir Mise →
            </button>
          </div>

          {/* Step 5 */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              border: hasShippedOrder ? '1px solid var(--color-forest-border)' : '1px solid var(--color-border)',
              background: hasShippedOrder ? 'var(--color-forest-soft)' : 'var(--color-surface)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="badge badge-grape">Étape 5 · Commerce</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-forest)' }}>
                  {hasShippedOrder ? '✓ Expédié (72 bout.)' : 'Aval commercial'}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>3. Vendre, réserver & livrer</div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                Créer commande de 120 bouteilles (réservation), livrer 72 bouteilles (déstockage physique) et émettre facture démo.
              </p>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('sales')}>
              Ouvrir Ventes →
            </button>
          </div>
        </div>
      </div>

      {/* Multi-vintages Continuity Matrix */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700 }}>
              Continuité multi-millésimes active (2023 → 2027)
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
              Un domaine viticole ne s’arrête jamais à une seule année : 5 millésimes coexistent simultanément au chai et en cave.
            </p>
          </div>
          <span className="badge badge-green">5 horizons simultanés</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(225px, 1fr))', gap: '14px' }}>
          {vintages.map((v) => (
            <div
              key={v.year}
              className="card-interactive"
              onClick={() => onNavigate(v.targetTab)}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="serif-display" style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-forest)' }}>
                    {v.label}
                  </span>
                  <span className={`badge ${v.badgeClass}`}>{v.badge}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '4px' }}>
                  {v.stage}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>{v.detail}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-forest)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px' }}>
                {v.cta}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Vigilance & Field Alerts */}
      <div className="card">
        <div className="card-header">
          <h2 className="serif-display" style={{ fontSize: '19px', fontWeight: 700 }}>
            Points d’attention & vigilance qualité du jour (24 oct. 2026)
          </h2>
          <span className="badge badge-amber">3 alertes opérationnelles</span>
        </div>

        <div className="grid-3">
          <div style={{ padding: '14px', background: 'var(--color-amber-soft)', border: '1px solid var(--color-amber-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-amber)' }}>
                ⚠ Relevé manquant : Rouge 2026 (C-06)
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-ink)', marginTop: '4px' }}>
                Aucune mesure de densité depuis le 17 octobre 2026 (7 jours). Conformément aux règles d’intégrité, aucune valeur n’est inventée ou interpolée.
              </div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginTop: '10px', alignSelf: 'flex-start' }}
              onClick={() => onNavigate('cellar')}
            >
              Saisir le relevé sur C-06 →
            </button>
          </div>

          <div style={{ padding: '14px', background: 'var(--color-forest-soft)', border: '1px solid var(--color-forest-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-forest)' }}>
                🍇 Mission vendange tardive en cours
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-ink)', marginTop: '4px' }}>
                Parcelle <em>Le Clos du Puits</em> (<code>mission-h-c</code>) : 12 caisses comptées (~216 kg estimés). Récolte partielle ouverte au terrain.
              </div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginTop: '10px', alignSelf: 'flex-start' }}
              onClick={() => onNavigate('vineyard')}
            >
              Ouvrir le comptage terrain →
            </button>
          </div>

          <div style={{ padding: '14px', background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)' }}>
                🔧 Contenant en maintenance (Cuve C-07)
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                La cuve inox C-07 (400 L) est verrouillée en statut <code>maintenance</code>. Toute tentative de transfert ou d’assemblage vers C-07 est bloquée.
              </div>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ marginTop: '10px', alignSelf: 'flex-start' }}
              onClick={() => onNavigate('cellar')}
            >
              Inspecter le plan de cuverie →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
