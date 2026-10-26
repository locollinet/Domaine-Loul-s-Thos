import React, { useState } from 'react';
import {
  MapPin,
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
  Settings,
  Camera,
  ExternalLink,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useStore } from '../../app/store-context';
import { canRun } from '../../domain/commands';
import { lotVolumeMl, lotOccupancies } from '../../domain/selectors';
import type { HarvestCount, Mission, MissionStatus, Parcel } from '../../domain/types';
import { InteractiveVineyardMap, type ParcelMapItem } from './InteractiveVineyardMap';
import { LivretImportModal, type ImportedParcelRecord } from './LivretImportModal';
import { PhytoAndTesaPanel } from './PhytoAndTesaPanel';
import { useModuleConfig } from '../modules/ModuleConfigContext';

function normalizeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Enrichissement "Haute Bourgogne & Livret de Vendanges" (exactement calé sur les 7 IDs de seed.ts)
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
  polygon: [number, number][];
  terroir: string;
  altitude: string;
  defaultDaySlot: 'today' | 'tomorrow' | 'upcoming' | 'done';
  defaultStatus: 'a_faire' | 'en_cours' | 'vendange';
  initialHl: number;
  linkedLotIds: string[];
}

const CLIMAT_METADATA: Record<string, ClimatLivretMeta> = {
  'origin-a': {
    classification: '1er Cru',
    appellation: 'Puligny-Montrachet 1er Cru',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AH n°0092 (25,38 ares · Rangs 1 à 42)',
    nbRangs: '42 rangs (28 Chardonnay / 14 Pinot)',
    pageLivret: 12,
    pastilleNum: 1,
    lat: 46.94825,
    lng: 4.73905,
    pinX: 24,
    pinY: 32,
    polygon: [
      [46.948483, 4.738357],
      [46.948575, 4.738427],
      [46.948582, 4.738428],
      [46.948657, 4.738464],
      [46.94818, 4.739673],
      [46.948138, 4.739772],
      [46.948124, 4.739767],
      [46.948071, 4.739747],
      [46.948046, 4.739742],
      [46.947961, 4.73974],
      [46.947932, 4.739729],
      [46.948483, 4.738357],
    ],
    terroir: 'Calcaire à entroques & marnes blanches',
    altitude: '265 m · Exposition Est-Sud-Est',
    defaultDaySlot: 'done',
    defaultStatus: 'vendange',
    initialHl: 1.5,
    linkedLotIds: ['lot-2026-white', 'lot-2024-white', 'lot-2023-white'],
  },
  'origin-b': {
    classification: '1er Cru',
    appellation: 'Puligny-Montrachet 1er Cru',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AH n°0068 (21,04 ares · Coteau médian)',
    nbRangs: '34 rangs (Vignes franches)',
    pageLivret: 18,
    pastilleNum: 2,
    lat: 46.94508,
    lng: 4.73702,
    pinX: 54,
    pinY: 28,
    polygon: [
      [46.944708, 4.736966],
      [46.944778, 4.736777],
      [46.944809, 4.736693],
      [46.944842, 4.736608],
      [46.945253, 4.736969],
      [46.945259, 4.737],
      [46.945447, 4.737156],
      [46.945371, 4.737369],
      [46.945353, 4.737424],
      [46.945207, 4.737335],
      [46.945186, 4.737319],
      [46.945122, 4.737258],
      [46.945023, 4.737173],
      [46.944889, 4.737067],
      [46.9448, 4.737016],
      [46.944708, 4.736966],
    ],
    terroir: 'Argilo-calcaire sur dalle rocheuse',
    altitude: '250 m · Coteau médian',
    defaultDaySlot: 'done',
    defaultStatus: 'vendange',
    initialHl: 1.8,
    linkedLotIds: ['lot-2026-red', 'lot-2025-r1'],
  },
  'parcel-c': {
    classification: 'Grand Cru',
    appellation: 'Bâtard-Montrachet Grand Cru (fictif)',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AI n°0131 (46,02 ares · Clos du Puits)',
    nbRangs: '24 rangs (Rangs 1 à 24 · Priorité 05h00)',
    pageLivret: 7,
    pastilleNum: 3,
    lat: 46.94642,
    lng: 4.74258,
    pinX: 82,
    pinY: 34,
    polygon: [
      [46.946296, 4.743614],
      [46.946189, 4.743553],
      [46.946025, 4.743479],
      [46.946425, 4.742155],
      [46.946574, 4.741657],
      [46.946824, 4.741833],
      [46.946296, 4.743614],
    ],
    terroir: 'Terres brunes profondes & cailloutis calcaires',
    altitude: '240 m · Pied de coteau d’élite',
    defaultDaySlot: 'today',
    defaultStatus: 'en_cours',
    initialHl: 1.62,
    linkedLotIds: ['lot-2025-r2'],
  },
  'parcel-d': {
    classification: 'Village',
    appellation: 'Puligny-Montrachet Village',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AI n°0114 (58,50 ares · Terrasses Basses)',
    nbRangs: '26 rangs (Cépage blanc)',
    pageLivret: 24,
    pastilleNum: 4,
    lat: 46.94295,
    lng: 4.74415,
    pinX: 26,
    pinY: 68,
    polygon: [
      [46.943543, 4.744916],
      [46.942154, 4.743793],
      [46.942027, 4.743348],
      [46.942172, 4.743409],
      [46.942278, 4.743459],
      [46.942437, 4.743577],
      [46.943116, 4.744096],
      [46.943437, 4.744353],
      [46.943441, 4.744342],
      [46.943663, 4.744513],
      [46.943543, 4.744916],
    ],
    terroir: 'Limons argilo-calcaires de pied de combe',
    altitude: '230 m · Plaine haute',
    defaultDaySlot: 'upcoming',
    defaultStatus: 'a_faire',
    initialHl: 0,
    linkedLotIds: [],
  },
  'parcel-e1': {
    classification: '1er Cru',
    appellation: 'Puligny-Montrachet 1er Cru',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AH n°0158 (35,78 ares · Pierres Plates Nord)',
    nbRangs: '16 rangs (Propriété Domaine · Équipe B)',
    pageLivret: 31,
    pastilleNum: 5,
    lat: 46.94945,
    lng: 4.74135,
    pinX: 50,
    pinY: 60,
    polygon: [
      [46.94952, 4.740576],
      [46.949587, 4.740613],
      [46.949782, 4.740723],
      [46.949431, 4.742175],
      [46.949354, 4.742124],
      [46.949266, 4.742064],
      [46.949178, 4.742002],
      [46.94952, 4.740576],
    ],
    terroir: 'Dalles calcaires affleurantes',
    altitude: '275 m · Haut de coteau',
    defaultDaySlot: 'today',
    defaultStatus: 'a_faire',
    initialHl: 0,
    linkedLotIds: [],
  },
  'parcel-e2': {
    classification: '1er Cru',
    appellation: 'Puligny-Montrachet 1er Cru',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AK n°0104 (74,88 ares · Pierres Plates Fermage)',
    nbRangs: '14 rangs (Fermage · Accès humide)',
    pageLivret: 32,
    pastilleNum: 6,
    lat: 46.94815,
    lng: 4.74385,
    pinX: 50,
    pinY: 82,
    polygon: [
      [46.947651, 4.744339],
      [46.947902, 4.743668],
      [46.948166, 4.742958],
      [46.948211, 4.743004],
      [46.948238, 4.743019],
      [46.948366, 4.743108],
      [46.948415, 4.743127],
      [46.948477, 4.743143],
      [46.948636, 4.743256],
      [46.948626, 4.7433],
      [46.948496, 4.743854],
      [46.948339, 4.74452],
      [46.948049, 4.744485],
      [46.947827, 4.744451],
      [46.947784, 4.744435],
      [46.94774, 4.744409],
      [46.947651, 4.744339],
    ],
    terroir: 'Éboulis calcaires fins',
    altitude: '268 m',
    defaultDaySlot: 'upcoming',
    defaultStatus: 'a_faire',
    initialHl: 0,
    linkedLotIds: [],
  },
  'parcel-f': {
    classification: 'Village',
    appellation: 'Puligny-Montrachet Village',
    commune: 'Puligny-Montrachet (INSEE 21512)',
    sectionCadastrale: 'Section AH n°0045 (19,29 ares · Vigne du Moulin)',
    nbRangs: '22 rangs (Vendange demain matin 06h30)',
    pageLivret: 38,
    pastilleNum: 7,
    lat: 46.95122,
    lng: 4.73955,
    pinX: 78,
    pinY: 74,
    polygon: [
      [46.950982, 4.739791],
      [46.951228, 4.739093],
      [46.951236, 4.739068],
      [46.951446, 4.739218],
      [46.951479, 4.739243],
      [46.951473, 4.739261],
      [46.951218, 4.740008],
      [46.951111, 4.739909],
      [46.950988, 4.739797],
      [46.950982, 4.739791],
    ],
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
  pastilleNum: 8,
  lat: 46.9462,
  lng: 4.7395,
  pinX: 50,
  pinY: 50,
  polygon: [
    [46.9466, 4.7389],
    [46.9467, 4.7401],
    [46.9458, 4.7402],
    [46.9457, 4.739],
  ],
  terroir: 'Coteau argilo-calcaire',
  altitude: '250 m',
  defaultDaySlot: 'upcoming',
  defaultStatus: 'a_faire',
  initialHl: 0,
  linkedLotIds: [],
};

export interface ParcelFieldPhoto {
  id: string;
  dataUrl: string;
  caption: string;
  date: string;
}

interface CustomParcelTracking {
  daySlot: 'today' | 'tomorrow' | 'upcoming' | 'done';
  status: 'a_faire' | 'en_cours' | 'vendange';
  extraCaisses: number;
  extraKg: number;
  extraHl: number;
  customPin?: { xPct: number; yPct: number; lat: number; lng: number };
  customPolygon?: [number, number][];
  customGoogleMapsUrl?: string;
  customNbRangs?: string;
  customAccessNotes?: string;
  customContextNotes?: string;
  customPageLivret?: number;
  customPastilleNum?: number;
  customSectionCadastrale?: string;
  customClassification?: 'Grand Cru' | '1er Cru' | 'Village';
  customAppellation?: string;
  customCommune?: string;
  photos?: ParcelFieldPhoto[];
}

const PARCEL_STORAGE_KEY = 'domaine-erp-parcel-configs-v1';
const IMPORTED_PARCELS_STORAGE_KEY = 'domaine-erp-imported-parcels-v1';

// Photo terrain par défaut (repère visuel d'entrée de rangs et murger en Bourgogne)
const DEFAULT_FIELD_PHOTO_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#D9E2DC"/>
          <stop offset="100%" stop-color="#F4EFE6"/>
        </linearGradient>
      </defs>
      <rect width="480" height="130" fill="url(#sky)"/>
      <path d="M0 115 Q160 85 320 105 T480 95 L480 270 L0 270 Z" fill="#3B523E"/>
      <path d="M0 140 L480 125 L480 270 L0 270 Z" fill="#2A3E2D"/>
      <g stroke="#8CA87C" stroke-width="3" opacity="0.65">
        <line x1="40" y1="270" x2="210" y2="130"/>
        <line x1="120" y1="270" x2="235" y2="130"/>
        <line x1="200" y1="270" x2="260" y2="130"/>
        <line x1="280" y1="270" x2="285" y2="130"/>
        <line x1="360" y1="270" x2="310" y2="130"/>
        <line x1="440" y1="270" x2="335" y2="130"/>
      </g>
      <rect x="18" y="185" width="95" height="38" rx="4" fill="#C4B9A5" stroke="#6E6555" stroke-width="2"/>
      <circle cx="240" cy="185" r="18" fill="rgba(249,115,22,0.28)" stroke="#F97316" stroke-width="3"/>
      <circle cx="240" cy="185" r="5" fill="#F97316"/>
      <rect x="145" y="16" width="190" height="28" rx="14" fill="rgba(20,24,20,0.82)"/>
      <text x="240" y="34" font-family="sans-serif" font-size="12" font-weight="bold" fill="#FAF8F5" text-anchor="middle">Repère Entrée de Rang &amp; Murger</text>
    </svg>`
  );

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(ev.target?.result ?? ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = String(ev.target?.result ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const VineyardView: React.FC<{
  restrictedFieldMode?: boolean;
  onToggleRestrictedMode?: () => void;
}> = ({ restrictedFieldMode = false, onToggleRestrictedMode }) => {
  const { state, dispatch, role } = useStore();
  const { isAddonEnabled } = useModuleConfig();
  // Navigation simple par onglets clairs (Zéro surcharge à l'écran)
  const [subTab, setSubTab] = useState<'atlas' | 'harvest' | 'reception' | 'phyto_tesa'>('atlas');
  const [fieldMode, setFieldMode] = useState(false);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>('parcel-c');
  const [parcelSearch, setParcelSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'Grand Cru' | '1er Cru' | 'Village'>('all');

  // Mode "Repositionnement Point GPS Domaine" (On-top du cadastre et du livret)
  const [isEditingGpsPin, setIsEditingGpsPin] = useState(false);
  const [showLivretImportModal, setShowLivretImportModal] = useState(false);
  const [importedBannerMsg, setImportedBannerMsg] = useState<string | null>(null);
  const [importedParcels, setImportedParcels] = useState<Parcel[]>(() => {
    try {
      const raw = localStorage.getItem(IMPORTED_PARCELS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Parcel[]) : [];
    } catch {
      return [];
    }
  });
  const [parcelTracking, setParcelTracking] = useState<Record<string, CustomParcelTracking>>(() => {
    try {
      const raw = localStorage.getItem(PARCEL_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, CustomParcelTracking>) : {};
    } catch {
      return {};
    }
  });

  // Modale de Paramétrage Complet & Photos Terrain d'une parcelle
  const [configParcel, setConfigParcel] = useState<Parcel | null>(null);
  const [cfgLat, setCfgLat] = useState('');
  const [cfgLng, setCfgLng] = useState('');
  const [cfgGoogleMapsUrl, setCfgGoogleMapsUrl] = useState('');
  const [cfgNbRangs, setCfgNbRangs] = useState('');
  const [cfgSectionCadastrale, setCfgSectionCadastrale] = useState('');
  const [cfgPageLivret, setCfgPageLivret] = useState('');
  const [cfgPastilleNum, setCfgPastilleNum] = useState('');
  const [cfgAccessNotes, setCfgAccessNotes] = useState('');
  const [cfgContextNotes, setCfgContextNotes] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('Entrée des rangs & repère fourgon');
  const [previewPhoto, setPreviewPhoto] = useState<ParcelFieldPhoto | null>(null);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string | null>(null);

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

  const baseParcels = Object.values(state.parcels);
  const parcels: Parcel[] = [
    ...baseParcels,
    ...importedParcels.filter((ip) => !state.parcels[ip.id]),
  ];
  const parcelMap: Record<string, Parcel> = Object.fromEntries(parcels.map((p) => [p.id, p]));
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
    const tr = getParcelTrack(p);
    const effClass = tr.customClassification ?? meta.classification;
    const effApp = tr.customAppellation ?? meta.appellation;
    const effComm = tr.customCommune ?? meta.commune;
    if (levelFilter !== 'all' && effClass !== levelFilter) return false;
    if (!parcelSearch.trim()) return true;
    const q = normalizeAccents(parcelSearch);
    return normalizeAccents(`${p.code} ${p.name} ${p.grape} ${effApp} ${effComm}`).includes(q);
  });

  const selectedParcel = (selectedParcelId ? parcelMap[selectedParcelId] : null) ?? parcels[0] ?? null;
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

  const persistParcelTracking = (updater: (prev: Record<string, CustomParcelTracking>) => Record<string, CustomParcelTracking>) => {
    setParcelTracking((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem(PARCEL_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  };

  const handleApplyLivretImport = (records: ImportedParcelRecord[]) => {
    const newParcelsToAdd: Parcel[] = [];

    records.forEach((rec, idx) => {
      if (!rec.matchExistingId) {
        newParcelsToAdd.push({
          id: rec.id,
          code: rec.code,
          name: rec.name,
          owner: 'Domaine des Trois Coteaux (Import Livret)',
          cadastralRef: `${rec.section} ${rec.numero}`,
          grape: rec.grape,
          color: rec.color,
          areaM2: { value: rec.areaM2, status: 'measured' },
          plantedYear: 1988,
          gps: { lat: rec.lat, lng: rec.lng, source: 'Livret & Cadastre IGN' },
          access: rec.accessNotes,
          notes: rec.contextNotes,
          schematic: {
            x: 15 + ((idx * 23) % 65),
            y: 18 + ((idx * 19) % 62),
            w: 16,
            h: 14,
          },
        });
      }
    });

    if (newParcelsToAdd.length > 0) {
      setImportedParcels((prev) => {
        const mergedMap = new Map<string, Parcel>();
        prev.forEach((p) => mergedMap.set(p.id, p));
        newParcelsToAdd.forEach((p) => mergedMap.set(p.id, p));
        const nextList = Array.from(mergedMap.values());
        try {
          localStorage.setItem(IMPORTED_PARCELS_STORAGE_KEY, JSON.stringify(nextList));
        } catch {
          // Ignore quota errors
        }
        return nextList;
      });
    }

    persistParcelTracking((prev) => {
      const next = { ...prev };
      records.forEach((rec) => {
        const targetId = rec.matchExistingId ?? rec.id;
        const existingTrack = next[targetId] ?? {
          daySlot: rec.daySlot,
          status: rec.status,
          extraCaisses: 0,
          extraKg: 0,
          extraHl: 0,
        };
        next[targetId] = {
          ...existingTrack,
          daySlot: rec.daySlot,
          status: rec.status,
          customPin: {
            xPct: existingTrack.customPin?.xPct ?? 50,
            yPct: existingTrack.customPin?.yPct ?? 50,
            lat: rec.lat,
            lng: rec.lng,
          },
          customPolygon: rec.polygon,
          customGoogleMapsUrl: rec.googleMapsUrl,
          customNbRangs: rec.nbRangs,
          customAccessNotes: rec.accessNotes,
          customContextNotes: rec.contextNotes,
          customPageLivret: rec.pageLivret,
          customPastilleNum: rec.pastilleNum,
          customSectionCadastrale: rec.sectionCadastrale,
          customClassification: rec.classification,
          customAppellation: rec.appellation,
          customCommune: rec.commune,
        };
      });
      return next;
    });

    const firstRecord = records[0];
    if (firstRecord) {
      const firstId = firstRecord.matchExistingId ?? firstRecord.id;
      setSelectedParcelId(firstId);
    }
    setShowLivretImportModal(false);
    setImportedBannerMsg(
      `Livret numérique appliqué avec succès : ${records.length} parcelle(s) synchronisée(s) sur la carte satellite & le cadastre IGN.`
    );
  };

  const handleSetCustomGpsFromMap = (parcelId: string, lat: number, lng: number) => {
    const target = parcelMap[parcelId];
    if (!target) return;
    const current = getParcelTrack(target);
    persistParcelTracking((prev) => ({
      ...prev,
      [parcelId]: {
        ...current,
        customPin: {
          xPct: current.customPin?.xPct ?? 50,
          yPct: current.customPin?.yPct ?? 50,
          lat,
          lng,
        },
        customGoogleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      },
    }));
    setIsEditingGpsPin(false);

    // Détection automatique de la vraie délimitation cadastrale IGN sous le point cliqué
    const geom = encodeURIComponent(JSON.stringify({ type: 'Point', coordinates: [lng, lat] }));
    fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const feat = data?.features?.[0];
        if (!feat) return;
        const ring =
          feat.geometry?.type === 'MultiPolygon'
            ? feat.geometry.coordinates?.[0]?.[0]
            : feat.geometry?.type === 'Polygon'
            ? feat.geometry.coordinates?.[0]
            : null;
        if (!Array.isArray(ring) || ring.length < 3) return;
        const exactPoly: [number, number][] = ring.map((pt: [number, number]) => [
          Number(pt[1].toFixed(6)),
          Number(pt[0].toFixed(6)),
        ]);
        const props = feat.properties ?? {};
        const ares = props.contenance ? `${(Number(props.contenance) / 100).toFixed(2)} ares` : '';
        const sectionLabel =
          props.section && props.numero
            ? `Section ${props.section} n°${props.numero}${ares ? ` (${ares})` : ''}`
            : undefined;

        persistParcelTracking((prev) => {
          const latest = prev[parcelId] ?? current;
          return {
            ...prev,
            [parcelId]: {
              ...latest,
              customPolygon: exactPoly,
              ...(sectionLabel ? { customSectionCadastrale: sectionLabel } : {}),
            },
          };
        });
      })
      .catch(() => {
        // Offline fallback: keep existing polygon
      });
  };

  const mapItems: ParcelMapItem[] = parcels.map((p) => {
    const meta = CLIMAT_METADATA[p.id] ?? DEFAULT_CLIMAT_META;
    const tr = getParcelTrack(p);
    const lat = tr.customPin?.lat ?? meta.lat;
    const lng = tr.customPin?.lng ?? meta.lng;
    return {
      parcel: p,
      pastilleNum: tr.customPastilleNum ?? meta.pastilleNum,
      pageLivret: tr.customPageLivret ?? meta.pageLivret,
      classification: tr.customClassification ?? meta.classification,
      appellation: tr.customAppellation ?? meta.appellation,
      commune: tr.customCommune ?? meta.commune,
      sectionCadastrale: tr.customSectionCadastrale ?? meta.sectionCadastrale,
      nbRangs: tr.customNbRangs ?? meta.nbRangs,
      status: tr.status,
      daySlot: tr.daySlot,
      lat,
      lng,
      isCustomGps: Boolean(tr.customPin),
      googleMapsUrl:
        tr.customGoogleMapsUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      polygon: tr.customPolygon ?? meta.polygon,
    };
  });

  const todayPriorityItems = mapItems.filter(
    (i) => i.daySlot === 'today' || i.status === 'en_cours'
  );
  const tomorrowItems = mapItems.filter((i) => i.daySlot === 'tomorrow');

  const updateParcelTrack = (parcel: Parcel, patch: Partial<CustomParcelTracking>) => {
    const current = getParcelTrack(parcel);
    persistParcelTracking((prev) => ({
      ...prev,
      [parcel.id]: {
        ...current,
        ...patch,
      },
    }));
  };

  const openParcelConfigModal = (parcel: Parcel) => {
    const meta = CLIMAT_METADATA[parcel.id] ?? DEFAULT_CLIMAT_META;
    const track = getParcelTrack(parcel);
    const pin = track.customPin ?? {
      xPct: parcel.schematic.x + parcel.schematic.w / 2,
      yPct: parcel.schematic.y + parcel.schematic.h / 2,
      lat: meta.lat,
      lng: meta.lng,
    };
    setConfigParcel(parcel);
    setCfgLat(String(pin.lat));
    setCfgLng(String(pin.lng));
    setCfgGoogleMapsUrl(
      track.customGoogleMapsUrl ?? `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`
    );
    setCfgNbRangs(track.customNbRangs ?? meta.nbRangs);
    setCfgSectionCadastrale(track.customSectionCadastrale ?? meta.sectionCadastrale);
    setCfgPageLivret(String(track.customPageLivret ?? meta.pageLivret));
    setCfgPastilleNum(String(track.customPastilleNum ?? meta.pastilleNum));
    setCfgAccessNotes(track.customAccessNotes ?? parcel.access ?? 'Accès fourgon par le chemin communal haut');
    setCfgContextNotes(track.customContextNotes ?? `${meta.terroir} · ${meta.altitude}`);
    setGpsStatusMsg(null);
  };

  const handleCaptureDeviceGps = () => {
    if (!navigator.geolocation) {
      setGpsStatusMsg('Géolocalisation non disponible sur ce navigateur.');
      return;
    }
    setGpsStatusMsg('Acquisition GPS en cours...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lng = pos.coords.longitude.toFixed(5);
        setCfgLat(lat);
        setCfgLng(lng);
        setCfgGoogleMapsUrl(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
        setGpsStatusMsg(`Position GPS acquise (±${Math.round(pos.coords.accuracy)}m)`);
      },
      () => {
        setGpsStatusMsg('Permission GPS refusée ou signal indisponible — saisie manuelle active.');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleSaveParcelConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configParcel) return;
    const current = getParcelTrack(configParcel);
    const parsedLat = parseFloat(cfgLat);
    const parsedLng = parseFloat(cfgLng);
    const basePin = current.customPin ?? {
      xPct: configParcel.schematic.x + configParcel.schematic.w / 2,
      yPct: configParcel.schematic.y + configParcel.schematic.h / 2,
      lat: selectedMeta.lat,
      lng: selectedMeta.lng,
    };

    updateParcelTrack(configParcel, {
      customPin: {
        xPct: basePin.xPct,
        yPct: basePin.yPct,
        lat: Number.isFinite(parsedLat) ? parsedLat : basePin.lat,
        lng: Number.isFinite(parsedLng) ? parsedLng : basePin.lng,
      },
      customGoogleMapsUrl: cfgGoogleMapsUrl.trim() || undefined,
      customNbRangs: cfgNbRangs.trim() || undefined,
      customSectionCadastrale: cfgSectionCadastrale.trim() || undefined,
      customPageLivret: parseInt(cfgPageLivret, 10) || selectedMeta.pageLivret,
      customPastilleNum: parseInt(cfgPastilleNum, 10) || selectedMeta.pastilleNum,
      customAccessNotes: cfgAccessNotes.trim() || undefined,
      customContextNotes: cfgContextNotes.trim() || undefined,
    });
    setConfigParcel(null);
  };

  const handleAddParcelPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetParcel = configParcel ?? selectedParcel;
    if (!file || !targetParcel) return;
    try {
      const dataUrl = await compressImageFile(file);
      const current = getParcelTrack(targetParcel);
      const existingPhotos = current.photos ?? [
        {
          id: 'default-photo-1',
          dataUrl: DEFAULT_FIELD_PHOTO_SVG,
          caption: 'Repère entrée des rangs & murger (Livret Domaine)',
          date: '2026-10-20',
        },
      ];
      const newPhoto: ParcelFieldPhoto = {
        id: `photo-${Date.now()}`,
        dataUrl,
        caption: newPhotoCaption.trim() || file.name,
        date: new Date().toISOString().slice(0, 10),
      };
      updateParcelTrack(targetParcel, {
        photos: [newPhoto, ...existingPhotos],
      });
    } catch {
      // Ignore compression error
    }
    e.target.value = '';
  };

  const handleRemoveParcelPhoto = (parcel: Parcel, photoId: string) => {
    const current = getParcelTrack(parcel);
    const existingPhotos = current.photos ?? [];
    updateParcelTrack(parcel, {
      photos: existingPhotos.filter((ph) => ph.id !== photoId),
    });
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

  const totalAreaHa = parcels.reduce((sum, p) => sum + (p.areaM2?.value ?? 0) / 10000, 0);
  const donePct = parcels.length > 0 ? Math.round((globalHarvestStats.doneCount / parcels.length) * 100) : 0;

  return (
    <div className="ds-overview">
      {/* 1. BANNIÈRE VIGNOBLE & RÉCOLTE (Design System v2) */}
      <section className="ds-hero ds-rise">
        <div>
          <div className="ds-eyebrow">
            <span className="ds-pulse" aria-hidden="true" />
            <span>
              Cadastre IGN Puligny-Montrachet · {parcels.length} climats ({totalAreaHa.toFixed(2)} ha)
            </span>
          </div>
          <h1 className="ds-hero-title">Vignoble & Récolte</h1>
          <p className="ds-hero-sub">
            Repérez chaque parcelle au mètre près pour guider vos coupeurs dès 5 h du matin,
            comptez les caisses au rang, déclenchez les bennes et pesez la vendange à l’arrivée au pressoir.
          </p>
        </div>

        <div className="ds-next">
          <div>
            <div className="ds-next-label">Priorité dans les vignes</div>
            <div className="ds-next-title">
              {untransportedCounts.length > 0
                ? `${untransportedCounts.reduce((s, c) => s + c.quantity, 0)} cagettes coupées attendent au bout du rang`
                : inTransitCount > 0
                  ? `${inTransitCount} benne(s) en route vers le quai de réception`
                  : 'Consulter la carte GPS et le planning de coupe'}
            </div>
            <p className="ds-next-desc">
              {untransportedCounts.length > 0
                ? 'Groupez ces cagettes dans un transport pour les envoyer au pressoir avant que le raisin ne chauffe.'
                : 'Utilisez le guidage GPS ±1 m ou importez votre livret parcellaire / CVI.'}
            </p>
          </div>
          {untransportedCounts.length > 0 && !restrictedFieldMode ? (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setSubTab('harvest')}
            >
              <span>Envoyer la vendange au pressoir</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ds-cta"
              onClick={() => setSubTab('atlas')}
            >
              <span>Ouvrir la carte GPS des climats</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>

      {/* 2. GESTES TERRAIN EN 1 CLIC (4 TUILES VERBES) */}
      <section className="ds-rise ds-rise-1" aria-label="Actions rapides vignoble">
        <div className="ds-section-head">
          <h2 className="ds-section-title">Que voulez-vous faire sur le terrain ?</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!restrictedFieldMode && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setShowLivretImportModal(true)}
                title="Importer et traduire un Livret Parcellaire PDF/Texte, un Export CVI Douanes, un CSV Excel ou un GeoJSON"
              >
                <BookOpen size={14} />
                <span>📖 Importer Livret / CVI</span>
              </button>
            )}

            {onToggleRestrictedMode && (
              <button
                type="button"
                className={`btn btn-sm ${restrictedFieldMode ? 'btn-accent' : 'btn-gold'}`}
                onClick={onToggleRestrictedMode}
                title="Restreindre l'interface uniquement au guidage GPS et aux priorités de vendange pour un ouvrier ou un transporteur"
              >
                <Navigation size={14} />
                <span>
                  {restrictedFieldMode
                    ? '🔒 Vue Restreinte Active (Quitter)'
                    : '🚜 Vue Terrain 5h00 (Ouvrier / Transporteur)'}
                </span>
              </button>
            )}

            <button
              type="button"
              className={`btn btn-sm ${fieldMode ? 'btn-gold' : 'btn-secondary'}`}
              onClick={() => setFieldMode((v) => !v)}
              title="Activer le contraste élevé pour lecture en plein soleil dans les vignes"
            >
              <Sun size={14} />
              <span>{fieldMode ? 'Mode Soleil Actif' : 'Mode Soleil'}</span>
            </button>
          </div>
        </div>

        <div className="ds-quick-grid-4">
          <button
            type="button"
            className={`ds-tile ${subTab === 'atlas' ? 'is-recommended' : ''}`}
            onClick={() => setSubTab('atlas')}
          >
            <span className="ds-tile-badge">Cadastre & GPS</span>
            <div className="ds-icon-bubble ds-tone-forest">
              <MapPin size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">1. Carte GPS & Livret ({parcels.length})</div>
              <div className="ds-tile-sub">
                Polygones cadastraux IGN, photos d’accès et navigation Waze/Maps
              </div>
            </div>
          </button>

          <button
            type="button"
            className={`ds-tile ${subTab === 'harvest' ? 'is-recommended' : ''}`}
            onClick={() => setSubTab('harvest')}
          >
            <span className="ds-tile-badge">Coupe & Bennes</span>
            <div className="ds-icon-bubble ds-tone-gold">
              <Calendar size={20} strokeWidth={1.9} />
            </div>
            <div>
              <div className="ds-tile-label">2. Planning & Vendanges ({counts.length})</div>
              <div className="ds-tile-sub">
                Compter les caisses (+1/+5/+10), planifier Aujourd’hui / Demain
              </div>
            </div>
          </button>

          {!restrictedFieldMode ? (
            <button
              type="button"
              className={`ds-tile ${subTab === 'reception' ? 'is-recommended' : ''}`}
              onClick={() => setSubTab('reception')}
            >
              <span className="ds-tile-badge">Quai pressoir</span>
              <div className="ds-icon-bubble ds-tone-grape">
                <Scale size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">3. Quai & Pesées ({inTransitCount} en transit)</div>
                <div className="ds-tile-sub">
                  Peser Brut/Tare/Net et affecter les raisins à une cuve du chai
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="ds-tile"
              onClick={() => setFieldMode((v) => !v)}
            >
              <div className="ds-icon-bubble ds-tone-amber">
                <Sun size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">Contraste Plein Soleil</div>
                <div className="ds-tile-sub">
                  {fieldMode ? 'Mode extérieur activé' : 'Renforcer la lisibilité au soleil'}
                </div>
              </div>
            </button>
          )}

          {!restrictedFieldMode && isAddonEnabled('phyto_tesa') ? (
            <button
              type="button"
              className={`ds-tile ${subTab === 'phyto_tesa' ? 'is-recommended' : ''}`}
              onClick={() => setSubTab('phyto_tesa')}
            >
              <span className="ds-tile-badge">Bio / HVE & MSA</span>
              <div className="ds-icon-bubble ds-tone-amber">
                <CheckCircle2 size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">4. Phyto Bio/HVE & TESA</div>
                <div className="ds-tile-sub">
                  Délai avant récolte (DAR), plafond cuivre 4 kg/ha et contrats saisonniers
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              className="ds-tile"
              onClick={() => setShowLivretImportModal(true)}
            >
              <div className="ds-icon-bubble ds-tone-ink">
                <BookOpen size={20} strokeWidth={1.9} />
              </div>
              <div>
                <div className="ds-tile-label">Importer un Livret / CVI</div>
                <div className="ds-tile-sub">
                  Traduire automatiquement PDF, CSV Douanes ou GeoJSON en parcelles
                </div>
              </div>
            </button>
          )}
        </div>
      </section>

      {/* 3. JAUGES VISUELLES DE RÉCOLTE */}
      <section className="ds-stats ds-rise ds-rise-2" aria-label="Repères de vendange">
        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-forest">
              <CheckCircle2 size={16} />
            </span>
            <span>Climats vendangés</span>
          </div>
          <div className="ds-stat-value">
            {globalHarvestStats.doneCount}
            <span className="ds-stat-unit">/ {parcels.length}</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: `${donePct}%`, background: 'var(--color-forest)' }} />
          </div>
          <div className="ds-stat-foot">
            {globalHarvestStats.inProgressCount} en cours · {globalHarvestStats.todoCount} à venir
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-gold">
              <Grape size={16} />
            </span>
            <span>Vendange coupée cumulée</span>
          </div>
          <div className="ds-stat-value">
            {globalHarvestStats.kg.toLocaleString('fr-FR')}
            <span className="ds-stat-unit">kg</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '68%', background: 'var(--color-gold-dark)' }} />
          </div>
          <div className="ds-stat-foot">
            Soit {globalHarvestStats.caisses} cagettes (~{globalHarvestStats.hl} hL potentiels)
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-amber">
              <Truck size={16} />
            </span>
            <span>Logistique vers le pressoir</span>
          </div>
          <div className="ds-stat-value">
            {untransportedCounts.length}
            <span className="ds-stat-unit">lot(s) au rang</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span
              style={{
                width: untransportedCounts.length > 0 ? '45%' : '100%',
                background: untransportedCounts.length > 0 ? 'var(--color-amber)' : 'var(--color-forest)',
              }}
            />
          </div>
          <div className="ds-stat-foot">
            {inTransitCount} transport(s) actuellement en transit
          </div>
        </div>

        <div className="ds-stat">
          <div className="ds-stat-top">
            <span className="ds-icon-bubble ds-tone-grape">
              <Wine size={16} />
            </span>
            <span>Surface cadastrale suivie</span>
          </div>
          <div className="ds-stat-value">
            {totalAreaHa.toFixed(2)}
            <span className="ds-stat-unit">ha</span>
          </div>
          <div className="ds-bar" aria-hidden="true">
            <span style={{ width: '100%', background: 'var(--color-grape)' }} />
          </div>
          <div className="ds-stat-foot">
            Grand Cru, 1er Cru & Village · Puligny-Montrachet
          </div>
        </div>
      </section>

      {/* BANDEAU 05h00 DU MATIN : QUOI VENDANGER AUJOURD'HUI & S'Y RENDRE EN 1 CLIC */}
      {importedBannerMsg && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.45)',
            color: 'var(--color-ink)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>✅ {importedBannerMsg}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setImportedBannerMsg(null)}
          >
            OK
          </button>
        </div>
      )}
      <div
        style={{
          background: 'linear-gradient(135deg, #19211A 0%, #243025 100%)',
          color: '#FAF8F5',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          border: '1.5px solid #F97316',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: '#F97316',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: '999px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              🌅 Briefing 05h00 · Priorités de Coupe du Jour
            </span>
            <span style={{ fontSize: '13px', color: '#E2C799', fontWeight: 600 }}>
              Cliquez sur « Y ALLER (MAPS) » pour lancer le guidage routier jusqu’à l’entrée des rangs
            </span>
          </div>
          {tomorrowItems.length > 0 && (
            <span style={{ fontSize: '12px', color: 'rgba(250,248,245,0.75)' }}>
              Demain matin :{' '}
              <strong style={{ color: '#E2C799' }}>
                {tomorrowItems.map((t) => `${t.parcel.name.replace(' — fictif', '')} (Pastille n°${t.pastilleNum})`).join(', ')}
              </strong>
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px' }}>
          {todayPriorityItems.map((item) => {
            const metrics = getParcelHarvestMetrics(item.parcel);
            const isSelected = selectedParcel?.id === item.parcel.id;
            return (
              <div
                key={item.parcel.id}
                onClick={() => {
                  setSelectedParcelId(item.parcel.id);
                  setSubTab('atlas');
                }}
                style={{
                  background: isSelected ? 'rgba(249, 115, 22, 0.16)' : 'rgba(255,255,255,0.06)',
                  border: isSelected ? '2px solid #F97316' : '1px solid rgba(255,255,255,0.16)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span
                      style={{
                        background: '#F97316',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '11px',
                        padding: '1px 7px',
                        borderRadius: '999px',
                      }}
                    >
                      Pastille n°{item.pastilleNum} · Livret p.{item.pageLivret}
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#E2C799', fontWeight: 700 }}>
                      {item.status === 'en_cours' ? '● En cours de coupe' : 'À attaquer ce matin'}
                    </span>
                  </div>
                  <div className="serif-display" style={{ fontSize: '19px', fontWeight: 700, color: '#FFFFFF' }}>
                    {item.parcel.name.replace(' — fictif', '')} ({item.parcel.code})
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(250,248,245,0.8)' }}>
                    {item.nbRangs} · Cumul : <strong>{metrics.totalCaisses} caisses</strong> ({metrics.totalKg} kg)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      adjustParcelUnit(item.parcel, 5);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +5 Caisses
                  </button>
                  <a
                    href={item.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    style={{
                      background: '#10B981',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      borderRadius: '999px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    <Navigation size={14} />
                    <span>Y ALLER (MAPS)</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          SOUS-VUE 1 : VRAIE CARTE INTERACTIVE SATELLITE / CADASTRE IGN & LIVRET
         ===================================================================== */}
      {subTab === 'atlas' && (
        <div className="grid-2 animate-fade-in">
          {/* Colonne Gauche : Vraie Carte Interactive Navigable (Zoom / Pan / GPS Flottant / Plein Écran) */}
          <div
            className="card"
            style={{
              background: fieldMode ? '#141814' : 'var(--color-surface)',
              color: fieldMode ? '#FAF8F5' : 'var(--color-ink)',
              borderColor: fieldMode ? '#C4A47A' : 'var(--color-border)',
            }}
          >
            <div className="card-header" style={{ borderColor: fieldMode ? 'rgba(255,255,255,0.12)' : undefined, marginBottom: '10px' }}>
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
                    Carte Satellite Interactive, Cadastre IGN & GPS Terrain
                  </h2>
                  <div style={{ fontSize: '11.5px', opacity: 0.78 }}>
                    Déplacez-vous et zoomez sur la carte · Cliquez sur « ME LOCALISER (GPS) » en bas à droite ou ouvrez en Plein Écran
                  </div>
                </div>
              </div>
            </div>

            <InteractiveVineyardMap
              items={mapItems}
              selectedParcelId={selectedParcel?.id ?? 'parcel-c'}
              onSelectParcel={(id) => setSelectedParcelId(id)}
              isEditingGpsPin={isEditingGpsPin}
              onToggleEditGpsPin={() => setIsEditingGpsPin((v) => !v)}
              onSetCustomGps={handleSetCustomGpsFromMap}
              fieldMode={fieldMode || restrictedFieldMode}
            />

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
                      <span className="badge badge-muted">
                        {selectedTrack?.customSectionCadastrale ?? selectedMeta.sectionCadastrale}
                      </span>
                      <span className="badge badge-amber">
                        Livret p.{selectedTrack?.customPageLivret ?? selectedMeta.pageLivret} · Pastille n°
                        {selectedTrack?.customPastilleNum ?? selectedMeta.pastilleNum}
                      </span>
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
                      href={
                        selectedTrack?.customGoogleMapsUrl ||
                        `https://www.google.com/maps/dir/?api=1&destination=${effectivePin.lat},${effectivePin.lng}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                      style={{ textDecoration: 'none' }}
                      title="Ouvrir l’itinéraire Google Maps vers cette parcelle"
                    >
                      <Navigation size={13} />
                      <span>Google Maps</span>
                      <ExternalLink size={11} />
                    </a>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => openParcelConfigModal(selectedParcel)}
                      title="Paramétrer les coordonnées GPS, le lien Google Maps, les consignes d’accès et les photos terrain"
                    >
                      <Settings size={13} />
                      <span>Paramétrer & Photos</span>
                    </button>
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

                {/* 3 Infos Terrain Essentielles (Paramétrables) */}
                <div className="grid-3" style={{ gap: '10px' }}>
                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Subdivision & Rangs
                    </div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px' }}>
                      {selectedTrack?.customNbRangs ?? selectedMeta.nbRangs}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }} className="tabular">
                      {selectedParcel.areaM2 ? `${(selectedParcel.areaM2.value / 10000).toFixed(2)} ha (${selectedParcel.areaM2.status === 'measured' ? 'mesurée' : 'estimée'})` : 'Surface inconnue (≠ 0)'}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Accès & Contexte Terrain
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--color-forest)' }}>
                      {selectedTrack?.customAccessNotes ?? selectedParcel.access ?? 'Accès fourgon chemin haut'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                      {selectedTrack?.customContextNotes ?? `${selectedMeta.terroir} · ${selectedMeta.altitude}`}
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: fieldMode ? '#141814' : 'var(--color-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Point GPS & Lien Maps
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px' }} className="tabular">
                      {effectivePin.lat.toFixed(5)}, {effectivePin.lng.toFixed(5)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-forest)' }}>
                      {selectedTrack?.customPin ? '★ Coordonnées Domaine personnalisées' : 'Calé sur Pastille Livret'}
                    </div>
                  </div>
                </div>

                {/* Bandeau Photos du Terrain (Repères visuels d'entrée de rangs, portail, murger, état sanitaire) */}
                {(() => {
                  const photos = selectedTrack?.photos ?? [
                    {
                      id: 'default-photo-1',
                      dataUrl: DEFAULT_FIELD_PHOTO_SVG,
                      caption: `Entrée de rang Pastille n°${selectedTrack?.customPastilleNum ?? selectedMeta.pastilleNum} (${selectedParcel.name})`,
                      date: '2026-10-20',
                    },
                  ];
                  return (
                    <div
                      style={{
                        padding: '10px 12px',
                        background: fieldMode ? '#141814' : 'var(--color-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {photos.slice(0, 3).map((ph) => (
                          <div
                            key={ph.id}
                            onClick={() => setPreviewPhoto(ph)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '4px 8px 4px 4px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg-elevated)',
                              cursor: 'pointer',
                            }}
                            title="Cliquer pour agrandir la photo terrain"
                          >
                            <img
                              src={ph.dataUrl}
                              alt={ph.caption}
                              style={{ width: '44px', height: '30px', objectFit: 'cover', borderRadius: '4px' }}
                            />
                            <div>
                              <div style={{ fontSize: '11.5px', fontWeight: 600, maxWidth: '170px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ph.caption}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--color-ink-light)' }}>{ph.date}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => openParcelConfigModal(selectedParcel)}
                      >
                        <Camera size={13} />
                        <span>+ Photo terrain ({photos.length})</span>
                      </button>
                    </div>
                  );
                })()}

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

             {isAddonEnabled('negoce') && (
               <div
                 style={{
                   marginTop: '18px',
                   paddingTop: '14px',
                   borderTop: '1px solid var(--color-border)',
                 }}
               >
                 <div
                   style={{
                     display: 'flex',
                     justifyContent: 'space-between',
                     alignItems: 'center',
                     marginBottom: '8px',
                     flexWrap: 'wrap',
                     gap: '6px',
                   }}
                 >
                   <div>
                     <span className="badge badge-gold">MODE MAISON DE NÉGOCE ACTIVÉ</span>
                     <h3 style={{ margin: '4px 0 0 0', fontSize: '15.5px' }}>
                       Apports sous Contrat d’Achat de Raisins / Moûts (Séparation Douanes Domaine vs Négoce)
                     </h3>
                   </div>
                   <span className="badge badge-green">Traçabilité Apporteurs</span>
                 </div>

                 <table>
                   <thead>
                     <tr>
                       <th>Contrat & Vigneron Apporteur</th>
                       <th>Appellation & Climat</th>
                       <th>Nature Apport</th>
                       <th>Volume / Poids Reçu</th>
                       <th>Cuve Négoce Dédiée</th>
                     </tr>
                   </thead>
                   <tbody>
                     <tr>
                       <td>
                         <strong>CTR-NEG-2026-01</strong>
                         <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                           Domaine Morel & Fils (Apporteur Partenaire — fictif)
                         </div>
                       </td>
                       <td>Meursault Village · Les Narvaux</td>
                       <td>
                         <span className="badge badge-gold">Raisins entiers (Caissettes 18 kg)</span>
                       </td>
                       <td className="tabular" style={{ fontWeight: 700 }}>
                         1 420 kg (Pressurage séparé)
                       </td>
                       <td>
                         <span className="badge badge-grape">Cuve Inox C-04 (Isolement Négoce)</span>
                       </td>
                     </tr>
                     <tr>
                       <td>
                         <strong>CTR-NEG-2026-02</strong>
                         <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                           EARL des Combes (Apporteur Partenaire — fictif)
                         </div>
                       </td>
                       <td>Puligny-Montrachet Village</td>
                       <td>
                         <span className="badge badge-green">Moût débourbé (Achat hL)</span>
                       </td>
                       <td className="tabular" style={{ fontWeight: 700 }}>
                         11,40 hL (Ticket pont-bascule #892)
                       </td>
                       <td>
                         <span className="badge badge-grape">Fûts F-12 à F-16 (Lot Négoce)</span>
                       </td>
                     </tr>
                   </tbody>
                 </table>
               </div>
             )}
           </div>
         </div>
       )}

       {/* =====================================================================
           SOUS-VUE 4 : REGISTRE PHYTOSANITAIRE BIO/HVE (DAR) & POINTAGE TESA MSA
          ===================================================================== */}
       {subTab === 'phyto_tesa' && !restrictedFieldMode && isAddonEnabled('phyto_tesa') && (
         <PhytoAndTesaPanel parcels={parcels} />
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

      {/* Modal Paramétrage Complet & Photos Terrain de la Parcelle */}
      {configParcel && (
        <div className="modal-backdrop" onClick={() => setConfigParcel(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <span className="badge badge-gold" style={{ marginBottom: '4px' }}>
                  Paramétrage Parcellaire & Terrain
                </span>
                <h2 className="serif-display" style={{ fontSize: '22px', fontWeight: 700 }}>
                  {configParcel.name} ({configParcel.code})
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleCaptureDeviceGps}
                title="Utiliser le GPS du téléphone/tablette pour capturer les coordonnées exactes sur le terrain"
              >
                <Crosshair size={13} />
                <span>Capturer ma position GPS actuelle</span>
              </button>
            </div>

            {gpsStatusMsg && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: 'var(--color-forest-soft)',
                  border: '1px solid var(--color-forest-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-forest)',
                }}
              >
                {gpsStatusMsg}
              </div>
            )}

            <form onSubmit={handleSaveParcelConfig}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Latitude GPS exacte (Entrée de rang)</label>
                  <input
                    type="number"
                    step="0.00001"
                    className="form-input tabular"
                    value={cfgLat}
                    onChange={(e) => {
                      setCfgLat(e.target.value);
                      setCfgGoogleMapsUrl(`https://www.google.com/maps/dir/?api=1&destination=${e.target.value},${cfgLng}`);
                    }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude GPS exacte (Entrée de rang)</label>
                  <input
                    type="number"
                    step="0.00001"
                    className="form-input tabular"
                    value={cfgLng}
                    onChange={(e) => {
                      setCfgLng(e.target.value);
                      setCfgGoogleMapsUrl(`https://www.google.com/maps/dir/?api=1&destination=${cfgLat},${e.target.value}`);
                    }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Lien Google Maps direct (Itinéraire fourgon / tracteur ou épingle partagée)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="url"
                    className="form-input"
                    value={cfgGoogleMapsUrl}
                    onChange={(e) => setCfgGoogleMapsUrl(e.target.value)}
                    placeholder="https://www.google.com/maps/dir/?api=1&destination=..."
                    style={{ flex: 1 }}
                  />
                  <a
                    href={cfgGoogleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    <Navigation size={14} /> Tester Maps
                  </a>
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Référence Cadastrale</label>
                  <input
                    type="text"
                    className="form-input"
                    value={cfgSectionCadastrale}
                    onChange={(e) => setCfgSectionCadastrale(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Page du Livret</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={cfgPageLivret}
                    onChange={(e) => setCfgPageLivret(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Pastille n° (Repère carte)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={cfgPastilleNum}
                    onChange={(e) => setCfgPastilleNum(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Subdivision & Nombre de rangs</label>
                  <input
                    type="text"
                    className="form-input"
                    value={cfgNbRangs}
                    onChange={(e) => setCfgNbRangs(e.target.value)}
                    placeholder="Ex : 42 rangs (Rangs 1 à 28 Chardonnay)"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Consignes d’accès (Fourgon / Tracteur / Équipe)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={cfgAccessNotes}
                    onChange={(e) => setCfgAccessNotes(e.target.value)}
                    placeholder="Ex : Entrée par le portail vert chemin haut"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Infos contextuelles (Terroir, pente, vigilance météo / sanitaire)</label>
                <input
                  type="text"
                  className="form-input"
                  value={cfgContextNotes}
                  onChange={(e) => setCfgContextNotes(e.target.value)}
                />
              </div>

              {/* Section Photos prises du terrain */}
              <div
                style={{
                  padding: '12px',
                  background: 'var(--color-bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-ink)' }}>
                      📷 Photos prises du terrain (Entrée de rang, murger, grappes, accès)
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                      Sur mobile, ouvre directement l’appareil photo · Compression automatique hors-ligne
                    </div>
                  </div>
                  <label className="btn btn-sm btn-gold" style={{ cursor: 'pointer', margin: 0 }}>
                    <Camera size={13} />
                    <span>Prendre / Importer une photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleAddParcelPhoto}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={newPhotoCaption}
                    onChange={(e) => setNewPhotoCaption(e.target.value)}
                    placeholder="Légende de la prochaine photo (ex: Portail d'accès rang n°1 côté nord)"
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                </div>

                {(() => {
                  const track = getParcelTrack(configParcel);
                  const photos = track.photos ?? [
                    {
                      id: 'default-photo-1',
                      dataUrl: DEFAULT_FIELD_PHOTO_SVG,
                      caption: `Entrée de rang Pastille n°${track.customPastilleNum ?? (CLIMAT_METADATA[configParcel.id]?.pastilleNum ?? 1)}`,
                      date: '2026-10-20',
                    },
                  ];
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '10px' }}>
                      {photos.map((ph) => (
                        <div
                          key={ph.id}
                          style={{
                            border: '1px solid var(--color-border)',
                            borderRadius: '8px',
                            background: 'var(--color-surface)',
                            overflow: 'hidden',
                          }}
                        >
                          <img
                            src={ph.dataUrl}
                            alt={ph.caption}
                            onClick={() => setPreviewPhoto(ph)}
                            style={{ width: '100%', height: '90px', objectFit: 'cover', cursor: 'pointer' }}
                          />
                          <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ph.caption}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--color-ink-light)' }}>{ph.date}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveParcelPhoto(configParcel, ph.id)}
                              style={{ color: 'var(--color-crimson)', padding: '3px', cursor: 'pointer' }}
                              title="Supprimer cette photo"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setConfigParcel(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer le paramétrage de la parcelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox d'aperçu plein écran d'une photo terrain */}
      {previewPhoto && (
        <div className="modal-backdrop" onClick={() => setPreviewPhoto(null)}>
          <div className="modal-content" style={{ maxWidth: '720px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 className="serif-display" style={{ fontSize: '20px', fontWeight: 700 }}>{previewPhoto.caption}</h3>
                <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>Photo terrain prise le {previewPhoto.date}</div>
              </div>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setPreviewPhoto(null)}>
                Fermer
              </button>
            </div>
            <img
              src={previewPhoto.dataUrl}
              alt={previewPhoto.caption}
              style={{ width: '100%', maxHeight: '460px', objectFit: 'contain', borderRadius: '8px', background: '#141814' }}
            />
          </div>
        </div>
      )}
      {/* Modale d'Import & Traduction de Livrets Numériques (PDF/Texte, CVI Douanes, CSV, JSON/GeoJSON) */}
      {showLivretImportModal && (
        <LivretImportModal
          existingParcels={parcels}
          onClose={() => setShowLivretImportModal(false)}
          onApplyImport={handleApplyLivretImport}
        />
      )}
    </div>
  );
};
