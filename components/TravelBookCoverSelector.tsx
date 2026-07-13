'use client';

import React, { useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import Image from 'next/image';

/**
 * Travel Book cover picker.
 *
 * Reads the live cover library from /api/travelbook-covers, which serves the
 * `travelbook_covers` table (the 100 city + country covers uploaded through the
 * admin). This component used to query the OLD `travel_book_covers` table (55
 * rows, group_type ukrainian/international) directly, so freshly uploaded covers
 * never appeared in the constructor. The API is the single source of truth and
 * is CDN-cached, so we go through it instead of a direct table read.
 *
 * The emitted cover keeps the legacy field aliases (city_name / country /
 * landmark / background_color) so the consumer in BookConstructorConfig — which
 * saves and previews those fields — keeps working without changes.
 */

interface TravelBookCover {
    id: string;
    name: string;
    name_en: string;
    image_url: string;
    thumbnail_url: string | null;
    kind: 'city' | 'country';
    sort_order: number;
    // Legacy aliases kept for the consumer (BookConstructorConfig save/preview).
    city_name: string;
    city_name_en: string;
    country: string;
    landmark: string;
    background_color: string;
    group_type: 'city' | 'country';
}

interface TravelBookCoverSelectorProps {
    selectedCoverId: string | null;
    onCoverSelect: (cover: TravelBookCover) => void;
    onClose?: () => void;
}

// Map an /api/travelbook-covers row onto the shape this component and its
// consumer expect. The new table has no country/landmark/background_color, so
// we fill sensible fallbacks (the English name doubles as the subtitle).
function mapCover(row: any): TravelBookCover {
    const name = row.name || row.name_en || '';
    const nameEn = row.name_en || row.name || '';
    const kind: 'city' | 'country' = row.kind === 'country' ? 'country' : 'city';
    return {
        id: row.id,
        name,
        name_en: nameEn,
        image_url: row.image_url || '',
        thumbnail_url: row.thumbnail_url || null,
        kind,
        sort_order: row.sort_order ?? 0,
        city_name: name,
        city_name_en: nameEn,
        country: nameEn,
        landmark: '',
        background_color: '#e5e7eb',
        group_type: kind,
    };
}

export default function TravelBookCoverSelector({
    selectedCoverId,
    onCoverSelect,
    onClose
}: TravelBookCoverSelectorProps) {
    const [covers, setCovers] = useState<TravelBookCover[]>([]);
    const [filteredCovers, setFilteredCovers] = useState<TravelBookCover[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'city' | 'country'>('all');

    useEffect(() => {
        fetchCovers();
    }, []);

    useEffect(() => {
        filterCovers();
    }, [covers, searchQuery, activeTab]);

    async function fetchCovers() {
        setLoading(true);
        try {
            const res = await fetch('/api/travelbook-covers');
            const body = await res.json();
            const list = Array.isArray(body?.covers) ? body.covers.map(mapCover) : [];
            setCovers(list);
        } catch (error) {
            console.error('Error fetching travel book covers:', error);
        } finally {
            setLoading(false);
        }
    }

    function filterCovers() {
        let filtered = [...covers];

        // Filter by tab (city / country)
        if (activeTab === 'city') {
            filtered = filtered.filter(c => c.kind === 'city');
        } else if (activeTab === 'country') {
            filtered = filtered.filter(c => c.kind === 'country');
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(query) ||
                c.name_en.toLowerCase().includes(query)
            );
        }

        setFilteredCovers(filtered);
    }

    const cityCovers = covers.filter(c => c.kind === 'city');
    const countryCovers = covers.filter(c => c.kind === 'country');

    return (
        <div className="w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Оберіть обкладинку Travel Book</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        {covers.length} доступних обкладинок
                    </p>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Пошук за містом або країною..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                        activeTab === 'all'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Всі ({covers.length})
                </button>
                <button
                    onClick={() => setActiveTab('city')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                        activeTab === 'city'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Міста ({cityCovers.length})
                </button>
                <button
                    onClick={() => setActiveTab('country')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                        activeTab === 'country'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                >
                    Країни ({countryCovers.length})
                </button>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredCovers.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-600">
                        {searchQuery
                            ? `Не знайдено за запитом "${searchQuery}"`
                            : 'Немає доступних обкладинок'}
                    </p>
                </div>
            )}

            {/* Cover Grid */}
            {!loading && filteredCovers.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[600px] overflow-y-auto pr-2">
                    {filteredCovers.map((cover) => (
                        <CoverCard
                            key={cover.id}
                            cover={cover}
                            isSelected={cover.id === selectedCoverId}
                            onSelect={() => onCoverSelect(cover)}
                        />
                    ))}
                </div>
            )}

            {/* Selection Info */}
            {selectedCoverId && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-900">
                        <span className="font-semibold">Обрано:</span>{' '}
                        {covers.find(c => c.id === selectedCoverId)?.name}
                    </p>
                </div>
            )}
        </div>
    );
}

// =============================================
// Cover Card Component
// =============================================

interface CoverCardProps {
    cover: TravelBookCover;
    isSelected: boolean;
    onSelect: () => void;
}

function CoverCard({ cover, isSelected, onSelect }: CoverCardProps) {
    const [imageError, setImageError] = useState(false);

    return (
        <button
            onClick={onSelect}
            className={`relative group rounded-lg overflow-hidden transition-all ${
                isSelected
                    ? 'ring-4 ring-purple-600 shadow-lg'
                    : 'hover:ring-2 hover:ring-purple-400 hover:shadow-md'
            }`}
        >
            {/* Image */}
            <div className="aspect-[2/3] bg-gray-100 relative">
                {!imageError && cover.image_url ? (
                    <Image
                        src={cover.thumbnail_url || cover.image_url}
                        alt={cover.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        className="object-cover"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    // Fallback placeholder
                    <div
                        className="w-full h-full flex flex-col items-center justify-center p-4 text-center"
                        style={{ backgroundColor: cover.background_color }}
                    >
                        <p className="text-2xl font-bold text-gray-800 mb-2">
                            {(cover.name_en || cover.name).toUpperCase()}
                        </p>
                    </div>
                )}

                {/* Selection Indicator */}
                {isSelected && (
                    <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1">
                        <Check className="w-4 h-4" />
                    </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all" />
            </div>

            {/* Info */}
            <div className="p-2 bg-white text-left">
                <p className="font-semibold text-sm text-gray-900 truncate">
                    {cover.name}
                </p>
                <p className="text-xs text-gray-600 truncate">
                    {cover.kind === 'country' ? 'Країна' : 'Місто'}
                </p>
            </div>
        </button>
    );
}
