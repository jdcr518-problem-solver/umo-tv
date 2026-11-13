import type React from 'react';
import { X, Sparkles, Check, Cpu } from 'lucide-react';
import { AVAILABLE_FILTERS } from '../modules/ar-filter/filterManager.js';
import type { FilterId } from '@shared/types.js';

interface FilterDrawerProps {
  isOpen: boolean;
  activeFilter: FilterId;
  onSelectFilter: (id: FilterId) => void;
  onClose: () => void;
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  activeFilter,
  onSelectFilter,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AR Face Filters</h3>
              <p className="text-[11px] text-slate-400">Real-time WebRTC stream transformation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter List */}
        <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {AVAILABLE_FILTERS.map((filter) => {
            const isSelected = activeFilter === filter.id;

            return (
              <div
                key={filter.id}
                onClick={() => onSelectFilter(filter.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                  isSelected
                    ? 'bg-purple-950/30 border-purple-500/60 shadow-md shadow-purple-900/20'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">{filter.name}</span>
                    {filter.id !== 'none' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        MediaPipe + Three.js
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{filter.description}</p>
                </div>

                <div className="pt-0.5">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-600" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Technical Guarantee Badge */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-400">
          <Cpu className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-300">Outgoing Stream Guarantee:</span> Filter effects are rendered on-device into an HTML5 Canvas and broadcast via WebRTC <code className="text-purple-300 text-[10px]">captureStream()</code>. The remote peer sees the rendered filter directly in real time.
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-colors"
        >
          Apply Filter
        </button>
      </div>
    </div>
  );
};
