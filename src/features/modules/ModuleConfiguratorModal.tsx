import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  X,
  Grape,
  Wine,
  Layers,
  Package,
  ShoppingBag,
  Award,
  GitBranch,
  TrendingUp,
  QrCode,
  ShieldCheck,
  Handshake,
  Crown,
  Landmark,
  Download,
  Upload,
} from 'lucide-react';
import {
  useModuleConfig,
  PRESET_CONFIGS,
  type MainModuleId,
  type AddonModuleId,
  type CommercialPresetId,
} from './ModuleConfigContext';

const MAIN_MODULE_DESCRIPTIONS: Array<{
  id: MainModuleId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number }>;
  locked?: boolean;
}> = [
  {
    id: 'overview',
    label: 'Cockpit & Vue Multi-Millésimes',
    subtitle: 'Synthèse exécutive du domaine (Toujours actif)',
    icon: Sliders,
    locked: true,
  },
  {
    id: 'vineyard',
    label: '1. Vignoble, Cadastre IGN & Vendanges 5h00',
    subtitle: 'Carte satellite, livret parcellaire GPS, planning de coupe et pesées à quai',
    icon: Grape,
  },
  {
    id: 'cellar',
    label: '2. Chai & Vinification',
    subtitle: 'Cuverie interactive, fermentations, analyses et décisions œnologiques',
    icon: Wine,
  },
  {
    id: 'aging',
    label: '3. Élevage Fûts & Assemblage',
    subtitle: 'Parc à fûts, ouillages, soutirages et généalogie des assemblages',
    icon: Layers,
  },
  {
    id: 'bottling',
    label: '4. Conditionnement & Stock Bouteilles',
    subtitle: 'Ordres de mise, consommation matières sèches et lots tirés-bouchés',
    icon: Package,
  },
  {
    id: 'supplies',
    label: 'Matières Sèches & Achats Verre/Bouchons',
    subtitle: 'Commandes fournisseurs, réceptions et contrôle de disponibilité avant mise',
    icon: ShoppingBag,
  },
  {
    id: 'sales',
    label: '5. Ventes, Caveau & Expéditions',
    subtitle: 'Commandes clients, réservations de stocks, bons de livraison et retours',
    icon: Award,
  },
  {
    id: 'traceability',
    label: '6. Traçabilité & Filiation Amont-Aval',
    subtitle: 'Arbre complet de la parcelle jusqu’à la bouteille livrée',
    icon: GitBranch,
  },
  {
    id: 'finance',
    label: 'Pilotage Financier, Coûts & Douanes',
    subtitle: 'Factures illustratives, trésorerie prévisionnelle, DRM Douanes et investissements',
    icon: TrendingUp,
  },
];

const ADDON_DESCRIPTIONS: Array<{
  id: AddonModuleId;
  title: string;
  badge: string;
  subtitle: string;
  parentModule: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  {
    id: 'drm_douanes',
    title: 'Comptabilité Matières & DRM Douanes Mensuelle (CIEL / DAE)',
    badge: 'Obligation Légale France',
    subtitle:
      'Calcul automatique de la balance mensuelle en hL (Entrées récolte/négoce, Sorties CRD/suspendu, Lies) et export XML ProDouane CIEL.',
    parentModule: 'Logé dans : Pilotage & Finance',
    icon: Landmark,
  },
  {
    id: 'elabel_qr',
    title: 'Générateur QR Code E-Labeling Nutritionnel & Ingrédients (UE 2021/2117)',
    badge: 'Obligatoire UE depuis déc. 2023',
    subtitle:
      'Calcul automatique kJ/kcal pour 100 ml depuis les analyses du lot, liste des intrants/allergènes et génération du QR Code vectoriel sans abonnement tiers.',
    parentModule: 'Logé dans : Conditionnement & Stocks',
    icon: QrCode,
  },
  {
    id: 'allocations',
    title: 'Allocations Grands Crus, Quotas Clients & Grilles Multi-Formats',
    badge: 'Domaines de Prestige',
    subtitle:
      'Répartition annuelle des cuvées rares par client/importateur/étoilé Michelin, suivi des quotas (75cl, Magnum, Jéroboam) et conversion en commande.',
    parentModule: 'Logé dans : Ventes & Commerce',
    icon: Crown,
  },
  {
    id: 'negoce',
    title: 'Mode Maison de Négoce (Achats de Raisins, Moûts & Contrats Apporteurs)',
    badge: 'Domaine + Négoce',
    subtitle:
      'Distingue les apports Propriété (Domaine) des achats de vendanges/moûts auprès de vignerons partenaires avec suivi des contrats à quai.',
    parentModule: 'Logé dans : Vignoble > Quai & Pesées',
    icon: Handshake,
  },
  {
    id: 'phyto_tesa',
    title: 'Cahier Phytosanitaire (DAR / Cuivre Bio-HVE) & Pointage Vendangeurs TESA',
    badge: 'Agronomie & RH Vendanges',
    subtitle:
      'Suivi du cumul cuivre (limite 4 kg/ha/an), contrôle automatique du Délai Avant Récolte (DAR) et pointage journalier des saisonniers pour export TESA MSA.',
    parentModule: 'Logé dans : Vignoble & Récolte',
    icon: ShieldCheck,
  },
];

export const ModuleConfiguratorModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { config, applyPreset, toggleMainModule, toggleAddon } = useModuleConfig();
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);

  const activeMainCount = Object.values(config.enabledMainModules).filter(Boolean).length;
  const activeAddonCount = Object.values(config.enabledAddons).filter(Boolean).length;

  const DOMAINE_STORAGE_KEYS = [
    'domaine-erp-modules-config-v1',
    'domaine-erp-parcel-configs-v1',
    'domaine-erp-imported-parcels-v1',
    'domaine-erp-bottle-cellar-slots-v1',
    'domaine-erp-bottle-cellar-zones-v1',
    'domaine-erp-bottle-cellar-racks-v1',
    'domaine-erp-custom-containers-v1',
  ];

  const handleExportDomainProfile = () => {
    const dump: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      profileVersion: 1,
      keys: {},
    };
    const keyMap: Record<string, unknown> = {};
    DOMAINE_STORAGE_KEYS.forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) keyMap[k] = JSON.parse(raw);
      } catch {
        // Ignore
      }
    });
    dump.keys = keyMap;

    try {
      const blob = new Blob([JSON.stringify(dump, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'profil-domaine-sur-mesure.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore in test environment
    }
    setSnapshotMsg(
      'Profil complet du domaine ("profil-domaine-sur-mesure.json") exporté avec succès (Parcelles, Livret CVI, Zones d’entrepôt, Cuves sur-mesure & Modules).'
    );
  };

  const handleImportDomainProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result ?? '{}')) as {
          keys?: Record<string, unknown>;
        };
        if (parsed.keys && typeof parsed.keys === 'object') {
          Object.entries(parsed.keys).forEach(([k, val]) => {
            if (k.startsWith('domaine-erp-')) {
              localStorage.setItem(k, JSON.stringify(val));
            }
          });
          setSnapshotMsg('Profil Domaine chargé ! Rechargement de la configuration...');
          setTimeout(() => {
            window.location.reload();
          }, 400);
        }
      } catch {
        setSnapshotMsg('Fichier JSON de profil invalide.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '960px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-gold">ARCHITECTURE MODULAIRE À LA CARTE</span>
              <span className="badge badge-green">
                {activeMainCount}/9 Modules · {activeAddonCount}/5 Extensions Métier
              </span>
            </div>
            <h3 style={{ margin: '4px 0', fontSize: '22px' }}>
              Configurateur d’Offre & Modules du Domaine
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-ink-muted)' }}>
              Adaptez l’ERP en 1 clic à la taille et au besoin exact du client : du vigneron qui ne
              veut que <strong>l’outil Terrain & Vendanges 5h00</strong> jusqu’à la{' '}
              <strong>Grande Maison de Bourgogne (Domaine + Négoce + Allocations + Douanes)</strong>.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            <X size={15} />
            <span>Fermer</span>
          </button>
        </div>

        {/* 1. Les 4 Offres Commerciales Prêtes à Vendre */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-ink-muted)',
              marginBottom: '8px',
            }}
          >
            1. Choisir un Pack Commercial Prédéfini (selon la cible client) :
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
              gap: '10px',
            }}
          >
            {(
              Object.keys(PRESET_CONFIGS) as Array<Exclude<CommercialPresetId, 'custom'>>
            ).map((presetKey) => {
              const p = PRESET_CONFIGS[presetKey];
              const isSelected = config.preset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  onClick={() => applyPreset(presetKey)}
                  style={{
                    textAlign: 'left',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected
                      ? '2px solid var(--color-burgundy)'
                      : '1px solid var(--color-border)',
                    background: isSelected ? 'rgba(107, 30, 46, 0.06)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '4px',
                        marginBottom: '6px',
                      }}
                    >
                      <span className="badge badge-gold" style={{ fontSize: '10px' }}>
                        {p.badge}
                      </span>
                      {isSelected && <CheckCircle2 size={15} color="var(--color-burgundy)" />}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '13.5px',
                        color: 'var(--color-ink)',
                        marginBottom: '4px',
                      }}
                    >
                      {p.title}
                    </div>
                    <div
                      style={{
                        fontSize: '11.5px',
                        color: 'var(--color-ink-muted)',
                        lineHeight: 1.38,
                      }}
                    >
                      {p.description}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: 'var(--color-gold-dark)',
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: '6px',
                    }}
                  >
                    Cible : {p.targetAudience}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Briques Compétitives & Réglementaires (Add-ons à la carte) */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-ink-muted)',
              marginBottom: '8px',
            }}
          >
            2. Extensions Réglementaires & Métier (Activables / Désactivables à la carte) :
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ADDON_DESCRIPTIONS.map((addon) => {
              const IconComp = addon.icon;
              const enabled = config.enabledAddons[addon.id];
              return (
                <div
                  key={addon.id}
                  onClick={() => toggleAddon(addon.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: enabled
                      ? '1.5px solid rgba(26, 94, 66, 0.45)'
                      : '1px solid var(--color-border)',
                    background: enabled ? 'rgba(26, 94, 66, 0.05)' : 'var(--color-bg-elevated)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: enabled ? '#1A5E42' : 'var(--color-border)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <IconComp size={17} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)' }}>
                          {addon.title}
                        </span>
                        <span className="badge badge-gold" style={{ fontSize: '10px' }}>
                          {addon.badge}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--color-ink-light)' }}>
                          ({addon.parentModule})
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)', marginTop: '2px' }}>
                        {addon.subtitle}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`btn btn-sm ${enabled ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAddon(addon.id);
                    }}
                    style={{ minWidth: '96px', flexShrink: 0 }}
                  >
                    {enabled ? '✓ Activé' : 'Désactivé'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Modules Principaux de Navigation (Menu Latéral) */}
        <div style={{ marginBottom: '18px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-ink-muted)',
              marginBottom: '8px',
            }}
          >
            3. Modules du Menu Principal (Désélectionnez un module pour l’épurer de l’interface) :
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '8px',
            }}
          >
            {MAIN_MODULE_DESCRIPTIONS.map((mod) => {
              const IconComp = mod.icon;
              const enabled = config.enabledMainModules[mod.id];
              return (
                <div
                  key={mod.id}
                  onClick={() => !mod.locked && toggleMainModule(mod.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: enabled
                      ? '1px solid rgba(196, 164, 122, 0.65)'
                      : '1px dashed var(--color-border)',
                    background: enabled ? 'var(--color-surface)' : 'var(--color-bg-elevated)',
                    opacity: enabled ? 1 : 0.6,
                    cursor: mod.locked ? 'default' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconComp size={15} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--color-ink)' }}>
                        {mod.label}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-ink-muted)' }}>
                        {mod.subtitle}
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={mod.locked}
                    onChange={() => !mod.locked && toggleMainModule(mod.id)}
                    style={{ width: '16px', height: '16px', cursor: mod.locked ? 'default' : 'pointer' }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Sauvegarde & Portabilité d'un Profil Domaine Sur-Mesure (.JSON) */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-strong)',
            marginBottom: '18px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-ink)' }}>
                4. Portabilité & Sauvegarde de Configuration Domaine (.JSON)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-ink-muted)' }}>
                Exportez ou rechargez en 1 clic une configuration complète préparée pour un prospect (Parcelles CVI, Livret, Zones d’entrepôt, Cuves sur-mesure & Modules actifs).
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-gold"
                onClick={handleExportDomainProfile}
              >
                <Download size={14} />
                <span>Exporter Profil Domaine (.JSON)</span>
              </button>

              <label
                className="btn btn-sm btn-secondary"
                style={{ cursor: 'pointer', margin: 0 }}
              >
                <Upload size={14} />
                <span>Charger un Profil (.JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportDomainProfile}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {snapshotMsg && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(26, 94, 66, 0.12)',
                border: '1px solid rgba(26, 94, 66, 0.35)',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ✅ {snapshotMsg}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            <CheckCircle2 size={15} />
            <span>Appliquer cette configuration au Domaine</span>
          </button>
        </div>
      </div>
    </div>
  );
};
