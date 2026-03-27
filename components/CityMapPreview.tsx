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
    mapStyle: 'classic-bw' | 'smooth-light' | 'dark-mode' | 'color-outdoors' | 'vintage-sepia' | 'blueprint';
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

export default function CityMapPreview({ config, setConfig }: CityMapPreviewProps) {
    const [isClient, setIsClient] = useState(false);
    const mapRef = useRef<any>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Get tile URL based on map style
    const getTileUrl = () => {
        switch (config.mapStyle) {
            case 'classic-bw':
                return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            case 'smooth-light':
                return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            case 'dark-mode':
                return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
            case 'color-outdoors':
                return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            case 'vintage-sepia':
                return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            case 'blueprint':
                return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
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
                return 'grayscale(100%) brightness(1.1) contrast(0.9)';
            case 'dark-mode':
                return 'none';
            case 'color-outdoors':
                return 'none';
            case 'vintage-sepia':
                return 'sepia(70%) saturate(0.7) brightness(1.1)';
            case 'blueprint':
                return 'hue-rotate(180deg) invert(100%)';
            default:
                return 'none';
        }
    };

    const aspectRatio = config.orientation === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]';

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Попередній перегляд</h3>

            {/* Poster Preview */}
            <div className={`relative ${aspectRatio} bg-gray-200 rounded-lg overflow-hidden`}>
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
