import React from 'react';
import { useStore } from '../../app/store-context';
import { lotVolumeMl, batchPosition } from '../../domain/selectors';

export const OverviewView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { state } = useStore();
  if (!state) return null;

  const totalWineInCellarL = Object.values(state.lots)
    .filter((l) => l.stage !== 'bottled' && l.stage !== 'empty')
    .reduce((acc, l) => acc + lotVolumeMl(state, l.id), 0) / 1000;

  const batches = Object.values(state.batches);
  const totalPhysicalBottles = batches.reduce((acc, b) => acc + b.physical, 0);
  const totalReservedBottles = batches.reduce((acc, b) => acc + batchPosition(state, b).reserved, 0);
  const totalAvailableBottles = batches.reduce((acc, b) => acc + batchPosition(state, b).available, 0);

  // Vintages represented
  const vintages = [
    { year: 2023, label: 'Millésime 2023', stage: 'Bouteilles en stock commercial', detail: '36 bouteilles anciennes' },
    { year: 2024, label: 'Millésime 2024', stage: 'Élevage en fûts (blanc)', detail: '200 L en barriques F-01 & F-02' },
    { year: 2025, label: 'Millésime 2025', stage: 'Prêt à assembler (rouge)', detail: '2 lots prêts (600 L + 400 L)' },
    { year: 2026, label: 'Millésime 2026', stage: 'En cours d’élaboration (blanc & rouge)', detail: 'Fermentations en cours (150 L + 180 L)' },
    { year: 2027, label: 'Horizon 2027', stage: 'Projet de renouvellement parcellaire', detail: 'Scénario prévisionnel (Vigne du Moulin)' },
  ];

  const pendingOrders = Object.values(state.orders).filter((o) => o.status === 'confirmed' || o.status === 'partially_shipped');
  const heldLots = Object.values(state.lots).filter((l) => l.quality === 'held');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)', marginBottom: '4px' }}>
          Vue d’ensemble — {state.organization.name}
        </h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
          Date de démonstration : <strong>24 octobre 2026</strong> · Coexistence active des millésimes 2023 à 2027.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid-4">
        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Vin en cuverie & chai
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-forest)', marginTop: '4px' }} className="tabular">
            {totalWineInCellarL.toLocaleString('fr-FR')} <span style={{ fontSize: '15px', fontWeight: 500 }}>L</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink-light)', marginTop: '4px' }}>
            {Object.keys(state.lots).length} lots suivis
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Bouteilles physiques
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '4px' }} className="tabular">
            {totalPhysicalBottles.toLocaleString('fr-FR')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink-light)', marginTop: '4px' }}>
            Dont {totalReservedBottles} réservées · {totalAvailableBottles} disponibles
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Commandes à livrer
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-grape)', marginTop: '4px' }} className="tabular">
            {pendingOrders.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink-light)', marginTop: '4px' }}>
            Commandes en cours ou partielles
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Lots en élaboration / bloqués
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-amber)', marginTop: '4px' }} className="tabular">
            {heldLots.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-ink-light)', marginTop: '4px' }}>
            Statut qualité en retenue
          </div>
        </div>
      </div>

      {/* Multi-vintages Overview */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Continuité multi-millésimes active</h2>
          <span className="badge badge-green">5 horizons simultanés</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {vintages.map((v) => (
            <div
              key={v.year}
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                background: v.year === 2026 ? 'var(--color-forest-soft)' : v.year === 2025 ? 'var(--color-grape-soft)' : 'var(--color-surface-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--color-ink)' }}>{v.year}</span>
                <span className="badge badge-muted" style={{ fontSize: '11px' }}>{v.label}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginTop: '8px' }}>
                {v.stage}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                {v.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Actions / alerts and quick shortcuts */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Parcours recommandés pour la démo</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '10px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>1. Assembler les lots 2025</div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Prévisualiser l’essai (sans consommation), puis assembler 300L + 200L.</div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('aging')}>
                Ouvrir Élevage
              </button>
            </div>

            <div style={{ padding: '10px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>2. Conditionner le vin assemblé</div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Mettre en bouteilles 500L → 660 bouteilles (495L) + 5L perte.</div>
              </div>
              <button className="btn btn-sm btn-accent" onClick={() => onNavigate('bottling')}>
                Ouvrir Mise
              </button>
            </div>

            <div style={{ padding: '10px', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>3. Vendre, réserver & livrer</div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Créer commande de 120 bouteilles, livrer 72, émettre facture et paiement.</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('sales')}>
                Ouvrir Ventes
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Points d’attention & qualité du jour</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '10px', background: 'var(--color-amber-soft)', border: '1px solid #EED7B5', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-amber)' }}>
                Relevé manquant : Rouge 2026 (C-06)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink)', marginTop: '2px' }}>
                Aucune mesure de densité depuis le 17 octobre 2026. La valeur n’est pas interpolée artificiellement.
              </div>
            </div>

            <div style={{ padding: '10px', background: 'var(--color-forest-soft)', border: '1px solid #C2DCC8', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-forest)' }}>
                Mission vendange tardive en cours
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink)', marginTop: '2px' }}>
                Le Clos du Puits (mission-h-c) : 12 caisses comptées à ce jour. Récolte partielle non clôturée.
              </div>
            </div>

            <div style={{ padding: '10px', background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-ink)' }}>
                Équipement en maintenance
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                Cuve C-07 (400 L) en maintenance — refusera tout transfert ou assemblage.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
