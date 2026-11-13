import type React from 'react';
import { ShieldCheck, Video, Users } from 'lucide-react';
import type { MatchmakingState } from '@shared/types.js';

interface HeaderProps {
  state: MatchmakingState;
  guestId?: string;
  isAgeVerified: boolean;
  onOpenRules: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  guestId,
  isAgeVerified,
  onOpenRules,
}) => {
  const getStatusBadge = () => {
    switch (state) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            In Call
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Waiting for Stranger...
          </span>
        );
      case 'MATCHING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Stranger Found
          </span>
        );
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Connecting Video...
          </span>
        );
      case 'DISCONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Stranger Disconnected
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Connection Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            Idle
          </span>
        );
    }
  };

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between z-30 select-none">
      {/* Brand Identity */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Video className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">UMO</span>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-pink-500 to-purple-400 bg-clip-text text-transparent">
              TV
            </span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              WebRTC + AR
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">Random Video Chat with Real-Time Face Filters</p>
        </div>
      </div>

      {/* Center Status */}
      <div className="flex items-center gap-3">
        {getStatusBadge()}
      </div>

      {/* Right Controls & Verification Badge */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenRules}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
          title="Community Rules and Safety Policy"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Safety & 18+</span>
          {isAgeVerified && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400 bg-slate-950/60 border border-slate-800">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>{guestId ? `Guest#${guestId.slice(0, 6)}` : 'Guest'}</span>
        </div>
      </div>
    </header>
  );
};
