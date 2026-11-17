import React, { useRef } from 'react';

/**
 * Barre d'onglets de module (navigation entre espaces de travail d'un même métier).
 *
 * Règle UX :
 *  - Un ONGLET change l'espace de travail affiché (Carte GPS, Livret, Planning, Quai…).
 *  - Une TUILE (`ds-tile`) déclenche une ACTION (ouvrir un formulaire de saisie).
 *  Ne jamais mélanger les deux dans une même rangée de vignettes.
 *
 * L'espace de travail s'affiche juste SOUS cette barre. Au changement d'onglet,
 * la barre est ramenée en haut de l'écran si l'utilisateur l'avait dépassée,
 * afin que le contenu affiché corresponde immédiatement à l'onglet choisi.
 */
export interface SubNavTab<T extends string> {
  id: T;
  label: string;
  hint?: string;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  count?: string | number;
  alert?: boolean;
}

/**
 * Fait défiler doucement jusqu'à la barre d'onglets UNIQUEMENT si elle est sortie
 * de la zone visible (utile depuis un bouton situé plus bas dans la page).
 * Ne provoque jamais de recentrage brutal si la barre est déjà visible à l'écran.
 */
export function scrollSubNavIntoView(anchorId: string): void {
  setTimeout(() => {
    try {
      const el = document.getElementById(anchorId);
      if (!el || typeof el.getBoundingClientRect !== 'function') return;
      const rect = el.getBoundingClientRect();
      const isHiddenAbove = rect.top < 64;
      const isHiddenBelow = rect.bottom > window.innerHeight - 24;
      if (isHiddenAbove || isHiddenBelow) {
        el.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      }
    } catch {
      // Ignore in test environment
    }
  }, 30);
}

export function SubNav<T extends string>({
  id,
  ariaLabel,
  tabs,
  active,
  onChange,
  trailing,
}: {
  id: string;
  ariaLabel: string;
  tabs: SubNavTab<T>[];
  active: T;
  onChange: (next: T) => void;
  trailing?: React.ReactNode;
}): React.ReactElement {
  const listRef = useRef<HTMLDivElement>(null);

  const select = (next: T) => {
    // L'utilisateur vient de cliquer directement sur l'onglet : ne jamais déplacer l'écran sous son curseur.
    onChange(next);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const idx = tabs.findIndex((t) => t.id === active);
    if (idx < 0) return;
    const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    const next = tabs[nextIdx];
    if (!next) return;
    e.preventDefault();
    select(next.id);
    const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`);
    btn?.focus();
  };

  return (
    <nav id={id} className="ds-subnav" aria-label={ariaLabel}>
      <div
        ref={listRef}
        className="ds-subnav-tabs"
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              data-tab-id={t.id}
              aria-pressed={isActive}
              className={`ds-subnav-tab ${isActive ? 'is-active' : ''}`}
              onClick={() => select(t.id)}
              title={t.hint}
            >
              {Icon && <Icon size={16} strokeWidth={1.9} />}
              <span className="ds-subnav-label">{t.label}</span>
              {t.count !== undefined && (
                <span className={`ds-subnav-count ${t.alert ? 'is-alert' : ''}`}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {trailing && <div className="ds-subnav-trailing">{trailing}</div>}
    </nav>
  );
}
