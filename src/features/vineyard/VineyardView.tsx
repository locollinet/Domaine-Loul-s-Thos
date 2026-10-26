import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  Sun,
  BookOpen,
  Grape,
  Scale,
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { canRun } from '../../domain/commands';
import type { HarvestCount, Mission, MissionStatus, Parcel } from '../../domain/types';

function normalizeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Enrichissement "Haute Bourgogne & Livret de Vendanges" (inspiré de Parcelles-vendanges / Olivier Leflaive)
interface ClimatLivretMeta {
  classification: 'Grand Cru' | '1er Cru' | 'Village';
  appellation: string;
  commune: string;
  nbRangs: string;
  pageLivret: number;
  pastilleNum: number;
  pinX: number;
  pinY: number;
  terroir: string;
  altitude: string;
}

const CLIMAT_METADATA: Record<string, ClimatLivretMeta> = {
  'parcel-hr': {
    classification: '1er Cru',
    appellation: 'Puligny-Montrachet 1er Cru',
    commune: 'Puligny-Montrachet',
    nbRangs: '42 rangs (28 Chardonnay / 14 Pinot)',
    pageLivret: 12,
    pastilleNum: 1,
    pinX: 28,
    pinY: 32,
    terroir: 'Calcaire à entroques & marnes blanches',
    altitude: '265 m · Exposition Est-Sud-Est',
  },
  'parcel-cc': {
    classification: '1er Cru',
    appellation: 'Chassagne-Montrachet 1er Cru',
    commune: 'Chassagne-Montrachet',
    nbRangs: '34 rangs (Vignes franches)',
    pageLivret: 18,
    pastilleNum: 2,
    pinX: 54,
    pinY: 28,
    terroir: 'Argilo-calcaire sur dalle rocheuse',
    altitude: '250 m · Coteau médian',
  },
  'parcel-cp': {
    classification: 'Grand Cru',
    appellation: 'Bâtard-Montrachet Grand Cru (fictif)',
    commune: 'Puligny-Montrachet',
    nbRangs: '19 rangs (Vieilles vignes)',
    pageLivret: 7,
    pastilleNum: 3,
    pinX: 82,
    pinY: 34,
    terroir: 'Terres brunes profondes & cailloutis calcaires',
    altitude: '240 m · Pied de coteau d’élite',
  },
  'parcel-tb': {
    classification: 'Village',
    appellation: 'Meursault Village',
    commune: 'Meursault',
    nbRangs: '26 rangs',
    pageLivret: 24,
    pastilleNum: 4,
    pinX: 26,
    pinY: 68,
    terroir: 'Marnes calcaires blanches',
    altitude: '235 m',
  },
  'parcel-pp1': {
    classification: '1er Cru',
    appellation: 'Volnay 1er Cru',
    commune: 'Volnay',
    nbRangs: '16 rangs (Clos haut)',
    pageLivret: 31,
    pastilleNum: 5,
    pinX: 50,
    pinY: 60,
    terroir: 'Calcaire oolithique ferrugineux',
    altitude: '280 m',
  },
  'parcel-pp2': {
    classification: '1er Cru',
    appellation: 'Volnay 1er Cru',
    commune: 'Volnay',
    nbRangs: '14 rangs (Clos bas)',
    pageLivret: 31,
    pastilleNum: 6,
    pinX: 50,
    pinY: 82,
    terroir: 'Éboulis calcaires fins',
    altitude: '265 m',
  },
  'parcel-vm': {
    classification: 'Village',
    appellation: 'Auxey-Duresses Village',
    commune: 'Auxey-Duresses',
    nbRangs: '22 rangs (En projet replantation 2027)',
    pageLivret: 38,
    pastilleNum: 7,
    pinX: 80,
    pinY: 74,
    terroir: 'Marnes argilo-calcaires',
    altitude: '295 m',
  },
};

const DEFAULT_CLIMAT_META: ClimatLivretMeta = {
  classification: 'Village',
  appellation: 'Côte de Beaune Village',
  commune: 'Trois Coteaux',
  nbRangs: '24 rangs',
  pageLivret: 10,
  pastilleNum: 1,
  pinX: 50,
  pinY: 50,
  terroir: 'Coteau argilo-calcaire',
  altitude: '250 m',
};

export const VineyardView: React.FC = () => {
  const { state, dispatch, role } = useStore();
  // Navigation par focus métier (Zéro surcharge à l'écran)
  const [subTab, setSubTab] = useState<'atlas' | 'harvest' | 'reception'>('atlas');
  const [fieldMode, setFieldMode] = useState(false);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'cadastre'>('satellite');
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [parcelSearch, setParcelSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'Grand Cru' | '1er Cru' | 'Village'>('all');

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
    const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
    if (levelFilter !== 'all' && meta.classification !== levelFilter) return false;
    if (!parcelSearch.trim()) return true;
    const q = normalizeAccents(parcelSearch);
    return normalizeAccents(`${p.code} ${p.name} ${p.grape} ${meta.appellation} ${meta.commune}`).includes(q);
  });

  const selectedParcel = (selectedParcelId ? state.parcels[selectedParcelId] : null) ?? parcels[0] ?? null;
  const selectedMeta = selectedParcel ? (CLIMAT_METADATA[selectedParcel.id] ?? DEFAULT_CLIMAT_META) : DEFAULT_CLIMAT_META;

  const missions = Object.values(state.missions);
  const counts = Object.values(state.harvestCounts);
  const transports = Object.values(state.transports);

  const untransportedCounts = counts.filter((c) => c.transportId === null && c.quantity > 0);
  const inTransitCount = transports.filter((t) => t.status === 'in_transit').length;
  const canEditVineyard = canRun('harvest.count', role);
  const canRecordReception = canRun('reception.record', role);

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
      // Handled
    }
  };

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
      // Handled
    }
  };

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
          control: 'Contrôle visuel et réfractométrique conforme à quai',
          destination: { kind: 'existing', lotId: receptionDestLot },
        },
      });
      setShowReceptionModal(null);
    } catch {
      // Handled
    }
  };

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

  const handleMissionStatus = async (mission: Mission, nextStatus: MissionStatus) => {
    try {
      await dispatch({
        type: 'mission.setStatus',
        payload: {
          missionId: mission.id,
          to: nextStatus,
          reason: nextStatus === 'blocked' ? 'Aléa météo signalé' : 'Mise à jour terrain',
        },
      });
    } catch {
      // Handled
    }
  };

  const getLevelBadgeClass = (level: string) => {
    if (level === 'Grand Cru') return 'badge-gold';
    if (level === '1er Cru') return 'badge-grape';
    return 'badge-green';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* En-tête épuré avec Switcher par Tâche Métier (Progressive Disclosure) */}
      <div className="page-header" style={{ marginBottom: '0' }}>
        <div>
          <h1 className="page-title">Vignoble & Récolte</h1>
          <p className="page-subtitle">
            Atlas des Climats, livret de vendanges annoté, comptage terrain et quai de réception.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Mode Soleil Terrain (Inspiré de Parcelles-vendanges) */}
          <button
            type="button"
            className={`btn btn-sm ${fieldMode ? 'btn-gold' : 'btn-secondary'}`}
            onClick={() => setFieldMode((v) => !v)}
            title="Activer le contraste élevé pour lecture en plein soleil dans les vignes"
          >
            <Sun size={14} />
            <span>{fieldMode ? 'Mode Soleil Actif' : 'Mode Soleil'}</span>
          </button>

          {/* 3 Vues Ciblées au lieu d'un mur d'informations */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${subTab === 'atlas' ? 'active' : ''}`}
              onClick={() => setSubTab('atlas')}
            >
              <MapPin size={14} />
              <span>1. Atlas & Livret ({parcels.length})</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'harvest' ? 'active' : ''}`}
              onClick={() => setSubTab('harvest')}
            >
              <Grape size={14} />
              <span>2. Missions & Comptage ({counts.length})</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'reception' ? 'active' : ''}`}
              onClick={() => setSubTab('reception')}
            >
              <Scale size={14} />
              <span>3. Quai & Pesées ({inTransitCount} en transit)</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SOUS-VUE 1 : ATLAS DES CLIMATS & LIVRET DE VENDANGES ANNOTÉ
         ===================================================================== */}
      {subTab === 'atlas' && (
        <div className="grid-2 animate-fade-in">
          {/* Colonne Gauche : Carte Satellite / Cadastre Annotée avec Pastille Orange Pulsante */}
          <div
            className="card"
            style={{
              background: fieldMode ? '#141814' : 'var(--color-surface)',
              color: fieldMode ? '#FAF8F5' : 'var(--color-ink)',
              borderColor: fieldMode ? '#C4A47A' : 'var(--color-border)',
            }}
          >
            <div className="card-header" style={{ borderColor: fieldMode ? 'rgba(255,255,255,0.12)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#F97316',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={16} />
                </div>
                <div>
                  <h2 className="card-title" style={{ color: fieldMode ? '#FAF8F5' : undefined, fontSize: '18px' }}>
                    Livret de Vendanges & Repérage Aérien
                  </h2>
                  <div style={{ fontSize: '11.5px', opacity: 0.75 }}>
                    Pastille orange pulsante = point d’entrée exact des coupeurs dans les rangs
                  </div>
                </div>
              </div>

              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
                  onClick={() => setMapLayer('satellite')}
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                >
                  Vue Aérienne Livret
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${mapLayer === 'cadastre' ? 'active' : ''}`}
                  onClick={() => setMapLayer('cadastre')}
                  style={{ fontSize: '11.5px', padding: '4px 10px' }}
                >
                  Plan Cadastral
                </button>
              </div>
            </div>

            {/* Carte Interactive avec Texture Satellite / Cadastre + Anneau de Repérage Orange */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '285px',
                background:
                  mapLayer === 'satellite'
                    ? 'radial-gradient(circle at 35% 40%, #2C3B2B 0%, #1E291D 55%, #161F15 100%)'
                    : 'linear-gradient(165deg, #F3EFE6 0%, #E6E0D2 100%)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(196, 164, 122, 0.4)',
                overflow: 'hidden',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)',
              }}
            >
              {/* Trame de rangs de vigne & chemins de coteaux en SVG */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: mapLayer === 'satellite' ? 0.35 : 0.45, pointerEvents: 'none' }}>
                <defs>
                  <pattern id="vineRows" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke={mapLayer === 'satellite' ? '#8CA87C' : '#9C9480'} strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#vineRows)" />
                {/* Chemins d'exploitation viticoles (Chemin des Perrières / Route des Grands Crus) */}
                <path d="M 0 135 Q 240 115, 480 145 T 800 120" fill="none" stroke={mapLayer === 'satellite' ? '#D6CFC2' : '#FFFFFF'} strokeWidth="5" opacity="0.7" />
                <path d="M 290 0 L 265 300" fill="none" stroke={mapLayer === 'satellite' ? '#D6CFC2' : '#FFFFFF'} strokeWidth="3.5" opacity="0.55" strokeDasharray="6 3" />
              </svg>

              {/* Bandeau d'indication du Livret */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '12px',
                  background: 'rgba(20, 24, 20, 0.82)',
                  backdropFilter: 'blur(6px)',
                  color: '#FAF8F5',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid rgba(196, 164, 122, 0.35)',
                  zIndex: 10,
                }}
              >
                <Compass size={12} style={{ color: '#C4A47A' }} />
                <span>Livret p.{selectedMeta.pageLivret} · Pastille n°{selectedMeta.pastilleNum}</span>
              </div>

              {/* Polygones des Climats */}
              {parcels.map((p) => {
                const isSelected = selectedParcel?.id === p.id;
                const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
                const fillBg =
                  meta.classification === 'Grand Cru'
                    ? 'rgba(196, 164, 122, 0.82)'
                    : meta.classification === '1er Cru'
                    ? 'rgba(107, 33, 40, 0.82)'
                    : 'rgba(45, 74, 54, 0.82)';

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedParcelId(p.id)}
                    style={{
                      position: 'absolute',
                      left: `${p.schematic.x}%`,
                      top: `${p.schematic.y}%`,
                      width: `${p.schematic.w}%`,
                      height: `${p.schematic.h}%`,
                      background: fillBg,
                      color: meta.classification === 'Grand Cru' ? '#1E221E' : '#FFFFFF',
                      border: isSelected ? '2.5px solid #FFFFFF' : '1px solid rgba(255,255,255,0.45)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      cursor: 'pointer',
                      transition: 'all 160ms ease',
                      transform: isSelected ? 'scale(1.04)' : 'scale(1)',
                      zIndex: isSelected ? 6 : 2,
                      boxShadow: isSelected ? '0 6px 18px rgba(0,0,0,0.35)' : '0 2px 5px rgba(0,0,0,0.15)',
                    }}
                    title={`${p.name} (${meta.appellation})`}
                  >
                    <span style={{ fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.02em' }}>{p.code}</span>
                    <span style={{ fontSize: '9.5px', opacity: 0.9 }}>
                      {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Inconnu'}
                    </span>
                  </button>
                );
              })}

              {/* Anneau de repérage Orange Pulsant (Exactement comme dans Parcelles-vendanges !) */}
              {selectedParcel && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${selectedParcel.schematic.x + selectedParcel.schematic.w / 2}%`,
                    top: `${selectedParcel.schematic.y + selectedParcel.schematic.h / 2}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    zIndex: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    className="pin-orange-ring"
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      border: '3px solid #F97316',
                      background: 'rgba(249, 115, 22, 0.18)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '-20px',
                      background: '#F97316',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    }}
                  >
                    n°{selectedMeta.pastilleNum}
                  </div>
                </div>
              )}
            </div>

            {/* Fiche Synthétique du Climat Sélectionné (Style BottomSheet Parcelles-vendanges) */}
            {selectedParcel && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '16px',
                  background: fieldMode ? '#1E241E' : 'var(--color-bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span className={`badge ${getLevelBadgeClass(selectedMeta.classification)}`}>
                        ★ {selectedMeta.classification}
                      </span>
                      <span className="badge badge-muted">Livret p.{selectedMeta.pageLivret}</span>
                      <span className="badge badge-amber">Pastille n°{selectedMeta.pastilleNum}</span>
                    </div>
                    <h3 className="serif-display" style={{ fontSize: '22px', fontWeight: 600 }}>
                      {selectedParcel.name} ({selectedParcel.code})
                    </h3>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-gold-dark)', fontWeight: 600 }}>
                      {selectedMeta.appellation} · {selectedMeta.commune}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowObsModal(selectedParcel)}
                    >
                      <Plus size={13} />
                      <span>Observation</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setSubTab('harvest')}
                    >
                      <Grape size={13} />
                      <span>Vendanger</span>
                    </button>
                  </div>
                </div>

                {/* 3 Infos Terrain Essentielles avec Icônes (Zéro texte superflu) */}
                <div className="grid-3" style={{ marginTop: '12px', gap: '10px' }}>
                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Rangs & Surface
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px' }}>
                      {selectedMeta.nbRangs}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }} className="tabular">
                      {selectedParcel.areaM2 ? `${(selectedParcel.areaM2.value / 10000).toFixed(2)} ha (${selectedParcel.areaM2.status === 'measured' ? 'mesurée' : 'estimée'})` : 'Surface inconnue (≠ 0)'}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Terroir & Géologie
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px' }}>
                      {selectedMeta.terroir}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                      {selectedMeta.altitude}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Consigne d’Accès Fourgon
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px', color: 'var(--color-forest)' }}>
                      {selectedParcel.access ?? 'Accès par le chemin communal haut'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                      Plantation : {selectedParcel.plantedYear ?? 'Non renseignée'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Colonne Droite : Répertoire des Climats Filtrable par Niveau d'Appellation */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Répertoire Parcellaire Synchronisé</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Filtrez par niveau d’appellation (Grand Cru, 1er Cru, Village) ou nom de Climat
                </div>
              </div>
              <span className="badge badge-gold">{filteredParcels.length} Climats</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <input
                type="search"
                className="form-input"
                placeholder="Rechercher un Climat, commune, cépage..."
                value={parcelSearch}
                onChange={(e) => setParcelSearch(e.target.value)}
                style={{ flex: 1, minWidth: '170px' }}
              />
              <div className="segmented-control">
                {(['all', 'Grand Cru', '1er Cru', 'Village'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    className={`segmented-btn ${levelFilter === lvl ? 'active' : ''}`}
                    onClick={() => setLevelFilter(lvl)}
                    style={{ fontSize: '11.5px', padding: '5px 10px' }}
                  >
                    {lvl === 'all' ? 'Tous' : lvl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredParcels.map((p) => {
                const isSelected = selectedParcel?.id === p.id;
                const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedParcelId(p.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-gold-soft)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 140ms ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isSelected ? '#F97316' : 'var(--color-surface-soft)',
                          color: isSelected ? '#FFFFFF' : 'var(--color-ink)',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        title={`Pastille n°${meta.pastilleNum} sur le livret`}
                      >
                        {meta.pastilleNum}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="serif-display" style={{ fontWeight: 600, fontSize: '17px' }}>
                            {p.name}
                          </span>
                          <span className={`badge ${getLevelBadgeClass(meta.classification)}`}>
                            {meta.classification}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-light)' }}>
                            {p.code}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                          {meta.appellation} · {meta.nbRangs}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }} className="tabular">
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)' }}>
                        {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surface inconnue'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                        Livret p.{meta.pageLivret}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SOUS-VUE 2 : MISSIONS DE VENDANGES & COMPTAGE TERRAIN
         ===================================================================== */}
      {subTab === 'harvest' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Missions de Vendanges & Travaux du Vignoble</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Action principale accessible au pouce · Comptage immédiat des caisses de 20 kg
                </div>
              </div>
              <span className="badge badge-green">{missions.length} missions</span>
            </div>

            <div className="grid-3">
              {missions.map((m) => {
                const parcel = state.parcels[m.parcelId];
                const team = m.teamId ? state.teams[m.teamId] : null;
                return (
                  <div
                    key={m.id}
                    style={{
                      padding: '16px',
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
                        <span className="serif-display" style={{ fontWeight: 600, fontSize: '18px' }}>
                          {m.title}
                        </span>
                        <span
                          className={`badge ${
                            m.status === 'in_progress'
                              ? 'badge-green'
                              : m.status === 'completed'
                              ? 'badge-muted'
                              : 'badge-amber'
                          }`}
                        >
                          {m.status === 'in_progress' ? (
                            <>
                              <Clock size={11} /> En cours
                            </>
                          ) : m.status === 'completed' ? (
                            <>
                              <CheckCircle2 size={11} /> Terminée
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={11} /> {m.status}
                            </>
                          )}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }}>
                        <strong>Climat :</strong> {parcel?.name ?? m.parcelId} · <strong>Équipe :</strong> {team?.name ?? 'Non assignée'}
                      </div>

                      <div style={{ fontSize: '12.5px', color: 'var(--color-ink)', marginTop: '8px', padding: '8px 10px', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-xs)' }}>
                        {m.instructions}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {m.operation === 'harvest' && m.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setShowCountModal(m)}
                          style={{ flex: 1 }}
                        >
                          <Plus size={14} />
                          <span>Saisir comptage</span>
                        </button>
                      )}
                      {m.status === 'planned' && canEditVineyard && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleMissionStatus(m, 'in_progress')}>
                          Démarrer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Comptages de récolte & Traçabilité des corrections</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Caisses de 20 kg · Toute correction incrémente la version avec motif obligatoire
                </div>
              </div>
              {untransportedCounts.length > 0 && (
                <button
                  className="btn btn-sm btn-gold"
                  onClick={() => {
                    setSelectedCountsForTransport(untransportedCounts.map((c) => c.id));
                    setShowTransportModal(true);
                  }}
                >
                  <Truck size={14} />
                  <span>Créer transport ({untransportedCounts.length} comptage(s))</span>
                </button>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Climat d’origine</th>
                    <th>Quantité</th>
                    <th>Version</th>
                    <th>Statut transport</th>
                    <th>Auteur</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => {
                    const p = state.parcels[c.parcelId];
                    return (
                      <tr key={c.id}>
                        <td className="font-mono-metric" style={{ fontWeight: 600 }}>{c.id}</td>
                        <td style={{ fontWeight: 600 }}>{p?.name ?? c.parcelId}</td>
                        <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)' }}>
                          {c.quantity} caisses (20 kg)
                        </td>
                        <td>
                          <span className="badge badge-muted">v{c.version}</span>
                          {c.corrections.length > 0 && (
                            <span style={{ fontSize: '11px', color: 'var(--color-amber)', marginLeft: '6px' }}>
                              ({c.corrections[c.corrections.length - 1]?.before} → {c.quantity})
                            </span>
                          )}
                        </td>
                        <td>
                          {c.transportId ? (
                            <span className="badge badge-green">Chargé ({c.transportId})</span>
                          ) : (
                            <span className="badge badge-amber">En attente convoi</span>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>{c.author}</td>
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
        </div>
      )}

      {/* =====================================================================
          SOUS-VUE 3 : QUAI DE RÉCEPTION & PESÉES AU CHAI
         ===================================================================== */}
      {subTab === 'reception' && (
        <div className="grid-2 animate-fade-in">
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Convois de Vendange (Vigne → Chai)</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Origines parcellaires isolées jusqu’au quai de réception
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
                      padding: '14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      background: t.status === 'in_transit' ? 'var(--color-amber-soft)' : 'var(--color-surface)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{t.code}</span>
                      <span className={`badge ${t.status === 'received' ? 'badge-green' : 'badge-amber'}`}>
                        {t.status === 'received' ? '✓ Réceptionné' : 'En transit'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginTop: '4px' }} className="tabular">
                      {t.lines.length} ligne(s) d’origine · <strong>{totalCrates} caisses</strong>
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
                          <Scale size={13} />
                          <span>Peser & Réceptionner au chai</span>
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
                <h2 className="card-title">Tickets de Pesée à Quai (Brut − Tare = Net)</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Affectation au lot de vinification sans conversion magique kg → L
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
                      padding: '14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface-soft)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>Ticket {r.ticket}</span>
                      <span className="badge badge-green tabular">
                        Net : {(r.netG / 1000).toLocaleString('fr-FR')} kg
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '4px' }} className="tabular">
                      Brut : {(r.grossG / 1000).toLocaleString('fr-FR')} kg · Tare : {(r.tareG / 1000).toLocaleString('fr-FR')} kg
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-forest)', marginTop: '6px', fontWeight: 600 }}>
                      Affecté au lot : {destLot?.code ?? r.destinationLotId} — {destLot?.name ?? ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Saisie Comptage — Grand Pavé Numérique Terrain */}
      {showCountModal && (
        <div className="modal-backdrop" onClick={() => setShowCountModal(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '4px' }}>
              Comptage Terrain — {showCountModal.title}
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Unité explicite : Caisses de 20 kg · Saisie à une main
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
                  style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', height: '56px' }}
                  required
                  autoFocus
                />
              </div>

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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCountModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider ({countQuantity} caisses)
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
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>
              Observation Climat — {showObsModal.name}
            </h2>
            <form onSubmit={handleAddObservation}>
              <div className="form-group">
                <label className="form-label">Note agronomique ou sanitaire</label>
                <textarea
                  className="form-textarea"
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Ex : État sanitaire sain, pépins bruns..."
                  required
                />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Indicateur</label>
                  <input type="text" className="form-input" value={obsMeasureLabel} onChange={(e) => setObsMeasureLabel(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Valeur</label>
                  <input type="number" step="0.1" className="form-input" value={obsMeasureVal} onChange={(e) => setObsMeasureVal(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unité</label>
                  <input type="text" className="form-input" value={obsMeasureUnit} onChange={(e) => setObsMeasureUnit(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowObsModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer
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
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 600, marginBottom: '14px' }}>
              Corriger le comptage {showCorrectModal.id} (v{showCorrectModal.version})
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
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 600, marginBottom: '14px' }}>
              Créer un convoi de vendange
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              {selectedCountsForTransport.length} comptage(s) sélectionné(s).
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
            <h2 className="serif-display" style={{ fontSize: '20px', fontWeight: 600, marginBottom: '14px' }}>
              Réceptionner le transport {showReceptionModal}
            </h2>
            <form onSubmit={handleRecordReception}>
              <div className="form-group">
                <label className="form-label">Numéro de ticket de pesée</label>
                <input type="text" className="form-input" value={receptionTicket} onChange={(e) => setReceptionTicket(e.target.value)} required />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Poids Brut (kg)</label>
                  <input type="number" step="0.5" min="1" className="form-input" value={grossKg} onChange={(e) => setGrossKg(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Tare (kg)</label>
                  <input type="number" step="0.5" min="0" className="form-input" value={tareKg} onChange={(e) => setTareKg(e.target.value)} required />
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-forest)', fontWeight: 600, marginBottom: '14px' }} className="tabular">
                Poids Net calculé : {Math.max(0, parseFloat(grossKg || '0') - parseFloat(tareKg || '0')).toFixed(1)} kg
              </div>
              <div className="form-group">
                <label className="form-label">Lot de vinification de destination</label>
                <select className="form-select" value={receptionDestLot} onChange={(e) => setReceptionDestLot(e.target.value)}>
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
