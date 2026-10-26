import React, { createContext, useContext, useState } from 'react';

export type MainModuleId =
  | 'overview'
  | 'vineyard'
  | 'cellar'
  | 'aging'
  | 'bottling'
  | 'supplies'
  | 'sales'
  | 'traceability'
  | 'finance';

export type AddonModuleId =
  | 'phyto_tesa'
  | 'negoce'
  | 'elabel_qr'
  | 'allocations'
  | 'drm_douanes';

export type CommercialPresetId =
  | 'full_prestige'
  | 'harvest_field'
  | 'cellar_commerce'
  | 'independent_essential'
  | 'custom';

export interface DomaineModuleConfig {
  preset: CommercialPresetId;
  enabledMainModules: Record<MainModuleId, boolean>;
  enabledAddons: Record<AddonModuleId, boolean>;
}

const STORAGE_KEY = 'domaine-erp-modules-config-v1';

export const PRESET_CONFIGS: Record<
  Exclude<CommercialPresetId, 'custom'>,
  {
    title: string;
    badge: string;
    targetAudience: string;
    pricePositioning: string;
    description: string;
    enabledMainModules: Record<MainModuleId, boolean>;
    enabledAddons: Record<AddonModuleId, boolean>;
  }
> = {
  full_prestige: {
    title: 'Suite Complète « Haute Maison & Négoce »',
    badge: '100% Activé · Grands Domaines',
    targetAudience: 'Domaines de prestige (10 à 100 ha) & Maisons de Négoce (Bourgogne, Champagne, Bordeaux)',
    pricePositioning: 'Offre Signature (Tout-en-un : Vigne + Cave + QR UE + Allocations + DRM Douanes)',
    description:
      'Active l’intégralité de la chaîne de valeur, les allocations Grands Crus, les achats Négoce, la DRM Douanes CIEL, le QR Code nutritionnel UE et le cahier Phyto/TESA.',
    enabledMainModules: {
      overview: true,
      vineyard: true,
      cellar: true,
      aging: true,
      bottling: true,
      supplies: true,
      sales: true,
      traceability: true,
      finance: true,
    },
    enabledAddons: {
      phyto_tesa: true,
      negoce: true,
      elabel_qr: true,
      allocations: true,
      drm_douanes: true,
    },
  },
  harvest_field: {
    title: 'Pack « Terrain, Cadastre IGN & Vendanges 5h00 »',
    badge: 'Spécial Vigne & Vendanges',
    targetAudience: 'Domaines équipés d’un vieux logiciel comptable qui veulent uniquement l’outil terrain et vendanges',
    pricePositioning: 'Offre Entrée de Gamme Terrain (Vignoble + Livret GPS + Quai de réception)',
    description:
      'Masque toute la comptabilité, les ventes et l’élevage pour ne garder que l’Atlas Cadastral IGN, le Livret de Vendanges GPS 5h00, le Cahier Phyto/TESA et les pesées à quai.',
    enabledMainModules: {
      overview: true,
      vineyard: true,
      cellar: false,
      aging: false,
      bottling: false,
      supplies: false,
      sales: false,
      traceability: true,
      finance: false,
    },
    enabledAddons: {
      phyto_tesa: true,
      negoce: false,
      elabel_qr: false,
      allocations: false,
      drm_douanes: false,
    },
  },
  cellar_commerce: {
    title: 'Pack « Chai, DRM Douanes & Commerce »',
    badge: 'Concurrent direct Baqio / Wineriz',
    targetAudience: 'Vignerons & Caves cherchant le pilotage cuverie, l’étiquetage QR UE, la DRM Douanes et la facturation',
    pricePositioning: 'Offre Cœur de Gestion (Chai + Mise + QR Code + Commerce + DRM Douanes)',
    description:
      'Masque le suivi parcellaire/cultural pour se concentrer sur la vinification, la mise en bouteilles avec QR Code nutritionnel UE, les ventes/allocations et la DRM Douanes.',
    enabledMainModules: {
      overview: true,
      vineyard: false,
      cellar: true,
      aging: true,
      bottling: true,
      supplies: true,
      sales: true,
      traceability: true,
      finance: true,
    },
    enabledAddons: {
      phyto_tesa: false,
      negoce: true,
      elabel_qr: true,
      allocations: true,
      drm_douanes: true,
    },
  },
  independent_essential: {
    title: 'Pack « Vigneron Indépendant Essentiel »',
    badge: '5 à 15 ha · Sans complexité',
    targetAudience: 'Exploitations familiales en vente directe caveau et CHR (100% récoltant, sans négoce ni quotas)',
    pricePositioning: 'Offre Essentielle (De la Vigne à la Facture + DRM + QR Code, zéro superflu)',
    description:
      'Garde tout le parcours de la vigne au verre avec la DRM Douanes et le QR Code UE, mais désactive les modules complexes (Maison de Négoce et Quotas d’Allocations Grands Crus).',
    enabledMainModules: {
      overview: true,
      vineyard: true,
      cellar: true,
      aging: true,
      bottling: true,
      supplies: true,
      sales: true,
      traceability: true,
      finance: true,
    },
    enabledAddons: {
      phyto_tesa: true,
      negoce: false,
      elabel_qr: true,
      allocations: false,
      drm_douanes: true,
    },
  },
};

const DEFAULT_CONFIG: DomaineModuleConfig = {
  preset: 'full_prestige',
  enabledMainModules: { ...PRESET_CONFIGS.full_prestige.enabledMainModules },
  enabledAddons: { ...PRESET_CONFIGS.full_prestige.enabledAddons },
};

interface ModuleConfigContextValue {
  config: DomaineModuleConfig;
  applyPreset: (preset: Exclude<CommercialPresetId, 'custom'>) => void;
  toggleMainModule: (id: MainModuleId) => void;
  toggleAddon: (id: AddonModuleId) => void;
  isMainEnabled: (id: MainModuleId) => boolean;
  isAddonEnabled: (id: AddonModuleId) => boolean;
}

const ModuleConfigContext = createContext<ModuleConfigContextValue>({
  config: DEFAULT_CONFIG,
  applyPreset: () => {},
  toggleMainModule: () => {},
  toggleAddon: () => {},
  isMainEnabled: () => true,
  isAddonEnabled: () => true,
});

export const ModuleConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<DomaineModuleConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_CONFIG;
      const parsed = JSON.parse(raw) as Partial<DomaineModuleConfig>;
      return {
        preset: parsed.preset ?? 'full_prestige',
        enabledMainModules: {
          ...DEFAULT_CONFIG.enabledMainModules,
          ...(parsed.enabledMainModules ?? {}),
        },
        enabledAddons: {
          ...DEFAULT_CONFIG.enabledAddons,
          ...(parsed.enabledAddons ?? {}),
        },
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const persist = (next: DomaineModuleConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  };

  const applyPreset = (preset: Exclude<CommercialPresetId, 'custom'>) => {
    const target = PRESET_CONFIGS[preset];
    persist({
      preset,
      enabledMainModules: { ...target.enabledMainModules },
      enabledAddons: { ...target.enabledAddons },
    });
  };

  const toggleMainModule = (id: MainModuleId) => {
    if (id === 'overview') return; // Le cockpit reste toujours accessible
    const nextMain = {
      ...config.enabledMainModules,
      [id]: !config.enabledMainModules[id],
    };
    persist({
      preset: 'custom',
      enabledMainModules: nextMain,
      enabledAddons: config.enabledAddons,
    });
  };

  const toggleAddon = (id: AddonModuleId) => {
    const nextAddons = {
      ...config.enabledAddons,
      [id]: !config.enabledAddons[id],
    };
    persist({
      preset: 'custom',
      enabledMainModules: config.enabledMainModules,
      enabledAddons: nextAddons,
    });
  };

  return (
    <ModuleConfigContext.Provider
      value={{
        config,
        applyPreset,
        toggleMainModule,
        toggleAddon,
        isMainEnabled: (id) => Boolean(config.enabledMainModules[id]),
        isAddonEnabled: (id) => Boolean(config.enabledAddons[id]),
      }}
    >
      {children}
    </ModuleConfigContext.Provider>
  );
};

export function useModuleConfig(): ModuleConfigContextValue {
  return useContext(ModuleConfigContext);
}
