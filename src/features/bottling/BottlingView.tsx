import React, { useState } from 'react';
import {
  Package,
  QrCode,
  Flame,
  Plus,
  CheckCircle2,
  BookmarkCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { bottlingRequirements } from '../../domain/commands/cellar';
import { batchPosition, lotOccupancies, lotVolumeMl } from '../../domain/selectors';
import { useModuleConfig } from '../modules/ModuleConfigContext';
import { ELabelQrPanel } from './ELabelQrPanel';
import { CellarBottleMapPanel } from './CellarBottleMapPanel';
import type { AssistantPrefillPayload } from '../ai/types';
import { useAssistantPrefill } from '../ai/useAssistantPrefill';
import { SubNav, scrollSubNavIntoView, type SubNavTab } from '../../ui/SubNav';
import { Modal } from '../../ui/Modal';

type BottlingTabId = 'stocks' | 'cellar_map' | 'elabel';

export const BottlingView: React.FC<{
  prefill?: Extract<AssistantPrefillPayload, { tab: 'bottling' }>;
}> = ({ prefill }) => {
  const { state, dispatch } = useStore();
  const { isAddonEnabled } = useModuleConfig();
  const [subTab, setSubTab] = useState<BottlingTabId>('stocks');
  const [focusedBatchCode, setFocusedBatchCode] = useState<string | undefined>(undefined);
  const [showBottlingModal, setShowBottlingModal] = useState(false);

  // Form states
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('sku-red-2025-750');
  const [bottleCount, setBottleCount] = useState('660');
  const [lossLitres, setLossLitres] = useState('5');
  const [serviceCostEur, setServiceCostEur] = useState('330');

  useAssistantPrefill(prefill, (p) => {
    if (p.subTab) setSubTab(p.subTab);
    if (p.lotId) setSelectedLotId(p.lotId);
    if (p.skuId) setSelectedSkuId(p.skuId);
    if (p.batchCode) setFocusedBatchCode(p.batchCode);
    if (typeof p.bottles === 'number') setBottleCount(String(p.bottles));
    if (p.openModal === 'bottling') setShowBottlingModal(true);
  });

  if (!state) return null;

  const batches = Object.values(state.batches);
  const skus = Object.values(state.skus);
  const eligibleLots = Object.values(state.lots).filter(
    (l) => lotVolumeMl(state, l.id) > 0 && l.quality === 'released'
  );

  // Active lot
  const activeLotId = selectedLotId || (eligibleLots[0]?.id ?? '');
  const activeLot = state.lots[activeLotId];
  const lotOccs = activeLot ? lotOccupancies(state, activeLot.id) : [];
  const activeContainerId = lotOccs[0]?.containerId ?? '';

  const sku = state.skus[selectedSkuId] || skus[0];
  const bottles = parseInt(bottleCount || '0', 10);
  const lossMl = Math.round(parseFloat(lossLitres || '0') * 1000);
  const inputVolumeMl = bottles > 0 && sku ? bottles * sku.sizeMl + lossMl : 0;

  // Check dry goods BOM
  let bomReqs: { dryGoodId: string; required: number; onHand: number }[] = [];
  if (sku && bottles > 0) {
    bomReqs = bottlingRequirements(state, sku.id, bottles);
  }
  const hasInsufficientDryGoods = bomReqs.some((r) => r.required > r.onHand);

  const handleExecuteBottling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLot || !activeContainerId || !sku) return;
    const serviceCents = Math.round(parseFloat(serviceCostEur || '0') * 100);

    try {
      await dispatch({
        type: 'bottling.execute',
        payload: {
          lotId: activeLot.id,
          containerId: activeContainerId,
          skuId: sku.id,
          inputVolumeMl,
          bottles,
          lossMl,
          serviceCostCents: serviceCents,
        },
      });
      setShowBottlingModal(false);
    } catch {
      // Handled
    }
  };

  const showElabelAddon = isAddonEnabled('elabel_qr');
  const effectiveSubTab: BottlingTabId = !showElabelAddon && subTab === 'elabel' ? 'stocks' : subTab;

  const switchBottlingTab = (next: BottlingTabId, batchCode?: string) => {
    if (batchCode) setFocusedBatchCode(batchCode);
    setSubTab(next);
    scrollSubNavIntoView('bottling-subnav');
  };

  // Synthèse globale des bouteilles
  const totals = batches.reduce(
    (acc, b) => {
      const pos = batchPosition(state, b);
      acc.physical += pos.physical;
      acc.available += pos.available;
      acc.reserved += pos.reserved;
      acc.isolated += pos.blocked + pos.quarantine;
      return acc;
    },
    { physical: 0, available: 0, reserved: 0, isolated: 0 }
  );

  const availPct = totals.physical > 0 ? Math.round((totals.available / totals.physical) * 100) : 0;
  const resPct = totals.physical > 0 ? Math.round((totals.reserved / totals.physical) * 100) : 0;

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE CONDITIONNEMENT & CAVE À BOUTEILLES */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>Atelier de tirage, habillage & cave de garde · {batches.length} lots de mise</span>
          </div>
          <h1 className="ds-hero-title">Conditionnement, Rangement Cave & Priorités de Vente</h1>
          <p className="ds-hero-sub">
            Transformez vos vins prêts en bouteilles habillées, localisez chaque lot dans vos
            palox ou casiers d’œnothèque, et identifiez d’un coup d’œil les cuvées à vendre en priorité.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Prochaine étape de cave</div>
            <div className="ds-next-title">
              {eligibleLots.length > 0
                ? `${eligibleLots.length} lot(s) de vin prêts à être mis en bouteilles`
                : 'Vérifier le rangement et les priorités de sortie'}
            </div>
            <p className="ds-next-desc">
              Le calculateur vérifie automatiquement que vous avez assez de bouteilles vides,
              bouchons, étiquettes et cartons avant de soutirer la cuve.
            </p>
          </div>
          <button
            type="button"
            className="ds-cta"
            onClick={() => {
              if (eligibleLots.length > 0) {
                setSelectedLotId(eligibleLots[0]!.id);
              }
              setShowBottlingModal(true);
            }}
          >
            <span>+ Nouvelle mise en bouteilles</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* 2. NAVIGATION D'ESPACES MÉTIER (STOCKS · RANGEMENT CAVE · E-LABELING) */}
      <SubNav
        id="bottling-subnav"
        ariaLabel="Espaces de travail Conditionnement et Cave à bouteilles"
        tabs={[
          {
            id: 'stocks',
            label: '📦 Mises & Stocks bouteilles',
            icon: Package,
            count: batches.length,
            hint: 'Consulter ce qui est libre à la vente, réservé ou en quarantaine',
          },
          {
            id: 'cellar_map',
            label: '🔥 Plan de cave & Priorités vente',
            icon: Flame,
            hint: 'Palox, palettes, casiers œnothèque et dates optimales d’écoulement',
          },
          ...(showElabelAddon
            ? [
                {
                  id: 'elabel' as const,
                  label: '📱 QR Code E-Labeling UE',
                  icon: QrCode,
                  hint: 'Valeurs nutritionnelles kcal/kJ, ingrédients et tri sélectif',
                },
              ]
            : []),
        ] satisfies SubNavTab<BottlingTabId>[]}
        active={effectiveSubTab}
        onChange={(next) => setSubTab(next)}
        trailing={
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              if (eligibleLots.length > 0 && !selectedLotId) {
                setSelectedLotId(eligibleLots[0]!.id);
              }
              setShowBottlingModal(true);
            }}
          >
            <Plus size={14} />
            <span>Déclarer un tirage / habillage</span>
          </button>
        }
      />

      {effectiveSubTab === 'cellar_map' ? (
        <CellarBottleMapPanel
          state={state}
          batches={batches}
          skus={state.skus}
          focusedBatchCode={focusedBatchCode}
        />
      ) : effectiveSubTab === 'elabel' && showElabelAddon ? (
        <ELabelQrPanel batches={batches} skus={state.skus} lots={state.lots} />
      ) : (
        <>
          {/* 3. JAUGES VISUELLES DE LA CAVE À BOUTEILLES */}
          <section className="ds-stats ds-rise ds-rise-2" aria-label="Synthèse du stock de bouteilles">
            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-ink">
                  <Package size={16} />
                </span>
                <span>Présentes physiquement en cave</span>
              </div>
              <div className="ds-stat-value">
                {totals.physical.toLocaleString('fr-FR')}
                <span className="ds-stat-unit">cols</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: `${availPct}%`, background: 'var(--color-forest)' }} />
                <span style={{ width: `${resPct}%`, background: 'var(--color-gold-dark)' }} />
              </div>
              <div className="ds-stat-foot">
                Total physique sur {batches.length} lots de mise
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-forest">
                  <CheckCircle2 size={16} />
                </span>
                <span>Disponibles à la vente</span>
              </div>
              <div className="ds-stat-value" style={{ color: 'var(--color-forest)' }}>
                {totals.available.toLocaleString('fr-FR')}
                <span className="ds-stat-unit">cols</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: `${availPct}%`, background: 'var(--color-forest)' }} />
              </div>
              <div className="ds-stat-foot">
                {availPct}% du stock libre immédiatement pour de nouvelles commandes
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-gold">
                  <BookmarkCheck size={16} />
                </span>
                <span>Réservées (commandes fermes)</span>
              </div>
              <div className="ds-stat-value">
                {totals.reserved.toLocaleString('fr-FR')}
                <span className="ds-stat-unit">cols</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span style={{ width: `${resPct}%`, background: 'var(--color-gold-dark)' }} />
              </div>
              <div className="ds-stat-foot">
                Protégées contre toute double vente en attendant l’expédition
              </div>
            </div>

            <div className="ds-stat">
              <div className="ds-stat-top">
                <span className="ds-icon-bubble ds-tone-amber">
                  <ShieldAlert size={16} />
                </span>
                <span>Isolées (qualité ou retours)</span>
              </div>
              <div className="ds-stat-value">
                {totals.isolated.toLocaleString('fr-FR')}
                <span className="ds-stat-unit">cols</span>
              </div>
              <div className="ds-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${totals.physical > 0 ? Math.min(100, Math.round((totals.isolated / totals.physical) * 100)) : 0}%`,
                    background: 'var(--color-amber)',
                  }}
                />
              </div>
              <div className="ds-stat-foot">
                Écartées automatiquement du stock vendable
              </div>
            </div>
          </section>

          {/* 3B. CUVÉES PRÊTES AU TIRAGE EN 1 CLIC (MANIPULATION DIRECTE) */}
          {eligibleLots.length > 0 && (
            <div className="ds-panel ds-rise ds-rise-2">
              <div className="ds-section-head">
                <div>
                  <h2 className="ds-section-title">Cuvées prêtes au tirage (Cliquez sur un lot pour lancer sa mise)</h2>
                  <span className="ds-section-meta">
                    La sélection pré-remplit automatiquement le lot, son volume disponible et l’habillage associé
                  </span>
                </div>
                <span className="badge badge-gold">{eligibleLots.length} lot(s) éligible(s)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
                {eligibleLots.map((l) => {
                  const volMl = lotVolumeMl(state, l.id);
                  const maxCols = Math.max(1, Math.floor((volMl - 5000) / 750));
                  return (
                    <div
                      key={l.id}
                      className="ds-clickable-card"
                      onClick={() => {
                        setSelectedLotId(l.id);
                        setBottleCount(String(Math.min(660, maxCols)));
                        setShowBottlingModal(true);
                      }}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '14.5px', color: 'var(--color-ink)' }}>{l.name}</strong>
                        <span className="badge badge-green">{l.code}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }} className="tabular">
                        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-forest)' }}>
                          {(volMl / 1000).toLocaleString('fr-FR')} L
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                          ≈ {maxCols} cols (75 cl)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                        <span style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                          Millésime {l.vintage} · {l.color === 'red' ? 'Rouge' : 'Blanc'}
                        </span>
                        <span className="ds-action-chip">+ Mettre en bouteilles →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. TABLEAU & JAUGES DES LOTS DE BOUTEILLES */}
          <div className="ds-panel ds-rise ds-rise-3">
            <div className="ds-section-head">
              <div>
                <h2 className="ds-section-title">Lots de bouteilles en stock</h2>
                <span className="ds-section-meta">
                  Cliquez sur n’importe quel lot pour inspecter son emplacement en cave ou agir sur son statut
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="badge badge-green">{batches.length} lot(s) de mise</span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => switchBottlingTab('cellar_map')}
                >
                  Voir où ils sont rangés →
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lot de mise</th>
                    <th>Cuvée & Format</th>
                    <th>Millésime</th>
                    <th>Répartition visuelle</th>
                    <th>Physique</th>
                    <th>Réservé</th>
                    <th>Bloqué / Retour</th>
                    <th>Disponible vendable</th>
                    <th>Coût connu</th>
                    <th>Statut & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => {
                    const pos = batchPosition(state, b);
                    const article = state.skus[b.skuId];
                    const bAvailPct = pos.physical > 0 ? Math.round((pos.available / pos.physical) * 100) : 0;
                    const bResPct = pos.physical > 0 ? Math.round((pos.reserved / pos.physical) * 100) : 0;
                    const bIsoPct = pos.physical > 0 ? Math.round(((pos.blocked + pos.quarantine) / pos.physical) * 100) : 0;
                    return (
                      <tr
                        key={b.id}
                        className="ds-clickable-row"
                        onClick={() => switchBottlingTab('cellar_map', b.code)}
                        title="Cliquer pour localiser ce lot dans le plan des casiers & palox"
                      >
                        <td style={{ fontWeight: 700 }}>{b.code}</td>
                        <td style={{ fontWeight: 600 }}>{article?.label ?? b.skuId}</td>
                        <td>
                          <span className="badge badge-gold">{b.vintage}</span>
                        </td>
                        <td style={{ minWidth: '130px' }}>
                          <div className="ds-bar" title={`Disponible : ${pos.available} · Réservé : ${pos.reserved}`}>
                            <span style={{ width: `${bAvailPct}%`, background: 'var(--color-forest)' }} />
                            <span style={{ width: `${bResPct}%`, background: 'var(--color-gold-dark)' }} />
                            <span style={{ width: `${bIsoPct}%`, background: 'var(--color-amber)' }} />
                          </div>
                          <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                            {bAvailPct}% libre · {bResPct}% réservé
                          </div>
                        </td>
                        <td className="tabular" style={{ fontWeight: 600 }}>{pos.physical}</td>
                        <td className="tabular" style={{ color: 'var(--color-grape)', fontWeight: 600 }}>{pos.reserved}</td>
                        <td
                          className="tabular"
                          style={{
                            color: pos.blocked + pos.quarantine > 0 ? 'var(--color-crimson)' : 'var(--color-ink-light)',
                          }}
                        >
                          {pos.blocked + pos.quarantine}
                          {pos.quarantine > 0 ? ` (dont ${pos.quarantine} ret.)` : ''}
                        </td>
                        <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)', fontSize: '15px' }}>
                          {pos.available} cols
                        </td>
                        <td className="tabular" style={{ fontSize: '12px' }}>
                          {b.cost.knownCents ? `${(b.cost.knownCents / 100).toLocaleString('fr-FR')} €` : 'Partiel'}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className={`badge ${b.quality === 'released' ? 'badge-green' : 'badge-amber'}`}>
                              {b.quality === 'released' ? 'Libéré' : 'Retenu'}
                            </span>
                            <button
                              type="button"
                              className="ds-action-chip"
                              onClick={() => switchBottlingTab('cellar_map', b.code)}
                            >
                              📍 Cave
                            </button>
                            <button
                              type="button"
                              className="ds-action-chip"
                              onClick={() => {
                                void dispatch({
                                  type: b.quality === 'released' ? 'quality.hold' : 'quality.release',
                                  payload: {
                                    target: 'batch',
                                    id: b.id,
                                    reason:
                                      b.quality === 'released'
                                        ? 'Mise en retenue qualité depuis la cave à bouteilles'
                                        : 'Libération qualité validée pour commercialisation',
                                  },
                                });
                              }}
                            >
                              {b.quality === 'released' ? '🔒 Isoler' : '✓ Libérer'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

      {/* Modal Mise en bouteilles (accessible depuis tous les onglets) */}
      {showBottlingModal && (
        <Modal
          eyebrow="Conditionnement & Tirage"
          badge={<span className="badge badge-accent">Transaction atomique</span>}
          title="Ordre de mise en bouteilles"
          subtitle="Décompte simultanément la cuve et les matières sèches nécessaires sans jamais créer de bouteille fantôme."
          onClose={() => setShowBottlingModal(false)}
          onSubmit={handleExecuteBottling}
          maxWidth="650px"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBottlingModal(false)}>
                Annuler
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={hasInsufficientDryGoods || !activeLot}
              >
                Valider le conditionnement
              </button>
            </>
          }
        >
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Lot de vin à conditionner</label>
              <select
                className="form-select"
                value={activeLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                required
              >
                {eligibleLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} · {l.name} ({lotVolumeMl(state, l.id) / 1000} L dispo)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Article / Présentation (SKU)</label>
              <select
                className="form-select"
                value={selectedSkuId}
                onChange={(e) => setSelectedSkuId(e.target.value)}
                required
              >
                {skus.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.sizeMl / 10} cl)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Bouteilles produites</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input tabular"
                  value={bottleCount}
                  onChange={(e) => setBottleCount(e.target.value)}
                  required
                />
                <span className="input-unit-cap">cols</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Perte de tirage</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="form-input tabular"
                  value={lossLitres}
                  onChange={(e) => setLossLitres(e.target.value)}
                  required
                />
                <span className="input-unit-cap">L</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Prestation de mise</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input tabular"
                  value={serviceCostEur}
                  onChange={(e) => setServiceCostEur(e.target.value)}
                />
                <span className="input-unit-cap">€ HT</span>
              </div>
            </div>
          </div>

          {/* Volume Conservation Summary */}
          {sku && (
            <div className="ds-modal-summary">
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-forest)' }}>
                  Volume de vin soutiré de la cuve : <span className="tabular">{inputVolumeMl / 1000} L</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                  Conservation : {bottles} × {sku.sizeMl / 10} cl ({(bottles * sku.sizeMl) / 1000} L) + {lossLitres} L perte = {inputVolumeMl / 1000} L.
                </div>
              </div>
            </div>
          )}

          {/* BOM Check with visual bars */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', background: '#FFFFFF' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '8px', color: 'var(--color-forest)' }}>
              Vérification des fournitures (Bouteilles, Bouchons, Étiquettes, Cartons)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bomReqs.map((r) => {
                const g = state.dryGoods[r.dryGoodId];
                const isOk = r.onHand >= r.required;
                const coverPct = r.required > 0 ? Math.min(100, Math.round((r.onHand / r.required) * 100)) : 100;
                return (
                  <div key={r.dryGoodId}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: isOk ? 'var(--color-ink)' : 'var(--color-crimson)',
                        marginBottom: '3px',
                      }}
                    >
                      <span>{g?.name ?? r.dryGoodId}</span>
                      <span className="tabular" style={{ fontWeight: 600 }}>
                        {r.required} nécessaires (en stock : {r.onHand}) {isOk ? '✓ OK' : `⚠️ Manque ${r.required - r.onHand}`}
                      </span>
                    </div>
                    <div className="ds-bar" style={{ height: '5px' }}>
                      <span
                        style={{
                          width: `${coverPct}%`,
                          background: isOk ? 'var(--color-forest)' : 'var(--color-crimson)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasInsufficientDryGoods && (
            <div className="alert alert-error" style={{ marginTop: '14px', marginBottom: 0 }}>
              Stock de matières sèches insuffisant : l’opération est bloquée sans toucher au vin.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
