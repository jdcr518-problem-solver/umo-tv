import type React from 'react';
import { ShieldCheck, Lock, AlertCircle, EyeOff, Check } from 'lucide-react';

interface AgeGateModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const AgeGateModal: React.FC<AgeGateModalProps> = ({
  isOpen,
  onConfirm,
  onClose,
  canDismiss = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3 text-indigo-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Welcome to UMO TV</h2>
          <p className="text-xs text-slate-400">
            Anonymous random video chat with real-time AR face filters.
          </p>
        </div>

        {/* Essential Disclaimers */}
        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
              <span className="text-[10px] font-extrabold px-1">18+</span>
            </div>
            <p className="text-slate-300">
              <strong className="text-white">Strict 18+ Age Restriction:</strong> You must be at least 18 years of age to enter and chat.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
              <EyeOff className="w-3.5 h-3.5" />
            </div>
            <p className="text-slate-300">
              <strong className="text-white">Zero Recording Policy:</strong> Video streams are strictly peer-to-peer (P2P). UMO TV never records, intercepts, or stores your video or audio conversations.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <p className="text-slate-300">
              <strong className="text-white">Instant Guest Access:</strong> No passwords, phone numbers, or credit cards are required.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <p className="text-slate-300">
              <strong className="text-white">Zero Tolerance For Abuse:</strong> Inappropriate acts, nudity, hate speech, or harassment result in permanent IP & device bans.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-purple-500 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>I Am 18+ & Agree to Safety Rules</span>
          </button>

          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
