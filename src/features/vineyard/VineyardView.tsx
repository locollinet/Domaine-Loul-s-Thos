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
  Calendar,
  Navigation,
  Crosshair,
  Wine,
  Droplets,
  Layers,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { canRun } from '../../domain/commands';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';
import type { HarvestCount, Mission, MissionStatus, Parcel } from '../../domain/types';

function normalizeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Enrichissement "Haute Bourgogne & Livret de Vendanges" (inspiré de Parcelles-vendanges / Olivier Leflaive)
interface ClimatLivretMeta {
  classification: 'Grand Cru' | '1er Cru' | 'Village';
  appellation: string;
  commune: string;
  sectionCadastrale: string;
  nbRangs: string;
  pageLivret: number;
  pastilleNum: number;
  lat: number;
  lng: number;
  pinX: number;
  pinY: number;
  terroir: string;
  altitude: string;
  defaultDaySlot: 'today' | 'tomorrow' | 'upcoming' | 'done';
  defaultStatus: 'a_faire' | 'en_cours' | 'vendange';
  initialHl: number;
  linkedLotIds: string[];
}

const CLIMAT_METADATA: Record<string, ClimatLivretMeta> = {
  'parcel-hr': {
    classification: '1er Cru',
    appellation: 'Puligny-Montrachet 1er Cru',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AB n°0142 (Subdivision Rangs 1–42)',
    nbRangs: '42 rangs (28 Chardonnay / 14 Pinot)',
    pageLivret: 12,
    pastilleNum: 1,
    lat: 46.94782,
    lng: 4.73891,
    pinX: 24,
    pinY: 32,
    terroir: 'Calcaire à entroques & marnes blanches',
    altitude: '265 m · Exposition Est-Sud-Est',
    defaultDaySlot: 'done',
    defaultStatus: 'vendange',
    initialHl: 1.5,
    linkedLotIds: ['lot-2026-white', 'lot-2024-white', 'lot-2023-white'],
  },
  'parcel-cc': {
    classification: '1er Cru',
    appellation: 'Chassagne-Montrachet 1er Cru',
    commune: 'Chassagne-Montrachet (INSEE 21150)',
    sectionCadastrale: 'Section AD n°0088 (Coteau médian)',
    nbRangs: '34 rangs (Vignes franches)',
    pageLivret: 18,
    pastilleNum: 2,
    lat: 46.93914,
    lng: 4.72845,
    pinX: 54,
    pinY: 28,
    terroir: 'Argilo-calcaire sur dalle rocheuse',
    altitude: '250 m · Coteau médian',
    defaultDaySlot: 'done',
    defaultStatus: 'vendange',
    initialHl: 1.8,
    linkedLotIds: ['lot-2026-red', 'lot-2025-r1'],
  },
  'parcel-cp': {
    classification: 'Grand Cru',
    appellation: 'Bâtard-Montrachet Grand Cru (fictif)',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AC n°0019 (Clos cadastré)',
    nbRangs: '19 rangs (Vieilles vignes)',
    pageLivret: 7,
    pastilleNum: 3,
    lat: 46.94465,
    lng: 4.74218,
    pinX: 82,
    pinY: 34,
    terroir: 'Terres brunes profondes & cailloutis calcaires',
    altitude: '240 m · Pied de coteau d’élite',
    defaultDaySlot: 'today',
    defaultStatus: 'en_cours',
    initialHl: 1.62,
    linkedLotIds: ['lot-2025-r2'],
  },
  'parcel-vm': {
    classification: 'Village',
    appellation: 'Meursault Village',
    commune: 'Meursault (INSEE 21412)',
    sectionCadastrale: 'Section BE n°0214 (Lieu-dit du Moulin)',
    nbRangs: '22 rangs (Vendange demain + projet 2027)',
    pageLivret: 38,
    pastilleNum: 4,
    lat: 46.97612,
    lng: 4.76904,
    pinX: 78,
    pinY: 74,
    terroir: 'Marnes argilo-calcaires',
    altitude: '295 m',
    defaultDaySlot: 'tomorrow',
    defaultStatus: 'a_faire',
    initialHl: 0,
    linkedLotIds: [],
  },
};

const DEFAULT_CLIMAT_META: ClimatLivretMeta = {
  classification: 'Village',
  appellation: 'Côte de Beaune Village',
  commune: 'Puligny-Montrachet (INSEE 21512)',
  sectionCadastrale: 'Section AB n°0105',
  nbRangs: '24 rangs',
  pageLivret: 10,
  pastilleNum: 5,
  lat: 46.9451,
  lng: 4.7395,
  pinX: 50,
  pinY: 50,
  terroir: 'Coteau argilo-calcaire',
  altitude: '250 m',
  defaultDaySlot: 'upcoming',
  defaultStatus: 'a_faire',
  initialHl: 0,
  linkedLotIds: [],
};

interface CustomParcelTracking {
  daySlot: 'today' | 'tomorrow' | 'upcoming' | 'done';
  status: 'a_faire' | 'en_cours' | 'vendange';
  extraCaisses: number;
  extraKg: number;
  extraHl: number;
  customPin?: { xPct: number; yPct: number; lat: number; lng: number };
}

export const VineyardView: React.FC = () => {
  const { state, dispatch, role } = useStore();
  // Navigation simple en 3 onglets clairs (Zéro surcharge à l'écran)
  const [subTab, setSubTab] = useState<'atlas' | 'harvest' | 'reception'>('atlas');
  const [fieldMode, setFieldMode] = useState(false);
  const [mapLayer, setMapLayer] = useState<'satellite' | 'cadastre'>('satellite');
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [parcelSearch, setParcelSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'Grand Cru' | '1er Cru' | 'Village'>('all');

  // Mode "Repositionnement Point GPS Domaine" (On-top du cadastre et du livret)
  const [isEditingGpsPin, setIsEditingGpsPin] = useState(false);
  const [parcelTracking, setParcelTracking] = useState<Record<string, CustomParcelTracking>>({});

  // Pilotage Vendanges : Horizon (Aujourd'hui / Demain / Jours à venir / Toutes) & Unité (Caisses / kg / hL)
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'today' | 'tomorrow' | 'upcoming' | 'done'>('all');
  const [unitMode, setUnitMode] = useState<'caisses' | 'kg' | 'hl'>('caisses');

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
  const missions = Object.values(state.missions);
  const counts = Object.values(state.harvestCounts);
  const transports = Object.values(state.transports);
  const receptions = Object.values(state.receptions);

  const getParcelTrack = (p: Parcel): CustomParcelTracking => {
    const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
    return (
      parcelTracking[p.id] ?? {
        daySlot: meta.defaultDaySlot,
        status: meta.defaultStatus,
        extraCaisses: 0,
        extraKg: 0,
        extraHl: 0,
      }
    );
  };

  // Calcul des quantités réelles (Caisses, kg pesés ou estimés, hL écoulés/estimés) par parcelle
  const getParcelHarvestMetrics = (p: Parcel) => {
    const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
    const track = getParcelTrack(p);
    const parcelMissionIds = missions.filter((m) => m.parcelId === p.id).map((m) => m.id);
    const parcelCounts = counts.filter((c) => parcelMissionIds.includes(c.missionId));
    const baseCaisses = parcelCounts.reduce((acc, c) => acc + c.quantity, 0);
    const totalCaisses = Math.max(0, baseCaisses + track.extraCaisses);

    // Réceptions liées aux transports de cette parcelle
    const transportIds = new Set(parcelCounts.map((c) => c.transportId).filter(Boolean));
    const parcelReceptions = receptions.filter((r) => transportIds.has(r.transportId));
    const weighedKg = parcelReceptions.reduce((acc, r) => acc + r.netG / 1000, 0);
    const baseKg = weighedKg > 0 ? weighedKg : baseCaisses * 18;
    const totalKg = Math.max(0, Math.round(baseKg + track.extraKg));

    const totalHl = Math.max(0, parseFloat((meta.initialHl + track.extraHl).toFixed(2)));

    return {
      totalCaisses,
      totalKg,
      totalHl,
      weighedKg,
      parcelReceptions,
      linkedLots: meta.linkedLotIds.map((id) => state.lots[id]).filter(Boolean),
    };
  };

  const filteredParcels = parcels.filter((p) => {
    const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
    if (levelFilter !== 'all' && meta.classification !== levelFilter) return false;
    if (!parcelSearch.trim()) return true;
    const q = normalizeAccents(parcelSearch);
    return normalizeAccents(`${p.code} ${p.name} ${p.grape} ${meta.appellation} ${meta.commune}`).includes(q);
  });

  const selectedParcel = (selectedParcelId ? state.parcels[selectedParcelId] : null) ?? parcels[0] ?? null;
  const selectedMeta = selectedParcel ? (CLIMAT_METADATA[selectedParcel.id] ?? DEFAULT_CLIMAT_META) : DEFAULT_CLIMAT_META;
  const selectedTrack = selectedParcel ? getParcelTrack(selectedParcel) : null;
  const selectedMetrics = selectedParcel ? getParcelHarvestMetrics(selectedParcel) : null;

  // Coordonnées GPS effectives (Point GPS Domaine prioritaire sur le centre cadastral)
  const effectivePin = selectedParcel
    ? selectedTrack?.customPin ?? {
        xPct: selectedParcel.schematic.x + selectedParcel.schematic.w / 2,
        yPct: selectedParcel.schematic.y + selectedParcel.schematic.h / 2,
        lat: selectedMeta.lat,
        lng: selectedMeta.lng,
      }
    : { xPct: 50, yPct: 50, lat: 46.9478, lng: 4.7389 };

  const handleMapClickForCustomPin = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isEditingGpsPin || !selectedParcel) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(4, Math.min(96, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const yPct = Math.max(6, Math.min(94, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    // Conversion fine vers GPS autour du climat (précision métrique d'entrée de rang)
    const latOffset = ((50 - yPct) * 0.00008);
    const lngOffset = ((xPct - 50) * 0.00011);
    const newLat = parseFloat((selectedMeta.lat + latOffset).toFixed(5));
    const newLng = parseFloat((selectedMeta.lng + lngOffset).toFixed(5));

    const current = getParcelTrack(selectedParcel);
    setParcelTracking((prev) => ({
      ...prev,
      [selectedParcel.id]: {
        ...current,
        customPin: { xPct, yPct, lat: newLat, lng: newLng },
      },
    }));
    setIsEditingGpsPin(false);
  };

  const updateParcelTrack = (parcel: Parcel, patch: Partial<CustomParcelTracking>) => {
    const current = getParcelTrack(parcel);
    setParcelTracking((prev) => ({
      ...prev,
      [parcel.id]: {
        ...current,
        ...patch,
      },
    }));
  };

  const adjustParcelUnit = (parcel: Parcel, delta: number) => {
    const current = getParcelTrack(parcel);
    if (unitMode === 'caisses') {
      updateParcelTrack(parcel, {
        extraCaisses: current.extraCaisses + delta,
        status: current.status === 'a_faire' && delta > 0 ? 'en_cours' : current.status,
      });
    } else if (unitMode === 'kg') {
      updateParcelTrack(parcel, {
        extraKg: current.extraKg + delta,
        status: current.status === 'a_faire' && delta > 0 ? 'en_cours' : current.status,
      });
    } else {
      updateParcelTrack(parcel, {
        extraHl: parseFloat((current.extraHl + delta).toFixed(2)),
        status: current.status === 'a_faire' && delta > 0 ? 'en_cours' : current.status,
      });
    }
  };

  const untransportedCounts = counts.filter((c) => c.transportId === null && c.quantity > 0);
  const inTransitCount = transports.filter((t) => t.status === 'in_transit').length;
  const canEditVineyard = canRun('harvest.count', role);
  const canRecordReception = canRun('reception.record', role);

  // Statistiques globales du tableau de bord Vendanges (Caisses + kg + hL)
  const globalHarvestStats = parcels.reduce(
    (acc, p) => {
      const tr = getParcelTrack(p);
      const m = getParcelHarvestMetrics(p);
      if (tr.status === 'vendange') acc.doneCount += 1;
      else if (tr.status === 'en_cours') acc.inProgressCount += 1;
      else acc.todoCount += 1;
      acc.caisses += m.totalCaisses;
      acc.kg += m.totalKg;
      acc.hl = parseFloat((acc.hl + m.totalHl).toFixed(2));
      return acc;
    },
    { doneCount: 0, inProgressCount: 0, todoCount: 0, caisses: 0, kg: 0, hl: 0 }
  );

  const scheduledParcels = parcels.filter((p) => {
    if (scheduleFilter === 'all') return true;
    return getParcelTrack(p).daySlot === scheduleFilter;
  });

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
      {/* En-tête épuré avec Switcher simple en 3 vues métier */}
      <div className="page-header" style={{ marginBottom: '0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span className="badge badge-gold">Cadastre Communal Ciblé (IGN)</span>
            <span className="badge badge-green">Points GPS Domaine ±1m</span>
            <span className="badge badge-grape">Suivi Caisses · kg · hL</span>
          </div>
          <h1 className="page-title">Vignoble & Récolte</h1>
          <p className="page-subtitle">
            Atlas cadastral et points GPS du domaine, planning des vendanges (Aujourd’hui / Demain / À venir) et continuité directe vers la cuverie.
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

          {/* 3 Vues Ciblées simples et lisibles */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${subTab === 'atlas' ? 'active' : ''}`}
              onClick={() => setSubTab('atlas')}
            >
              <MapPin size={14} />
              <span>1. Atlas, GPS & Livret ({parcels.length})</span>
            </button>
            <button
              type="button"
              className={`segmented-btn ${subTab === 'harvest' ? 'active' : ''}`}
              onClick={() => setSubTab('harvest')}
            >
              <Calendar size={14} />
              <span>2. Planning & Vendanges ({counts.length})</span>
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
          SOUS-VUE 1 : ATLAS CADASTRAL CIBLÉ, POINTS GPS DOMAINE & LIVRET
         ===================================================================== */}
      {subTab === 'atlas' && (
        <div className="grid-2 animate-fade-in">
          {/* Colonne Gauche : Carte Satellite / Cadastre + Point GPS Personnalisable + Suite Cuverie */}
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
                    Cadastre Communal & Point GPS Domaine
                  </h2>
                  <div style={{ fontSize: '11.5px', opacity: 0.78 }}>
                    Chargement léger par commune INSEE (Puligny, Chassagne, Meursault) + Point GPS d’entrée de rang posé par le domaine
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${isEditingGpsPin ? 'btn-gold' : 'btn-secondary'}`}
                  onClick={() => setIsEditingGpsPin((v) => !v)}
                  title="Cliquer sur la carte pour poser un point GPS précis d'entrée de rang (prioritaire sur le cadastre)"
                >
                  <Crosshair size={13} />
                  <span>{isEditingGpsPin ? 'Cliquez sur la carte...' : 'Poser Point GPS'}</span>
                </button>

                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
                    onClick={() => setMapLayer('satellite')}
                    style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    Satellite + Livret
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${mapLayer === 'cadastre' ? 'active' : ''}`}
                    onClick={() => setMapLayer('cadastre')}
                    style={{ fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    Cadastre IGN
                  </button>
                </div>
              </div>
            </div>

            {/* Carte Interactive avec Texture Satellite / Cadastre + Anneau de Repérage Orange + Point GPS Domaine */}
            <div
              onClick={handleMapClickForCustomPin}
              style={{
                position: 'relative',
                width: '100%',
                height: '285px',
                background:
                  mapLayer === 'satellite'
                    ? 'radial-gradient(circle at 35% 40%, #2C3B2B 0%, #1E291D 55%, #161F15 100%)'
                    : 'linear-gradient(165deg, #F3EFE6 0%, #E6E0D2 100%)',
                borderRadius: 'var(--radius-md)',
                border: isEditingGpsPin ? '2px dashed #F97316' : '1px solid rgba(196, 164, 122, 0.4)',
                overflow: 'hidden',
                cursor: isEditingGpsPin ? 'crosshair' : 'default',
                boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)',
              }}
            >
              {/* Trame de rangs de vigne & limites cadastrales en SVG */}
              <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: mapLayer === 'satellite' ? 0.35 : 0.55, pointerEvents: 'none' }}>
                <defs>
                  <pattern id="vineRows" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(22)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke={mapLayer === 'satellite' ? '#8CA87C' : '#9C9480'} strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#vineRows)" />
                <path d="M 0 135 Q 240 115, 480 145 T 800 120" fill="none" stroke={mapLayer === 'satellite' ? '#D6CFC2' : '#FFFFFF'} strokeWidth="5" opacity="0.7" />
                <path d="M 290 0 L 265 300" fill="none" stroke={mapLayer === 'satellite' ? '#D6CFC2' : '#FFFFFF'} strokeWidth="3.5" opacity="0.55" strokeDasharray="6 3" />
              </svg>

              {/* Bandeau d'indication du Livret & Coordonnées GPS Exactes */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '12px',
                  right: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  zIndex: 10,
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(20, 24, 20, 0.85)',
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
                  }}
                >
                  <Compass size={12} style={{ color: '#C4A47A' }} />
                  <span>Livret p.{selectedMeta.pageLivret} · Pastille n°{selectedMeta.pastilleNum}</span>
                </div>

                <div
                  className="tabular"
                  style={{
                    background: selectedTrack?.customPin ? 'rgba(249, 115, 22, 0.92)' : 'rgba(20, 24, 20, 0.85)',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  GPS : {effectivePin.lat.toFixed(5)}° N, {effectivePin.lng.toFixed(5)}° E{' '}
                  {selectedTrack?.customPin ? '★ Point Domaine' : '(Cadastre + Livret)'}
                </div>
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
                    onClick={(ev) => {
                      if (isEditingGpsPin) return;
                      ev.stopPropagation();
                      setSelectedParcelId(p.id);
                    }}
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
                      cursor: isEditingGpsPin ? 'crosshair' : 'pointer',
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

              {/* Anneau de repérage Orange Pulsant sur le Point GPS Exact (Livret ou Point Domaine posé au clic) */}
              {selectedParcel && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${effectivePin.xPct}%`,
                    top: `${effectivePin.yPct}%`,
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
                      background: 'rgba(249, 115, 22, 0.22)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '-22px',
                      background: '#F97316',
                      color: '#FFFFFF',
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '1px 7px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    }}
                  >
                    n°{selectedMeta.pastilleNum} {selectedTrack?.customPin ? '· GPS Domaine' : ''}
                  </div>
                </div>
              )}
            </div>

            {/* Fiche du Climat Sélectionné + Continuité Post-Vendange ("Ce qu'il se passe par la suite") */}
            {selectedParcel && selectedMetrics && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '16px',
                  background: fieldMode ? '#1E241E' : 'var(--color-bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span className={`badge ${getLevelBadgeClass(selectedMeta.classification)}`}>
                        ★ {selectedMeta.classification}
                      </span>
                      <span className="badge badge-muted">{selectedMeta.sectionCadastrale}</span>
                      <span className="badge badge-amber">Pastille n°{selectedMeta.pastilleNum}</span>
                    </div>
                    <h3 className="serif-display" style={{ fontSize: '22px', fontWeight: 600 }}>
                      {selectedParcel.name} ({selectedParcel.code})
                    </h3>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-gold-dark)', fontWeight: 600 }}>
                      {selectedMeta.appellation} · {selectedMeta.commune}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${effectivePin.lat},${effectivePin.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ textDecoration: 'none' }}
                      title="Ouvrir le guidage GPS direct vers le point d'entrée du rang"
                    >
                      <Navigation size={13} />
                      <span>Guidage GPS</span>
                    </a>
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
                      <span>Pilotage Vendange</span>
                    </button>
                  </div>
                </div>

                {/* 3 Infos Terrain Essentielles */}
                <div className="grid-3" style={{ gap: '10px' }}>
                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Subdivision & Rangs
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
                      Bilan Récolte Parcelle
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, marginTop: '2px', color: 'var(--color-forest)' }} className="tabular">
                      {selectedMetrics.totalCaisses} caisses · {selectedMetrics.totalKg} kg · {selectedMetrics.totalHl} hL
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                      {selectedMetrics.weighedKg > 0 ? `Pesé bascule : ${selectedMetrics.weighedKg} kg` : 'Estimation terrain avant pesée'}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Point GPS d’Entrée de Rang
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }} className="tabular">
                      {effectivePin.lat.toFixed(5)}, {effectivePin.lng.toFixed(5)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-forest)' }}>
                      {selectedTrack?.customPin ? 'Ajusté manuellement par le domaine' : 'Calé sur Pastille Livret'}
                    </div>
                  </div>
                </div>

                {/* CONTINUITÉ POST-VENDANGE : Suivre ce qu'il se passe par la suite (De la Parcelle à la Cuve / Fût / Bouteille) */}
                <div
                  style={{
                    padding: '10px 12px',
                    background: fieldMode ? '#141814' : 'var(--color-forest-soft)',
                    border: '1px solid var(--color-forest-border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-forest)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Layers size={13} /> Suite des opérations après vendange (Filiation Parcelle → Cuverie & Cave)
                    </span>
                    <span className="badge badge-green">Traçabilité temps réel</span>
                  </div>

                  {selectedMetrics.linkedLots.length > 0 ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {selectedMetrics.linkedLots.map((lot) => {
                        if (!lot) return null;
                        const volL = lotVolumeMl(state, lot.id) / 1000;
                        const occs = lotOccupancies(state, lot.id)
                          .map((o) => state.containers[o.containerId]?.code ?? o.containerId)
                          .join(', ');
                        return (
                          <div
                            key={lot.id}
                            style={{
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 10px',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            <Wine size={14} color={lot.color === 'red' ? 'var(--color-grape)' : '#9E7E53'} />
                            <div>
                              <strong>{lot.code}</strong> ({lot.name}) ·{' '}
                              <span className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)' }}>
                                {volL > 0 ? `${volL} L (${(volL / 100).toFixed(2)} hL)` : 'Mis en bouteilles'}
                              </span>
                              {occs && <span style={{ color: 'var(--color-ink-muted)' }}> · Contenant : {occs}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                      Parcelle planifiée pour demain : dès la réception de la vendange au quai, le lot de moût / vin créé s’affichera automatiquement ici avec sa cuve d’accueil.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Colonne Droite : Répertoire Parcellaire avec Statut Vendange & Horizon */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Répertoire Parcellaire & État d’Avancement</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Chaque Climat combine référence cadastrale, Pastille du livret et cumul (Caisses / kg / hL)
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
                const track = getParcelTrack(p);
                const metrics = getParcelHarvestMetrics(p);
                const statusBadge =
                  track.status === 'vendange'
                    ? { label: '✓ Vendangé', cls: 'badge-green' }
                    : track.status === 'en_cours'
                    ? { label: '● En cours (Aujourd’hui)', cls: 'badge-amber' }
                    : { label: 'Demain / À venir', cls: 'badge-muted' };

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="serif-display" style={{ fontWeight: 600, fontSize: '17px' }}>
                            {p.name}
                          </span>
                          <span className={`badge ${getLevelBadgeClass(meta.classification)}`}>
                            {meta.classification}
                          </span>
                          <span className={`badge ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                          {meta.appellation} · {meta.nbRangs}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }} className="tabular">
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-forest)' }}>
                        {metrics.totalCaisses} c. · {metrics.totalKg} kg · {metrics.totalHl} hL
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                        {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surface inconnue'} · Livret p.{meta.pageLivret}
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
          SOUS-VUE 2 : PLANNING VENDANGES (AUJOURD'HUI / DEMAIN / À VENIR) & TRI-UNITÉS (CAISSES / KG / HL)
         ===================================================================== */}
      {subTab === 'harvest' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tableau de Pilotage Quotidien inspiré de Parcelles-vendanges (Aujourd'hui / Demain / Jours à venir + Caisses / kg / hL) */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Pilotage des Parcelles à Vendanger (Aujourd’hui · Demain · Jours à venir)</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Planifiez l’ordre de coupe et suivez l’avancement en Caisses, en Kilogrammes (kg) ou en Hectolitres (hL)
                </div>
              </div>

              {/* Sélecteur d'unité actif : Caisses | kg | hL */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-ink-muted)' }}>Unité de saisie rapide :</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${unitMode === 'caisses' ? 'active' : ''}`}
                    onClick={() => setUnitMode('caisses')}
                  >
                    📦 Caisses
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${unitMode === 'kg' ? 'active' : ''}`}
                    onClick={() => setUnitMode('kg')}
                  >
                    ⚖️ Poids (kg)
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${unitMode === 'hl' ? 'active' : ''}`}
                    onClick={() => setUnitMode('hl')}
                  >
                    <Droplets size={13} /> Volume (hL)
                  </button>
                </div>
              </div>
            </div>

            {/* Barre de synthèse globale Multi-Unités */}
            <div className="grid-4" style={{ marginBottom: '16px' }}>
              <div style={{ padding: '12px 14px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                  Progression Parcellaire
                </div>
                <div className="serif-display tabular" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-forest)', marginTop: '2px' }}>
                  {globalHarvestStats.doneCount} / {parcels.length} vendangées
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                  {globalHarvestStats.inProgressCount} en cours · {globalHarvestStats.todoCount} à venir
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: unitMode === 'caisses' ? 'var(--color-gold-soft)' : 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', border: unitMode === 'caisses' ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                  Cumul Caisses (Terrain)
                </div>
                <div className="serif-display tabular" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '2px' }}>
                  {globalHarvestStats.caisses} caisses
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                  Caisses de ~18–20 kg
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: unitMode === 'kg' ? 'var(--color-gold-soft)' : 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', border: unitMode === 'kg' ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                  Cumul Poids Raisin (kg)
                </div>
                <div className="serif-display tabular" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-ink)', marginTop: '2px' }}>
                  {globalHarvestStats.kg.toLocaleString('fr-FR')} kg
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                  Bascule quai + estimé rangs
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: unitMode === 'hl' ? 'var(--color-gold-soft)' : 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', border: unitMode === 'hl' ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>
                  Cumul Volume Moût (hL)
                </div>
                <div className="serif-display tabular" style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-grape)', marginTop: '2px' }}>
                  {globalHarvestStats.hl} hL
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                  Soit {(globalHarvestStats.hl / 2.28).toFixed(1)} pièces bourguignonnes (228 L)
                </div>
              </div>
            </div>

            {/* Filtres temporels : Toutes | Aujourd'hui | Demain | Jours à venir | Vendangées */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-btn ${scheduleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('all')}
                >
                  Toutes ({parcels.length})
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${scheduleFilter === 'today' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('today')}
                >
                  Aujourd’hui (24 oct.)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${scheduleFilter === 'tomorrow' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('tomorrow')}
                >
                  Demain (25 oct.)
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${scheduleFilter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('upcoming')}
                >
                  Jours à venir
                </button>
                <button
                  type="button"
                  className={`segmented-btn ${scheduleFilter === 'done' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('done')}
                >
                  ✓ Vendangées
                </button>
              </div>
            </div>

            {/* Cartes de pilotage rapide par parcelle */}
            <div className="grid-2">
              {scheduledParcels.map((p) => {
                const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
                const track = getParcelTrack(p);
                const metrics = getParcelHarvestMetrics(p);
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: track.status === 'en_cours' ? '2px solid var(--color-amber)' : '1px solid var(--color-border)',
                      background: track.status === 'vendange' ? 'var(--color-forest-soft)' : 'var(--color-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span className="badge badge-amber">Pastille n°{meta.pastilleNum}</span>
                          <span className={`badge ${getLevelBadgeClass(meta.classification)}`}>{meta.classification}</span>
                          <select
                            aria-label={`Jour de vendange ${p.name}`}
                            value={track.daySlot}
                            onChange={(e) =>
                              updateParcelTrack(p, {
                                daySlot: e.target.value as CustomParcelTracking['daySlot'],
                              })
                            }
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg-elevated)',
                              fontWeight: 600,
                            }}
                          >
                            <option value="today">📅 Aujourd’hui (24 oct.)</option>
                            <option value="tomorrow">📅 Demain (25 oct.)</option>
                            <option value="upcoming">📅 Jours à venir</option>
                            <option value="done">✓ Récolte terminée</option>
                          </select>
                        </div>
                        <div className="serif-display" style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                          {p.name} ({p.code})
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }}>
                          {meta.nbRangs} · {p.areaM2 ? `${(p.areaM2.value / 10000).toFixed(2)} ha` : 'Surface inconnue'}
                        </div>
                      </div>

                      {/* Statut rapide en 1 clic */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['a_faire', 'en_cours', 'vendange'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              updateParcelTrack(p, {
                                status: st,
                                daySlot: st === 'vendange' ? 'done' : st === 'en_cours' ? 'today' : track.daySlot,
                              })
                            }
                            className={`badge ${
                              track.status === st
                                ? st === 'vendange'
                                  ? 'badge-green'
                                  : st === 'en_cours'
                                  ? 'badge-amber'
                                  : 'badge-grape'
                                : 'badge-muted'
                            }`}
                            style={{ cursor: 'pointer' }}
                          >
                            {st === 'a_faire' ? 'À faire' : st === 'en_cours' ? 'En cours' : '✓ Vendangé'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Compteurs Caisses / kg / hL + Boutons d'incrément selon l'unité choisie */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: 'var(--color-bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-subtle)',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div className="tabular" style={{ fontSize: '12.5px', fontWeight: 700 }}>
                        <span>{metrics.totalCaisses} caisses</span> ·{' '}
                        <span>{metrics.totalKg} kg</span> ·{' '}
                        <span style={{ color: 'var(--color-grape)' }}>{metrics.totalHl} hL</span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {unitMode === 'caisses' && (
                          <>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => adjustParcelUnit(p, 1)}>
                              +1 caisse
                            </button>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => adjustParcelUnit(p, 5)}>
                              +5 caisses
                            </button>
                          </>
                        )}
                        {unitMode === 'kg' && (
                          <>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => adjustParcelUnit(p, 50)}>
                              +50 kg
                            </button>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => adjustParcelUnit(p, 200)}>
                              +200 kg
                            </button>
                          </>
                        )}
                        {unitMode === 'hl' && (
                          <>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => adjustParcelUnit(p, 0.5)}>
                              +0.5 hL
                            </button>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => adjustParcelUnit(p, 2.28)} title="+1 pièce bourguignonne (2,28 hL)">
                              +2.28 hL (1 pièce)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Missions d’Équipes & Comptage Audité des Caisses</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Action principale accessible au pouce · Comptage horodaté des caisses de 20 kg
                </div>
              </div>
              <span className="badge badge-green">{missions.length} missions</span>
            </div>

            <div className="grid-3">
              {missions.map((m) => {
                const parcel = state.parcels[m.parcelId];
                const team = m.teamId ? state.teams[m.teamId] : null;
                const missionCrates = counts
                  .filter((c) => c.missionId === m.id)
                  .reduce((acc, c) => acc + c.quantity, 0);
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span
                          className={`badge ${
                            m.status === 'completed'
                              ? 'badge-green'
                              : m.status === 'in_progress'
                              ? 'badge-amber'
                              : m.status === 'blocked'
                              ? 'badge-crimson'
                              : 'badge-muted'
                          }`}
                        >
                          {m.status === 'completed' && <CheckCircle2 size={11} />}
                          {m.status === 'in_progress' && <Clock size={11} />}
                          {m.status === 'blocked' && <AlertTriangle size={11} />}
                          <span>{m.status}</span>
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--color-ink-muted)' }} className="tabular">
                          {m.plannedStart}
                        </span>
                      </div>

                      <h3 className="serif-display" style={{ fontWeight: 600, fontSize: '18px' }}>
                        {m.title}
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                        Climat : <strong>{parcel?.name ?? m.parcelId}</strong> · {team?.name ?? 'Non assignée'}
                      </div>

                      {missionCrates > 0 && (
                        <div
                          style={{
                            marginTop: '10px',
                            padding: '8px 10px',
                            background: 'var(--color-forest-soft)',
                            border: '1px solid var(--color-forest-border)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--color-forest)',
                          }}
                          className="tabular"
                        >
                          {missionCrates} caisses comptées (~{(missionCrates * 18).toLocaleString('fr-FR')} kg est.)
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)' }}>
                      {m.operation === 'harvest' && m.status !== 'completed' && (
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={!canEditVineyard}
                          onClick={() => {
                            setShowCountModal(m);
                            setCountQuantity('8');
                          }}
                        >
                          <Plus size={13} />
                          <span>Ajouter comptage</span>
                        </button>
                      )}
                      {m.status === 'planned' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          disabled={!canEditVineyard}
                          onClick={() => handleMissionStatus(m, 'in_progress')}
                        >
                          Démarrer
                        </button>
                      )}
                      {m.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          disabled={!canEditVineyard}
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

          {/* Journal des comptages & départ navette */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Journal des Comptages de Caisses & Navettes</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Toute correction conserve la version précédente et exige un motif audité
                </div>
              </div>
              {untransportedCounts.length > 0 && (
                <button
                  className="btn btn-sm btn-accent"
                  disabled={!canEditVineyard}
                  onClick={() => {
                    setSelectedCountsForTransport(untransportedCounts.map((c) => c.id));
                    setShowTransportModal(true);
                  }}
                >
                  <Truck size={14} />
                  <span>Créer un transport ({untransportedCounts.length} comptages prêts)</span>
                </button>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Horodatage</th>
                    <th>Mission / Climat</th>
                    <th>Quantité</th>
                    <th>Version</th>
                    <th>Statut Transport</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {counts.map((c) => {
                    const m = state.missions[c.missionId];
                    const p = m ? state.parcels[m.parcelId] : null;
                    return (
                      <tr key={c.id}>
                        <td className="tabular">{c.recordedAt.slice(0, 16).replace('T', ' ')}</td>
                        <td style={{ fontWeight: 600 }}>{p?.name ?? m?.title ?? c.missionId}</td>
                        <td className="tabular" style={{ fontWeight: 700 }}>
                          {c.quantity} caisses (~{(c.quantity * 18).toLocaleString('fr-FR')} kg)
                        </td>
                        <td className="tabular">
                          v{c.version}
                          {c.corrections.length > 0 && (
                            <span className="badge badge-amber" style={{ marginLeft: '6px' }}>
                              Corrigé ({c.corrections.length})
                            </span>
                          )}
                        </td>
                        <td>
                          {c.transportId ? (
                            <span className="badge badge-green">Associé ({c.transportId})</span>
                          ) : (
                            <span className="badge badge-amber">Au terrain (prêt au départ)</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            disabled={!canEditVineyard}
                            onClick={() => {
                              setShowCorrectModal(c);
                              setCorrectQty(String(c.quantity));
                            }}
                          >
                            Corriger
                          </button>
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
                <h2 className="card-title">Navettes de Vendange & Arrivées Quai</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Sélectionnez un transport en transit pour enregistrer sa pesée officielle au pressoir
                </div>
              </div>
              <span className="badge badge-amber">{inTransitCount} en transit</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {transports.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '14px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: t.status === 'in_transit' ? 'var(--color-amber-soft)' : 'var(--color-surface)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      {t.code} — Campagne {t.campaign}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                      Départ : {t.createdAt.slice(0, 16).replace('T', ' ')} · {t.lines.length} lot(s) de caisses
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge ${t.status === 'received' ? 'badge-green' : 'badge-amber'}`}>
                      {t.status === 'received' ? 'Réceptionné' : 'En transit'}
                    </span>
                    {t.status === 'in_transit' && (
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!canRecordReception}
                        onClick={() => setShowReceptionModal(t.id)}
                      >
                        Peser & Réceptionner
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Bons de Pesée & Filiation vers Cuverie</h2>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                  Poids net en kg sans conversion magique automatique en litres de vin (kg ≠ L)
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Poids Brut / Tare</th>
                    <th>Poids Net (kg)</th>
                    <th>Lot de Cuverie Créé / Alimenté</th>
                  </tr>
                </thead>
                <tbody>
                  {receptions.map((r) => {
                    const lot = state.lots[r.destinationLotId];
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{r.ticket}</td>
                        <td className="tabular">
                          {(r.grossG / 1000).toLocaleString('fr-FR')} kg / {(r.tareG / 1000).toLocaleString('fr-FR')} kg
                        </td>
                        <td className="tabular" style={{ fontWeight: 700, color: 'var(--color-forest)' }}>
                          {(r.netG / 1000).toLocaleString('fr-FR')} kg
                        </td>
                        <td>
                          <span className="badge badge-grape">{lot?.code ?? r.destinationLotId}</span>{' '}
                          <span style={{ fontSize: '12px', fontWeight: 500 }}>{lot?.name}</span>
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

      {/* Modal Ajout Comptage */}
      {showCountModal && (
        <div className="modal-backdrop" onClick={() => setShowCountModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>
              Saisie terrain : Ajouter un comptage ({showCountModal.title})
            </h2>
            <form onSubmit={handleAddCount}>
              <div className="form-group">
                <label className="form-label">Nombre de caisses (20 kg nominal)</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  className="form-input"
                  value={countQuantity}
                  onChange={(e) => setCountQuantity(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCountModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer le comptage
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
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Correction auditée du comptage ({showCorrectModal.id})
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              La valeur actuelle ({showCorrectModal.quantity} caisses, v{showCorrectModal.version}) sera archivée dans l’historique.
            </p>
            <form onSubmit={handleCorrectCount}>
              <div className="form-group">
                <label className="form-label">Nouvelle quantité exacte (caisses)</label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  value={correctQty}
                  onChange={(e) => setCorrectQty(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Motif obligatoire de correction</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Ex : Recomptage contradictoire au chargement de la remorque"
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCorrectModal(null)}>
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

      {/* Modal Création Transport */}
      {showTransportModal && (
        <div className="modal-backdrop" onClick={() => setShowTransportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>
              Créer un transport vers le chai
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              {selectedCountsForTransport.length} comptage(s) sélectionné(s) vont être chargés et placés en statut <code>in_transit</code>.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTransportModal(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCreateTransport}>
                Confirmer le départ navette
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Réception au Chai */}
      {showReceptionModal && (
        <div className="modal-backdrop" onClick={() => setShowReceptionModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '8px' }}>
              Réception & Pesée au Chai ({showReceptionModal})
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Règle métier : la réception enregistre des kilogrammes de raisin (Brut − Tare = Net). Aucun volume en litres n’est inventé par conversion automatique.
            </p>
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
                    min="1"
                    className="form-input"
                    value={grossKg}
                    onChange={(e) => setGrossKg(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tare contenants (kg)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={tareKg}
                    onChange={(e) => setTareKg(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Lot de vinification destinataire</label>
                <select
                  className="form-select"
                  value={receptionDestLot}
                  onChange={(e) => setReceptionDestLot(e.target.value)}
                >
                  {Object.values(state.lots)
                    .filter((l) => l.vintage === 2026)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} — {l.name}
                      </option>
                    ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceptionModal(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider la réception ({Math.max(0, parseFloat(grossKg || '0') - parseFloat(tareKg || '0'))} kg net)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Observation */}
      {showObsModal && (
        <div className="modal-backdrop" onClick={() => setShowObsModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 600, marginBottom: '12px' }}>
              Nouvelle observation — {showObsModal.name}
            </h2>
            <form onSubmit={handleAddObservation}>
              <div className="form-group">
                <label className="form-label">Observation terrain (état sanitaire, pépins, pellicules...)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Ex : État sanitaire irréprochable, pellicules croquantes, pépins bruns..."
                  required
                  autoFocus
                />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Indicateur</label>
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
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
    </div>
  );
};
