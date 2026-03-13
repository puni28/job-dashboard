'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Filter, Eye, EyeOff, Link, X, ChevronDown, ChevronUp } from 'lucide-react';
import ListingCard from './ListingCard';

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
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
};

export default function FindJobs({ onShowToast }: Props) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('All');

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/listings');
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleRefresh = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/listings/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = await res.json();
        onShowToast(`Fetched ${data.fetched} listings from ${data.sources.join(', ')}`, 'success');
        await fetchListings();
      } else {
        onShowToast('Failed to fetch listings', 'error');
      }
    } finally {
      setFetching(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError('');
    try {
      const res = await fetch('/api/listings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const listing = data.listing;
        setListings(prev => {
          const exists = prev.find(l => l.id === listing.id);
          return exists ? prev.map(l => l.id === listing.id ? listing : l) : [listing, ...prev];
        });
        setImportUrl('');
        setShowImport(false);
        onShowToast(`Imported: ${listing.title} at ${listing.company}`, 'success');
      } else {
        setImportError(data.error || 'Import failed');
      }
    } finally {
      setImporting(false);
    }
  };

  const handleAction = async (id: number, action: 'liked' | 'dismissed') => {
    const existing = listings.find(l => l.id === id);
    const newAction = existing?.userAction === action ? null : action;

    setListings(prev => prev.map(l => l.id === id ? { ...l, userAction: newAction } : l));

    if (newAction) {
      await fetch('/api/listings/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id, action: newAction }),
      });
    }
  };

  const sources = ['All', ...Array.from(new Set(listings.map(l => l.source)))];

  const filtered = listings.filter(l => {
    if (!showDismissed && l.userAction === 'dismissed') return false;
    if (minScore > 0 && l.score < minScore) return false;
    if (remoteOnly && l.remote !== 'remote' && !(l.location?.toLowerCase().includes('remote'))) return false;
    if (sourceFilter !== 'All' && l.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.title.toLowerCase().includes(q) || l.company.toLowerCase().includes(q) || (l.tags || '').toLowerCase().includes(q);
    }
    return true;
  });

  const likedCount = listings.filter(l => l.userAction === 'liked').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">{filtered.length} listings</span>
          {likedCount > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
              {likedCount} liked
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, company, skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 w-56"
            />
          </div>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
          >
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Min score */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value={0}>All scores</option>
              <option value={40}>40%+</option>
              <option value={60}>60%+</option>
              <option value={75}>75%+</option>
            </select>
          </div>

          {/* Remote toggle */}
          <button
            onClick={() => setRemoteOnly(v => !v)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              remoteOnly
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
            }`}
          >
            Remote only
          </button>

          {/* Show/hide dismissed */}
          <button
            onClick={() => setShowDismissed(v => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 transition-colors"
          >
            {showDismissed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showDismissed ? 'Hide dismissed' : 'Show dismissed'}
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={fetching}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Fetching...' : 'Fetch Jobs'}
          </button>
        </div>
      </div>

      {/* Import from URL */}
      <div className="border border-slate-700 rounded-xl overflow-hidden">
        <button
          onClick={() => { setShowImport(v => !v); setImportError(''); }}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/60 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 text-slate-300">
            <Link className="w-4 h-4 text-blue-400" />
            <span className="font-medium">Import from job URL</span>
            <span className="text-xs text-slate-500">Paste a link to any job posting</span>
          </div>
          {showImport ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showImport && (
          <div className="px-4 pb-4 pt-3 border-t border-slate-700 bg-slate-800/20 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://jobs.example.com/software-engineer-123"
                value={importUrl}
                onChange={e => { setImportUrl(e.target.value); setImportError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleImport()}
                className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 placeholder-slate-500"
                disabled={importing}
              />
              <button
                onClick={handleImport}
                disabled={importing || !importUrl.trim()}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {importing ? 'Importing...' : 'Import'}
              </button>
              {importUrl && !importing && (
                <button
                  onClick={() => { setImportUrl(''); setImportError(''); }}
                  className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {importError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{importError}</p>
            )}
            <p className="text-xs text-slate-500">
              Works with most job boards. If a page blocks automated access, try copying the job description into your profile instead.
            </p>
          </div>
        )}
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">No listings yet</h3>
          <p className="text-slate-500 max-w-sm mb-4">
            Click <strong className="text-slate-400">Fetch Jobs</strong> to pull listings from Remotive, RemoteOK, The Muse, and We Work Remotely.
          </p>
          <p className="text-xs text-slate-600">
            Set your preferred job titles in <strong>Profile</strong> to get better matches.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onLike={id => handleAction(id, 'liked')}
              onDismiss={id => handleAction(id, 'dismissed')}
              onShowToast={onShowToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}
