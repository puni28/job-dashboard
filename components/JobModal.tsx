'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

type Job = {
  id: number;
  company: string;
  position: string;
  status: string;
  job_url: string | null;
  location: string | null;
  notes: string | null;
};

type Props = {
  job?: Job | null;
  onClose: () => void;
  onSave: (data: Partial<Job>) => Promise<void>;
};

const STATUSES = ['Applied', 'Screening', 'Interview', 'Offer', 'Rejected'] as const;

const STATUS_COLORS: Record<string, string> = {
  Applied: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  Screening: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  Interview: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  Offer: 'bg-green-500/20 border-green-500/50 text-green-300',
  Rejected: 'bg-red-500/20 border-red-500/50 text-red-300',
};

export default function JobModal({ job, onClose, onSave }: Props) {
  const [company, setCompany] = useState(job?.company ?? '');
  const [position, setPosition] = useState(job?.position ?? '');
  const [status, setStatus] = useState<string>(job?.status ?? 'Applied');
  const [jobUrl, setJobUrl] = useState(job?.job_url ?? '');
  const [location, setLocation] = useState(job?.location ?? '');
  const [notes, setNotes] = useState(job?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !position.trim()) {
      setError('Company and position are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        company: company.trim(),
        position: position.trim(),
        status,
        job_url: jobUrl.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {job ? 'Edit Application' : 'Add Application'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Company *</label>
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="e.g. Google, Stripe, OpenAI"
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Position *</label>
            <input
              value={position}
              onChange={e => setPosition(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    status === s
                      ? STATUS_COLORS[s]
                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Job URL</label>
            <input
              value={jobUrl}
              onChange={e => setJobUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, CA / Remote"
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Recruiter contact, salary range, referral..."
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 text-white placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Saving...' : job ? 'Save Changes' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
