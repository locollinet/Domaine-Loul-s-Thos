import React, { useState } from 'react';
import { Package, Plus, Scissors, Building2 } from 'lucide-react';
import type { BottlingBatch, Sku, DomainState } from '../../domain/types';
import { batchPosition } from '../../domain/selectors';

export type SaleUrgencyLevel = 'urgent' | 'high' | 'resting' | 'oenotheque';

export interface BottleSlotRecord {
  id: string;
  batchCode: string;
  cuveeLabel: string;
  vintage: number;
  formatLabel: string;
  zone: string;
  rackCode: string; // ex: "Allée C · Casier #C-01"
  dressingState:
    | 'Habillé CRD France (Cartons de 6)'
    | 'Habillé Export Neutre (Cartons)'
    | 'Tiré-Bouché Nu (Palox Fil 600 cols)'
    | 'Caisse Bois Origine (CBO)';
  physicalBottles: number;
  availableBottles: number;
  urgency: SaleUrgencyLevel;
  prioritySellByDate: string;
  urgencyReason: string;
  sommelierPeakWindow: string;
  unitTargetPriceHtEur: number;
}

const STORAGE_KEY = 'domaine-erp-bottle-cellar-slots-v1';
const ZONES_STORAGE_KEY = 'domaine-erp-bottle-cellar-zones-v1';
const RACKS_STORAGE_KEY = 'domaine-erp-bottle-cellar-racks-v1';

const DEFAULT_ZONES: string[] = [
  'Zone C · Caveau & Fins de Lots',
  'Zone B · Palettes Prêtes',
  'Zone A · Palox Tiré-Bouché',
  'Zone D · Œnotèque Voûtée',
];

const DEFAULT_RACKS: string[] = [
  'Allée A · Travée 01 · Palox Fil #A-12',
  'Allée A · Travée 02 · Palox Fil #A-14',
  'Allée B · Travée 01 · Palette #B-02 (Quai Départ)',
  'Allée B · Travée 02 · Palette #B-04',
  'Allée C · Casier #C-01 (Niveau 1 · Caveau)',
  'Allée C · Casier #C-02 (Rotation Rapide)',
  'Cave Voûtée · Alvéole Pierre #D-01',
  'Cave Voûtée · Alvéole Pierre #D-03',
];

const DEFAULT_EXTRA_SLOTS: BottleSlotRecord[] = [
  {
    id: 'slot-m23-001',
    batchCode: 'M23-001',
    cuveeLabel: 'Coteaux Rouges · Vieilles Vignes',
    vintage: 2023,
    formatLabel: 'Bouteille 75 cl',
    zone: 'Zone C · Caveau & Fins de Lots',
    rackCode: 'Allée C · Casier #C-01 (Niveau 1 · Caveau)',
    dressingState: 'Habillé CRD France (Cartons de 6)',
    physicalBottles: 36,
    availableBottles: 36,
    urgency: 'urgent',
    prioritySellByDate: '2026-11-30',
    urgencyReason:
      'Reliquat de fin de millésime 2023 (6 cartons) : à écouler en priorité au Caveau / CHR avant l’ouverture du millésime 2024 et pour libérer le Casier #C-01.',
    sommelierPeakWindow: 'Apogée actuelle (2026 – 2029) · Prêt à boire',
    unitTargetPriceHtEur: 24,
  },
  {
    id: 'slot-m24-w01',
    batchCode: 'M24-B01',
    cuveeLabel: 'Puligny-Montrachet 1er Cru · Les Hauts Rangs',
    vintage: 2024,
    formatLabel: 'Bouteille 75 cl',
    zone: 'Zone B · Palettes Prêtes',
    rackCode: 'Allée B · Travée 02 · Palette #B-04',
    dressingState: 'Habillé CRD France (Cartons de 6)',
    physicalBottles: 420,
    availableBottles: 300,
    urgency: 'high',
    prioritySellByDate: '2027-02-15',
    urgencyReason:
      'Pleine fenêtre de commercialisation automne/hiver (Fêtes de fin d’année CHR & Cavistes).',
    sommelierPeakWindow: '2026 – 2033 · Tension minérale optimale',
    unitTargetPriceHtEur: 58,
  },
  {
    id: 'slot-m25-gc1',
    batchCode: 'M25-GC1',
    cuveeLabel: 'Bâtard-Montrachet Grand Cru · Le Clos du Puits',
    vintage: 2025,
    formatLabel: 'Bouteille 75 cl',
    zone: 'Zone A · Palox Tiré-Bouché',
    rackCode: 'Allée A · Travée 01 · Palox Fil #A-12',
    dressingState: 'Tiré-Bouché Nu (Palox Fil 600 cols)',
    physicalBottles: 580,
    availableBottles: 580,
    urgency: 'resting',
    prioritySellByDate: '2027-05-01',
    urgencyReason:
      'En repos post-mise sur lattes (contraction du bouchon) : habillage à la demande à partir du printemps 2027.',
    sommelierPeakWindow: '2028 – 2040 · Grand vin de garde',
    unitTargetPriceHtEur: 145,
  },
  {
    id: 'slot-m22-mag',
    batchCode: 'M22-MAG',
    cuveeLabel: 'Puligny-Montrachet 1er Cru · Les Pierres Plates',
    vintage: 2022,
    formatLabel: 'Magnum 150 cl',
    zone: 'Zone D · Œnotèque Voûtée',
    rackCode: 'Cave Voûtée · Alvéole Pierre #D-03',
    dressingState: 'Caisse Bois Origine (CBO)',
    physicalBottles: 48,
    availableBottles: 18,
    urgency: 'oenotheque',
    prioritySellByDate: '2028-12-31',
    urgencyReason:
      'Réserve Œnothèque & Allocations Rares : déblocage sélectif pour restauration gastronomique, cavistes et clients fidèles.',
    sommelierPeakWindow: '2026 – 2036 · Complexité briochée & pierre à fusil',
    unitTargetPriceHtEur: 135,
  },
];

interface CellarBottleMapPanelProps {
  state: DomainState;
  batches: BottlingBatch[];
  skus: Record<string, Sku>;
}

export const CellarBottleMapPanel: React.FC<CellarBottleMapPanelProps> = ({
  state,
  batches,
  skus,
}) => {
  const [slots, setSlots] = useState<BottleSlotRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as BottleSlotRecord[];
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_EXTRA_SLOTS;
  });

  const [zones, setZones] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ZONES_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      // Ignore
    }
    return DEFAULT_ZONES;
  });

  const [racks, setRacks] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RACKS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as string[];
    } catch {
      // Ignore
    }
    return DEFAULT_RACKS;
  });

  const [urgencyFilter, setUrgencyFilter] = useState<'all' | SaleUrgencyLevel>('all');
  const [selectedSlotId, setSelectedSlotId] = useState<string>(DEFAULT_EXTRA_SLOTS[0]?.id ?? '');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Modale d'ajout d'une Zone / Entrepôt ou Travée / Palox sur-mesure
  const [showAddStructureModal, setShowAddStructureModal] = useState(false);
  const [newZoneName, setNewZoneName] = useState('Zone E · Entrepôt Climatisé Beaune (13°C)');
  const [newRackName, setNewRackName] = useState('Entrepôt Beaune · Allée 1 · Palox #E-01');

  // Modale de Split (Scinder un lot sur plusieurs emplacements simultanés)
  const [splitTargetSlot, setSplitTargetSlot] = useState<BottleSlotRecord | null>(null);
  const [splitQty, setSplitQty] = useState('120');
  const [splitDestZone, setSplitDestZone] = useState<string>(DEFAULT_ZONES[1] ?? 'Zone B · Palettes Prêtes');
  const [splitDestRack, setSplitDestRack] = useState<string>(DEFAULT_RACKS[2] ?? 'Allée B · Travée 01 · Palette #B-02 (Quai Départ)');
  const [splitDressing, setSplitDressing] = useState<BottleSlotRecord['dressingState']>(
    'Habillé CRD France (Cartons de 6)'
  );

  const persistSlots = (next: BottleSlotRecord[]) => {
    setSlots(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota error
    }
  };

  // Fusionne dynamiquement les nouveaux lots créés dans l'ERP avec les emplacements du chai à bouteilles
  const mergedSlots: BottleSlotRecord[] = [...slots];
  batches.forEach((b, idx) => {
    const pos = batchPosition(state, b);
    const matchingIndices = mergedSlots
      .map((s, i) => (s.batchCode === b.code ? i : -1))
      .filter((i) => i >= 0);

    if (matchingIndices.length === 1) {
      const existingIdx = matchingIndices[0]!;
      const current = mergedSlots[existingIdx];
      if (current) {
        mergedSlots[existingIdx] = {
          ...current,
          physicalBottles: pos.physical,
          availableBottles: pos.available,
        };
      }
    } else if (matchingIndices.length === 0) {
      const sku = skus[b.skuId];
      mergedSlots.unshift({
        id: `slot-${b.id}`,
        batchCode: b.code,
        cuveeLabel: sku?.label.replace(' — fictif', '') ?? b.code,
        vintage: b.vintage,
        formatLabel: sku?.sizeMl === 1500 ? 'Magnum 150 cl' : 'Bouteille 75 cl',
        zone: zones[0] ?? 'Zone A · Palox Tiré-Bouché',
        rackCode: `Allée A · Travée 0${(idx % 3) + 1} · Palox Fil #A-0${idx + 1}`,
        dressingState: 'Habillé CRD France (Cartons de 6)',
        physicalBottles: pos.physical,
        availableBottles: pos.available,
        urgency: 'high',
        prioritySellByDate: '2027-03-31',
        urgencyReason: 'Lot récemment conditionné — Disponible pour expédition.',
        sommelierPeakWindow: `${b.vintage + 1} – ${b.vintage + 7}`,
        unitTargetPriceHtEur: 28,
      });
    }
  });

  const filteredSlots = mergedSlots.filter((s) => {
    if (urgencyFilter !== 'all' && s.urgency !== urgencyFilter) return false;
    return true;
  });

  const activeSlot =
    mergedSlots.find((s) => s.id === selectedSlotId) ?? filteredSlots[0] ?? mergedSlots[0];

  const urgentCount = mergedSlots.filter((s) => s.urgency === 'urgent').length;
  const highPriorityCount = mergedSlots.filter((s) => s.urgency === 'high').length;
  const totalBottlesInCellar = mergedSlots.reduce((acc, s) => acc + s.physicalBottles, 0);

  const handleMoveSlot = (slotId: string, newRackCode: string) => {
    const updated = mergedSlots.map((s) =>
      s.id === slotId ? { ...s, rackCode: newRackCode } : s
    );
    persistSlots(updated);
    setStatusBanner(`Lot déplacé vers l’emplacement : ${newRackCode}.`);
  };

  const handleChangeZone = (slotId: string, newZone: string) => {
    const updated = mergedSlots.map((s) =>
      s.id === slotId ? { ...s, zone: newZone } : s
    );
    persistSlots(updated);
    setStatusBanner(`Lot affecté à la zone : ${newZone}.`);
  };

  const handleChangeUrgency = (slotId: string, newUrgency: SaleUrgencyLevel) => {
    const updated = mergedSlots.map((s) =>
      s.id === slotId ? { ...s, urgency: newUrgency } : s
    );
    persistSlots(updated);
    setStatusBanner(`Priorité d’écoulement commercial mise à jour.`);
  };

  const handleDressPaloxToReady = (slotId: string) => {
    const updated = mergedSlots.map((s) =>
      s.id === slotId
        ? {
            ...s,
            dressingState: 'Habillé CRD France (Cartons de 6)' as const,
            zone: 'Zone B · Palettes Prêtes',
            rackCode: 'Allée B · Travée 01 · Palette #B-02 (Quai Départ)',
            urgency: 'high' as const,
          }
        : s
    );
    persistSlots(updated);
    setStatusBanner(
      'Opération d’habillage validée : lot étiqueté CRD, mis en cartons de 6 et transféré en Zone B (Prêt à expédier).'
    );
  };

  // Ajout d'une Zone d'Entrepôt et/ou d'un Emplacement (Palox / Travée / Casier) propre au domaine
  const handleAddCustomStructure = (e: React.FormEvent) => {
    e.preventDefault();
    const z = newZoneName.trim();
    const r = newRackName.trim();
    if (z && !zones.includes(z)) {
      const nextZ = [...zones, z];
      setZones(nextZ);
      try {
        localStorage.setItem(ZONES_STORAGE_KEY, JSON.stringify(nextZ));
      } catch {
        // Ignore
      }
    }
    if (r && !racks.includes(r)) {
      const nextR = [...racks, r];
      setRacks(nextR);
      try {
        localStorage.setItem(RACKS_STORAGE_KEY, JSON.stringify(nextR));
      } catch {
        // Ignore
      }
    }
    setShowAddStructureModal(false);
    setStatusBanner(
      `Structure d’entrepôt mise à jour : Zone "${z || 'existante'}" et emplacement "${r || 'existant'}" ajoutés.`
    );
  };

  // Scission (Split) d'un lot sur 2 emplacements simultanés avec conservation stricte des quantités
  const handleExecuteSplit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitTargetSlot) return;
    const qty = parseInt(splitQty, 10);
    if (Number.isNaN(qty) || qty <= 0 || qty >= splitTargetSlot.availableBottles) return;

    const remainingPhys = splitTargetSlot.physicalBottles - qty;
    const remainingAvail = splitTargetSlot.availableBottles - qty;

    const newChildSlot: BottleSlotRecord = {
      ...splitTargetSlot,
      id: `${splitTargetSlot.id}-split-${Date.now()}`,
      zone: splitDestZone,
      rackCode: splitDestRack,
      dressingState: splitDressing,
      physicalBottles: qty,
      availableBottles: qty,
      urgency: splitDressing.includes('Habillé') ? 'high' : splitTargetSlot.urgency,
      urgencyReason: `Fraction de ${qty} cols issue du lot ${splitTargetSlot.batchCode} (${splitDressing}).`,
    };

    const next = mergedSlots.flatMap((s) =>
      s.id === splitTargetSlot.id
        ? [
            {
              ...s,
              physicalBottles: remainingPhys,
              availableBottles: remainingAvail,
            },
            newChildSlot,
          ]
        : [s]
    );

    persistSlots(next);
    setSelectedSlotId(newChildSlot.id);
    setSplitTargetSlot(null);
    setStatusBanner(
      `Lot ${splitTargetSlot.batchCode} réparti : ${qty} cols transférés vers "${splitDestRack}" (${splitDestZone}) et ${remainingAvail} cols conservés dans "${splitTargetSlot.rackCode}".`
    );
  };

  const renderUrgencyBadge = (u: SaleUrgencyLevel) => {
    if (u === 'urgent') {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(220, 38, 38, 0.14)',
            color: '#B91C1C',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            fontWeight: 800,
          }}
        >
          🔴 URGENT À VENDRE EN PRIO
        </span>
      );
    }
    if (u === 'high') {
      return (
        <span
          className="badge"
          style={{
            background: 'rgba(249, 115, 22, 0.15)',
            color: '#C2410C',
            border: '1px solid rgba(249, 115, 22, 0.4)',
            fontWeight: 700,
          }}
        >
          🟠 PRIORITÉ COMMERCIALE HAUTE
        </span>
      );
    }
    if (u === 'resting') {
      return <span className="badge badge-green">🟢 EN REPOS POST-MISE (GARDE)</span>;
    }
    return <span className="badge badge-gold">👑 ŒNOTÈQUE & ALLOCATIONS RARES</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 1. Bandeau KPIs : Livre de Cave & Priorités d'Écoulement */}
      <div className="kpi-grid">
        <div className="kpi-card" style={{ borderLeft: '4px solid #DC2626' }}>
          <div className="kpi-label">Lots Urgents à Écouler en Priorité</div>
          <div className="kpi-value tabular" style={{ color: '#B91C1C' }}>
            {urgentCount} emplacement(s)
          </div>
          <div className="kpi-sub">
            Fins de millésime à vendre avant changement de carte ou palox à libérer avant mise
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #F97316' }}>
          <div className="kpi-label">En Pleine Fenêtre Commerciale (Prêts)</div>
          <div className="kpi-value tabular" style={{ color: '#C2410C' }}>
            {highPriorityCount} emplacement(s)
          </div>
          <div className="kpi-sub">
            Habillés en cartons sur palettes · Rotation active CHR & Cavistes
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Stock Total Rangé ({zones.length} Zones d’Entrepôt)</div>
          <div className="kpi-value tabular">
            {totalBottlesInCellar.toLocaleString('fr-FR')} cols
          </div>
          <div className="kpi-sub">
            Multi-emplacements actif : un même lot peut être réparti entre Palox, Palette & Caveau
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(26, 94, 66, 0.12)',
            border: '1px solid rgba(26, 94, 66, 0.4)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {statusBanner}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setStatusBanner(null)}
          >
            OK
          </button>
        </div>
      )}

      {/* 2. Plan Visuel des Zones Physiques du Chai à Bouteilles + Fiche Sommelier & Rangement */}
      <div className="grid-2">
        {/* Carte Interactive des Zones de Rangement (100% adaptable à tout domaine/entrepôt) */}
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <span className="badge badge-gold">ARCHITECTURE D’ENTREPÔT PERSONNALISABLE</span>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '18px' }}>
                Plan de Rangement ({zones.length} Zones · {racks.length} Travées/Palox)
              </h3>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-gold"
                onClick={() => setShowAddStructureModal(true)}
                title="Ajouter un nouveau bâtiment, une cave voûtée, une allée ou un palox propre au domaine"
              >
                <Building2 size={13} />
                <span>+ Zone / Travée / Palox</span>
              </button>

              <select
                className="form-select"
                style={{ width: 'auto', fontSize: '12px' }}
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as 'all' | SaleUrgencyLevel)}
              >
                <option value="all">Toutes priorités ({mergedSlots.length})</option>
                <option value="urgent">🔴 Urgent à vendre</option>
                <option value="high">🟠 Priorité haute</option>
                <option value="resting">🟢 En repos (Garde)</option>
                <option value="oenotheque">👑 Œnotèque</option>
              </select>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            {zones.map((zoneName) => {
              const zoneItems = filteredSlots.filter((s) => s.zone === zoneName);
              return (
                <div
                  key={zoneName}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: '#192019',
                    color: '#FAF8F5',
                    border: '1px solid rgba(196, 164, 122, 0.45)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid rgba(196, 164, 122, 0.25)',
                      paddingBottom: '6px',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#E2C799' }}>
                      {zoneName}
                    </span>
                    <span style={{ fontSize: '11px', opacity: 0.8 }}>{zoneItems.length} réf.</span>
                  </div>

                  {zoneItems.map((slot) => {
                    const isSelected = activeSlot?.id === slot.id;
                    const borderColor =
                      slot.urgency === 'urgent'
                        ? '#EF4444'
                        : slot.urgency === 'high'
                        ? '#F97316'
                        : slot.urgency === 'resting'
                        ? '#10B981'
                        : '#C4A47A';
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          setTimeout(() => {
                            const el = document.getElementById('bottle-slot-inspector');
                            if (el && typeof el.scrollIntoView === 'function') {
                              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                          }, 40);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '10px',
                          borderRadius: '8px',
                          background: isSelected
                            ? 'rgba(196, 164, 122, 0.22)'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: isSelected ? `2px solid #FFFFFF` : `1.5px solid ${borderColor}`,
                          color: '#FAF8F5',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '4px',
                            marginBottom: '3px',
                          }}
                        >
                          <span
                            className="tabular"
                            style={{
                              fontWeight: 800,
                              fontSize: '11px',
                              color: borderColor,
                            }}
                          >
                            {slot.batchCode} · {slot.vintage}
                          </span>
                          <span className="tabular" style={{ fontSize: '11px', fontWeight: 700 }}>
                            {slot.availableBottles} disp. / {slot.physicalBottles} cols
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '12.5px', marginBottom: '2px' }}>
                          {slot.cuveeLabel}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#E2C799' }}>
                          📍 {slot.rackCode}
                        </div>
                        <div style={{ fontSize: '10px', opacity: 0.85, marginTop: '3px' }}>
                          ⏱ Écouler d’ici : <strong>{slot.prioritySellByDate}</strong>
                        </div>
                      </button>
                    );
                  })}

                  {zoneItems.length === 0 && (
                    <div style={{ fontSize: '11px', opacity: 0.6, padding: '8px 0' }}>
                      Aucun lot dans cette zone.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fiche d'Inspection Sommelier & Gestion de l'Emplacement Sélectionné */}
        {activeSlot && (
          <div id="bottle-slot-inspector" className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  {renderUrgencyBadge(activeSlot.urgency)}
                  <span className="badge badge-grape">{activeSlot.formatLabel}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '20px' }}>
                  {activeSlot.cuveeLabel} ({activeSlot.vintage}) — Lot {activeSlot.batchCode}
                </h3>
              </div>
              <div className="tabular" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-forest)' }}>
                  {activeSlot.availableBottles} cols vendables
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                  sur {activeSlot.physicalBottles} cols dans cet emplacement
                </div>
              </div>
            </div>

            {/* Diagnostic d'urgence de vente */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background:
                  activeSlot.urgency === 'urgent'
                    ? 'rgba(220, 38, 38, 0.08)'
                    : 'var(--color-bg-elevated)',
                border:
                  activeSlot.urgency === 'urgent'
                    ? '1px solid rgba(220, 38, 38, 0.35)'
                    : '1px solid var(--color-border)',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--color-ink)' }}>
                  🎯 Consigne Commerciale & Rotation Cave :
                </span>
                <span className="tabular" style={{ fontWeight: 700, fontSize: '12px', color: '#B91C1C' }}>
                  Date cible d’écoulement : {activeSlot.prioritySellByDate}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-ink-muted)', lineHeight: 1.45 }}>
                {activeSlot.urgencyReason}
              </p>
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span>
                  🍷 <strong>Fenêtre Sommelier :</strong> {activeSlot.sommelierPeakWindow}
                </span>
                <span>
                  📦 <strong>État :</strong> {activeSlot.dressingState}
                </span>
              </div>
            </div>

            {/* Contrôles de Zone, Rangement (Palox/Casier) & Changement de Priorité */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '10px',
                marginBottom: '14px',
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '11.5px' }}>
                  🏢 Zone / Bâtiment d’entrepôt
                </label>
                <select
                  className="form-select"
                  value={activeSlot.zone}
                  onChange={(e) => handleChangeZone(activeSlot.id, e.target.value)}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11.5px' }}>
                  📍 Travée / Palox / Casier précis
                </label>
                <select
                  className="form-select"
                  value={activeSlot.rackCode}
                  onChange={(e) => handleMoveSlot(activeSlot.id, e.target.value)}
                >
                  {racks.map((rk) => (
                    <option key={rk} value={rk}>
                      {rk}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11.5px' }}>
                  🔥 Niveau d’urgence commerciale
                </label>
                <select
                  className="form-select"
                  value={activeSlot.urgency}
                  onChange={(e) =>
                    handleChangeUrgency(activeSlot.id, e.target.value as SaleUrgencyLevel)
                  }
                >
                  <option value="urgent">🔴 Urgent à vendre en priorité</option>
                  <option value="high">🟠 Priorité commerciale haute</option>
                  <option value="resting">🟢 En repos post-mise (Garde)</option>
                  <option value="oenotheque">👑 Réserve Œnotèque</option>
                </select>
              </div>
            </div>

            {/* Boutons d'actions logistiques : Scinder sur un autre emplacement (Split) ou Habiller */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              {activeSlot.availableBottles > 6 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSplitTargetSlot(activeSlot);
                    setSplitQty(String(Math.min(60, Math.floor(activeSlot.availableBottles / 2))));
                  }}
                >
                  <Scissors size={14} />
                  <span>
                    Scinder / Répartir une partie sur un autre emplacement (Palox → Palette / Caveau)
                  </span>
                </button>
              )}

              {activeSlot.dressingState.includes('Tiré-Bouché Nu') && (
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => handleDressPaloxToReady(activeSlot.id)}
                >
                  <Package size={14} />
                  <span>Habiller tout ce Palox (Étiqueter CRD → Zone B)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Vue Tabulaire Complète triée par Urgence d'Écoulement */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '17px' }}>
              Registre d’Écoulement Prioritaire & Localisation Multi-Emplacements en Cave
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-ink-muted)' }}>
              Permet à l’équipe commerciale et au magasinier de savoir immédiatement quel lot vendre en premier et dans quelle allée/palox le prélever.
            </p>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Priorité de Vente</th>
              <th>Date Cible Écoulement</th>
              <th>Lot & Cuvée</th>
              <th>Zone & Rangement Physique</th>
              <th>Habillage</th>
              <th>Dispo / Physique</th>
              <th>Fenêtre Sommelier</th>
            </tr>
          </thead>
          <tbody>
            {filteredSlots.map((s) => (
              <tr
                key={s.id}
                onClick={() => setSelectedSlotId(s.id)}
                style={{
                  cursor: 'pointer',
                  background:
                    activeSlot?.id === s.id ? 'rgba(196, 164, 122, 0.12)' : undefined,
                }}
              >
                <td>{renderUrgencyBadge(s.urgency)}</td>
                <td className="tabular" style={{ fontWeight: 700 }}>
                  {s.prioritySellByDate}
                </td>
                <td>
                  <strong>
                    {s.cuveeLabel} ({s.vintage})
                  </strong>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                    Lot {s.batchCode} · {s.formatLabel}
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.rackCode}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>{s.zone}</div>
                </td>
                <td>
                  <span className="badge badge-gold">{s.dressingState}</span>
                </td>
                <td className="tabular" style={{ fontWeight: 700 }}>
                  {s.availableBottles} / {s.physicalBottles} cols
                </td>
                <td style={{ fontSize: '12px' }}>{s.sommelierPeakWindow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modale 1 : Ajouter une Zone / Bâtiment ou un Palox / Travée sur-mesure */}
      {showAddStructureModal && (
        <div className="modal-backdrop" onClick={() => setShowAddStructureModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontSize: '20px' }}>
              Configurer l’Architecture de votre Chai à Bouteilles / Entrepôt
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Adaptez les zones et les travées à la topologie exacte du domaine (Cave voûtée, bâtiment climatisé, entrepôt logistique déporté, palox 500 ou 600 cols).
            </p>
            <form onSubmit={handleAddCustomStructure}>
              <div className="form-group">
                <label className="form-label">Nouvelle Zone / Bâtiment de stockage</label>
                <input
                  type="text"
                  className="form-input"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Ex: Zone E · Entrepôt Climatisé Beaune (13°C)"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nouvelle Allée / Travée / Palox / Alvéole</label>
                <input
                  type="text"
                  className="form-input"
                  value={newRackName}
                  onChange={(e) => setNewRackName(e.target.value)}
                  placeholder="Ex: Entrepôt Beaune · Allée 1 · Palox #E-01"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddStructureModal(false)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={14} />
                  <span>Ajouter au plan de cave</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale 2 : Scinder (Split) un lot sur un autre emplacement simultané */}
      {splitTargetSlot && (
        <div className="modal-backdrop" onClick={() => setSplitTargetSlot(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, fontSize: '20px' }}>
              Scinder / Répartir le lot {splitTargetSlot.batchCode} ({splitTargetSlot.cuveeLabel})
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-ink-muted)', marginBottom: '14px' }}>
              Transférez une partie des <strong>{splitTargetSlot.availableBottles} bouteilles</strong> disponibles de{' '}
              <code>{splitTargetSlot.rackCode}</code> vers un second emplacement (ex: habillage partiel sur palette ou réassort caveau) tout en conservant le solde dans le palox d’origine.
            </p>
            <form onSubmit={handleExecuteSplit}>
              <div className="form-group">
                <label className="form-label">
                  Quantité à prélever et déplacer (max {splitTargetSlot.availableBottles - 1} cols)
                </label>
                <input
                  type="number"
                  min={1}
                  max={splitTargetSlot.availableBottles - 1}
                  className="form-input tabular"
                  value={splitQty}
                  onChange={(e) => setSplitQty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Zone de destination</label>
                <select
                  className="form-select"
                  value={splitDestZone}
                  onChange={(e) => setSplitDestZone(e.target.value)}
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Emplacement précis (Palox / Palette / Casier)</label>
                <select
                  className="form-select"
                  value={splitDestRack}
                  onChange={(e) => setSplitDestRack(e.target.value)}
                >
                  {racks.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">État d’habillage de la fraction déplacée</label>
                <select
                  className="form-select"
                  value={splitDressing}
                  onChange={(e) =>
                    setSplitDressing(e.target.value as BottleSlotRecord['dressingState'])
                  }
                >
                  <option value="Habillé CRD France (Cartons de 6)">
                    Habillé CRD France (Cartons de 6)
                  </option>
                  <option value="Habillé Export Neutre (Cartons)">
                    Habillé Export Neutre (Cartons)
                  </option>
                  <option value="Caisse Bois Origine (CBO)">Caisse Bois Origine (CBO)</option>
                  <option value="Tiré-Bouché Nu (Palox Fil 600 cols)">
                    Tiré-Bouché Nu (Palox Fil 600 cols)
                  </option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSplitTargetSlot(null)}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  <Scissors size={14} />
                  <span>Valider la répartition multi-emplacements</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
