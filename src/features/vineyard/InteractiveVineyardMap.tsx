import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  Crosshair,
  Maximize2,
  Minimize2,
  Compass,
  Layers,
  MapPin,
  BookOpen,
} from 'lucide-react';
import type { Parcel } from '../../domain/types';

export interface ParcelMapItem {
  parcel: Parcel;
  pastilleNum: number;
  pageLivret: number;
  classification: 'Grand Cru' | '1er Cru' | 'Village';
  appellation: string;
  commune: string;
  sectionCadastrale?: string;
  nbRangs: string;
  status: 'a_faire' | 'en_cours' | 'vendange';
  daySlot: 'today' | 'tomorrow' | 'upcoming' | 'done';
  lat: number;
  lng: number;
  isCustomGps: boolean;
  googleMapsUrl: string;
  polygon: [number, number][];
}

interface InteractiveVineyardMapProps {
  items: ParcelMapItem[];
  selectedParcelId: string;
  onSelectParcel: (parcelId: string) => void;
  isEditingGpsPin: boolean;
  onToggleEditGpsPin: () => void;
  onSetCustomGps: (parcelId: string, lat: number, lng: number) => void;
  onOpenLivret?: () => void;
  fieldMode?: boolean;
}

export const InteractiveVineyardMap: React.FC<InteractiveVineyardMapProps> = ({
  items,
  selectedParcelId,
  onSelectParcel,
  isEditingGpsPin,
  onToggleEditGpsPin,
  onSetCustomGps,
  onOpenLivret,
  fieldMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const cadastreLayerRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [mapStyle, setMapStyle] = useState<'satellite' | 'cadastre'>('satellite');
  const [showCadastreOverlay, setShowCadastreOverlay] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gpsState, setGpsState] = useState<{
    active: boolean;
    lat: number | null;
    lng: number | null;
    label: string | null;
  }>({ active: false, lat: null, lng: null, label: null });

  const selectedItem = items.find((i) => i.parcel.id === selectedParcelId) ?? items[0];

  // Detect JSDOM test environment where Leaflet canvas/DOM measurements aren't needed
  const isJsDom =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');

  // Initialize Leaflet map
  useEffect(() => {
    if (isJsDom || !mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = selectedItem
      ? [selectedItem.lat, selectedItem.lng]
      : [46.9462, 4.7392];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Base layer: Esri World Imagery (High-Res Satellite)
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    ).addTo(map);
    tileLayerRef.current = satLayer;

    // Official French Cadastre Overlay (IGN Géoplateforme Parcellaire Express)
    const cadLayer = L.tileLayer(
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=PCI%20vecteur&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
      { maxZoom: 19, opacity: 0.75 }
    ).addTo(map);
    cadastreLayerRef.current = cadLayer;

    const fg = L.layerGroup().addTo(map);
    layerGroupRef.current = fg;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJsDom]);

  // Handle map style & cadastre overlay changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const url =
      mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(url, { maxZoom: 19 }).addTo(map);
    tileLayerRef.current.bringToBack();

    if (cadastreLayerRef.current) {
      if (showCadastreOverlay) {
        if (!map.hasLayer(cadastreLayerRef.current)) {
          cadastreLayerRef.current.addTo(map);
        }
      } else if (map.hasLayer(cadastreLayerRef.current)) {
        map.removeLayer(cadastreLayerRef.current);
      }
    }
  }, [mapStyle, showCadastreOverlay]);

  // Handle click on map when positioning a custom Domain GPS pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!isEditingGpsPin || !selectedItem) return;
      const lat = parseFloat(e.latlng.lat.toFixed(5));
      const lng = parseFloat(e.latlng.lng.toFixed(5));
      onSetCustomGps(selectedItem.parcel.id, lat, lng);
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [isEditingGpsPin, selectedItem, onSetCustomGps]);

  // Render parcel polygons and pulsing Pastille markers on the Leaflet map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const fg = layerGroupRef.current;
    if (!map || !fg) return;

    fg.clearLayers();

    items.forEach((item) => {
      const isSelected = item.parcel.id === selectedParcelId;

      // Color coding by harvest priority (5:00 AM clarity!)
      const strokeColor = isSelected
        ? '#FFFFFF'
        : item.daySlot === 'today' || item.status === 'en_cours'
        ? '#F97316' // Bright Orange: To harvest TODAY
        : item.daySlot === 'tomorrow'
        ? '#EAB308' // Gold: Tomorrow
        : item.status === 'vendange'
        ? '#10B981' // Emerald: Done
        : '#C4A47A';

      const fillColor =
        item.daySlot === 'today' || item.status === 'en_cours'
          ? '#F97316'
          : item.daySlot === 'tomorrow'
          ? '#EAB308'
          : item.status === 'vendange'
          ? '#10B981'
          : '#6B2128';

      const poly = L.polygon(item.polygon, {
        color: strokeColor,
        weight: isSelected ? 3.5 : 2,
        fillColor,
        fillOpacity: isSelected ? 0.52 : 0.32,
      });

      poly.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        if (isEditingGpsPin && selectedItem) {
          onSetCustomGps(
            selectedItem.parcel.id,
            parseFloat(ev.latlng.lat.toFixed(5)),
            parseFloat(ev.latlng.lng.toFixed(5))
          );
          return;
        }
        onSelectParcel(item.parcel.id);
      });

      poly.addTo(fg);

      // Pulsing Pastille Marker at exact row entrance GPS point
      const badgeBg =
        item.daySlot === 'today' || item.status === 'en_cours'
          ? '#F97316'
          : item.status === 'vendange'
          ? '#10B981'
          : '#1E221E';

      const iconHtml = `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;">
          ${
            isSelected || item.daySlot === 'today'
              ? `<div class="pin-orange-ring" style="position:absolute;width:42px;height:42px;border-radius:50%;border:3px solid #F97316;background:rgba(249,115,22,0.22);"></div>`
              : ''
          }
          <div style="position:relative;z-index:2;background:${badgeBg};color:#FFFFFF;border:2px solid #FFFFFF;border-radius:999px;padding:2px 8px;font-family:var(--font-sans);font-size:11px;font-weight:800;box-shadow:0 3px 10px rgba(0,0,0,0.45);white-space:nowrap;display:flex;align-items:center;gap:4px;">
            <span>n°${item.pastilleNum}</span>
            <span style="opacity:0.9;font-weight:700;">${item.parcel.code}</span>
          </div>
        </div>
      `;

      const marker = L.marker([item.lat, item.lng], {
        icon: L.divIcon({
          className: 'domaine-parcel-pin',
          html: iconHtml,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      });

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelectParcel(item.parcel.id);
      });

      marker.addTo(fg);
    });
  }, [items, selectedParcelId, isEditingGpsPin, selectedItem, onSelectParcel, onSetCustomGps]);

  // Smoothly fly to selected parcel when selection changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedItem) return;
    map.setView([selectedItem.lat, selectedItem.lng], Math.max(map.getZoom(), 17), {
      animate: true,
    });
  }, [selectedParcelId, selectedItem]);

  // Invalidate map size when toggling fullscreen
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Handle Floating GPS Button ("Me localiser sur le terrain")
  const handleLocateMe = () => {
    const map = mapInstanceRef.current;

    const placeUserBeacon = (lat: number, lng: number, label: string) => {
      setGpsState({ active: true, lat, lng, label });
      if (map) {
        if (userMarkerRef.current) {
          map.removeLayer(userMarkerRef.current);
        }
        const beaconHtml = `
          <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
            <div class="pin-orange-ring" style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(59,130,246,0.35);border:2px solid #3B82F6;"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#2563EB;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
          </div>
        `;
        userMarkerRef.current = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'user-gps-beacon',
            html: beaconHtml,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(map);
        map.setView([lat, lng], 17, { animate: true });
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const uLat = pos.coords.latitude;
          const uLng = pos.coords.longitude;
          // If the user is physically far from Burgundy (> 30 km), center near today's priority parcel so they see the GPS beacon in action on the vineyard map!
          const distDeg = Math.hypot(uLat - 46.946, uLng - 4.739);
          if (distDeg > 0.25 && selectedItem) {
            placeUserBeacon(
              selectedItem.lat - 0.00045,
              selectedItem.lng - 0.00035,
              `Simulation GPS Terrain à 60m de ${selectedItem.parcel.name} (Position réelle hors Bourgogne détectée)`
            );
          } else {
            placeUserBeacon(uLat, uLng, `GPS Actif (±${Math.round(pos.coords.accuracy)}m)`);
          }
        },
        () => {
          // Fallback simulation in the vineyard if permission denied
          const target = items.find((i) => i.daySlot === 'today') ?? selectedItem;
          if (target) {
            placeUserBeacon(
              target.lat - 0.0004,
              target.lng - 0.0003,
              `GPS Terrain simulé à l’approche de ${target.parcel.name} (Pastille n°${target.pastilleNum})`
            );
          }
        },
        { enableHighAccuracy: true, timeout: 4000 }
      );
    } else if (selectedItem) {
      placeUserBeacon(
        selectedItem.lat - 0.0004,
        selectedItem.lng - 0.0003,
        `GPS Terrain simulé à l’approche de ${selectedItem.parcel.name}`
      );
    }
  };

  const FitAllParcels = () => {
    const map = mapInstanceRef.current;
    if (!map || items.length === 0) return;
    const bounds = L.latLngBounds(items.map((i) => [i.lat, i.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.25), { animate: true });
  };

  return (
    <div
      style={
        isFullscreen
          ? {
              position: 'fixed',
              inset: '16px',
              zIndex: 999,
              background: '#141814',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
              border: '2px solid #C4A47A',
            }
          : { position: 'relative', width: '100%' }
      }
    >
      {/* Barre d'outils Carte : Couches Satellite / Cadastre IGN / Livret + Plein écran */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${mapStyle === 'satellite' ? 'active' : ''}`}
              onClick={() => setMapStyle('satellite')}
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              🛰️ Satellite Réel (Zoomable)
            </button>
            <button
              type="button"
              className={`segmented-btn ${mapStyle === 'cadastre' ? 'active' : ''}`}
              onClick={() => setMapStyle('cadastre')}
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              📐 Plan Cadastral IGN
            </button>
          </div>

          <button
            type="button"
            className={`btn btn-sm ${showCadastreOverlay ? 'btn-gold' : 'btn-secondary'}`}
            onClick={() => setShowCadastreOverlay((v) => !v)}
            title="Activer/désactiver les limites cadastrales officielles IGN en surimpression"
          >
            <Layers size={13} />
            <span>Limites Cadastre IGN {showCadastreOverlay ? 'ON' : 'OFF'}</span>
          </button>

          {onOpenLivret && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onOpenLivret}
              title="Consulter le Livret Parcellaire complet avec caractéristiques et vendanges"
              style={{ fontWeight: 600 }}
            >
              <BookOpen size={13} />
              <span>📖 Ouvrir le Livret Parcellaire</span>
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={FitAllParcels}
            title="Recentrer la carte sur toutes les parcelles du domaine"
          >
            <Compass size={13} />
            <span>Voir tout le domaine</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${isEditingGpsPin ? 'btn-gold' : 'btn-secondary'}`}
            onClick={onToggleEditGpsPin}
            title="Cliquer sur la carte satellite pour déplacer le point GPS exact d'entrée de rang"
          >
            <Crosshair size={13} />
            <span>{isEditingGpsPin ? 'Cliquez sur la carte...' : 'Déplacer Point GPS'}</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => setIsFullscreen((v) => !v)}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? 'Réduire' : 'Plein Écran'}</span>
          </button>
        </div>
      </div>

      {/* Conteneur de la Carte Interactive (430px normal, 100% en plein écran) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: isFullscreen ? 'calc(100vh - 165px)' : fieldMode ? '480px' : '420px',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: isEditingGpsPin ? '3px dashed #F97316' : '1.5px solid rgba(196, 164, 122, 0.55)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          background: '#161F15',
        }}
      >
        {/* VRAIE CARTE INTERACTIVE LEAFLET (Pan, Zoom, Satellite Esri + Cadastre IGN + Polygones) */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            cursor: isEditingGpsPin ? 'crosshair' : 'grab',
          }}
        />

        {/* Légende Flottante Haut-Droite (Codes Couleurs Vendanges) */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 500,
            background: 'rgba(20, 24, 20, 0.88)',
            backdropFilter: 'blur(8px)',
            color: '#FAF8F5',
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            border: '1px solid rgba(196, 164, 122, 0.4)',
            pointerEvents: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#F97316' }} />
            Aujourd’hui
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#EAB308' }} />
            Demain
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10B981' }} />
            Vendangé
          </span>
        </div>

        {/* Bandeau Flottant Bas-Gauche : Parcelle Active + Lien Direct Itinéraire Google Maps */}
        {selectedItem && (
          <div
            style={{
              position: 'absolute',
              bottom: '14px',
              left: '14px',
              zIndex: 500,
              background: 'rgba(20, 24, 20, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#FAF8F5',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(196, 164, 122, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              maxWidth: 'calc(100% - 190px)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  Réf. #{selectedItem.pastilleNum} {selectedItem.pageLivret ? `· Livret p.${selectedItem.pageLivret}` : ''}
                </span>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  {selectedItem.parcel.name.replace(' — fictif', '')} ({selectedItem.parcel.code})
                </span>
              </div>
              <div className="tabular" style={{ fontSize: '11px', color: '#E2C799', marginTop: '2px' }}>
                {selectedItem.sectionCadastrale ? `${selectedItem.sectionCadastrale} · ` : ''}
                GPS : {selectedItem.lat.toFixed(5)}° N, {selectedItem.lng.toFixed(5)}° E · {selectedItem.nbRangs}
              </div>
              {gpsState.label && (
                <div style={{ fontSize: '11px', color: '#60A5FA', fontWeight: 600, marginTop: '2px' }}>
                  ● {gpsState.label}
                </div>
              )}
            </div>

            <a
              href={selectedItem.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#10B981',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '12px',
                padding: '8px 14px',
                borderRadius: '999px',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Navigation size={14} />
              <span>Y ALLER (GOOGLE MAPS)</span>
            </a>
          </div>
        )}

        {/* GROS BOUTON FLOTTANT GPS (Exactement comme GpsFloatingButton dans Parcelles-vendanges !) */}
        <button
          type="button"
          onClick={handleLocateMe}
          style={{
            position: 'absolute',
            bottom: '14px',
            right: '14px',
            zIndex: 500,
            background: gpsState.active
              ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
              : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
            color: '#FFFFFF',
            border: '2.5px solid #FFFFFF',
            borderRadius: '999px',
            padding: '12px 18px',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.02em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
          }}
          title="Activer le GPS pour vous localiser par rapport aux parcelles"
        >
          <MapPin size={18} />
          <span>{gpsState.active ? 'GPS ACTIF (RECENTRER)' : 'ME LOCALISER (GPS)'}</span>
        </button>
      </div>
    </div>
  );
};
