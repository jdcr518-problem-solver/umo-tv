import type React from 'react';
import { X, Users, Check, Sparkles } from 'lucide-react';
import { GENDER_OPTIONS, type GenderPreference } from '../lib/constants.js';

interface GenderSelectModalProps {
  isOpen: boolean;
  selectedGender: GenderPreference;
  onSelectGender: (gender: GenderPreference) => void;
  onClose: () => void;
}

export const GenderSelectModal: React.FC<GenderSelectModalProps> = ({
  isOpen,
  selectedGender,
  onSelectGender,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Gender Filter</h3>
              <p className="text-xs text-slate-400">Select your preferred partner filter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {GENDER_OPTIONS.map((opt) => {
            const isSelected = opt.id === selectedGender;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  onSelectGender(opt.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500/50 text-white'
                    : 'bg-slate-800/40 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className="text-2xl">{opt.icon}</span>
                  <div>
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs text-slate-400">{opt.subtitle}</div>
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Note */}
        <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span>
            Filters are applied based on available queue participants. Selecting Anyone gives instantaneous connection times.
          </span>
        </div>
      </div>
    </div>
  );
};
