import { useState } from 'react';
import type React from 'react';
import { X, AlertTriangle, ShieldAlert, Check } from 'lucide-react';
import type { ReportReason } from '@shared/types.js';

interface ReportModalProps {
  isOpen: boolean;
  peerSessionId?: string;
  onReportAndBlock: (reason: ReportReason, notes?: string) => void;
  onClose: () => void;
}

const REPORT_REASONS: { label: string; value: ReportReason; description: string }[] = [
  {
    label: 'Inappropriate Content / NSFW',
    value: 'INAPPROPRIATE_CONTENT',
    description: 'Nudity, sexual acts, or illicit material on video.',
  },
  {
    label: 'Harassment & Bullying',
    value: 'HARASSMENT',
    description: 'Threats, verbal abuse, hate speech, or intimidatory behavior.',
  },
  {
    label: 'Underage User',
    value: 'UNDERAGE',
    description: 'The user appears to be under 18 years of age.',
  },
  {
    label: 'Spam / Commercial Bots',
    value: 'SPAM',
    description: 'Automated video recordings, links, or advertising scams.',
  },
  {
    label: 'Other Community Violations',
    value: 'OTHER',
    description: 'Any other violation of our zero-tolerance community safety guidelines.',
  },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  peerSessionId,
  onReportAndBlock,
  onClose,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('INAPPROPRIATE_CONTENT');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onReportAndBlock(selectedReason, notes);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Report & Block User</h3>
              <p className="text-[11px] text-slate-400">
                {peerSessionId ? `Reporting peer #${peerSessionId.slice(0, 6)}` : 'Report current chat partner'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Callout */}
        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <p>
            Submitting a report immediately terminates the call, permanently blocks this user from being matched with you, and logs the report for automated moderation review.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-slate-300">Select Reason:</label>
          <div className="space-y-2">
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  selectedReason === reason.value
                    ? 'bg-rose-950/30 border-rose-500/50 text-white'
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="pt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      selectedReason === reason.value
                        ? 'border-rose-400 bg-rose-500 text-white'
                        : 'border-slate-600'
                    }`}
                  >
                    {selectedReason === reason.value && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold">{reason.label}</div>
                  <div className="text-[10px] text-slate-400">{reason.description}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-1">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Optional Details (what happened?):
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide any additional context for moderators..."
              rows={2}
              maxLength={250}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Report & Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
