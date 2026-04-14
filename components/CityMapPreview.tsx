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
    layout: 'original' | 'modern' | 'no-text' | 'circle' | 'heart' | 'square-border';
    border: 'simple-frame' | 'white-mat' | 'no-border';
    orientation: 'portrait' | 'landscape';
    fontFamily: string;
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
    const getTileUrl = () => {
        switch (config.mapStyle) {
            case 'dark-mode':
            case 'plum':
            case 'blueprint':
                return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            case 'smooth-light':
            case 'bayside':
            case 'paste':
                return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
            default:
                return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        }
    };

    // Get CSS filter based on map style
    const getMapFilter = () => {
        switch (config.mapStyle) {
            case 'classic-bw':
                return 'grayscale(100%) contrast(150%)';
            case 'smooth-light':
                return 'grayscale(80%) brightness(1.05)';
            case 'dark-mode':
            case 'plum':
                return 'none';
            case 'color-outdoors':
            case 'bayside':
                return 'saturate(1.2) brightness(1.05)';
            case 'vintage-sepia':
            case 'harvest':
                return 'sepia(70%) saturate(0.7) brightness(1.1)';
            case 'vintage-red':
                return 'sepia(30%) hue-rotate(320deg) saturate(1.5)';
            case 'blueprint':
                return 'hue-rotate(200deg) saturate(3) brightness(0.7)';
            case 'forest-green':
            case 'paste':
                return 'hue-rotate(90deg) saturate(0.6) brightness(1.1)';
            default:
                return 'none';
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

                {/* Map Container */}
                <div
                    className={`absolute ${
                        config.layout === 'original' ? 'inset-0 top-0 bottom-[25%]' :
                        config.layout === 'modern' ? 'inset-0' :
                        config.layout === 'no-text' ? 'inset-0' :
                        config.layout === 'circle' ? 'inset-0 top-0 bottom-[30%]' :
                        config.layout === 'heart' ? 'inset-0 top-0 bottom-[30%]' :
                        'inset-0'
                    }`}
                    style={{
                        filter: getMapFilter(),
                        clipPath:
                            config.layout === 'circle' ? 'circle(40% at 50% 45%)' :
                            config.layout === 'heart' ? 'path("M 50,30 C 50,20 30,5 20,15 C 5,30 20,45 50,70 C 80,45 95,30 80,15 C 70,5 50,20 50,30 Z")' :
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
                            {isClient && <MapUpdater lat={config.latitude} lng={config.longitude} zoom={config.zoom} />}
                        </MapContainer>
                    )}
                </div>

                {/* Text Overlays */}
                {config.layout !== 'no-text' && (
                    <div className={`absolute ${
                        config.layout === 'original' || config.layout === 'circle' || config.layout === 'heart' ?
                            'bottom-0 left-0 right-0 h-[25%] bg-gradient-to-t from-gray-100 to-transparent flex flex-col items-center justify-center p-4' :
                        config.layout === 'modern' ?
                            'bottom-4 left-4 bg-white bg-opacity-90 p-4 rounded-lg max-w-[60%]' :
                        'bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent'
                    }`}
                    style={{
                        color: config.textColor === 'light' ? '#1a1a1a' : '#ffffff',
                        fontFamily: config.fontFamily
                    }}>
                        <div className={`text-center ${config.layout === 'modern' ? 'text-left' : ''}`}>
                            {config.title && (
                                <h2 className="text-2xl font-bold mb-1">{config.title}</h2>
                            )}
                            {config.subtitle && (
                                <p className="text-sm opacity-80">{config.subtitle}</p>
                            )}
                            {config.textNote && (
                                <p className="text-xs opacity-70 mt-2">{config.textNote}</p>
                            )}
                            <p className="text-xs opacity-60 mt-2 font-mono">{config.coordinates}</p>
                        </div>
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
