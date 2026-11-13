import type React from 'react';
import {
  SkipForward,
  Square,
  Play,
  ChevronDown,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import type { MatchmakingState } from '@shared/types.js';
import type { CountryOption, GenderPreference } from '../lib/constants.js';

interface ControlBarProps {
  state: MatchmakingState;
  selectedCountry: CountryOption;
  selectedGender: GenderPreference;
  partnerCountry?: string;
  isChatOpen: boolean;
  unreadCount?: number;
  onNext: () => void;
  onStop: () => void;
  onOpenCountryModal: () => void;
  onOpenGenderModal: () => void;
  onToggleChat: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  state,
  selectedCountry,
  selectedGender,
  partnerCountry,
  isChatOpen,
  unreadCount = 0,
  onNext,
  onStop,
  onOpenCountryModal,
  onOpenGenderModal,
  onToggleChat,
}) => {
  const isCallActive =
    state === 'CONNECTED' ||
    state === 'CONNECTING' ||
    state === 'MATCHING' ||
    state === 'QUEUED';

  const getGenderLabel = (g: GenderPreference) => {
    switch (g) {
      case 'female':
        return 'Women';
      case 'male':
        return 'Men';
      default:
        return 'Anyone';
    }
  };

  const getGenderIcon = (g: GenderPreference) => {
    switch (g) {
      case 'female':
        return '👩';
      case 'male':
        return '👨';
      default:
        return '👥';
    }
  };

  const renderStatus = () => {
    switch (state) {
      case 'CONNECTED':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-emerald-400 leading-tight uppercase tracking-wider">
                Connected
              </span>
              <span className="text-xs font-semibold text-white truncate">
                {partnerCountry || 'Global Partner'}
              </span>
            </div>
          </div>
        );

      case 'CONNECTING':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-blue-400 leading-tight uppercase tracking-wider">
                Connecting
              </span>
              <span className="text-xs text-slate-300 truncate">Exchanging Video</span>
            </div>
          </div>
        );

      case 'MATCHING':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0 animate-bounce" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-indigo-400 leading-tight uppercase tracking-wider">
                Matched
              </span>
              <span className="text-xs text-slate-300 truncate">Assigning Room</span>
            </div>
          </div>
        );

      case 'QUEUED':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 animate-ping" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-amber-400 leading-tight uppercase tracking-wider">
                Searching
              </span>
              <span className="text-xs text-slate-300 truncate">Looking for Stranger</span>
            </div>
          </div>
        );

      case 'DISCONNECTED':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-slate-400 leading-tight uppercase tracking-wider">
                Partner Left
              </span>
              <span className="text-xs text-slate-300 truncate">Tap Next to continue</span>
            </div>
          </div>
        );

      case 'ERROR':
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-rose-400 leading-tight uppercase tracking-wider">
                Failed
              </span>
              <span className="text-xs text-slate-300 truncate">Tap Next to retry</span>
            </div>
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-slate-400 leading-tight uppercase tracking-wider">
                Ready
              </span>
              <span className="text-xs text-slate-300 truncate">Press Next / Start</span>
            </div>
          </div>
        );
    }
  };

  return (
    <footer className="w-full bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 px-3 py-2.5 sm:px-6 sm:py-3.5 z-30 select-none">
      {/* 
        Responsive Container:
        - Desktop: Single horizontal bar
        - Mobile: Two stacked rows (Action buttons on top, Selectors & Status below)
      */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-4">
        
        {/* Row 1 on Mobile / Left & Center on Desktop: [ NEXT ] [ STOP ] */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 md:flex-initial">
          {/* 1. Next Button (Green Tone) */}
          <button
            onClick={onNext}
            className="flex-1 md:flex-initial min-w-[130px] sm:min-w-[150px] h-12 sm:h-13 px-5 sm:px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98] cursor-pointer"
            title="Connect with the next partner"
          >
            {isCallActive ? (
              <>
                <SkipForward className="w-5 h-5 fill-current stroke-none" />
                <span>NEXT</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current stroke-none" />
                <span>START</span>
              </>
            )}
          </button>

          {/* 2. Stop Button (Orange / Red Tone) */}
          <button
            onClick={onStop}
            disabled={!isCallActive}
            className={`min-w-[90px] sm:min-w-[110px] h-12 sm:h-13 px-4 sm:px-6 rounded-2xl font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
              isCallActive
                ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-rose-950/40'
                : 'bg-slate-800/60 text-slate-500 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
            title="Stop chat session"
          >
            <Square className="w-4 h-4 fill-current stroke-none" />
            <span>STOP</span>
          </button>
        </div>

        {/* Row 2 on Mobile / Right Cluster on Desktop: Country, Gender, Status, Chat */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {/* 3. Country Select (White / Light Selection Pill) */}
          <button
            onClick={onOpenCountryModal}
            className="h-11 sm:h-12 px-3 sm:px-4 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 border border-slate-200 shadow-sm font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            title="Choose partner country preference"
          >
            <span className="text-base sm:text-lg leading-none">{selectedCountry.flag}</span>
            <span className="max-w-[70px] sm:max-w-[90px] truncate">{selectedCountry.name.split(' ')[0]}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>

          {/* 4. Gender Select (White / Light Selection Pill) */}
          <button
            onClick={onOpenGenderModal}
            className="h-11 sm:h-12 px-3 sm:px-4 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 border border-slate-200 shadow-sm font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            title="Choose partner gender preference"
          >
            <span className="text-base sm:text-lg leading-none">{getGenderIcon(selectedGender)}</span>
            <span>{getGenderLabel(selectedGender)}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </button>

          {/* 5. Connection Status / Partner Country Display (Compact Info Card) */}
          <div className="flex-1 sm:flex-initial h-11 sm:h-12 px-3 sm:px-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center shadow-inner min-w-[140px] sm:min-w-[175px]">
            {renderStatus()}
          </div>

          {/* 6. Chat Button (Secondary Action) */}
          <button
            onClick={onToggleChat}
            className={`relative h-11 sm:h-12 px-3.5 sm:px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 border transition-all active:scale-[0.98] cursor-pointer ${
              isChatOpen
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/30'
                : 'bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border-slate-700 text-slate-200 hover:text-white'
            }`}
            title="Toggle In-Call Message Chat Panel"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-pink-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-slate-950 shadow">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

      </div>
    </footer>
  );
};
