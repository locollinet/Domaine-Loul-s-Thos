import React, { useState } from 'react';
import {
  Wine,
  Package,
  Truck,
  ShieldAlert,
  Grape,
  ArrowRight,
  Sparkles,
  Layers,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { lotVolumeMl, batchPosition, ROLE_LABELS } from '../../domain/selectors';
import type { RoleId } from '../../domain/types';

export const OverviewView: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { state, role } = useStore();
  // Progressive disclosure: avoid stacking both the 5-step guide AND the 3 alert cards simultaneously
  const [bottomPanel, setBottomPanel] = useState<'workflow' | 'alerts'>('workflow');

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
      badge: 'Grand Vin · Cave',
      badgeClass: 'badge-green',
      stage: 'Bouteilles en stock commercial',
      detail: '36 flacons en caveau (Cuvée Les Pierres Blanches)',
      targetTab: 'bottling',
      cta: 'Voir le lot habillé',
    },
    {
      year: 2024,
      label: 'Millésime 2024',
      badge: 'Élevage sur lies',
      badgeClass: 'badge-gold',
      stage: 'Élevage en fûts (blanc)',
      detail: '200 L en pièces bourguignonnes F-01 & F-02 (ouillage)',
      targetTab: 'aging',
      cta: 'Chai à barriques',
    },
    {
      year: 2025,
      label: 'Millésime 2025',
      badge: hasBottled2025 ? 'Mis en bouteille' : hasAssembled2025 ? 'Assemblé' : 'Prêt à assembler',
      badgeClass: 'badge-grape',
      stage: 'Cuvée Rouge Parcellaire',
      detail: hasAssembled2025
        ? 'Lot assemblé LOT-2025-R-ASM créé avec filiation'
        : '2 lots élevés prêts (600 L C-01 + 400 L C-02)',
      targetTab: hasAssembled2025 ? 'bottling' : 'aging',
      cta: hasAssembled2025 ? 'Aller au tirage' : 'Assembler le 2025',
    },
    {
      year: 2026,
      label: 'Millésime 2026',
      badge: 'Vendange & Cuvaison',
      badgeClass: 'badge-amber',
      stage: 'Fermentations actives (blanc & rouge)',
      detail: '150 L Blanc C-05 · 180 L Rouge C-06 & fin de récolte',
      targetTab: 'cellar',
      cta: 'Inspecter la cuverie',
    },
    {
      year: 2027,
      label: 'Horizon 2027',
      badge: 'Patrimoine foncier',
      badgeClass: 'badge-muted',
      stage: 'Renouvellement parcellaire',
      detail: 'Scénario d’arrachage / replantation (La Vigne du Moulin, 1,20 ha)',
      targetTab: 'finance',
      cta: 'Simuler l’impact 2027',
    },
  ];

  const roleActionHint: Record<
    RoleId,
    { title: string; desc: string; tab: string; btn: string; focusMetrics: string }
  > = {
    direction: {
      title: 'Arbitrage & Pilotage Global de la Maison',
      desc: 'Validez la coupe d’assemblage du Rouge 2025, supervisez le tirage de 660 flacons et arbitrez le renouvellement parcellaire 2027.',
      tab: 'aging',
      btn: 'Piloter l’assemblage 2025',
      focusMetrics: '5 millésimes simultanés · Filiation 100% intègre',
    },
    cellar_master: {
      title: 'Focus Maître de Chai : Relevé C-06 & Coupe 2025',
      desc: 'Le lot Rouge 2026 (C-06) attend sa prise de densité quotidienne. Les lots 2025 (C-01 & C-02) sont prêts à l’assemblage.',
      tab: 'cellar',
      btn: 'Ouvrir Cuverie & Vinification',
      focusMetrics: `${totalWineInCellarL.toLocaleString('fr-FR')} L en chai · ${heldLots.length} retenue(s)`,
    },
    vineyard_manager: {
      title: 'Focus Chef de Culture : Livret & Vendange Le Clos du Puits',
      desc: 'Parcelle Pastille n°3 (Page 12 du livret) : 12 caisses comptées au rang (~216 kg). Poursuivez le comptage ou validez la pesée au quai.',
      tab: 'vineyard',
      btn: 'Ouvrir Atlas & Livret Vendanges',
      focusMetrics: '4 Climats cadastrés · Mode Soleil disponible',
    },
    sales: {
      title: 'Focus Commercial : Allocations & Expéditions Caveau',
      desc: `${totalAvailableBottles} flacons sont immédiatement allouables sans risque de sur-engagement par rapport au réservé.`,
      tab: 'sales',
      btn: 'Gérer Allocations & Commandes',
      focusMetrics: `${totalAvailableBottles} bout. dispo · ${pendingOrders.length} commande(s) à expédier`,
    },
    accounting: {
      title: 'Focus Gestion : Prix de Revient & Matières Sèches',
      desc: 'Contrôlez les stocks de bouchons liège et étiquettes avant tirage, et suivez les règlements clients.',
      tab: 'finance',
      btn: 'Ouvrir Coûts & Multi-Millésimes',
      focusMetrics: '4 références matières sèches · Trésorerie 2027',
    },
  };

  const currentRoleHint = roleActionHint[role] ?? roleActionHint.direction;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Editorial Hero Header + Persona Focus Card */}
      <div className="page-header" style={{ marginBottom: '0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span className="badge badge-gold">Samedi 24 octobre 2026</span>
            <span className="badge badge-grape">Campagne 2026–2027</span>
            <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)', letterSpacing: '0.02em' }}>
              Grands Vins de Terroir · Côteaux Calcaires
            </span>
          </div>
          <h1 className="page-title">
            Vue d’ensemble — {state.organization.name}
          </h1>
          <p className="page-subtitle">
            Direction opérationnelle du domaine : du climat cadastré jusqu’à l’allocation client, sans surcharge visuelle.
          </p>
        </div>

        {/* Active Persona Priority Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1E221E 0%, #272E28 100%)',
            color: '#FAF8F5',
            border: '1px solid rgba(196, 164, 122, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            maxWidth: '440px',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#E2C799' }}>
              <Sparkles size={12} /> Parcours Persona · {ROLE_LABELS[role]}
            </span>
            <span style={{ fontSize: '10.5px', color: 'rgba(250,248,245,0.65)' }} className="tabular">
              {currentRoleHint.focusMetrics}
            </span>
          </div>
          <div className="serif-display" style={{ fontWeight: 600, fontSize: '16px', color: '#FFFFFF', marginTop: '2px' }}>
            {currentRoleHint.title}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(250,248,245,0.78)', marginTop: '3px', marginBottom: '10px', lineHeight: 1.45 }}>
            {currentRoleHint.desc}
          </div>
          <button
            className="btn btn-sm"
            style={{ background: '#C4A47A', color: '#1E221E', borderColor: '#C4A47A', fontWeight: 700 }}
            onClick={() => onNavigate(currentRoleHint.tab)}
          >
            {currentRoleHint.btn} <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 4 Essential Architectural KPI Cards with Crisp Icons */}
      <div className="grid-4">
        <div
          className="kpi-card card-interactive"
          onClick={() => onNavigate('cellar')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Vin en cuverie & fûts</span>
              <Wine size={16} color="var(--color-forest)" />
            </div>
            <div className="kpi-value tabular">
              {totalWineInCellarL.toLocaleString('fr-FR')}{' '}
              <span style={{ fontSize: '16px', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>L</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--color-forest)', fontWeight: 600 }}>
            <span>{Object.keys(state.lots).length} lots au chai</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>Cuverie <ArrowRight size={12} /></span>
          </div>
        </div>

        <div
          className="kpi-card kpi-grape card-interactive"
          onClick={() => onNavigate('bottling')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Flacons physiques</span>
              <Package size={16} color="var(--color-grape)" />
            </div>
            <div className="kpi-value tabular">{totalPhysicalBottles.toLocaleString('fr-FR')}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            <span>
              <strong>{totalReservedBottles}</strong> rés. ·{' '}
              <strong style={{ color: 'var(--color-forest)' }}>{totalAvailableBottles}</strong> dispo
            </span>
            <span style={{ color: 'var(--color-grape)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              Cave <ArrowRight size={12} />
            </span>
          </div>
        </div>

        <div
          className="kpi-card kpi-gold card-interactive"
          onClick={() => onNavigate('sales')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Commandes à expédier</span>
              <Truck size={16} color="#9E7E53" />
            </div>
            <div className="kpi-value tabular">{pendingOrders.length}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--color-ink-muted)' }}>
            <span>Allocations & BL</span>
            <span style={{ color: 'var(--color-forest)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              Ventes <ArrowRight size={12} />
            </span>
          </div>
        </div>

        <div
          className="kpi-card kpi-amber card-interactive"
          onClick={() => onNavigate('cellar')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-label">Retenues qualité</span>
              <ShieldAlert size={16} color="var(--color-amber)" />
            </div>
            <div className="kpi-value tabular" style={{ color: 'var(--color-amber)' }}>
              {heldLots.length}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--color-amber)', fontWeight: 600 }}>
            <span>Lots sous contrôle</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>Vérifier <ArrowRight size={12} /></span>
          </div>
        </div>
      </div>

      {/* Multi-vintages Continuity Matrix (Always visible, refined Haute Bourgogne cards) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="serif-display" style={{ fontSize: '21px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--color-forest)" />
              Continuité multi-millésimes active (2023 → 2027)
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
              Cinq millésimes coexistent simultanément entre le vignoble, les pièces de chêne et le caveau d’expédition.
            </p>
          </div>
          <span className="badge badge-gold">5 horizons actifs</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '12px' }}>
          {vintages.map((v) => (
            <div
              key={v.year}
              className="card-interactive"
              onClick={() => onNavigate(v.targetTab)}
              style={{
                padding: '15px',
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
                  <span className="serif-display" style={{ fontWeight: 700, fontSize: '19px', color: 'var(--color-forest)' }}>
                    {v.label}
                  </span>
                  <span className={`badge ${v.badgeClass}`}>{v.badge}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink)', marginBottom: '4px' }}>
                  {v.stage}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', lineHeight: 1.4 }}>{v.detail}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-forest)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{v.cta}</span>
                <ArrowRight size={13} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progressive Disclosure Bottom Panel: Switch between End-to-End Flow and Daily Vigilance Alerts */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 600 }}>
              {bottomPanel === 'workflow'
                ? 'Parcours Opérationnel de Bout en Bout (De la Vigne au Client)'
                : 'Points d’attention & vigilance qualité du jour (24 oct. 2026)'}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              {bottomPanel === 'workflow'
                ? 'Cliquez sur une étape de la chaîne de valeur pour agir directement dans le module concerné'
                : 'Contrôles d’intégrité sans interpolation ni décision œnologique automatique'}
            </p>
          </div>

          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${bottomPanel === 'workflow' ? 'active' : ''}`}
              onClick={() => setBottomPanel('workflow')}
            >
              Chaîne de valeur (5 étapes)
            </button>
            <button
              type="button"
              className={`segmented-btn ${bottomPanel === 'alerts' ? 'active' : ''}`}
              onClick={() => setBottomPanel('alerts')}
            >
              Vigilance du jour (3)
            </button>
          </div>
        </div>

        {bottomPanel === 'workflow' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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
                  <span className="badge badge-green">1 · Vignoble</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-amber)', fontWeight: 600 }}>● En cours</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Livret & Réception Vendange</div>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Localiser <em>Le Clos du Puits</em> (Pastille n°3) et réceptionner la pesée sans conversion magique kg→L.
                </p>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('vineyard')}>
                1. Ouvrir Vignoble <ArrowRight size={12} />
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
                  <span className="badge badge-amber">2 · Cuverie</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-amber)', fontWeight: 600 }}>● Relevé C-06</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Fermentations 2026</div>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Inspecter les cuves C-01 à C-07, la cinétique de densité et saisir le relevé sur <code>LOT-2026-R1</code>.
                </p>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('cellar')}>
                2. Ouvrir le Chai <ArrowRight size={12} />
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
                  <span className="badge badge-grape">3 · Assemblage</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-forest)' }}>
                    {hasAssembled2025 ? '✓ Réalisé (500 L)' : '★ Prêt'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Assembler le Rouge 2025</div>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Assembler 300 L (<code>LOT-2025-R1</code>) + 200 L (<code>LOT-2025-R2</code>) vers la cuve d’assemblage C-03.
                </p>
              </div>
              <button className="btn btn-sm btn-primary" onClick={() => onNavigate('aging')}>
                Ouvrir Élevage <ArrowRight size={12} />
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
                  <span className="badge badge-green">4 · Tirage</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-forest)' }}>
                    {hasBottled2025 ? '✓ 660 bout.' : 'Suivant'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Tirer & Habiller</div>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Mettre en bouteilles 500 L → 660 flacons (495 L) + 5 L freinte et déduire les 4 matières sèches.
                </p>
              </div>
              <button className="btn btn-sm btn-accent" onClick={() => onNavigate('bottling')}>
                Ouvrir Mise <ArrowRight size={12} />
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
                  <span className="badge badge-gold">5 · Allocations</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-forest)' }}>
                    {hasShippedOrder ? '✓ 72 expédiées' : 'Commerce'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>Allouer & Expédier</div>
                <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Réserver 120 flacons, expédier 72 flacons avec bon de livraison et émettre la facture proforma.
                </p>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('sales')}>
                Ouvrir Ventes <ArrowRight size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="grid-3">
            <div style={{ padding: '14px', background: 'var(--color-amber-soft)', border: '1px solid var(--color-amber-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> Relevé manquant : Rouge 2026 (C-06)
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-ink)', marginTop: '6px' }}>
                  Aucune mesure de densité depuis le 17 oct. 2026 (7 jours). Aucune valeur n’est inventée ou interpolée.
                </div>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                style={{ marginTop: '12px', alignSelf: 'flex-start' }}
                onClick={() => onNavigate('cellar')}
              >
                Saisir le relevé sur C-06 <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ padding: '14px', background: 'var(--color-forest-soft)', border: '1px solid var(--color-forest-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-forest)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Grape size={15} /> Vendange tardive Le Clos du Puits
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-ink)', marginTop: '6px' }}>
                  Parcelle <em>Le Clos du Puits</em> (<code>mission-h-c</code>, Pastille n°3) : 12 caisses comptées (~216 kg).
                </div>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                style={{ marginTop: '12px', alignSelf: 'flex-start' }}
                onClick={() => onNavigate('vineyard')}
              >
                Ouvrir le comptage terrain <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ padding: '14px', background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Wrench size={15} /> Contenant en maintenance (Cuve C-07)
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '6px' }}>
                  La cuve inox C-07 (400 L) est verrouillée en statut <code>maintenance</code>. Tout transfert vers C-07 est bloqué.
                </div>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                style={{ marginTop: '12px', alignSelf: 'flex-start' }}
                onClick={() => onNavigate('cellar')}
              >
                Inspecter le plan de cuverie <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
