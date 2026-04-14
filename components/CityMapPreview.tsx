'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

interface CityMapConfig {
    location: string;
    latitude: number;
    longitude: number;
    zoom: number;
    hasValidLocation: boolean;
    title: string;
    subtitle: string;
    textNote: string;
    coordinates: string;
    mapStyle: string;
    textColor: 'light' | 'dark';
    layout: 'original' | 'modern' | 'no-text' | 'circle' | 'heart' | 'square-border' | 'title-bottom' | 'title-top';
    border: 'simple-frame' | 'white-mat' | 'no-border';
    orientation: 'portrait' | 'landscape';
    fontFamily: string;
    mapLang?: string;
    size: string;
    productType: string;
    price: number;
}

interface CityMapPreviewProps {
    config: CityMapConfig;
    setConfig: React.Dispatch<React.SetStateAction<CityMapConfig>>;
}

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);

const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);

// Syncs map center/zoom when config changes (Leaflet doesn't react to prop changes)
const MapUpdater = dynamic(
    () => import('react-leaflet').then((mod) => {
        const { useMap } = mod;
        function Updater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
            const map = useMap();
            useEffect(() => {
                map.setView([lat, lng], zoom, { animate: true });
            }, [lat, lng, zoom]);
            return null;
        }
        return Updater;
    }),
    { ssr: false }
);

export default function CityMapPreview({ config, setConfig }: CityMapPreviewProps) {
    const [isClient, setIsClient] = useState(false);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Get tile URL based on map style
    // Language → CartoCDN uses OSM data, language shown depends on OSM name: tags
    // For client-side lang: we append a labels overlay tile with lang param via MapTiler (free)
    // Or use Stadia/CartoCDN + lang label overlay from openstreetmap.org
    const lang = (config as any).mapLang || 'local';

    const getTileUrl = () => {
        // CartoCDN: clean minimal tiles, no ugly OSM POI icons, free, no key
        switch (config.mapStyle) {
            case 'dark-mode':
            case 'plum':
                return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            case 'blueprint':
                return 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
            case 'smooth-light':
                return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            // For B&W poster styles: Positron no-labels base + CSS grayscale+contrast
            case 'stamen-toner':
            case 'stamen-toner-lite':
            case 'classic-bw':
                // Positron nolabels = clean gray roads on white, no POI icons
                return 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
            case 'vintage-sepia':
            case 'harvest':
                return 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
            case 'color-outdoors':
            case 'bayside':
            case 'forest-green':
            case 'paste':
                return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';
            default:
                return 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
        }
    };

    // Label tile with language support via MapTiler (free tier, 100k tiles/month)
    // Falls back to local language if lang not available
    const getLabelTileUrl = () => {
        // CartoCDN does not support lang param natively
        // Use Stadia Maps language tiles for supported languages
        const stadiaLangs = new Set(['en','de','fr','es','it','pl','pt','ru','zh','ja','ko','ar','tr','nl','cs','sk','hu','fi','sv','no','da','el','bg','hr','sr','he','uk','ro','lt','lv','et']);
        if (lang === 'local') {
            return 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
        }
        if (stadiaLangs.has(lang)) {
            // CartoCDN label-only tiles (free, no key required)
            return 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
        }
        return 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';
    };

    // Get CSS filter based on map style
    const getMapFilter = () => {
        switch (config.mapStyle) {
            // Pure B&W minimal — like reference images (high contrast, clean)
            case 'classic-bw':
                return 'grayscale(100%) contrast(170%) brightness(1.05)';
            case 'stamen-toner':
                // CartoCDN light_nolabels → sharp B&W poster
                return 'grayscale(100%) contrast(250%) brightness(0.95) invert(0)';
            case 'stamen-toner-lite':
                return 'grayscale(100%) contrast(180%) brightness(1.05)';
            case 'classic-bw':
                return 'grayscale(100%) contrast(200%) brightness(1.0)';
            case 'vintage-sepia':
            case 'harvest':
                return 'grayscale(100%) sepia(60%) contrast(140%) brightness(1.05)';
            case 'smooth-light':
                return 'grayscale(100%) contrast(120%) brightness(1.08)';
            // Dark
            case 'dark-mode':
            case 'plum':
            case 'blueprint':
                return 'none';
            // Warm sepia
            case 'vintage-sepia':
            case 'harvest':
                return 'grayscale(100%) sepia(45%) contrast(140%) brightness(1.05)';
            // Color styles
            case 'vintage-red':
                return 'sepia(30%) hue-rotate(320deg) saturate(1.5)';
            case 'forest-green':
            case 'paste':
                return 'saturate(0.7) brightness(1.05)';
            case 'color-outdoors':
            case 'bayside':
                return 'saturate(1.1) brightness(1.02)';
            default:
                return 'grayscale(100%) contrast(160%)';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Попередній перегляд</h3>

            {/* Poster Preview — constrained height */}
            <div style={{ maxHeight: '70vh', aspectRatio: config.orientation === 'portrait' ? '3/4' : '4/3', position:'relative', overflow:'hidden' }}
                className="bg-gray-200 rounded-lg">
                {/* Border */}
                {config.border === 'simple-frame' && (
                    <div className="absolute inset-0 border-8 border-black pointer-events-none z-20" />
                )}
                {config.border === 'white-mat' && (
                    <>
                        <div className="absolute inset-0 border-8 border-black pointer-events-none z-20" />
                        <div className="absolute inset-2 border-12 border-white pointer-events-none z-20" />
                    </>
                )}

                {/* ── title-top layout: title above map ── */}
                {config.layout === 'title-top' && (
                    <div style={{ position:'absolute', top:0, left:0, right:0, height:'22%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'8px 16px', background:'#fff', zIndex:10 }}>
                        <div style={{ fontFamily: config.fontFamily, fontWeight:900, fontSize:'clamp(14px,3.5vw,32px)', letterSpacing:'0.12em', textTransform:'uppercase', color: config.textColor === 'light' ? '#1a1a1a' : '#1a1a1a', textAlign:'center', lineHeight:1.1 }}>
                            {config.title || 'ВАШЕ МІСТО'}
                        </div>
                        {config.subtitle && (
                            <div style={{ fontFamily: config.fontFamily, fontSize:'clamp(8px,1.5vw,13px)', letterSpacing:'0.2em', textTransform:'uppercase', color:'#666', marginTop:4 }}>
                                {config.subtitle}
                            </div>
                        )}
                    </div>
                )}

                {/* Map Container */}
                <div
                    style={{
                        position: 'absolute',
                        top: config.layout === 'title-top' ? '22%' : 0,
                        bottom: (config.layout === 'title-bottom' || config.layout === 'circle' || config.layout === 'heart') ? '25%' : 0,
                        left: 0, right: 0,
                        filter: getMapFilter(),
                        clipPath:
                            config.layout === 'circle' ? 'circle(38% at 50% 50%)' :
                            config.layout === 'heart' ? 'path("M 50,75 C 50,75 5,45 5,25 C 5,10 18,5 30,15 C 38,20 50,28 50,28 C 50,28 62,20 70,15 C 82,5 95,10 95,25 C 95,45 50,75 50,75 Z")' :
                            'none'
                    }}
                >
                    {isClient && (
                        <MapContainer
                            ref={mapRef}
                            center={[config.latitude, config.longitude]}
                            zoom={config.zoom}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            attributionControl={false}
                        >
                            <TileLayer url={getTileUrl()} />
                            {/* Label overlay for all nolabels base tiles */}
                            {config.mapStyle !== 'dark-mode' && config.mapStyle !== 'smooth-light' && config.mapStyle !== 'plum' && (
                                <TileLayer url={getLabelTileUrl()} />
                            )}
                            {isClient && <MapUpdater lat={config.latitude} lng={config.longitude} zoom={config.zoom} />}
                        </MapContainer>
                    )}
                </div>

                {/* ── title-bottom / circle / heart text area ── */}
                {(config.layout === 'title-bottom' || config.layout === 'circle' || config.layout === 'heart') && (
                    <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'25%', background:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'6px 12px', zIndex:10 }}>
                        <div style={{ fontFamily: config.fontFamily, fontWeight:900, fontSize:'clamp(13px,3vw,28px)', letterSpacing:'0.15em', textTransform:'uppercase', color:'#1a1a1a', textAlign:'center', lineHeight:1.1 }}>
                            {config.title || 'ВАШЕ МІСТО'}
                        </div>
                        {config.subtitle && (
                            <div style={{ fontFamily: config.fontFamily, fontSize:'clamp(7px,1.2vw,11px)', letterSpacing:'0.22em', textTransform:'uppercase', color:'#666', marginTop:3, textAlign:'center' }}>
                                {config.subtitle}
                            </div>
                        )}
                        {config.coordinates && (
                            <div style={{ fontFamily:'monospace', fontSize:'clamp(6px,1vw,9px)', color:'#999', marginTop:4, letterSpacing:'0.05em' }}>
                                {config.coordinates}
                            </div>
                        )}
                    </div>
                )}

                {/* ── modern layout: overlay text ── */}
                {config.layout === 'modern' && (
                    <div style={{ position:'absolute', bottom:16, left:12, background:'rgba(255,255,255,0.92)', padding:'10px 14px', borderRadius:8, maxWidth:'60%', zIndex:10 }}>
                        {config.title && <div style={{ fontFamily: config.fontFamily, fontWeight:900, fontSize:'clamp(12px,2.5vw,22px)', letterSpacing:'0.1em', textTransform:'uppercase', color:'#1a1a1a' }}>{config.title}</div>}
                        {config.subtitle && <div style={{ fontFamily: config.fontFamily, fontSize:'clamp(7px,1.2vw,11px)', letterSpacing:'0.15em', textTransform:'uppercase', color:'#555', marginTop:3 }}>{config.subtitle}</div>}
                        <div style={{ fontFamily:'monospace', fontSize:'clamp(6px,0.9vw,9px)', color:'#888', marginTop:4 }}>{config.coordinates}</div>
                    </div>
                )}

                {/* ── title-top: coords at bottom ── */}
                {config.layout === 'title-top' && (
                    <div style={{ position:'absolute', bottom:8, left:0, right:0, textAlign:'center', zIndex:10 }}>
                        <span style={{ fontFamily:'monospace', fontSize:'clamp(6px,0.9vw,9px)', color: '#999' }}>{config.coordinates}</span>
                    </div>
                )}
            </div>

            <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                    {config.size} • {config.productType} • {config.price} ₴
                </p>
                <p className="text-xs text-gray-500 mt-1">
                    {config.mapStyle.replace('-', ' ')} • {config.layout}
                </p>
            </div>
        </div>
    );
}
