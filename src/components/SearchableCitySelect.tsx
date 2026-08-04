import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Search, ChevronDown, Plus, Check } from 'lucide-react';
import { CITIES, UK_CITIES, CITIES_BY_REGION } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface SearchableCitySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  region?: string;
  country?: string;
  disabled?: boolean;
}

export const SearchableCitySelect: React.FC<SearchableCitySelectProps> = ({
  value,
  onChange,
  placeholder = "Select or type City / Town",
  required = false,
  region,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const activeCities = useMemo(() => {
    if (region && CITIES_BY_REGION[region]) {
      return CITIES_BY_REGION[region];
    }
    return UK_CITIES;
  }, [region]);

  const filteredCities = activeCities.filter(city =>
    city.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatchExists = activeCities.some(city => 
    city.toLowerCase() === search.trim().toLowerCase()
  );

  const handleSelect = (city: string) => {
    onChange(city);
    setIsOpen(false);
    setSearch('');
  };

  const handleCustomSelect = () => {
    if (search.trim()) {
      handleSelect(search.trim());
    }
  };

  return (
    <div className="relative w-full" ref={containerRef} id="searchable-city-select-container">
      {/* Botão de Ativação / Gatilho */}
      <button
        type="button"
        id="searchable-city-select-trigger"
        onClick={() => {
          if (disabled) return;
          setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className="w-full pl-12 pr-10 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-600 focus:bg-white outline-none transition-all placeholder:text-slate-400 font-medium text-left flex items-center justify-between text-slate-900 group disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <span className="flex items-center gap-1.5 truncate">
          {value ? (
            <span className="font-semibold text-slate-800">{value}</span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="searchable-city-select-dropdown"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border-2 border-slate-100 shadow-2xl overflow-hidden z-50 flex flex-col max-h-80"
          >
            {/* Search field */}
            <div className="p-3 border-b border-slate-100 sticky top-0 bg-white z-10" id="searchable-city-search-container">
              <div className="relative font-sans">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredCities.length > 0) {
                        handleSelect(filteredCities[0]);
                      } else {
                        handleCustomSelect();
                      }
                    }
                  }}
                  placeholder="Search or enter location..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white outline-none transition-all text-sm font-medium text-slate-900 font-sans"
                />
              </div>
            </div>

            {/* City / Location list */}
            <div className="overflow-y-auto flex-1 py-1 max-h-56 divide-y divide-slate-50 scrollbar-thin scrollbar-thumb-slate-200" id="searchable-city-list">
              {/* Option to add custom location */}
              {search.trim() && !exactMatchExists && (
                <button
                  type="button"
                  onClick={handleCustomSelect}
                  className="w-full px-4 py-3 text-left text-sm font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 transition-colors duration-150"
                >
                  <Plus size={16} />
                  <span>Use new location: "{search.trim()}"</span>
                </button>
              )}

              {/* Filtered locations */}
              {filteredCities.map((city) => {
                const isSelected = value === city;
                return (
                  <button
                    key={`city-option-${city}`}
                    type="button"
                    onClick={() => handleSelect(city)}
                    className={`w-full px-4 py-3 text-left text-sm font-medium flex items-center justify-between transition-colors duration-150 ${
                      isSelected ? 'bg-indigo-50/70 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{city}</span>
                    {isSelected && <Check size={16} className="text-indigo-600" />}
                  </button>
                );
              })}

              {/* Empty state */}
              {filteredCities.length === 0 && !search.trim() && (
                <div className="px-4 py-4 text-center text-xs text-slate-400 font-medium">
                  No default locations found.
                </div>
              )}

              {/* Empty list with search */}
              {filteredCities.length === 0 && search.trim() && !exactMatchExists && (
                <div className="px-4 py-2 text-xs text-slate-400 font-medium bg-slate-50/50">
                  Press Enter or click "Use new location" to confirm.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
