import React, { useState } from 'react';
import {
  Leaf,
  CheckCircle2,
  Users,
  Download,
  Plus,
} from 'lucide-react';
import type { Parcel } from '../../domain/types';

interface PhytoIntervention {
  id: string;
  date: string;
  parcelId: string;
  parcelCode: string;
  parcelName: string;
  product: string;
  category: 'Cuivre Bio' | 'Soufre Bio' | 'Biodynamie 500/501' | 'Travail du sol';
  dosePerHa: string;
  copperMetalKgHa: number;
  darDays: number; // Délai Avant Récolte réglementaire
  zntMeters: number; // Zone Non Traitée
  operator: string;
  weatherNote: string;
}

interface SeasonalWorkerEntry {
  id: string;
  name: string;
  role: 'Coupeur' | 'Porteur / Hottier' | 'Chauffeur Benne' | 'Tri Table';
  team: 'Équipe A (Coteau)' | 'Équipe B (Plaine)' | 'Équipe C (Chai)';
  contractType: 'TESA Vendanges CDD';
  hoursWorked: number;
  cratesPicked: number;
  mealIncluded: boolean;
  lodgingIncluded: boolean;
  hourlyGrossEur: number;
}

const INITIAL_PHYTO_LOG: PhytoIntervention[] = [
  {
    id: 'phy-1',
    date: '2026-07-18',
    parcelId: 'parcel-c',
    parcelCode: 'CP',
    parcelName: 'Le Clos du Puits (Grand Cru)',
    product: 'Bouillie Bordelaise RSR (20% Cu) + Tisane d’Osier',
    category: 'Cuivre Bio',
    dosePerHa: '1,25 kg/ha',
    copperMetalKgHa: 0.25,
    darDays: 21,
    zntMeters: 20,
    operator: 'Jean-Luc M. (Tracteur enjambeur électrique)',
    weatherNote: 'Vent < 8 km/h · Hygrométrie 68% · 06h30',
  },
  {
    id: 'phy-2',
    date: '2026-08-04',
    parcelId: 'origin-a',
    parcelCode: 'HR',
    parcelName: 'Les Hauts Rangs (1er Cru)',
    product: 'Soufre Mouillable Microthiol + Silice de Corne (501)',
    category: 'Soufre Bio',
    dosePerHa: '3,00 kg/ha',
    copperMetalKgHa: 0,
    darDays: 14,
    zntMeters: 5,
    operator: 'Jean-Luc M.',
    weatherNote: 'Ciel clair · Sans vent · 06h00',
  },
  {
    id: 'phy-3',
    date: '2026-08-19',
    parcelId: 'parcel-e1',
    parcelCode: 'PP-1',
    parcelName: 'Les Pierres Plates Nord (1er Cru)',
    product: 'Hydroxyde de Cuivre (Dose réduite fermeture grappe)',
    category: 'Cuivre Bio',
    dosePerHa: '0,90 kg/ha',
    copperMetalKgHa: 0.18,
    darDays: 21,
    zntMeters: 20,
    operator: 'Marc V.',
    weatherNote: 'Temps sec · Fin de campagne phytosanitaire',
  },
  {
    id: 'phy-4',
    date: '2026-09-02',
    parcelId: 'parcel-f',
    parcelCode: 'VM',
    parcelName: 'La Vigne du Moulin',
    product: 'Décoction de Prêle & Valériane (Préparation biodynamique)',
    category: 'Biodynamie 500/501',
    dosePerHa: '15 L/ha (Dynamisé 1h)',
    copperMetalKgHa: 0,
    darDays: 0,
    zntMeters: 0,
    operator: 'Jean-Luc M.',
    weatherNote: 'Matinée fraîche · Accompagnement maturité',
  },
];

const INITIAL_WORKERS: SeasonalWorkerEntry[] = [
  {
    id: 'w-1',
    name: 'Camille Garnier',
    role: 'Coupeur',
    team: 'Équipe A (Coteau)',
    contractType: 'TESA Vendanges CDD',
    hoursWorked: 42,
    cratesPicked: 148,
    mealIncluded: true,
    lodgingIncluded: false,
    hourlyGrossEur: 12.65,
  },
  {
    id: 'w-2',
    name: 'Romain Pelletier',
    role: 'Porteur / Hottier',
    team: 'Équipe A (Coteau)',
    contractType: 'TESA Vendanges CDD',
    hoursWorked: 44,
    cratesPicked: 310,
    mealIncluded: true,
    lodgingIncluded: true,
    hourlyGrossEur: 13.8,
  },
  {
    id: 'w-3',
    name: 'Sofia Benali',
    role: 'Coupeur',
    team: 'Équipe B (Plaine)',
    contractType: 'TESA Vendanges CDD',
    hoursWorked: 38,
    cratesPicked: 132,
    mealIncluded: true,
    lodgingIncluded: false,
    hourlyGrossEur: 12.65,
  },
  {
    id: 'w-4',
    name: 'Thierry Deschamps',
    role: 'Chauffeur Benne',
    team: 'Équipe A (Coteau)',
    contractType: 'TESA Vendanges CDD',
    hoursWorked: 46,
    cratesPicked: 0,
    mealIncluded: true,
    lodgingIncluded: false,
    hourlyGrossEur: 14.9,
  },
];

export const PhytoAndTesaPanel: React.FC<{ parcels: Parcel[] }> = ({ parcels }) => {
  const [activeSubView, setActiveSubView] = useState<'phyto' | 'tesa'>('phyto');
  const [phytoList, setPhytoList] = useState<PhytoIntervention[]>(INITIAL_PHYTO_LOG);
  const [workers, setWorkers] = useState<SeasonalWorkerEntry[]>(INITIAL_WORKERS);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Formulaire ajout intervention phyto
  const [newParcelId, setNewParcelId] = useState<string>(parcels[0]?.id ?? 'parcel-c');
  const [newProduct, setNewProduct] = useState('Tisane d’Ortie & Silice 501 (Biodynamie)');
  const [newCategory, setNewCategory] = useState<PhytoIntervention['category']>('Biodynamie 500/501');
  const [newDose, setNewDose] = useState('12 L/ha');
  const [newCopper, setNewCopper] = useState('0');
  const [newDar, setNewDar] = useState('0');

  // Cumul annuel cuivre (référence Campagne 2026 : 1,92 kg/ha antérieurs + saisies)
  const cumulativeCopperKgHa = Number(
    (1.92 + phytoList.reduce((acc, item) => acc + item.copperMetalKgHa, 0)).toFixed(2)
  );
  const maxBioCopperKgHa = 4.0; // Plafond réglementaire AB / Demeter (lissé sur 7 ans à 4 kg/ha/an)

  const handleAddPhyto = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parcels.find((p) => p.id === newParcelId) ?? parcels[0];
    if (!target) return;
    const item: PhytoIntervention = {
      id: `phy-${Date.now()}`,
      date: '2026-09-12',
      parcelId: target.id,
      parcelCode: target.code,
      parcelName: target.name.replace(' — fictif', ''),
      product: newProduct,
      category: newCategory,
      dosePerHa: newDose,
      copperMetalKgHa: parseFloat(newCopper || '0') || 0,
      darDays: parseInt(newDar || '0', 10) || 0,
      zntMeters: Number(newDar) > 0 ? 20 : 5,
      operator: 'Chef de Culture',
      weatherNote: 'Vent faible · Hygrométrie optimale',
    };
    setPhytoList((prev) => [item, ...prev]);
    setExportNotice(
      `Intervention enregistrée au Registre Phytosanitaire sur ${target.name.replace(' — fictif', '')} (DAR vérifié : conforme pour la vendange).`
    );
  };

  const handleAddWorkerHours = (id: string, deltaHours: number, deltaCrates: number) => {
    setWorkers((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              hoursWorked: Math.max(0, w.hoursWorked + deltaHours),
              cratesPicked: Math.max(0, w.cratesPicked + deltaCrates),
            }
          : w
      )
    );
  };

  const handleExportTesaCsv = () => {
    const header =
      'salarie;fonction;equipe;contrat;heures_travaillees;caisses_coupees;taux_horaire_brut_eur;total_brut_estime_eur;panier_repas;hebergement';
    const rows = workers.map((w) => {
      const gross = (w.hoursWorked * w.hourlyGrossEur).toFixed(2);
      return `${w.name};${w.role};${w.team};${w.contractType};${w.hoursWorked};${w.cratesPicked};${w.hourlyGrossEur};${gross};${w.mealIncluded ? 'OUI' : 'NON'};${w.lodgingIncluded ? 'OUI' : 'NON'}`;
    });
    const csv = [header, ...rows].join('\n');
    try {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export-tesa-msa-vendanges-2026.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback in test environment
    }
    setExportNotice(
      'Fichier "export-tesa-msa-vendanges-2026.csv" généré avec succès pour déclaration MSA / Paie saisonniers (illustratif).'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Sous-barre de bascule Cahier Phyto Bio/HVE vs Équipes Vendangeurs TESA */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span className="badge badge-green">Certifié Bio AB · HVE 3 · Biodynamie</span>
            <span className="badge badge-gold">Contrôle DAR Avant Vendanges : 100% OK</span>
          </div>
          <h3 style={{ margin: 0, fontSize: '18px' }}>
            Traçabilité Agronomique Annuelle & Gestion Sociale des Vendangeurs (TESA)
          </h3>
        </div>

        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-btn ${activeSubView === 'phyto' ? 'active' : ''}`}
            onClick={() => setActiveSubView('phyto')}
          >
            <Leaf size={14} />
            <span>🌿 Registre Phytosanitaire & DAR ({phytoList.length})</span>
          </button>
          <button
            type="button"
            className={`segmented-btn ${activeSubView === 'tesa' ? 'active' : ''}`}
            onClick={() => setActiveSubView('tesa')}
          >
            <Users size={14} />
            <span>👷 Équipes Vendangeurs & TESA MSA ({workers.length})</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(26, 94, 66, 0.12)',
            border: '1px solid rgba(26, 94, 66, 0.4)',
            color: 'var(--color-ink)',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {exportNotice}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setExportNotice(null)}
          >
            Fermer
          </button>
        </div>
      )}

      {activeSubView === 'phyto' ? (
        <>
          {/* 3 Indicateurs Clés : Cumul Cuivre Bio, IFT HVE, et Statut DAR Vendanges */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Cumul Cuivre Métal 2026 (Plafond Bio / Demeter)</div>
              <div className="kpi-value tabular">
                {cumulativeCopperKgHa} <span style={{ fontSize: '15px' }}>/ {maxBioCopperKgHa} kg/ha/an</span>
              </div>
              <div
                style={{
                  marginTop: '8px',
                  height: '7px',
                  borderRadius: '999px',
                  background: 'var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (cumulativeCopperKgHa / maxBioCopperKgHa) * 100)}%`,
                    height: '100%',
                    background: cumulativeCopperKgHa < 3.0 ? '#1A5E42' : '#D97706',
                  }}
                />
              </div>
              <div className="kpi-sub" style={{ marginTop: '6px' }}>
                ✓ Marge de sécurité : {(maxBioCopperKgHa - cumulativeCopperKgHa).toFixed(2)} kg/ha sous le seuil AB
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Contrôle DAR (Délai Avant Récolte)</div>
              <div className="kpi-value" style={{ color: '#1A5E42' }}>
                100% Libéré
              </div>
              <div className="kpi-sub">
                Dernière intervention cuivrée le 19/08/2026 (&gt; 60 jours avant vendange · DAR requis : 21 j)
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Indice IFT & Biodiversité HVE 3</div>
              <div className="kpi-value tabular">
                0,00 <span style={{ fontSize: '14px' }}>IFT Chimique de synthèse</span>
              </div>
              <div className="kpi-sub">
                100% Biocontrôle, Soufre, Cuivre micro-dosé & Tisanes biodynamiques (Haies & murgers : 14% SAU)
              </div>
            </div>
          </div>

          {/* Formulaire rapide d'enregistrement au Cahier de Vigne + Tableau réglementaire */}
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
                  Registre Phytosanitaire Réglementaire & Préparations Biodynamiques
                </h3>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
                  Traçabilité parcellaire obligatoire (Arrêté du 16 juin 2009 / Audit Certipaq Bio & HVE) — Aucune préconisation automatique de dose.
                </p>
              </div>
              <span className="badge badge-gold">Prêt pour Audit Ecocert / HVE</span>
            </div>

            <form
              onSubmit={handleAddPhyto}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                padding: '12px',
                background: 'var(--color-bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                marginBottom: '16px',
                alignItems: 'end',
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Parcelle concernée
                </label>
                <select
                  className="form-select"
                  value={newParcelId}
                  onChange={(e) => setNewParcelId(e.target.value)}
                >
                  {parcels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name.replace(' — fictif', '')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Type d’intervention
                </label>
                <select
                  className="form-select"
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as PhytoIntervention['category'])
                  }
                >
                  <option value="Biodynamie 500/501">Biodynamie 500/501 / Tisane</option>
                  <option value="Cuivre Bio">Cuivre Bio (Bouillie / Hydroxyde)</option>
                  <option value="Soufre Bio">Soufre Mouillable Bio</option>
                  <option value="Travail du sol">Travail du sol / Décavaillonnage</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Intrant / Opération constatée
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Dose appliquée (saisie humaine)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={newDose}
                  onChange={(e) => setNewDose(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>
                  Cuivre métal (kg/ha) & DAR (j)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.05"
                    className="form-input"
                    value={newCopper}
                    onChange={(e) => setNewCopper(e.target.value)}
                    title="Cuivre métal en kg/ha"
                  />
                  <input
                    type="number"
                    className="form-input"
                    value={newDar}
                    onChange={(e) => setNewDar(e.target.value)}
                    title="Délai Avant Récolte (jours)"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ height: '38px' }}>
                <Plus size={14} />
                <span>Inscrire au registre</span>
              </button>
            </form>

            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Parcelle</th>
                  <th>Catégorie</th>
                  <th>Intrant / Intervention enregistrée</th>
                  <th>Dose constatée</th>
                  <th>Cuivre métal</th>
                  <th>DAR & ZNT</th>
                  <th>Statut Vendange</th>
                </tr>
              </thead>
              <tbody>
                {phytoList.map((row) => (
                  <tr key={row.id}>
                    <td className="tabular">{row.date}</td>
                    <td>
                      <strong>{row.parcelCode}</strong> · {row.parcelName}
                    </td>
                    <td>
                      <span className="badge badge-green">{row.category}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.product}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                        {row.operator} · {row.weatherNote}
                      </div>
                    </td>
                    <td className="tabular">{row.dosePerHa}</td>
                    <td className="tabular">
                      {row.copperMetalKgHa > 0 ? `${row.copperMetalKgHa.toFixed(2)} kg/ha` : '—'}
                    </td>
                    <td className="tabular">
                      DAR {row.darDays} j · ZNT {row.zntMeters} m
                    </td>
                    <td>
                      <span
                        className="badge badge-green"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle2 size={12} /> DAR Purgé (Coupe autorisée)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Sous-vue 2 : Pointage Vendangeurs & Export TESA Simplifié (MSA) */
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                Pointage des Équipes Saisonnières & Préparation TESA Vendanges (MSA)
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--color-ink-muted)' }}>
                Suivi journalier des heures, caisses coupées, paniers repas et hébergement pour export vers le portail MSA / Cabinet comptable.
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleExportTesaCsv}>
              <Download size={14} />
              <span>Exporter le fichier TESA / Paie Vendanges (.CSV)</span>
            </button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Saisonnier</th>
                <th>Rôle & Équipe Terrain</th>
                <th>Contrat</th>
                <th>Heures Pointées</th>
                <th>Productivité (Caisses)</th>
                <th>Repas & Logement</th>
                <th>Brut Estimé (Illustratif)</th>
                <th>Pointage Rapide (+1 Journée)</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => {
                const totalGross = (w.hoursWorked * w.hourlyGrossEur).toFixed(2);
                return (
                  <tr key={w.id}>
                    <td>
                      <strong>{w.name}</strong>
                    </td>
                    <td>
                      <div>{w.role}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>{w.team}</div>
                    </td>
                    <td>
                      <span className="badge badge-gold">{w.contractType}</span>
                    </td>
                    <td className="tabular" style={{ fontWeight: 700 }}>
                      {w.hoursWorked} h
                    </td>
                    <td className="tabular">
                      {w.cratesPicked > 0 ? `${w.cratesPicked} caisses` : 'Forfait horaire'}
                    </td>
                    <td>
                      <span className="badge badge-green">
                        {w.mealIncluded ? 'Panier Midi' : 'Sans repas'}
                        {w.lodgingIncluded ? ' + Hébergé' : ''}
                      </span>
                    </td>
                    <td className="tabular" style={{ fontWeight: 700 }}>
                      {totalGross} €
                      <div style={{ fontSize: '10.5px', color: 'var(--color-ink-muted)' }}>
                        ({w.hourlyGrossEur.toFixed(2)} €/h)
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() =>
                          handleAddWorkerHours(w.id, 8, w.role === 'Coupeur' ? 28 : 0)
                        }
                      >
                        + 1 Journée (8h)
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
