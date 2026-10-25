import React, { useState } from 'react';
import { useStore } from '../../app/store-context';
import { canRun } from '../../domain/commands';
import type { HarvestCount, Mission, MissionStatus, Parcel } from '../../domain/types';

function normalizeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const VineyardView: React.FC = () => {
  const { state, dispatch, role } = useStore();
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>('parcel-a');
  const [parcelSearch, setParcelSearch] = useState('');
  const [colorFilter, setColorFilter] = useState<'all' | 'white' | 'red' | 'mixed'>('all');

  // Modals state
  const [showCountModal, setShowCountModal] = useState<Mission | null>(null);
  const [countQuantity, setCountQuantity] = useState('8');

  const [showCorrectModal, setShowCorrectModal] = useState<HarvestCount | null>(null);
  const [correctQty, setCorrectQty] = useState('');
  const [correctReason, setCorrectReason] = useState('');

  const [showTransportModal, setShowTransportModal] = useState(false);
  const [selectedCountsForTransport, setSelectedCountsForTransport] = useState<string[]>([]);

  const [showReceptionModal, setShowReceptionModal] = useState<string | null>(null);
  const [grossKg, setGrossKg] = useState('250');
  const [tareKg, setTareKg] = useState('30');
  const [receptionTicket, setReceptionTicket] = useState('TK-1024-01');
  const [receptionDestLot, setReceptionDestLot] = useState('lot-2026-red');

  // Observation modal
  const [showObsModal, setShowObsModal] = useState<Parcel | null>(null);
  const [obsText, setObsText] = useState('');
  const [obsMeasureLabel, setObsMeasureLabel] = useState('Maturité réfractométrique');
  const [obsMeasureVal, setObsMeasureVal] = useState('13.4');
  const [obsMeasureUnit, setObsMeasureUnit] = useState('% vol. potentiel');

  if (!state) return null;

  const parcels = Object.values(state.parcels);
  const filteredParcels = parcels.filter((p) => {
    if (colorFilter !== 'all' && p.color !== colorFilter) return false;
    if (!parcelSearch.trim()) return true;
    const q = normalizeAccents(parcelSearch);
    return normalizeAccents(`${p.code} ${p.name} ${p.grape} ${p.owner} ${p.notes}`).includes(q);
  });

  const selectedParcel = (selectedParcelId ? state.parcels[selectedParcelId] : null) ?? parcels[0] ?? null;
  const missions = Object.values(state.missions);
  const counts = Object.values(state.harvestCounts);
  const transports = Object.values(state.transports);
  const observations = Object.values(state.observations);

  const untransportedCounts = counts.filter((c) => c.transportId === null && c.quantity > 0);
  const canEditVineyard = canRun('harvest.count', role);
  const canRecordReception = canRun('reception.record', role);

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
          control: 'Contrôle visuel et réfractométrique conforme à quai (démo)',
          destination: { kind: 'existing', lotId: receptionDestLot },
        },
      });
      setShowReceptionModal(null);
    } catch {
      // Handled
    }
  };

  // Ajout observation
  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showObsModal || !obsText.trim()) return;
    try {
      await dispatch({
        type: 'observation.add',
        payload: {
          parcelId: showObsModal.id,
          missionId: null,
          text: obsText.trim(),
          measure: obsMeasureVal
            ? { label: obsMeasureLabel, value: parseFloat(obsMeasureVal), unit: obsMeasureUnit }
            : null,
        },
      });
      setObsText('');
      setShowObsModal(null);
    } catch {
      // Handled
    }
  };

  // Changement statut mission
  const handleMissionStatus = async (mission: Mission, nextStatus: MissionStatus) => {
    try {
      await dispatch({
        type: 'mission.setStatus',
        payload: {
          missionId: mission.id,
          to: nextStatus,
          reason: nextStatus === 'blocked' ? 'Aléa météo / portance sol signalé' : 'Mise à jour terrain',
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
          <h1 className="page-title">Vignoble & Récolte</h1>
          <p className="page-subtitle">
            Parcellaire synchronisé, travaux annuels, comptages terrain à grand pavé numérique, transports et réceptions pesées au chai.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-green">Campagne 2026</span>
          <span className="badge badge-muted">Kg de raisin ≠ Litres de vin</span>
        </div>
      </div>

      {/* Section 1 : Carte Cadastrale Schématique & Liste Synchronisée */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Plan Parcellaire — Domaine des Trois Coteaux</h2>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Carte et liste synchronisées · Sélectionnez un îlot pour afficher ses caractéristiques
              </div>
            </div>
            <span className="badge badge-muted">Schéma coteaux (sans GPS fictif)</span>
          </div>

          {/* Interactive Topographic & Parcel Map */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '260px',
              background: 'linear-gradient(165deg, #ECE9DF 0%, #DFDBD0 100%)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-strong)',
              overflow: 'hidden',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)',
            }}
          >
            {/* Courbes de niveau topographiques illustratives */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.25, pointerEvents: 'none' }}>
              <path d="M 0 50 Q 180 20, 400 70 T 800 40" fill="none" stroke="#8C8575" strokeWidth="1.5" strokeDasharray="4 4" />
              <path d="M 0 120 Q 220 90, 450 140 T 800 110" fill="none" stroke="#8C8575" strokeWidth="1.5" strokeDasharray="4 4" />
              <path d="M 0 190 Q 200 170, 420 210 T 800 185" fill="none" stroke="#8C8575" strokeWidth="1.5" strokeDasharray="4 4" />
            </svg>

            <div style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '10px', fontWeight: 700, color: 'var(--color-ink-muted)', background: 'rgba(255,255,255,0.75)', padding: '2px 7px', borderRadius: '4px' }}>
              ↑ NORD · Coteau Calcaire (Alt. 240–310m)
            </div>

            {parcels.map((p) => {
              const isSelected = selectedParcel?.id === p.id;
              const bg =
                p.color === 'white'
                  ? '#2E6B55'
                  : p.color === 'red'
                  ? '#694456'
                  : '#7A6855';
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedParcelId(p.id)}
                  style={{
                    position: 'absolute',
                    left: `${p.schematic.x}%`,
                    top: `${p.schematic.y}%`,
                    width: `${p.schematic.w}%`,
                    height: `${p.schematic.h}%`,
                    backgroundColor: bg,
                    color: '#FFFFFF',
                    border: isSelected ? '3px solid #FFFFFF' : '1px solid rgba(255,255,255,0.4)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    textAlign: 'center',
                    boxShadow: isSelected ? '0 0 0 3px var(--color-forest), var(--shadow-md)' : 'var(--shadow-xs)',
                    cursor: 'pointer',
                    transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                    transition: 'all 140ms ease',
                    zIndex: isSelected ? 5 : 1,
                  }}
                  title={`${p.code} — ${p.name}`}
                >
                  <span>{p.code}</span>
                  <span style={{ fontSize: '9.5px', fontWeight: 500, opacity: 0.9 }}>
                    {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surf. inconnue'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Fiche détaillée de la parcelle sélectionnée */}
          {selectedParcel && (
            <div
              style={{
                marginTop: '14px',
                padding: '14px 16px',
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span className="badge badge-green" style={{ marginRight: '8px' }}>
                    {selectedParcel.code}
                  </span>
                  <span className="serif-display" style={{ fontWeight: 700, fontSize: '18px' }}>
                    {selectedParcel.name}
                  </span>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowObsModal(selectedParcel)}
                >
                  + Noter une observation terrain
                </button>
              </div>

              <div className="grid-2" style={{ marginTop: '10px', gap: '8px', fontSize: '13px' }}>
                <div>
                  <strong>Encépagement :</strong> {selectedParcel.grape}
                </div>
                <div>
                  <strong>Surface :</strong>{' '}
                  {selectedParcel.areaM2
                    ? `${(selectedParcel.areaM2.value / 10000).toFixed(2)} ha (${
                        selectedParcel.areaM2.status === 'estimated' ? 'estimée' : 'mesurée'
                      })`
                    : 'Inconnue (≠ 0 ha)'}
                </div>
                <div>
                  <strong>Propriétaire :</strong> {selectedParcel.owner}
                </div>
                <div>
                  <strong>Plantation :</strong> {selectedParcel.plantedYear ?? 'Non renseignée'}
                </div>
              </div>

              {selectedParcel.access && (
                <div style={{ fontSize: '12px', color: 'var(--color-forest)', marginTop: '8px', fontWeight: 600 }}>
                  🚜 Consigne d’accès : {selectedParcel.access}
                </div>
              )}

              {/* Observations associées à cette parcelle */}
              {observations.filter((o) => o.parcelId === selectedParcel.id).length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)', marginBottom: '4px' }}>
                    Observations récentes sur {selectedParcel.name} :
                  </div>
                  {observations
                    .filter((o) => o.parcelId === selectedParcel.id)
                    .map((o) => (
                      <div key={o.id} style={{ fontSize: '12px', color: 'var(--color-ink)', marginBottom: '3px' }}>
                        • {o.text}{' '}
                        {o.measure && (
                          <strong className="tabular" style={{ color: 'var(--color-forest)' }}>
                            ({o.measure.label} : {o.measure.value} {o.measure.unit})
                          </strong>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Liste des Parcelles synchronisée + Filtre sans accents */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header">
              <div>
                <h2 className="card-title">Répertoire Parcellaire Synchronisé</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Recherche tolérante aux accents · Utilisable avec ou sans la carte
                </div>
              </div>
              <span className="badge badge-green">{filteredParcels.length} / {parcels.length} parcelles</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <input
                type="search"
                className="form-input"
                placeholder="Filtrer parcelle, cépage (ex: combe, pinot, moulin)..."
                value={parcelSearch}
                onChange={(e) => setParcelSearch(e.target.value)}
                style={{ flex: 1, minWidth: '180px' }}
              />
              <div className="segmented-control">
                {(['all', 'white', 'red', 'mixed'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`segmented-btn ${colorFilter === c ? 'active' : ''}`}
                    onClick={() => setColorFilter(c)}
                  >
                    {c === 'all' ? 'Toutes' : c === 'white' ? 'Blancs' : c === 'red' ? 'Rouges' : 'Mixte'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredParcels.map((p) => {
                const isSelected = selectedParcel?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedParcelId(p.id)}
                    style={{
                      padding: '11px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '2px solid var(--color-forest)' : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px' }}>{p.name}</span>
                        <span className={`badge ${p.color === 'red' ? 'badge-grape' : p.color === 'white' ? 'badge-green' : 'badge-amber'}`}>
                          {p.code}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                        {p.grape} · Plantée : {p.plantedYear ?? 'Inconnue'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }} className="tabular">
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)' }}>
                        {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surface inconnue'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                        {p.areaM2 ? (p.areaM2.status === 'measured' ? 'Arpentage mesuré' : 'Surface estimée') : 'Inconnu ≠ 0'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 : Missions de Terrain (Vendanges & Travaux Annuels) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="serif-display" style={{ fontSize: '19px', fontWeight: 700 }}>
              Missions de Terrain (Vendanges & Travaux Annuels de la Vigne)
            </h2>
            <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
              Même architecture opérationnelle pour la taille, le relevage et la récolte · Action principale dans la zone du pouce
            </div>
          </div>
          <span className="badge badge-green">{missions.length} missions actives ou planifiées</span>
        </div>

        <div className="grid-3">
          {missions.map((m) => {
            const parcel = state.parcels[m.parcelId];
            const team = m.teamId ? state.teams[m.teamId] : null;
            return (
              <div
                key={m.id}
                style={{
                  padding: '14px 16px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  background: m.status === 'in_progress' ? 'var(--color-bg-elevated)' : 'var(--color-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--color-ink)' }}>{m.title}</span>
                    <span
                      className={`badge ${
                        m.status === 'in_progress'
                          ? 'badge-green'
                          : m.status === 'completed'
                          ? 'badge-muted'
                          : m.status === 'blocked'
                          ? 'badge-amber'
                          : 'badge-muted'
                      }`}
                    >
                      {m.status === 'in_progress'
                        ? '● En cours'
                        : m.status === 'completed'
                        ? '✓ Terminée'
                        : m.status === 'blocked'
                        ? '⚠ Bloquée'
                        : 'Planifiée'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                    <strong>Parcelle :</strong> {parcel?.name ?? m.parcelId} · <strong>Équipe :</strong> {team?.name ?? 'Non assignée'}
                  </div>

                  <div
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--color-ink)',
                      marginTop: '8px',
                      padding: '8px 10px',
                      background: 'var(--color-surface-soft)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {m.instructions}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px solid var(--color-border-subtle)' }}>
                  {m.operation === 'harvest' && m.status === 'in_progress' && (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowCountModal(m)}
                      style={{ flex: 1 }}
                    >
                      + Saisir comptage
                    </button>
                  )}
                  {m.status === 'planned' && canEditVineyard && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleMissionStatus(m, 'in_progress')}
                    >
                      Démarrer la mission
                    </button>
                  )}
                  {m.status === 'in_progress' && canEditVineyard && (
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleMissionStatus(m, 'completed')}
                    >
                      Clôturer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3 : Comptages de récolte & Corrections Versionnées */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Comptages de récolte & Traçabilité des corrections</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
              Unités explicites (caisses 20 kg). Aucun kilogramme n’est inventé sans pesée séparée. Toute correction exige un motif et incrémente la version.
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
              🚜 Créer transport ({untransportedCounts.length} comptage(s))
            </button>
          )}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Réf</th>
                <th>Parcelle d’origine</th>
                <th>Quantité comptée</th>
                <th>Version & Audit</th>
                <th>Statut logistique</th>
                <th>Horodatage & Auteur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => {
                const p = state.parcels[c.parcelId];
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.id}</td>
                    <td style={{ fontWeight: 600 }}>{p?.name ?? c.parcelId}</td>
                    <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)', fontSize: '14.5px' }}>
                      {c.quantity} caisses (20 kg)
                    </td>
                    <td>
                      <span className="badge badge-muted">v{c.version}</span>
                      {c.corrections.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--color-amber)', marginTop: '2px' }}>
                          Corrigé : {c.corrections[c.corrections.length - 1]?.before} → {c.quantity} ({c.corrections[c.corrections.length - 1]?.reason})
                        </div>
                      )}
                    </td>
                    <td>
                      {c.transportId ? (
                        <span className="badge badge-green">✓ Chargé ({c.transportId})</span>
                      ) : (
                        <span className="badge badge-amber">● En attente transport</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }} className="tabular">
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

      {/* Section 4 : Transports & Réceptions Pesées au Quai de Vendange */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Transports de vendange (Vigne → Chai)</h2>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Conservation stricte des lignes parcellaires sans mélange silencieux
              </div>
            </div>
            <span className="badge badge-muted">{transports.length} convois</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {transports.map((t) => {
              const totalCrates = t.lines.reduce((s, l) => s + l.quantity, 0);
              return (
                <div
                  key={t.id}
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: t.status === 'in_transit' ? 'var(--color-amber-soft)' : 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{t.code}</span>
                    <span className={`badge ${t.status === 'received' ? 'badge-green' : 'badge-amber'}`}>
                      {t.status === 'received' ? '✓ Réceptionné au chai' : '🚜 En transit vers le chai'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '4px' }} className="tabular">
                    {t.lines.length} origine(s) parcellaire(s) · <strong>{totalCrates} caisses</strong> transportées · Campagne {t.campaign}
                  </div>
                  {t.status === 'in_transit' && (
                    <div style={{ marginTop: '10px' }}>
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!canRecordReception}
                        onClick={() => {
                          setShowReceptionModal(t.id);
                          setReceptionTicket(`TK-${t.campaign}-${Object.keys(state.receptions).length + 1}`);
                        }}
                      >
                        ⚖️ Peser & Réceptionner au chai
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Réceptions pesées au quai de vendange</h2>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Rapprochement Brut / Tare / Net (kg) avant pressurage ou encuvage
              </div>
            </div>
            <span className="badge badge-green">{Object.keys(state.receptions).length} réceptions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.values(state.receptions).map((r) => {
              const destLot = state.lots[r.destinationLotId];
              return (
                <div
                  key={r.id}
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-soft)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>Ticket : {r.ticket}</span>
                    <span className="badge badge-green tabular">
                      Poids Net : {(r.netG / 1000).toLocaleString('fr-FR')} kg
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }} className="tabular">
                    Brut : {(r.grossG / 1000).toLocaleString('fr-FR')} kg · Tare : {(r.tareG / 1000).toLocaleString('fr-FR')} kg · Contrôle : {r.control}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--color-forest)', marginTop: '6px', fontWeight: 600 }}>
                    🍇 Affecté au lot : {destLot?.code ?? r.destinationLotId} — {destLot?.name ?? ''} (Raisins en kg ≠ Volume en L)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Saisie Comptage — Grand Pavé Numérique Terrain */}
      {showCountModal && (
        <div className="modal-backdrop" onClick={() => setShowCountModal(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
              Nouveau comptage terrain — {showCountModal.title}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Saisie rapide adaptée au soleil et à une main · Unité explicite : Caisses de 20 kg
            </p>
            <form onSubmit={handleAddCount}>
              <div className="form-group">
                <label className="form-label">Nombre de caisses (20 kg)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input tabular"
                  value={countQuantity}
                  onChange={(e) => setCountQuantity(e.target.value)}
                  style={{ fontSize: '26px', fontWeight: 700, textAlign: 'center', height: '56px', color: 'var(--color-forest)' }}
                  required
                  autoFocus
                />
              </div>

              {/* Pavé tactile d'incrémentation rapide */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                {[1, 5, 10, 20].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    className="btn btn-secondary tabular"
                    style={{ fontWeight: 700 }}
                    onClick={() => setCountQuantity(String(Math.max(1, (parseInt(countQuantity || '0', 10) || 0) + inc)))}
                  >
                    +{inc}
                  </button>
                ))}
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  background: 'var(--color-forest-soft)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--color-forest)',
                  marginBottom: '16px',
                }}
              >
                ✓ <strong> Persistance locale immédiate :</strong> Enregistré sur cet appareil avec traçabilité d’auteur ({role}).
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCountModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider le comptage ({countQuantity} caisses)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Observation Terrain */}
      {showObsModal && (
        <div className="modal-backdrop" onClick={() => setShowObsModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
              Nouvelle observation parcellaire — {showObsModal.name}
            </h2>
            <form onSubmit={handleAddObservation}>
              <div className="form-group">
                <label className="form-label">Observation agronomique ou sanitaire</label>
                <textarea
                  className="form-textarea"
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Ex : État sanitaire sain, pépins bruns croquants, pellicule épaisse..."
                  required
                />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Indicateur mesuré</label>
                  <input
                    type="text"
                    className="form-input"
                    value={obsMeasureLabel}
                    onChange={(e) => setObsMeasureLabel(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Valeur</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-input"
                    value={obsMeasureVal}
                    onChange={(e) => setObsMeasureVal(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unité</label>
                  <input
                    type="text"
                    className="form-input"
                    value={obsMeasureUnit}
                    onChange={(e) => setObsMeasureUnit(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowObsModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer l’observation
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
                <label className="form-label">Motif de correction (obligatoire pour audit)</label>
                <textarea
                  className="form-textarea"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  placeholder="Ex : Erreur de pointage au déchargement de la remorque"
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
              {selectedCountsForTransport.length} comptage(s) sélectionné(s). Chaque origine parcellaire est préservée sans mélange silencieux.
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
