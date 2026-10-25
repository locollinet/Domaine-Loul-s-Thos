import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { PARAMETERS } from '../../domain/commands/cellar';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';
import type { Measurement, MeasurementParameter } from '../../domain/types';

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

  // Measurement Correction Modal
  const [showCorrectMeas, setShowCorrectMeas] = useState<Measurement | null>(null);
  const [correctMeasVal, setCorrectMeasVal] = useState('');
  const [correctMeasReason, setCorrectMeasReason] = useState('');

  // Declare Volume Modal (Grapes kg -> Wine L explicit measurement)
  const [showDeclareVolModal, setShowDeclareVolModal] = useState(false);
  const [declareContainerId, setDeclareContainerId] = useState('c-04');
  const [declareLitres, setDeclareLitres] = useState('160');

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

  const handleCorrectMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCorrectMeas) return;
    try {
      await dispatch({
        type: 'measurement.correct',
        payload: {
          measurementId: showCorrectMeas.id,
          value: parseFloat(correctMeasVal),
          reason: correctMeasReason,
        },
      });
      setShowCorrectMeas(null);
      setCorrectMeasReason('');
    } catch {
      // Handled
    }
  };

  const handleDeclareVolume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'lot.declareVolume',
        payload: {
          lotId: selectedLot.id,
          containerId: declareContainerId,
          volumeMl: Math.round(parseFloat(declareLitres) * 1000),
          note: 'Entonnage / écoulage mesuré après pressurage',
        },
      });
      setShowDeclareVolModal(false);
    } catch {
      // Handled
    }
  };

  const handleSetStage = async (nextStage: 'fermenting' | 'aging' | 'ready') => {
    if (!selectedLot) return;
    try {
      await dispatch({
        type: 'lot.setStage',
        payload: {
          lotId: selectedLot.id,
          stage: nextStage,
          reason: 'Évolution du stade œnologique validée au chai',
        },
      });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header" style={{ marginBottom: '2px' }}>
        <div>
          <h1 className="page-title">Chai & Vinification</h1>
          <p className="page-subtitle">
            Plan de cuverie interactif avec jauges de niveau, suivi analytique réel, itinéraires œnologiques et contrôle qualité.
          </p>
        </div>
        <div className="segmented-control">
          <button
            className={`segmented-btn ${viewMode === 'plan' ? 'active' : ''}`}
            onClick={() => setViewMode('plan')}
          >
            Plan de cave visuel
          </button>
          <button
            className={`segmented-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Table des contenants
          </button>
        </div>
      </div>

      {/* Plan de cave visuel avec jauges cylindriques ou Table alternative */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Occupation des contenants</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Cliquez sur une cuve ou une barrique occupée pour inspecter le lot de vin contenu
            </div>
          </div>
          <span className="badge badge-muted">
            Lot ≠ Contenant · 1 lot actif par contenant
          </span>
        </div>

        {viewMode === 'plan' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px' }}>
            {containers.map((c) => {
              const occ = state.occupancies[c.id];
              const lot = occ ? state.lots[occ.lotId] : null;
              const fillPct = occ ? Math.min(100, Math.round((occ.volumeMl / c.capacityMl) * 100)) : 0;
              const isSelected = lot && lot.id === selectedLot?.id;

              return (
                <div
                  key={c.id}
                  onClick={() => lot && setSelectedLotId(lot.id)}
                  className="vessel-visual-card"
                  style={{
                    border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                    background: c.state === 'maintenance' ? '#F6F0F0' : isSelected ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                    cursor: lot ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{c.code}</span>
                    <span className={`badge ${c.state === 'maintenance' ? 'badge-crimson' : c.kind === 'barrel' ? 'badge-amber' : 'badge-muted'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {c.state === 'maintenance' ? 'Maint.' : c.kind === 'barrel' ? 'Barrique' : 'Cuve Inox'}
                    </span>
                  </div>

                  {/* Jauge visuelle de cuve / fût */}
                  <div className="vessel-tank-cylinder">
                    {occ && lot ? (
                      <div
                        className={`vessel-liquid ${lot.color === 'red' ? 'wine-red' : 'wine-white'}`}
                        style={{ height: `${Math.max(12, fillPct)}%` }}
                      />
                    ) : null}
                    <div
                      className="tabular"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: occ && fillPct > 45 && lot?.color === 'red' ? '#FFFFFF' : 'var(--color-ink)',
                        textShadow: occ && fillPct > 45 && lot?.color === 'red' ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                      }}
                    >
                      {occ ? (
                        <>
                          <span>{occ.volumeMl / 1000} L</span>
                          <span style={{ fontSize: '10px', opacity: 0.85 }}>{fillPct}% plein</span>
                        </>
                      ) : c.state === 'maintenance' ? (
                        <span style={{ color: 'var(--color-crimson)', fontSize: '11px' }}>🔧 Indisponible</span>
                      ) : (
                        <span style={{ color: 'var(--color-ink-light)', fontSize: '11px' }}>Vide</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }} className="tabular">
                      Capacité : {c.capacityMl / 1000} L
                    </div>
                    {lot ? (
                      <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-forest)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lot.code} · {lot.name}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11.5px', color: 'var(--color-ink-light)', marginTop: '2px' }}>
                        {c.state === 'maintenance' ? 'Hors service' : 'Prêt à recevoir'}
                      </div>
                    )}
                  </div>
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
                  <th>Type & Emplacement</th>
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
                      <td style={{ fontWeight: 700 }}>{c.code}</td>
                      <td>{c.kind === 'barrel' ? 'Barrique chêne' : 'Cuve'} · {c.location}</td>
                      <td className="tabular">{c.capacityMl / 1000} L</td>
                      <td className="tabular" style={{ fontWeight: 600 }}>
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

      {/* Lot selector and comprehensive winemaking inspector */}
      <div className="grid-2">
        {/* Left: Lots list */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Lots de vinification</h2>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Sélectionnez un lot pour ouvrir sa fiche technique, ses courbes et ses contrôles
              </div>
            </div>
            <span className="badge badge-muted">{lots.length} lots actifs</span>
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
                    padding: '12px 14px',
                    border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{l.name}</span>
                    <span className={`badge ${l.quality === 'held' ? 'badge-amber' : 'badge-green'}`}>
                      {l.quality === 'held' ? '🔒 Bloqué qualité' : '✓ Libéré'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '3px' }}>
                    Code : <strong>{l.code}</strong> · Millésime {l.vintage} · {l.color === 'white' ? 'Blanc' : 'Rouge'}
                    {l.grapesReceivedG > 0 && ` · Raisins reçus : ${(l.grapesReceivedG / 1000).toLocaleString('fr-FR')} kg`}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-forest)' }} className="tabular">
                      Volume actuel : {volL} L
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
                <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700 }}>
                  {selectedLot.name} ({selectedLot.code})
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Millésime {selectedLot.vintage} · {selectedLot.color === 'white' ? 'Vin blanc tranquille' : 'Vin rouge tranquille'} · Mention : {selectedLot.mention}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {selectedLot.grapesReceivedG > 0 && lotVolumeMl(state, selectedLot.id) === 0 && (
                  <button
                    className="btn btn-sm btn-accent"
                    onClick={() => setShowDeclareVolModal(true)}
                  >
                    + Déclarer volume écoulé (L)
                  </button>
                )}
                {selectedLot.quality === 'held' ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setShowQualityModal('release');
                      setQualityReason('Analyses et dégustation conformes pour mise ou commercialisation');
                    }}
                  >
                    Libérer le lot
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setShowQualityModal('hold');
                      setQualityReason('Mise en retenue préventive pour contrôle analytique');
                    }}
                  >
                    Bloquer qualité
                  </button>
                )}
              </div>
            </div>

            {/* Stage progression switcher */}
            <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>
                Stade œnologique actuel : <strong style={{ color: 'var(--color-ink)' }}>{selectedLot.stage}</strong>
              </span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {(['fermenting', 'aging', 'ready'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`badge ${selectedLot.stage === st ? 'badge-green' : 'badge-muted'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSetStage(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Occupancies */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Répartition dans les contenants
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {lotOccupancies(state, selectedLot.id).map((o) => (
                  <div
                    key={o.containerId}
                    style={{
                      background: 'var(--color-surface-soft)',
                      border: '1px solid var(--color-border)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
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
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Itinéraire œnologique (Sans conseil de dose ni décision automatique)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {selectedLot.itinerary.map((step) => (
                    <div
                      key={step.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: step.status === 'done' ? 'var(--color-forest-soft)' : 'var(--color-surface-soft)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12.5px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600 }}>{step.label}</span>
                        {step.doneAt && (
                          <span style={{ color: 'var(--color-ink-muted)', marginLeft: '6px' }}>
                            (validé le {step.doneAt})
                          </span>
                        )}
                      </div>
                      <button
                        className={`badge ${step.status === 'done' ? 'badge-green' : 'badge-muted'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleItineraryStep(step.key, step.status)}
                      >
                        {step.status === 'done' ? '✓ Fait' : 'Marquer fait'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Measurements & Real SVG Density Curve */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
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
                <div style={{ background: '#FAF9F5', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-ink)' }}>
                      Cinétique fermentaire réelle — Densité (g/L)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                      Aucune interpolation artificielle
                    </span>
                  </div>
                  <svg width="100%" height="100" viewBox="0 0 320 90">
                    {(() => {
                      const minD = 990;
                      const maxD = 1100;
                      const pts = densityPoints.map((p, idx) => {
                        const x = 28 + (idx / (densityPoints.length - 1)) * 264;
                        const y = 74 - ((p.value - minD) / (maxD - minD)) * 56;
                        return { x, y, val: p.value, date: p.sampledAt.slice(5, 10) };
                      });
                      const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
                      return (
                        <>
                          <line x1="24" y1="74" x2="300" y2="74" stroke="#D5D2C8" strokeWidth="1" />
                          <line x1="24" y1="18" x2="300" y2="18" stroke="#D5D2C8" strokeWidth="1" strokeDasharray="3" />
                          <polyline fill="none" stroke="var(--color-forest)" strokeWidth="2.5" points={polyline} />
                          {pts.map((p, i) => (
                            <g key={i}>
                              <circle cx={p.x} cy={p.y} r="4" fill="var(--color-forest)" />
                              <text x={p.x} y={p.y - 7} fontSize="9.5" fontWeight="700" textAnchor="middle" fill="var(--color-ink)">
                                {p.val}
                              </text>
                              <text x={p.x} y={86} fontSize="8.5" textAnchor="middle" fill="var(--color-ink-muted)">
                                {p.date}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}

              <div className="table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th>Paramètre</th>
                      <th>Valeur</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotMeas.slice(-8).map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{PARAMETERS[m.parameter]?.label ?? m.parameter}</td>
                        <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)' }}>
                          {m.value} {m.unit}
                        </td>
                        <td className="tabular">{m.sampledAt.slice(0, 10)}</td>
                        <td>
                          <button
                            className="badge badge-muted"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setShowCorrectMeas(m);
                              setCorrectMeasVal(String(m.value));
                            }}
                          >
                            Corriger
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tastings & Operations */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-ink-muted)', textTransform: 'uppercase' }}>
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
                  <div key={t.id} style={{ padding: '8px 10px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{t.notes}</div>
                    <div style={{ color: 'var(--color-ink-light)', marginTop: '2px', fontSize: '11px' }}>
                      {t.tastedAt.slice(0, 10)} · {t.author}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations journal */}
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-ink-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Journal des opérations du lot ({lotOps.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                {lotOps.map((op) => (
                  <div key={op.id} style={{ padding: '6px 10px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
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
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '14px' }}>
              Nouveau relevé analytique — {selectedLot?.name}
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

      {/* Modal Correction de mesure */}
      {showCorrectMeas && (
        <div className="modal-backdrop" onClick={() => setShowCorrectMeas(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>
              Corriger le relevé ({PARAMETERS[showCorrectMeas.parameter]?.label})
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '12px' }}>
              L’ancienne mesure ({showCorrectMeas.value} {showCorrectMeas.unit}) reste conservée dans l’historique (`supersededBy`).
            </p>
            <form onSubmit={handleCorrectMeasurement}>
              <div className="form-group">
                <label className="form-label">Nouvelle valeur corrigée ({showCorrectMeas.unit})</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={correctMeasVal}
                  onChange={(e) => setCorrectMeasVal(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif de correction (obligatoire)</label>
                <input
                  type="text"
                  className="form-input"
                  value={correctMeasReason}
                  onChange={(e) => setCorrectMeasReason(e.target.value)}
                  placeholder="Ex : Correction de lecture hydromètre à 20°C"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCorrectMeas(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-accent">
                  Valider la correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Déclaration volume écoulé */}
      {showDeclareVolModal && (
        <div className="modal-backdrop" onClick={() => setShowDeclareVolModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
              Déclarer le volume de moût / vin écoulé — {selectedLot?.name}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Les kilogrammes de raisin ({((selectedLot?.grapesReceivedG ?? 0) / 1000).toLocaleString('fr-FR')} kg) ne sont jamais convertis automatiquement en litres. Saisissez le volume réel entonné.
            </p>
            <form onSubmit={handleDeclareVolume}>
              <div className="form-group">
                <label className="form-label">Contenant de destination</label>
                <select
                  className="form-select"
                  value={declareContainerId}
                  onChange={(e) => setDeclareContainerId(e.target.value)}
                >
                  {containers
                    .filter((c) => c.state === 'available' && !state.occupancies[c.id])
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.capacityMl / 1000} L)
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Volume réel mesuré (Litres)</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={declareLitres}
                  onChange={(e) => setDeclareLitres(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeclareVolModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Déclarer le volume
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
