'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Mail, ExternalLink, RefreshCw, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

type Document = {
  id: number;
  doc_type: string;
  content: string;
  version: number;
  created_at: string;
};

type LikedListing = {
  id: number;
  source: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  url: string;
  posted_at: string | null;
  documents: Document[];
};

type Props = {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

function DocumentViewer({ doc }: { doc: Document }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(doc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          {doc.doc_type === 'resume' ? (
            <FileText className="w-4 h-4 text-blue-400" />
          ) : (
            <Mail className="w-4 h-4 text-purple-400" />
          )}
          <span className="text-sm font-medium text-slate-200">
            {doc.doc_type === 'resume' ? 'Resume' : 'Cover Letter'}
          </span>
          <span className="text-xs text-slate-500">v{doc.version}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
        {doc.content}
      </pre>
    </div>
  );
}

function LikedJobCard({ listing, onShowToast, onRefresh }: { listing: LikedListing; onShowToast: Props['onShowToast']; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [generatingCL, setGeneratingCL] = useState(false);

  const resumeDocs = listing.documents.filter(d => d.doc_type === 'resume');
  const clDocs = listing.documents.filter(d => d.doc_type === 'cover_letter');
  const latestResume = resumeDocs[0];
  const latestCL = clDocs[0];

  const generate = async (type: 'resume' | 'cover_letter') => {
    const setLoading = type === 'resume' ? setGeneratingResume : setGeneratingCL;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, type }),
      });
      if (res.ok) {
        const label = type === 'resume' ? 'Resume' : 'Cover letter';
        onShowToast(`${label} generated!`, 'success');
        onRefresh();
        setExpanded(true);
      } else {
        const data = await res.json();
        onShowToast(data.error || 'Generation failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-500 bg-slate-700/60 px-2 py-0.5 rounded-full">{listing.source}</span>
          </div>
          <h3 className="text-sm font-semibold text-white">{listing.title}</h3>
          <p className="text-xs text-slate-400">{listing.company} {listing.location ? `· ${listing.location}` : ''}</p>
          {listing.salary && <p className="text-xs text-green-400 mt-0.5">{listing.salary}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Generate buttons */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => generate('resume')}
          disabled={generatingResume}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors disabled:opacity-50"
        >
          {generatingResume ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          {generatingResume ? 'Generating...' : latestResume ? 'Regenerate Resume' : 'Generate Resume'}
        </button>
        <button
          onClick={() => generate('cover_letter')}
          disabled={generatingCL}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 transition-colors disabled:opacity-50"
        >
          {generatingCL ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Mail className="w-3.5 h-3.5" />
          )}
          {generatingCL ? 'Generating...' : latestCL ? 'Regenerate Cover Letter' : 'Generate Cover Letter'}
        </button>
      </div>

      {/* Documents (expanded) */}
      {expanded && (latestResume || latestCL) && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-slate-700/50 pt-3">
          {latestResume && <DocumentViewer doc={latestResume} />}
          {latestCL && <DocumentViewer doc={latestCL} />}
        </div>
      )}
    </div>
  );
}

export default function LikedJobs({ onShowToast }: Props) {
  const [listings, setListings] = useState<LikedListing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLiked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/listings/liked');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiked();
  }, [fetchLiked]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">❤️</div>
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No liked jobs yet</h3>
        <p className="text-slate-500 max-w-sm">
          Go to <strong className="text-slate-400">Find Jobs</strong> and like the roles you&apos;re interested in. Then come back here to generate your tailored resume and cover letter.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{listings.length} liked {listings.length === 1 ? 'job' : 'jobs'}</span>
        <p className="text-xs text-slate-500">Complete your <strong className="text-slate-400">Profile</strong> for best results</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {listings.map(l => (
          <LikedJobCard key={l.id} listing={l} onShowToast={onShowToast} onRefresh={fetchLiked} />
        ))}
      </div>
    </div>
  );
}
