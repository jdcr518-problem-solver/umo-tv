import { useState } from 'react';
import type React from 'react';
import { X, Globe, Search, Check } from 'lucide-react';
import { COUNTRIES, type CountryOption } from '../lib/constants.js';

interface CountrySelectModalProps {
  isOpen: boolean;
  selectedCode: string;
  onSelectCountry: (country: CountryOption) => void;
  onClose: () => void;
}

export const CountrySelectModal: React.FC<CountrySelectModalProps> = ({
  isOpen,
  selectedCode,
  onSelectCountry,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Select Country</h3>
              <p className="text-xs text-slate-400">Connect with partners from a specific region</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="py-3">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search countries..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Country List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[50vh]">
          {filtered.map((country) => {
            const isSelected = country.code === selectedCode;
            return (
              <button
                key={country.code}
                onClick={() => {
                  onSelectCountry(country);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600/20 border-emerald-500/50 text-white font-semibold'
                    : 'bg-slate-800/40 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{country.flag}</span>
                  <span className="text-xs sm:text-sm font-medium">{country.name}</span>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Note */}
        <div className="mt-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            Global matchmaking pool is active. Selecting a country prioritizes regional peers when available.
          </span>
        </div>
      </div>
    </div>
  );
};
