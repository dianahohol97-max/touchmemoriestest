'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';

interface GooglePlacesAutocompleteProps {
    value: string;
    onChange: (location: string, lat: number, lon: number) => void;
    placeholder?: string;
}

interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
    address: { city?: string; town?: string; village?: string; country?: string };
}

export default function GooglePlacesAutocomplete({ value, onChange, placeholder }: GooglePlacesAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
    const [open, setOpen] = useState(false);
    const [inputVal, setInputVal] = useState(value);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync external value
    useEffect(() => { setInputVal(value); }, [value]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const search = useCallback(async (q: string) => {
        if (q.length < 2) { setSuggestions([]); return; }
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&accept-language=uk`,
                { headers: { 'Accept-Language': 'uk,en' } }
            );
            const data: NominatimResult[] = await res.json();
            setSuggestions(data);
            setOpen(data.length > 0);
        } catch { setSuggestions([]); }
    }, []);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setInputVal(v);
        onChange(v, 0, 0);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(v), 350);
    };

    const handleSelect = (item: NominatimResult) => {
        const name = item.display_name;
        setInputVal(name);
        setSuggestions([]);
        setOpen(false);
        onChange(name, parseFloat(item.lat), parseFloat(item.lon));
    };

    return (
        <div ref={wrapperRef} className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <MapPin className="w-5 h-5 text-gray-400" />
            </div>
            <input
                type="text"
                value={inputVal}
                onChange={handleInput}
                onFocus={() => suggestions.length > 0 && setOpen(true)}
                placeholder={placeholder || 'Київ, Україна'}
                autoComplete="off"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d] focus:border-transparent"
            />
            {open && suggestions.length > 0 && (
                <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                    {suggestions.map((item, i) => (
                        <li key={i} onMouseDown={() => handleSelect(item)}
                            className="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-blue-50 hover:text-[#1e2d7d] flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{item.display_name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Keep Window interface for backwards compat
declare global {
    interface Window {
        google: any;
    }
}
