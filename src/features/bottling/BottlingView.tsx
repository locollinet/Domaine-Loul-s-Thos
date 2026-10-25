import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { bottlingRequirements } from '../../domain/commands/cellar';
import { batchPosition, lotOccupancies, lotVolumeMl } from '../../domain/selectors';

export const BottlingView: React.FC = () => {
  const { state, dispatch } = useStore();
  const [showBottlingModal, setShowBottlingModal] = useState(false);

  // Form states
  const [selectedLotId, setSelectedLotId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('sku-red-2025-750');
  const [bottleCount, setBottleCount] = useState('660');
  const [lossLitres, setLossLitres] = useState('5');
  const [serviceCostEur, setServiceCostEur] = useState('330');

  if (!state) return null;

  const batches = Object.values(state.batches);
  const skus = Object.values(state.skus);
  const eligibleLots = Object.values(state.lots).filter((l) => lotVolumeMl(state, l.id) > 0 && l.quality === 'released');

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
            Conditionnement & Stock Bouteilles
          </h1>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
            Ordres de mise en bouteilles, consommation atomique vin/matières sèches et suivi des stocks.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (eligibleLots.length > 0) {
              setSelectedLotId(eligibleLots[0]!.id);
            }
            setShowBottlingModal(true);
          }}
        >
          + Nouvelle mise en bouteilles
        </button>
      </div>

      {/* Stocks Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Lots de bouteilles en stock</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
              Distinction stricte : Physique ≠ Réservé ≠ Bloqué ≠ Disponible vendable.
            </div>
          </div>
          <span className="badge badge-green">{batches.length} lot(s) de mise</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lot de mise</th>
                <th>Cuvée & Article</th>
                <th>Millésime</th>
                <th>Physique</th>
                <th>Réservé</th>
                <th>Bloqué qualité</th>
                <th>Quarantaine (retours)</th>
                <th>Disponible vendable</th>
                <th>Coût connu</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const pos = batchPosition(state, b);
                const article = state.skus[b.skuId];
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 700 }}>{b.code}</td>
                    <td>{article?.label ?? b.skuId}</td>
                    <td>{b.vintage}</td>
                    <td className="tabular" style={{ fontWeight: 600 }}>{pos.physical}</td>
                    <td className="tabular" style={{ color: 'var(--color-grape)' }}>{pos.reserved}</td>
                    <td className="tabular" style={{ color: pos.blocked > 0 ? 'var(--color-crimson)' : 'var(--color-ink-light)' }}>
                      {pos.blocked}
                    </td>
                    <td className="tabular" style={{ color: pos.quarantine > 0 ? 'var(--color-amber)' : 'var(--color-ink-light)' }}>
                      {pos.quarantine}
                    </td>
                    <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)', fontSize: '15px' }}>
                      {pos.available}
                    </td>
                    <td className="tabular" style={{ fontSize: '12px' }}>
                      {b.cost.knownCents ? `${(b.cost.knownCents / 100).toLocaleString('fr-FR')} €` : 'Partiel'}
                    </td>
                    <td>
                      <span className={`badge ${b.quality === 'released' ? 'badge-green' : 'badge-amber'}`}>
                        {b.quality === 'released' ? 'Libéré' : 'Retenu'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Mise en bouteilles */}
      {showBottlingModal && (
        <div className="modal-backdrop" onClick={() => setShowBottlingModal(false)}>
          <div className="modal-content" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                Ordre de mise en bouteilles
              </h2>
              <span className="badge badge-accent">Transaction atomique</span>
            </div>

            <form onSubmit={handleExecuteBottling}>
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
                      {l.code} · {l.name} ({lotVolumeMl(state, l.id) / 1000} L disponibles)
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

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Nombre de bouteilles produites</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    value={bottleCount}
                    onChange={(e) => setBottleCount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Perte de tirage déclarée (L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="form-input"
                    value={lossLitres}
                    onChange={(e) => setLossLitres(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Volume Conservation Summary */}
              {sku && (
                <div style={{ background: 'var(--color-surface-soft)', padding: '10px 12px', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Volume consommé requis :</span>
                    <strong className="tabular">{inputVolumeMl / 1000} L</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Formule de conservation : {bottles} × {sku.sizeMl / 10} cl ({bottles * sku.sizeMl / 1000} L) + {lossLitres} L perte = {inputVolumeMl / 1000} L.
                  </div>
                </div>
              )}

              {/* BOM Check */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                  Contrôle des matières sèches requises (BOM)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {bomReqs.map((r) => {
                    const g = state.dryGoods[r.dryGoodId];
                    const isOk = r.onHand >= r.required;
                    return (
                      <div
                        key={r.dryGoodId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          color: isOk ? 'var(--color-ink)' : 'var(--color-crimson)',
                        }}
                      >
                        <span>{g?.name ?? r.dryGoodId} :</span>
                        <span className="tabular" style={{ fontWeight: 600 }}>
                          {r.required} requis (en stock : {r.onHand}) {isOk ? '✓' : '⚠️ MANQUE ' + (r.required - r.onHand)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Coût prestation de mise (€ HT)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  value={serviceCostEur}
                  onChange={(e) => setServiceCostEur(e.target.value)}
                />
              </div>

              {hasInsufficientDryGoods && (
                <div className="alert alert-error" style={{ marginBottom: '14px' }}>
                  Stock de matières sèches insuffisant : l’opération sera refusée sans consommer de vin.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
