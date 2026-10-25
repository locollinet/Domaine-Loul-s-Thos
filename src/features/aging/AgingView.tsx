import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { previewBlend } from '../../domain/commands/cellar';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';

export const AgingView: React.FC = () => {
  const { state, dispatch } = useStore();

  // Blend Modal / Trial state
  const [showBlendModal, setShowBlendModal] = useState(false);
  const [blendName, setBlendName] = useState('Rouge 2025 Assemblage — Démo');
  const [destContainerId, setDestContainerId] = useState('tank-04');
  const [inputA_vol, setInputA_vol] = useState('300'); // Litres
  const [inputB_vol, setInputB_vol] = useState('200'); // Litres

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferLotId, setTransferLotId] = useState('lot-2024-aging');
  const [transferFromCont, setTransferFromCont] = useState('demo-barrel-1');
  const [transferToCont, setTransferToCont] = useState('barrel-03');
  const [transferVolL, setTransferVolL] = useState('50');
  const [transferLossL, setTransferLossL] = useState('1');
  const [transferReason, setTransferReason] = useState('Soutirage d’aération');

  if (!state) return null;

  // Compute live blend preview (pure simulation without side-effects)
  let blendPreviewData = null;
  let blendPreviewError = null;

  try {
    const volA_ml = Math.round(parseFloat(inputA_vol || '0') * 1000);
    const volB_ml = Math.round(parseFloat(inputB_vol || '0') * 1000);
    if (volA_ml > 0 && volB_ml > 0) {
      blendPreviewData = previewBlend(state, {
        name: blendName,
        cuveeId: 'cuvee-red',
        destinationContainerId: destContainerId,
        inputs: [
          { lotId: 'lot-2025-a', containerId: 'tank-02', volumeMl: volA_ml },
          { lotId: 'lot-2025-b', containerId: 'tank-03', volumeMl: volB_ml },
        ],
      });
    }
  } catch (err: unknown) {
    blendPreviewError = err instanceof Error ? err.message : 'Erreur de simulation';
  }

  const handleExecuteBlend = async () => {
    const volA_ml = Math.round(parseFloat(inputA_vol) * 1000);
    const volB_ml = Math.round(parseFloat(inputB_vol) * 1000);
    try {
      await dispatch({
        type: 'blend.execute',
        payload: {
          name: blendName,
          cuveeId: 'cuvee-red',
          destinationContainerId: destContainerId,
          inputs: [
            { lotId: 'lot-2025-a', containerId: 'tank-02', volumeMl: volA_ml },
            { lotId: 'lot-2025-b', containerId: 'tank-03', volumeMl: volB_ml },
          ],
        },
      });
      setShowBlendModal(false);
    } catch {
      // Handled
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const volMl = Math.round(parseFloat(transferVolL) * 1000);
    const lossMl = Math.round(parseFloat(transferLossL) * 1000);
    try {
      await dispatch({
        type: 'cellar.transfer',
        payload: {
          lotId: transferLotId,
          fromContainerId: transferFromCont,
          toContainerId: transferToCont,
          volumeMl: volMl,
          lossMl: lossMl,
          reason: transferReason,
        },
      });
      setShowTransferModal(false);
    } catch {
      // Handled
    }
  };

  const lotsReadyForBlend = Object.values(state.lots).filter((l) => l.stage === 'ready' || l.stage === 'aging');
  const availableContainers = Object.values(state.containers).filter((c) => c.state === 'available' && !state.occupancies[c.id]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
            Élevage & Assemblage
          </h1>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
            Occupation des barriques, transferts avec pertes tracées et simulateur d’assemblage.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowTransferModal(true)}>
            Transférer / Soutirer
          </button>
          <button className="btn btn-primary" onClick={() => setShowBlendModal(true)}>
            + Réaliser un assemblage
          </button>
        </div>
      </div>

      {/* Barrels & Aging Lots Overview */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Lots actuellement en élevage & prêts</h2>
            <span className="badge badge-green">{lotsReadyForBlend.length} lots</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {lotsReadyForBlend.map((l) => {
              const volL = lotVolumeMl(state, l.id) / 1000;
              const occs = lotOccupancies(state, l.id);
              return (
                <div key={l.id} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{l.name}</span>
                    <span className="badge badge-green">{l.code}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-forest)' }} className="tabular">
                      Volume total : {volL} L
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                      Coût connu : {l.cost.knownCents ? `${(l.cost.knownCents / 100).toLocaleString('fr-FR')} €` : 'Non valorisé'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-light)', marginTop: '4px' }}>
                    Contenants : {occs.map((o) => `${state.containers[o.containerId]?.code} (${o.volumeMl / 1000} L)`).join(', ') || 'Aucun'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Focus on 2024 Barrels */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Parc à barriques (Élevage 2024)</h2>
            <span className="badge badge-grape">Millésime 2024</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '12px' }}>
            Le lot <em>Blanc 2024 en barriques</em> (L24-B-01) est réparti sur deux fûts de 225 L. La somme des contenants équivaut strictement au volume du lot (200 L).
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {['demo-barrel-1', 'demo-barrel-2'].map((bId) => {
              const c = state.containers[bId];
              const occ = state.occupancies[bId];
              return (
                <div key={bId} style={{ padding: '12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '14px' }}>{c?.code}</strong>
                    <span className="badge badge-muted">Cap. 225 L</span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-forest)', margin: '8px 0' }} className="tabular">
                    {occ ? occ.volumeMl / 1000 : 0} L
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                    Remplissage : {occ ? Math.round((occ.volumeMl / (c?.capacityMl || 1)) * 100) : 0}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Assemblage (Essai & Exécution) */}
      {showBlendModal && (
        <div className="modal-backdrop" onClick={() => setShowBlendModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
                Assemblage des lots 2025
              </h2>
              <span className="badge badge-green">Simulateur & Exécution atomique</span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '16px' }}>
              Cet écran permet d’abord de <strong>prévisualiser l’essai</strong> sans consommer aucune goutte de stock, puis de déclencher l’opération réelle.
            </p>

            <div className="form-group">
              <label className="form-label">Nom du lot enfant résultant</label>
              <input
                type="text"
                className="form-input"
                value={blendName}
                onChange={(e) => setBlendName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contenant de destination (cuve vide disponible)</label>
              <select
                className="form-select"
                value={destContainerId}
                onChange={(e) => setDestContainerId(e.target.value)}
              >
                {availableContainers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.location} (Capacité {c.capacityMl / 1000} L)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px', background: 'var(--color-surface-soft)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                Composantes de l’assemblage (entrées)
              </div>
              <div className="grid-2">
                <div>
                  <label className="form-label">L25-R-A (Hauts Rangs) — en C-02 (600 L dispo)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="600"
                      className="form-input"
                      value={inputA_vol}
                      onChange={(e) => setInputA_vol(e.target.value)}
                    />
                    <span>L</span>
                  </div>
                </div>

                <div>
                  <label className="form-label">L25-R-B (Combe Claire) — en C-03 (400 L dispo)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="400"
                      className="form-input"
                      value={inputB_vol}
                      onChange={(e) => setInputB_vol(e.target.value)}
                    />
                    <span>L</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trial calculation output */}
            {blendPreviewData && (
              <div style={{ border: '1px solid #C2DCC8', borderRadius: 'var(--radius-md)', padding: '12px', background: 'var(--color-forest-soft)', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-forest)', marginBottom: '6px' }}>
                  ✓ Résultat de la simulation d’essai
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                  Volume total assemblé : <strong>{blendPreviewData.totalMl / 1000} L</strong> (dans {state.containers[destContainerId]?.code})
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-ink)' }}>
                  Coût connu alloué au lot enfant : <strong>{(blendPreviewData.cost.knownCents / 100).toLocaleString('fr-FR')} €</strong>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  Reliquats conservés : L25-R-A aura {(300000 / 1000)} L (400 €) · L25-R-B aura {(200000 / 1000)} L (300 €)
                </div>
              </div>
            )}

            {blendPreviewError && (
              <div className="alert alert-error">
                {blendPreviewError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBlendModal(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!blendPreviewData}
                onClick={handleExecuteBlend}
              >
                Exécuter l’assemblage réel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transfert */}
      {showTransferModal && (
        <div className="modal-backdrop" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Transfert de vin / Soutirage
            </h2>
            <form onSubmit={handleExecuteTransfer}>
              <div className="form-group">
                <label className="form-label">Lot concerné</label>
                <select
                  className="form-select"
                  value={transferLotId}
                  onChange={(e) => setTransferLotId(e.target.value)}
                >
                  {Object.values(state.lots).map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Contenant source</label>
                  <select
                    className="form-select"
                    value={transferFromCont}
                    onChange={(e) => setTransferFromCont(e.target.value)}
                  >
                    {lotOccupancies(state, transferLotId).map((o) => (
                      <option key={o.containerId} value={o.containerId}>
                        {state.containers[o.containerId]?.code} ({o.volumeMl / 1000} L dispo)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Contenant destination</label>
                  <select
                    className="form-select"
                    value={transferToCont}
                    onChange={(e) => setTransferToCont(e.target.value)}
                  >
                    {Object.values(state.containers)
                      .filter((c) => c.id !== transferFromCont && c.state === 'available')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} ({c.capacityMl / 1000} L cap.)
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Volume transféré (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    className="form-input"
                    value={transferVolL}
                    onChange={(e) => setTransferVolL(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Perte explicite tracée (L)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="form-input"
                    value={transferLossL}
                    onChange={(e) => setTransferLossL(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Motif du transfert</label>
                <input
                  type="text"
                  className="form-input"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider le transfert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
