'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

interface GooglePlacesAutocompleteProps {
    value: string;
    onChange: (location: string, lat: number, lon: number) => void;
    placeholder?: string;
}

export default function GooglePlacesAutocomplete({ value, onChange, placeholder }: GooglePlacesAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // Load Google Maps JavaScript API
        if (typeof window !== 'undefined' && !window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBma_5_HnE2ipk9VBCqLRbfn5zjS8bgEJg&libraries=places&language=uk`;
            script.async = true;
            script.defer = true;
            script.onload = () => setIsLoaded(true);
            document.head.appendChild(script);
        } else if (window.google) {
            setIsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!isLoaded || !inputRef.current || autocomplete) return;

        const newAutocomplete = new google.maps.places.Autocomplete(inputRef.current, {
            fields: ['formatted_address', 'geometry', 'name'],
            types: ['(cities)']
        });

        newAutocomplete.addListener('place_changed', () => {
            const place = newAutocomplete.getPlace();

            if (place.geometry && place.geometry.location) {
                const lat = place.geometry.location.lat();
                const lon = place.geometry.location.lng();
                const locationName = place.formatted_address || place.name || '';

                onChange(locationName, lat, lon);
            }
        });

        setAutocomplete(newAutocomplete);
    }, [isLoaded, autocomplete, onChange]);

    return (
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <MapPin className="w-5 h-5 text-gray-400" />
            </div>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value, 0, 0)}
                placeholder={placeholder || 'Київ, Україна'}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
            />
        </div>
    );
}

// Extend Window interface for TypeScript
declare global {
    interface Window {
        google: typeof google;
    }
}
