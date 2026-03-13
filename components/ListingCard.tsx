'use client';

import { useState } from 'react';
import { Heart, X, ExternalLink, MapPin, DollarSign, Tag, Zap, FileText, Mail, RefreshCw } from 'lucide-react';

type Listing = {
  id: number;
  source: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  salary: string | null;
  tags: string | null;
  url: string;
  posted_at: string | null;
  score: number;
  matchedSkills: string[];
  userAction: string | null;
};

type Props = {
  listing: Listing;
  onLike: (id: number) => void;
  onDismiss: (id: number) => void;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
};

function daysAgo(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return '1d ago';
    if (diff < 30) return `${diff}d ago`;
    if (diff < 60) return '1mo ago';
    return `${Math.floor(diff / 30)}mo ago`;
  } catch {
    return null;
  }
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-400 bg-green-500/10 border-green-500/30';
  if (score >= 50) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-slate-400 bg-slate-700/50 border-slate-600';
}

export default function ListingCard({ listing, onLike, onDismiss, onShowToast }: Props) {
  const isLiked = listing.userAction === 'liked';
  const isDismissed = listing.userAction === 'dismissed';
  const age = daysAgo(listing.posted_at);
  const tags = listing.tags?.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4) ?? [];

  const [generatingResume, setGeneratingResume] = useState(false);
  const [generatingCL, setGeneratingCL] = useState(false);

  const generate = async (type: 'resume' | 'cover_letter') => {
    const setLoading = type === 'resume' ? setGeneratingResume : setGeneratingCL;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, type }),
      });
      const data = await res.json();
      if (res.ok) {
        const label = type === 'resume' ? 'Resume' : 'Cover letter';
        onShowToast?.(`${label} generated! Go to Liked Jobs to view it.`, 'success');
      } else {
        onShowToast?.(data.error || 'Generation failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col gap-3 transition-all ${
      isDismissed ? 'opacity-40 border-slate-700' : isLiked ? 'border-blue-500/40 bg-blue-500/5' : 'border-slate-700 hover:border-slate-600'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">{listing.source}</span>
            {listing.remote && (
              <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Remote</span>
            )}
            {age && <span className="text-xs text-slate-500">{age}</span>}
          </div>
          <h3 className="text-sm font-semibold text-white truncate leading-tight">{listing.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{listing.company}</p>
        </div>

        {/* Score */}
        <div className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-lg border ${scoreColor(listing.score)}`}>
          {listing.score}%
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        {listing.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />{listing.location}
          </span>
        )}
        {listing.salary && (
          <span className="flex items-center gap-1 text-green-400">
            <DollarSign className="w-3 h-3" />{listing.salary}
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span key={tag} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Tag className="w-2.5 h-2.5" />{tag}
            </span>
          ))}
        </div>
      )}

      {/* Matched skills */}
      {listing.matchedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {listing.matchedSkills.slice(0, 5).map(skill => (
            <span key={skill} className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" />{skill}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-slate-700/50">
        <button
          onClick={() => onLike(listing.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-colors ${
            isLiked
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700/50 hover:bg-blue-600/20 text-slate-300 hover:text-blue-400'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
          {isLiked ? 'Liked' : 'Like'}
        </button>
        <button
          onClick={() => onDismiss(listing.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg transition-colors ${
            isDismissed
              ? 'bg-slate-600 text-slate-400'
              : 'bg-slate-700/50 hover:bg-slate-600/50 text-slate-300'
          }`}
        >
          <X className="w-3.5 h-3.5" />
          {isDismissed ? 'Dismissed' : 'Dismiss'}
        </button>
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 rounded-lg transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Generate buttons — shown when liked */}
      {isLiked && (
        <div className="flex gap-2 border-t border-blue-500/20 pt-3">
          <button
            onClick={() => generate('resume')}
            disabled={generatingResume}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors disabled:opacity-50"
          >
            {generatingResume ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {generatingResume ? 'Generating...' : 'Generate Resume'}
          </button>
          <button
            onClick={() => generate('cover_letter')}
            disabled={generatingCL}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 transition-colors disabled:opacity-50"
          >
            {generatingCL ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            {generatingCL ? 'Generating...' : 'Generate Cover Letter'}
          </button>
        </div>
      )}
    </div>
  );
}
