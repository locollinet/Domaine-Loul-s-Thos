import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { PARAMETERS } from '../../domain/commands/cellar';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';
import type { MeasurementParameter } from '../../domain/types';

export const CellarView: React.FC = () => {
  const { state, dispatch } = useStore();
  const [selectedLotId, setSelectedLotId] = useState<string>('lot-2026-white');
  const [viewMode, setViewMode] = useState<'plan' | 'table'>('plan');

  // Measurement Modal
  const [showMeasModal, setShowMeasModal] = useState(false);
  const [paramKey, setParamKey] = useState<MeasurementParameter>('density');
  const [paramVal, setParamVal] = useState('1010');
  const [paramUnit, setParamUnit] = useState('g/L');
  const [sampledDate, setSampledDate] = useState('2026-10-24');

  // Tasting Modal
  const [showTastingModal, setShowTastingModal] = useState(false);
  const [tastingNote, setTastingNote] = useState('');

  // Quality hold/release
  const [showQualityModal, setShowQualityModal] = useState<'hold' | 'release' | null>(null);
  const [qualityReason, setQualityReason] = useState('');

  if (!state) return null;

  const lots = Object.values(state.lots);
  const containers = Object.values(state.containers);
  const selectedLot = state.lots[selectedLotId] || lots[0];

  const lotMeas = Object.values(state.measurements)
    .filter((m) => m.lotId === selectedLot?.id && m.supersededBy === null)
    .sort((a, b) => a.sampledAt.localeCompare(b.sampledAt));

  const lotTastings = Object.values(state.tastings)
    .filter((t) => t.lotId === selectedLot?.id)
    .sort((a, b) => b.tastedAt.localeCompare(a.tastedAt));

  const lotOps = Object.values(state.cellarOps)
    .filter((o) => o.lotId === selectedLot?.id)
    .sort((a, b) => b.at.localeCompare(a.at));

  // Density curve points
  const densityPoints = lotMeas.filter((m) => m.parameter === 'density');

  const handleAddMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'measurement.add',
        payload: {
          lotId: selectedLot.id,
          containerId: null,
          parameter: paramKey,
          value: parseFloat(paramVal),
          unit: paramUnit,
          sampledAt: `${sampledDate}T08:00:00.000Z`,
        },
      });
      setShowMeasModal(false);
    } catch {
      // Handled
    }
  };

  const handleAddTasting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'tasting.add',
        payload: {
          lotId: selectedLot.id,
          notes: tastingNote,
        },
      });
      setShowTastingModal(false);
      setTastingNote('');
    } catch {
      // Handled
    }
  };

  const handleQualityChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot || !showQualityModal) return;
    try {
      if (showQualityModal === 'hold') {
        await dispatch({
          type: 'quality.hold',
          payload: { target: 'lot', id: selectedLot.id, reason: qualityReason },
        });
      } else {
        await dispatch({
          type: 'quality.release',
          payload: { target: 'lot', id: selectedLot.id, reason: qualityReason },
        });
      }
      setShowQualityModal(null);
      setQualityReason('');
    } catch {
      // Handled
    }
  };

  const handleItineraryStep = async (stepKey: string, currentStatus: string) => {
    if (!selectedLot) return;
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await dispatch({
        type: 'itinerary.setStep',
        payload: {
          lotId: selectedLot.id,
          key: stepKey,
          status: nextStatus,
          note: null,
        },
      });
    } catch {
      // Handled
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
            Chai & Vinification
          </h1>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
            Plan de cuverie, relevés fermentaires réels, itinéraires œnologiques et fiches de lots.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'plan' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('plan')}
          >
            Plan de cave
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('table')}
          >
            Table des contenants
          </button>
        </div>
      </div>

      {/* Plan de cave or Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Occupation des contenants</h2>
          <span className="badge badge-muted">
            Hypothèse démo : un lot par contenant à la fois
          </span>
        </div>

        {viewMode === 'plan' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
            {containers.map((c) => {
              const occ = state.occupancies[c.id];
              const lot = occ ? state.lots[occ.lotId] : null;
              const fillPct = occ ? Math.min(100, Math.round((occ.volumeMl / c.capacityMl) * 100)) : 0;
              const isSelected = lot?.id === selectedLot?.id;

              return (
                <div
                  key={c.id}
                  onClick={() => lot && setSelectedLotId(lot.id)}
                  style={{
                    border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    background: c.state === 'maintenance' ? '#F7F7F7' : 'var(--color-surface)',
                    cursor: lot ? 'pointer' : 'default',
                    opacity: c.state === 'maintenance' ? 0.6 : 1,
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>{c.code}</span>
                    <span style={{ fontSize: '10px', color: 'var(--color-ink-light)' }}>
                      {c.kind === 'barrel' ? 'Fût' : 'Cuve'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginTop: '2px' }} className="tabular">
                    Cap. {c.capacityMl / 1000} L
                  </div>

                  {occ && lot ? (
                    <div style={{ marginTop: '8px' }}>
                      <div
                        style={{
                          height: '6px',
                          background: '#EAE6DC',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '6px',
                        }}
                      >
                        <div
                          style={{
                            width: `${fillPct}%`,
                            height: '100%',
                            background: lot.color === 'white' ? '#C2D9CE' : '#8F4B5A',
                          }}
                        />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-ink)' }}>
                        {occ.volumeMl / 1000} L ({fillPct}%)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-forest)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {lot.name}
                      </div>
                    </div>
                  ) : c.state === 'maintenance' ? (
                    <div style={{ fontSize: '11px', color: 'var(--color-crimson)', marginTop: '10px' }}>
                      Maintenance
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)', marginTop: '10px' }}>
                      Disponible
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>Capacité</th>
                  <th>Occupation</th>
                  <th>Lot affecté</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const occ = state.occupancies[c.id];
                  const lot = occ ? state.lots[occ.lotId] : null;
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.code}</td>
                      <td>{c.kind === 'barrel' ? 'Barrique' : 'Cuve'}</td>
                      <td className="tabular">{c.capacityMl / 1000} L</td>
                      <td className="tabular">
                        {occ ? `${occ.volumeMl / 1000} L (${Math.round((occ.volumeMl / c.capacityMl) * 100)}%)` : 'Vide'}
                      </td>
                      <td>
                        {lot ? (
                          <button
                            style={{ color: 'var(--color-forest)', textDecoration: 'underline', fontWeight: 600 }}
                            onClick={() => setSelectedLotId(lot.id)}
                          >
                            {lot.code} · {lot.name}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {c.state === 'maintenance' ? (
                          <span className="badge badge-crimson">Maintenance</span>
                        ) : (
                          <span className="badge badge-green">Disponible</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lot selector and details */}
      <div className="grid-2">
        {/* Left: Lots list */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Lots de vinification</h2>
            <span className="badge badge-muted">{lots.length} lots</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lots.map((l) => {
              const volL = lotVolumeMl(state, l.id) / 1000;
              const isSelected = l.id === selectedLot?.id;
              return (
                <div
                  key={l.id}
                  onClick={() => setSelectedLotId(l.id)}
                  style={{
                    padding: '10px 12px',
                    border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{l.name}</span>
                    <span className={`badge ${l.quality === 'held' ? 'badge-amber' : 'badge-green'}`}>
                      {l.quality === 'held' ? 'Bloqué qualité' : 'Libéré'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Code : {l.code} · Millésime {l.vintage} · {l.color === 'white' ? 'Blanc' : 'Rouge'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600 }} className="tabular">
                      Volume : {volL} L
                    </span>
                    <span className="badge badge-muted" style={{ fontSize: '11px' }}>
                      Stade : {l.stage}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected lot details */}
        {selectedLot && (
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">{selectedLot.name} ({selectedLot.code})</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Millésime {selectedLot.vintage} · {selectedLot.color === 'white' ? 'Vin blanc' : 'Vin rouge'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {selectedLot.quality === 'held' ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setShowQualityModal('release');
                      setQualityReason('Analyses et dégustation conformes pour commercialisation');
                    }}
                  >
                    Libérer le lot
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setShowQualityModal('hold');
                      setQualityReason('Contrôle en cours');
                    }}
                  >
                    Bloquer qualité
                  </button>
                )}
              </div>
            </div>

            {/* Occupancies */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-muted)', marginBottom: '4px' }}>
                Répartition dans les contenants
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {lotOccupancies(state, selectedLot.id).map((o) => (
                  <div
                    key={o.containerId}
                    style={{
                      background: 'var(--color-surface-soft)',
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                    }}
                    className="tabular"
                  >
                    <strong>{state.containers[o.containerId]?.code ?? o.containerId}</strong> : {o.volumeMl / 1000} L
                  </div>
                ))}
              </div>
            </div>

            {/* Itinerary */}
            {selectedLot.itinerary.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-muted)', marginBottom: '6px' }}>
                  Itinéraire œnologique indicatif
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selectedLot.itinerary.map((step) => (
                    <div
                      key={step.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 8px',
                        background: 'var(--color-surface-soft)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>{step.label}</span>
                        {step.doneAt && (
                          <span style={{ color: 'var(--color-ink-light)', marginLeft: '6px' }}>
                            ({step.doneAt})
                          </span>
                        )}
                      </div>
                      <button
                        className={`badge ${step.status === 'done' ? 'badge-green' : 'badge-muted'}`}
                        onClick={() => handleItineraryStep(step.key, step.status)}
                      >
                        {step.status === 'done' ? '✓ Fait' : 'À faire'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Measurements & Density Graph */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                  Suivi des mesures réelles ({lotMeas.length})
                </span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowMeasModal(true)}
                >
                  + Nouveau relevé
                </button>
              </div>

              {/* Pure SVG Density Curve */}
              {densityPoints.length > 1 && (
                <div style={{ background: '#FAF9F5', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ink-muted)', marginBottom: '6px' }}>
                    Cinétique de densité (g/L)
                  </div>
                  <svg width="100%" height="90" viewBox="0 0 300 80">
                    {/* SVG Curve Points */}
                    {(() => {
                      const minD = 990;
                      const maxD = 1100;
                      const pts = densityPoints.map((p, idx) => {
                        const x = 20 + (idx / (densityPoints.length - 1)) * 260;
                        const y = 70 - ((p.value - minD) / (maxD - minD)) * 60;
                        return { x, y, val: p.value };
                      });
                      const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
                      return (
                        <>
                          <line x1="20" y1="70" x2="280" y2="70" stroke="#DDD" strokeWidth="1" />
                          <line x1="20" y1="10" x2="280" y2="10" stroke="#DDD" strokeWidth="1" strokeDasharray="2" />
                          <polyline fill="none" stroke="var(--color-forest)" strokeWidth="2" points={polyline} />
                          {pts.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="3" fill="var(--color-forest)" />
                              <text x={p.x} y={p.y - 5} fontSize="9" textAnchor="middle" fill="var(--color-ink)">
                                {p.val}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}

              <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                <table style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Paramètre</th>
                      <th>Valeur</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotMeas.slice(-6).map((m) => (
                      <tr key={m.id}>
                        <td>{PARAMETERS[m.parameter]?.label ?? m.parameter}</td>
                        <td className="tabular" style={{ fontWeight: 600 }}>{m.value} {m.unit}</td>
                        <td>{m.sampledAt.slice(0, 10)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tastings & Operations */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                  Observations & Dégustations ({lotTastings.length})
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowTastingModal(true)}
                >
                  + Dégustation
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {lotTastings.map((t) => (
                  <div key={t.id} style={{ padding: '8px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{t.notes}</div>
                    <div style={{ color: 'var(--color-ink-light)', marginTop: '2px' }}>
                      {t.tastedAt.slice(0, 10)} · {t.author}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations journal */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-ink-muted)', marginBottom: '6px' }}>
                Journal des opérations du lot ({lotOps.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                {lotOps.map((op) => (
                  <div key={op.id} style={{ padding: '6px 8px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '11px' }}>
                    <span style={{ fontWeight: 600 }}>{op.label}</span> — {op.details}
                    <span style={{ color: 'var(--color-ink-light)', marginLeft: '6px' }}>({op.at.slice(0, 10)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Relevé */}
      {showMeasModal && (
        <div className="modal-backdrop" onClick={() => setShowMeasModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Nouveau relevé pour {selectedLot?.name}
            </h2>
            <form onSubmit={handleAddMeasurement}>
              <div className="form-group">
                <label className="form-label">Paramètre mesuré</label>
                <select
                  className="form-select"
                  value={paramKey}
                  onChange={(e) => {
                    const k = e.target.value as MeasurementParameter;
                    setParamKey(k);
                    setParamUnit(PARAMETERS[k].units[0]!);
                  }}
                >
                  {Object.entries(PARAMETERS).map(([k, def]) => (
                    <option key={k} value={k}>{def.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Valeur mesurée</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={paramVal}
                    onChange={(e) => setParamVal(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unité</label>
                  <select
                    className="form-select"
                    value={paramUnit}
                    onChange={(e) => setParamUnit(e.target.value)}
                  >
                    {PARAMETERS[paramKey].units.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Date du prélèvement</label>
                <input
                  type="date"
                  className="form-input"
                  value={sampledDate}
                  onChange={(e) => setSampledDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowMeasModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer la mesure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dégustation */}
      {showTastingModal && (
        <div className="modal-backdrop" onClick={() => setShowTastingModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Note de dégustation — {selectedLot?.name}
            </h2>
            <form onSubmit={handleAddTasting}>
              <div className="form-group">
                <label className="form-label">Commentaire humain / impressions</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={tastingNote}
                  onChange={(e) => setTastingNote(e.target.value)}
                  placeholder="Ex : Équilibre frais, fin de fermentation alcoolique à surveiller"
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTastingModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Qualité (Hold/Release) */}
      {showQualityModal && (
        <div className="modal-backdrop" onClick={() => setShowQualityModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              {showQualityModal === 'hold' ? 'Bloquer la commercialisation' : 'Libérer le lot'} — {selectedLot?.name}
            </h2>
            <form onSubmit={handleQualityChange}>
              <div className="form-group">
                <label className="form-label">Motif (décision humaine auditée)</label>
                <textarea
                  className="form-textarea"
                  value={qualityReason}
                  onChange={(e) => setQualityReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowQualityModal(null)}>
                  Annuler
                </button>
                <button type="submit" className={showQualityModal === 'hold' ? 'btn btn-danger' : 'btn btn-primary'}>
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
