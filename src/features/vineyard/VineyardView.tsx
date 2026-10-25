import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import type { HarvestCount, Mission, Parcel } from '../../domain/types';

export const VineyardView: React.FC = () => {
  const { state, dispatch, role } = useStore();
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  // Modals state
  const [showCountModal, setShowCountModal] = useState<Mission | null>(null);
  const [countQuantity, setCountQuantity] = useState('8');

  const [showCorrectModal, setShowCorrectModal] = useState<HarvestCount | null>(null);
  const [correctQty, setCorrectQty] = useState('');
  const [correctReason, setCorrectReason] = useState('');

  const [showTransportModal, setShowTransportModal] = useState(false);
  const [selectedCountsForTransport, setSelectedCountsForTransport] = useState<string[]>([]);

  const [showReceptionModal, setShowReceptionModal] = useState<string | null>(null); // transportId
  const [grossKg, setGrossKg] = useState('250');
  const [tareKg, setTareKg] = useState('30');
  const [receptionTicket, setReceptionTicket] = useState('TK-1024-01');
  const [receptionDestLot, setReceptionDestLot] = useState('lot-2026-red');

  if (!state) return null;

  const parcels = Object.values(state.parcels);
  const missions = Object.values(state.missions);
  const counts = Object.values(state.harvestCounts);
  const transports = Object.values(state.transports);

  const untransportedCounts = counts.filter((c) => c.transportId === null && c.quantity > 0);

  // Saisie comptage
  const handleAddCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCountModal) return;
    const qty = parseInt(countQuantity, 10);
    try {
      await dispatch({
        type: 'harvest.count',
        payload: {
          missionId: showCountModal.id,
          crateType: 'crate-20',
          quantity: qty,
        },
      });
      setShowCountModal(null);
    } catch {
      // Handled by context
    }
  };

  // Correction comptage
  const handleCorrectCount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCorrectModal) return;
    const qty = parseInt(correctQty, 10);
    try {
      await dispatch({
        type: 'harvest.correctCount',
        payload: {
          countId: showCorrectModal.id,
          expectedVersion: showCorrectModal.version,
          quantity: qty,
          reason: correctReason,
        },
      });
      setShowCorrectModal(null);
      setCorrectReason('');
    } catch {
      // Handled by context
    }
  };

  // Création transport
  const handleCreateTransport = async () => {
    if (selectedCountsForTransport.length === 0) return;
    try {
      await dispatch({
        type: 'transport.create',
        payload: { countIds: selectedCountsForTransport },
      });
      setSelectedCountsForTransport([]);
      setShowTransportModal(false);
    } catch {
      // Handled
    }
  };

  // Enregistrement réception
  const handleRecordReception = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceptionModal) return;
    const gross = Math.round(parseFloat(grossKg) * 1000);
    const tare = Math.round(parseFloat(tareKg) * 1000);
    try {
      await dispatch({
        type: 'reception.record',
        payload: {
          transportId: showReceptionModal,
          ticket: receptionTicket,
          grossG: gross,
          tareG: tare,
          control: 'Contrôle à quai visuel et réfractométrique conforme (fictif)',
          destination: { kind: 'existing', lotId: receptionDestLot },
        },
      });
      setShowReceptionModal(null);
    } catch {
      // Handled
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-forest)' }}>
          Vignoble & Récolte
        </h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: '14px' }}>
          Parcellaire, travaux viticoles, comptages au champ, expéditions en transport et réceptions au chai.
        </p>
      </div>

      {/* Schematic Map & Parcels List */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Schéma parcellaire illustratif</h2>
            <span className="badge badge-muted">Sans GPS inventé</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginBottom: '12px' }}>
            Représentation schématique du domaine. Cliquez sur une parcelle pour consulter sa fiche.
          </p>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '240px',
              background: '#EAE6DB',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
            }}
          >
            {parcels.map((p) => {
              const isSelected = selectedParcel?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedParcel(p)}
                  style={{
                    position: 'absolute',
                    left: `${p.schematic.x}%`,
                    top: `${p.schematic.y}%`,
                    width: `${p.schematic.w}%`,
                    height: `${p.schematic.h}%`,
                    backgroundColor: isSelected ? 'var(--color-grape)' : p.color === 'white' ? '#C2D9CE' : p.color === 'red' ? '#8F4B5A' : '#71655C',
                    color: isSelected || p.color !== 'white' ? 'white' : 'var(--color-ink)',
                    border: '1px solid rgba(0,0,0,0.2)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2px',
                    textAlign: 'center',
                    boxShadow: isSelected ? '0 0 0 2px var(--color-forest)' : 'none',
                    cursor: 'pointer',
                  }}
                  title={p.name}
                >
                  {p.code}
                </button>
              );
            })}
          </div>

          {selectedParcel && (
            <div style={{ marginTop: '14px', padding: '12px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{selectedParcel.name}</span>
                <span className="badge badge-green">{selectedParcel.code}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginTop: '6px' }}>
                <strong>Cépage / Bloc :</strong> {selectedParcel.grape}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginTop: '2px' }}>
                <strong>Surface :</strong> {selectedParcel.areaM2 ? `${(selectedParcel.areaM2.value / 10000).toFixed(2)} ha (${selectedParcel.areaM2.status === 'estimated' ? 'estimée' : 'mesurée'})` : 'Inconnue (≠ 0)'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-ink)', marginTop: '2px' }}>
                <strong>Propriétaire :</strong> {selectedParcel.owner} · <strong>Plantation :</strong> {selectedParcel.plantedYear ?? 'Non renseignée'}
              </div>
              {selectedParcel.access && (
                <div style={{ fontSize: '12px', color: 'var(--color-forest)', marginTop: '4px' }}>
                  Accès : {selectedParcel.access}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Missions de terrain</h2>
            <span className="badge badge-green">{missions.length} missions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {missions.map((m) => {
              const parcel = state.parcels[m.parcelId];
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMission(m)}
                  style={{
                    padding: '10px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: selectedMission?.id === m.id ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{m.title}</span>
                    <span className={`badge ${m.status === 'in_progress' ? 'badge-green' : m.status === 'completed' ? 'badge-muted' : m.status === 'blocked' ? 'badge-amber' : 'badge-muted'}`}>
                      {m.status === 'in_progress' ? 'En cours' : m.status === 'completed' ? 'Terminée' : m.status === 'blocked' ? 'Bloquée' : m.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                    Parcelle : {parcel?.name ?? m.parcelId} · Campagne {m.campaign}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink)', marginTop: '4px' }}>
                    {m.instructions}
                  </div>
                  {m.operation === 'harvest' && m.status === 'in_progress' && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => setShowCountModal(m)}
                      >
                        + Saisir comptage
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Harvest counts & corrections */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Comptages de récolte & Traçabilité des corrections</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
              Unités explicites (caisses 20 kg). Aucun kilogramme n’est inventé sans pesée séparée.
            </div>
          </div>
          {untransportedCounts.length > 0 && (
            <button
              className="btn btn-sm btn-accent"
              onClick={() => {
                setSelectedCountsForTransport(untransportedCounts.map((c) => c.id));
                setShowTransportModal(true);
              }}
            >
              Créer transport ({untransportedCounts.length} comptage(s))
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Parcelle</th>
                <th>Quantité</th>
                <th>Version</th>
                <th>Statut transport</th>
                <th>Date / Auteur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => {
                const p = state.parcels[c.parcelId];
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.id}</td>
                    <td>{p?.name ?? c.parcelId}</td>
                    <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)' }}>
                      {c.quantity} caisses (20 kg)
                    </td>
                    <td>
                      <span className="badge badge-muted">v{c.version}</span>
                      {c.corrections.length > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--color-ink-muted)', marginLeft: '4px' }}>
                          ({c.corrections.length} correction(s))
                        </span>
                      )}
                    </td>
                    <td>
                      {c.transportId ? (
                        <span className="badge badge-green">Chargé ({c.transportId})</span>
                      ) : (
                        <span className="badge badge-amber">En attente transport</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                      {c.countedAt.slice(0, 16).replace('T', ' ')} · {c.author}
                    </td>
                    <td>
                      {!c.transportId && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setShowCorrectModal(c);
                            setCorrectQty(String(c.quantity));
                          }}
                        >
                          Corriger
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transports & Receptions */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Transports de vendange</h2>
            <span className="badge badge-muted">{transports.length} convois</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {transports.map((t) => (
              <div key={t.id} style={{ padding: '10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{t.code}</span>
                  <span className={`badge ${t.status === 'received' ? 'badge-green' : 'badge-amber'}`}>
                    {t.status === 'received' ? 'Réceptionné' : 'En transit'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                  {t.lines.length} ligne(s) d’origine · Campagne {t.campaign}
                </div>
                {t.status === 'in_transit' && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setShowReceptionModal(t.id);
                        setReceptionTicket(`TK-${t.campaign}-01`);
                      }}
                    >
                      Peser & Réceptionner au chai
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Réceptions au quai de vendange</h2>
            <span className="badge badge-green">{Object.keys(state.receptions).length} réceptions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.values(state.receptions).map((r) => {
              const destLot = state.lots[r.destinationLotId];
              return (
                <div key={r.id} style={{ padding: '10px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>Ticket : {r.ticket}</span>
                    <span className="badge badge-green tabular">Net : {(r.netG / 1000).toLocaleString('fr-FR')} kg</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }} className="tabular">
                    Brut : {(r.grossG / 1000).toLocaleString('fr-FR')} kg · Tare : {(r.tareG / 1000).toLocaleString('fr-FR')} kg
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-forest)', marginTop: '4px', fontWeight: 600 }}>
                    Affecté au lot : {destLot?.name ?? r.destinationLotId}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Saisie Comptage */}
      {showCountModal && (
        <div className="modal-backdrop" onClick={() => setShowCountModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Nouveau comptage terrain — {showCountModal.title}
            </h2>
            <form onSubmit={handleAddCount}>
              <div className="form-group">
                <label className="form-label">Nombre de caisses (20 kg)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  value={countQuantity}
                  onChange={(e) => setCountQuantity(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <p style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginBottom: '16px' }}>
                Enregistré sur cet appareil avec traçabilité d’auteur ({role}).
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCountModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider le comptage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Correction Comptage */}
      {showCorrectModal && (
        <div className="modal-backdrop" onClick={() => setShowCorrectModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Corriger le comptage {showCorrectModal.id} (version courante {showCorrectModal.version})
            </h2>
            <form onSubmit={handleCorrectCount}>
              <div className="form-group">
                <label className="form-label">Nouvelle quantité (actuel : {showCorrectModal.quantity})</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-input"
                  value={correctQty}
                  onChange={(e) => setCorrectQty(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif de correction (obligatoire)</label>
                <textarea
                  className="form-textarea"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  placeholder="Ex : Erreur de pointage au déchargement"
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCorrectModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-accent">
                  Enregistrer la correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Transport */}
      {showTransportModal && (
        <div className="modal-backdrop" onClick={() => setShowTransportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Créer un transport de vendange
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              {selectedCountsForTransport.length} comptage(s) sélectionné(s). Chaque origine est préservée sans mélange silencieux.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTransportModal(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreateTransport}>
                Confirmer l’expédition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réception */}
      {showReceptionModal && (
        <div className="modal-backdrop" onClick={() => setShowReceptionModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
              Réceptionner le transport {showReceptionModal}
            </h2>
            <form onSubmit={handleRecordReception}>
              <div className="form-group">
                <label className="form-label">Numéro de ticket de pesée</label>
                <input
                  type="text"
                  className="form-input"
                  value={receptionTicket}
                  onChange={(e) => setReceptionTicket(e.target.value)}
                  required
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Poids Brut (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    className="form-input"
                    value={grossKg}
                    onChange={(e) => setGrossKg(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tare (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="form-input"
                    value={tareKg}
                    onChange={(e) => setTareKg(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-forest)', fontWeight: 600, marginBottom: '14px' }} className="tabular">
                Poids Net calculé : {Math.max(0, parseFloat(grossKg || '0') - parseFloat(tareKg || '0')).toFixed(1)} kg
              </div>
              <div className="form-group">
                <label className="form-label">Lot de vinification de destination</label>
                <select
                  className="form-select"
                  value={receptionDestLot}
                  onChange={(e) => setReceptionDestLot(e.target.value)}
                >
                  {Object.values(state.lots)
                    .filter((l) => l.stage === 'receiving' || l.stage === 'fermenting')
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} · {l.name} ({l.vintage})
                      </option>
                    ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceptionModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer la pesée
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
