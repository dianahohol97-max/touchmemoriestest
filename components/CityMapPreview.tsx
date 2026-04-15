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

const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const MapUpdater = dynamic(
    () => import('react-leaflet').then((mod) => {
        const { useMap } = mod;
        function Updater({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
            const map = useMap();
            useEffect(() => { map.setView([lat, lng], zoom, { animate: true }); }, [lat, lng, zoom]);
            return null;
        }
        return Updater;
    }),
    { ssr: false }
);

// Tile URL — CartoCDN light gives cleanest poster-quality output
const getTileUrl = (style: string) => {
    switch (style) {
        case 'dark-mode':
        case 'plum':
            return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{r}.png';
        case 'blueprint':
            return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}{r}.png';
        case 'color-outdoors':
        case 'bayside':
        case 'forest-green':
            return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        case 'smooth-light':
        case 'vintage-sepia':
        case 'harvest':
            return 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png';
        // For B&W poster styles: light_nolabels = clean roads/parks/water
        // without district labels (matches Etsy poster style — text goes below map)
        case 'stamen-toner':
        case 'classic-bw':
        case 'stamen-toner-lite':
        default:
            return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
};

const getMapFilter = (style: string) => {
    switch (style) {
        case 'stamen-toner':
        case 'classic-bw':
            // Etsy-style B&W: pure white background, dark crisp roads
            return 'grayscale(100%) contrast(220%) brightness(1.05)';
        case 'stamen-toner-lite':
            return 'grayscale(100%) contrast(130%) brightness(1.05)';
        case 'smooth-light':
            return 'grayscale(100%) contrast(115%) brightness(1.08)';
        case 'vintage-sepia':
            return 'grayscale(60%) sepia(50%) contrast(115%) brightness(1.05)';
        case 'harvest':
            return 'grayscale(30%) sepia(40%) hue-rotate(10deg) saturate(1.4) contrast(120%)';
        case 'dark-mode':
        case 'plum':
        case 'blueprint':
            return 'none';
        case 'forest-green':
            return 'hue-rotate(90deg) saturate(0.8) brightness(0.95)';
        case 'bayside':
            return 'hue-rotate(180deg) saturate(0.9) brightness(1.0)';
        default:
            return 'grayscale(100%) contrast(160%) brightness(0.95)';
    }
};

// Text color for each style
const getTextColor = (style: string) => {
    if (['dark-mode', 'plum', 'blueprint'].includes(style)) return { primary: '#ffffff', secondary: '#cccccc', coords: '#aaaaaa' };
    if (['vintage-sepia', 'harvest'].includes(style)) return { primary: '#4a2c10', secondary: '#7a5030', coords: '#8a6040' };
    if (['forest-green'].includes(style)) return { primary: '#1a3a1a', secondary: '#2a5a2a', coords: '#4a6a4a' };
    return { primary: '#111111', secondary: '#333333', coords: '#666666' };
};

// Background for text band
const getTextBg = (style: string) => {
    if (['dark-mode', 'plum', 'blueprint'].includes(style)) return '#0a0a0a';
    if (['vintage-sepia', 'harvest'].includes(style)) return '#f9f0e0';
    if (['forest-green', 'bayside'].includes(style)) return '#f5f8f2';
    return '#ffffff';
};

export default function CityMapPreview({ config, setConfig }: CityMapPreviewProps) {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true); }, []);

    const tc = getTextColor(config.mapStyle);
    const textBg = getTextBg(config.mapStyle);
    const isLandscape = config.orientation === 'landscape';

    // Poster aspect ratio
    const posterRatio = isLandscape ? '4/3' : '3/4';

    // Text area height — 22% like the Etsy example
    const textAreaPct = config.layout === 'no-text' ? 0 : 22;
    const mapHeightPct = 100 - textAreaPct;

    const cityName = config.title || config.location.split(',')[0].toUpperCase() || 'YOUR CITY';
    const countryName = config.subtitle || (config.location.split(',').slice(1).join(',').trim()) || 'Ukraine';

    // Decorative divider lines like the Etsy example
    const DividerLines = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
            <div style={{ flex: 1, height: 1, background: tc.secondary, opacity: 0.4 }} />
            <div style={{ flex: 1, height: 1, background: tc.secondary, opacity: 0.4 }} />
        </div>
    );

    return (
        <div style={{ background: '#e5e5e5', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Попередній перегляд
            </div>

            {/* Poster frame — like the Etsy image: white background + black border */}
            <div style={{
                width: '100%',
                maxWidth: isLandscape ? 480 : 320,
                aspectRatio: posterRatio,
                position: 'relative',
                background: textBg,
                // Outer shadow simulating photo frame
                boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                borderRadius: 2,
                overflow: 'hidden',
            }}>
                {/* Black border frame (like in example) */}
                {config.border !== 'no-border' && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none',
                        border: config.border === 'white-mat'
                            ? '10px solid #ffffff'
                            : '8px solid #111111',
                        boxSizing: 'border-box',
                    }} />
                )}
                {/* Inner white mat for white-mat style */}
                {config.border === 'white-mat' && (
                    <div style={{
                        position: 'absolute', inset: 10, zIndex: 29, pointerEvents: 'none',
                        border: '6px solid #111111',
                        boxSizing: 'border-box',
                    }} />
                )}

                {/* MAP AREA — fills top part */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: config.layout === 'no-text' ? '100%' : `${mapHeightPct}%`,
                    overflow: 'hidden',
                    filter: getMapFilter(config.mapStyle),
                    // Clip shapes
                    clipPath: config.layout === 'circle'
                        ? 'circle(42% at 50% 48%)'
                        : 'none',
                }}>
                    {isClient ? (
                        <MapContainer
                            center={[config.latitude, config.longitude]}
                            zoom={config.zoom}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            attributionControl={false}
                            scrollWheelZoom={false}
                            dragging={false}
                            doubleClickZoom={false}
                            keyboard={false}
                        >
                            <TileLayer
                                url={getTileUrl(config.mapStyle)}
                                subdomains={['a','b','c','d']}
                                maxZoom={19}
                            />
                            <MapUpdater lat={config.latitude} lng={config.longitude} zoom={config.zoom} />
                        </MapContainer>
                    ) : (
                        <div style={{ width: '100%', height: '100%', background: '#e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: '#999', fontSize: 12 }}>Завантаження карти...</span>
                        </div>
                    )}
                </div>

                {/* TEXT AREA — bottom band like Etsy example */}
                {config.layout !== 'no-text' && (
                    <div style={{
                        position: 'absolute',
                        bottom: 0, left: 0, right: 0,
                        height: `${textAreaPct}%`,
                        background: textBg,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '6px 16px',
                        zIndex: 20,
                        // Thin separator line at top of text area
                        borderTop: `0.5px solid ${tc.secondary}22`,
                    }}>
                        {/* City name — large, bold, spaced */}
                        <div style={{
                            fontFamily: config.fontFamily || 'serif',
                            fontSize: 'clamp(11px, 3.5vw, 28px)',
                            fontWeight: 900,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: tc.primary,
                            textAlign: 'center',
                            lineHeight: 1,
                            marginBottom: 3,
                        }}>
                            {cityName}
                        </div>

                        {/* Decorative lines flanking country */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '70%', marginBottom: 3 }}>
                            <div style={{ flex: 1, height: '0.5px', background: tc.secondary }} />
                            <div style={{
                                fontFamily: config.fontFamily || 'serif',
                                fontSize: 'clamp(7px, 1.4vw, 11px)',
                                letterSpacing: '0.22em',
                                textTransform: 'uppercase',
                                color: tc.secondary,
                                whiteSpace: 'nowrap',
                            }}>
                                {countryName}
                            </div>
                            <div style={{ flex: 1, height: '0.5px', background: tc.secondary }} />
                        </div>

                        {/* Coordinates — monospace small */}
                        {config.coordinates && (
                            <div style={{
                                fontFamily: 'monospace',
                                fontSize: 'clamp(6px, 1vw, 8px)',
                                color: tc.coords,
                                letterSpacing: '0.06em',
                                textAlign: 'center',
                            }}>
                                {config.coordinates}
                            </div>
                        )}
                    </div>
                )}

                {/* MODERN layout — text overlay on map */}
                {config.layout === 'modern' && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 25,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'flex-end',
                        padding: '0 0 12%',
                    }}>
                        <div style={{
                            background: 'rgba(255,255,255,0.92)',
                            backdropFilter: 'blur(4px)',
                            padding: '10px 20px',
                            borderRadius: 2,
                            textAlign: 'center',
                            border: '0.5px solid rgba(0,0,0,0.12)',
                        }}>
                            <div style={{ fontFamily: config.fontFamily, fontWeight: 900, fontSize: 'clamp(12px, 3vw, 22px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#111' }}>
                                {cityName}
                            </div>
                            <div style={{ height: '0.5px', background: '#333', margin: '3px 0' }} />
                            <div style={{ fontFamily: 'monospace', fontSize: 'clamp(6px, 1vw, 9px)', color: '#666', letterSpacing: '0.08em' }}>
                                {config.coordinates}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Info below poster */}
            <div style={{ marginTop: 10, textAlign: 'center', color: '#64748b', fontSize: 11 }}>
                {config.size} · {config.price} ₴
            </div>
        </div>
    );
}
