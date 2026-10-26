import React, { useState } from 'react';
import { Download, CheckCircle2, Truck } from 'lucide-react';
import type { DomainState } from '../../domain/types';
import { lotVolumeMl } from '../../domain/selectors';

interface CustomsDrmPanelProps {
  state: DomainState;
}

export const CustomsDrmPanel: React.FC<CustomsDrmPanelProps> = ({ state }) => {
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const lots = Object.values(state.lots);
  const batches = Object.values(state.batches);
  const shipments = Object.values(state.shipments);

  // Calcul réel du stock en cuverie/fûts (en hL) depuis le store
  const totalBulkMl = lots.reduce((acc, l) => acc + lotVolumeMl(state, l.id), 0);
  const totalBulkHl = Number((totalBulkMl / 100_000).toFixed(2));

  // Calcul réel du volume embouteillé et expédié (en hL)
  const totalBottledHl = Number(
    (
      batches.reduce((acc, b) => {
        const sku = state.skus[b.skuId];
        return acc + b.bottles * (sku?.sizeMl ?? 750);
      }, 0) / 100_000
    ).toFixed(2)
  );

  const totalShippedBottles = shipments.reduce(
    (acc, s) => acc + s.lines.reduce((la, l) => la + l.quantity, 0),
    0
  );
  const shippedHl = Number(((totalShippedBottles * 750) / 100_000).toFixed(2));

  // Lignes de la DRM Mensuelle par Appellation / Code Produit Douane (INAOC)
  const drmLines = [
    {
      codeInaoc: 'B0841-GC',
      appellation: 'Bâtard-Montrachet Grand Cru (Blanc Tranquille AOP)',
      regime: 'Droits Suspendus (Chai & Cave)',
      openingHl: 14.2,
      harvestInHl: 1.62,
      bottlingTransferHl: 0,
      shippedCrdHl: 0.27,
      shippedExportDaeHl: 0.54,
      leesAndLossHl: 0.12,
    },
    {
      codeInaoc: 'B0842-1C',
      appellation: 'Puligny-Montrachet 1er Cru (Blanc & Rouge AOP)',
      regime: 'Droits Suspendus + CRD Bouteilles',
      openingHl: Math.max(18.5, totalBulkHl),
      harvestInHl: 3.3,
      bottlingTransferHl: totalBottledHl,
      shippedCrdHl: Math.max(0.9, shippedHl),
      shippedExportDaeHl: 1.35,
      leesAndLossHl: 0.24,
    },
    {
      codeInaoc: 'B0845-VL',
      appellation: 'Puligny-Montrachet & Meursault Village (AOP)',
      regime: 'Droits Suspendus',
      openingHl: 22.4,
      harvestInHl: 1.85,
      bottlingTransferHl: 4.5,
      shippedCrdHl: 1.08,
      shippedExportDaeHl: 0.9,
      leesAndLossHl: 0.18,
    },
  ];

  const handleDownloadCielXml = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- EXPORT ILLUSTRATIF DE DÉMONSTRATION — SANS VALEUR FISCALE OU DOUANIÈRE RÉELLE -->
<DeclarationRecapitulativeMensuelle xmlns="http://douane.finances.gouv.fr/ciel/drm/v2">
  <Entete>
    <Periode>2026-10</Periode>
    <NumeroAccises>FR021004892E001</NumeroAccises>
    <NumeroCVI>2151200842</NumeroCVI>
    <RaisonSociale>Domaine des Trois Coteaux (Démo Fictive)</RaisonSociale>
  </Entete>
  <BalancesMois>
${drmLines
  .map((l) => {
    const closing = (
      l.openingHl +
      l.harvestInHl -
      l.shippedCrdHl -
      l.shippedExportDaeHl -
      l.leesAndLossHl
    ).toFixed(2);
    return `    <Produit codeINAOC="${l.codeInaoc}" libelle="${l.appellation}">
      <StockDebutMoisHL>${l.openingHl.toFixed(2)}</StockDebutMoisHL>
      <EntreesRecolteHL>${l.harvestInHl.toFixed(2)}</EntreesRecolteHL>
      <SortiesAcquitteesCRDHL>${l.shippedCrdHl.toFixed(2)}</SortiesAcquitteesCRDHL>
      <SortiesExonereesExportDAEHL>${l.shippedExportDaeHl.toFixed(2)}</SortiesExonereesExportDAEHL>
      <PertesLiesOuillagesHL>${l.leesAndLossHl.toFixed(2)}</PertesLiesOuillagesHL>
      <StockFinMoisHL>${closing}</StockFinMoisHL>
    </Produit>`;
  })
  .join('\n')}
  </BalancesMois>
</DeclarationRecapitulativeMensuelle>`;

    try {
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DRM-CIEL-ProDouane-2026-10-DEMO.xml';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore in test environment
    }
    setExportMsg(
      'Fichier "DRM-CIEL-ProDouane-2026-10-DEMO.xml" généré (simulation illustrative de téléprocédure CIEL / EDI GAMMA).'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-gold">COMPTABILITÉ MATIÈRES & DOUANES (DRM)</span>
              <span className="badge badge-green">Synchronisé en temps réel avec Chai & Expéditions</span>
            </div>
            <h3 style={{ margin: 0, fontSize: '19px' }}>
              Déclaration Récapitulative Mensuelle (DRM — ProDouane CIEL) & Documents DAE / DSA
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-muted)' }}>
              Agrège automatiquement en hectolitres (hL) les entrées de vendanges, les mises, les pertes/ouillages et les sorties commerciales (Simulation illustrative sans connexion serveur douanier).
            </p>
          </div>

          <button type="button" className="btn btn-primary" onClick={handleDownloadCielXml}>
            <Download size={14} />
            <span>Générer l’Export XML ProDouane (CIEL)</span>
          </button>
        </div>

        {exportMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(26, 94, 66, 0.12)',
              border: '1px solid rgba(26, 94, 66, 0.4)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '14px',
            }}
          >
            ✅ {exportMsg}
          </div>
        )}

        <table className="table">
          <thead>
            <tr>
              <th>Code INAOC & Appellation</th>
              <th>Stock Début (hL)</th>
              <th>+ Entrées Récolte (hL)</th>
              <th>Dont Mis en Bouteille</th>
              <th>− Sorties France CRD</th>
              <th>− Sorties Export DAE</th>
              <th>− Lies & Ouillages</th>
              <th>= Stock Fin de Mois</th>
            </tr>
          </thead>
          <tbody>
            {drmLines.map((l) => {
              const closing = (
                l.openingHl +
                l.harvestInHl -
                l.shippedCrdHl -
                l.shippedExportDaeHl -
                l.leesAndLossHl
              ).toFixed(2);
              return (
                <tr key={l.codeInaoc}>
                  <td>
                    <strong>{l.appellation}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                      Code Douane : {l.codeInaoc} · {l.regime}
                    </div>
                  </td>
                  <td className="tabular">{l.openingHl.toFixed(2)} hL</td>
                  <td className="tabular" style={{ color: '#1A5E42', fontWeight: 700 }}>
                    +{l.harvestInHl.toFixed(2)} hL
                  </td>
                  <td className="tabular">{l.bottlingTransferHl.toFixed(2)} hL</td>
                  <td className="tabular">−{l.shippedCrdHl.toFixed(2)} hL</td>
                  <td className="tabular">−{l.shippedExportDaeHl.toFixed(2)} hL</td>
                  <td className="tabular">−{l.leesAndLossHl.toFixed(2)} hL</td>
                  <td className="tabular" style={{ fontWeight: 800, fontSize: '14px' }}>
                    {closing} hL
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Registre des Documents d'Accompagnement (DAE / DSA — EMCS GAMMA) */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Truck size={16} color="var(--color-gold-dark)" />
          <h3 style={{ margin: 0, fontSize: '17px' }}>
            Suivi des Titres de Mouvement (DAE Export & DSA / CRD France — Illustratif)
          </h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Réf. Document EMCS / GAMMA</th>
              <th>Type</th>
              <th>Destinataire</th>
              <th>Volume & Colisage</th>
              <th>Régime d’Accises</th>
              <th>Statut Apurement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="tabular">
                <strong>26FR02100489200018421</strong>
              </td>
              <td>
                <span className="badge badge-gold">DAE (e-AD Export)</span>
              </td>
              <td>Comptoir Nordique (Importateur UE / Export — fictif)</td>
              <td className="tabular">180 cols (1,35 hL)</td>
              <td>Suspension de droits</td>
              <td>
                <span className="badge badge-green">
                  <CheckCircle2 size={11} /> Apuré à destination
                </span>
              </td>
            </tr>
            <tr>
              <td className="tabular">
                <strong>DSA-2026-10-089</strong>
              </td>
              <td>
                <span className="badge badge-grape">DSA / Facture CRD</span>
              </td>
              <td>Table des Coteaux (CHR France — fictif)</td>
              <td className="tabular">120 cols (0,90 hL)</td>
              <td>Droits acquittés (3,98 €/hL)</td>
              <td>
                <span className="badge badge-green">
                  <CheckCircle2 size={11} /> Livré & Acquitté
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
