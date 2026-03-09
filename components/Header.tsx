'use client';

import { Mail, RefreshCw, LogOut, Plus, Briefcase } from 'lucide-react';

type Props = {
  connected: boolean;
  email: string | null;
  syncing: boolean;
  lastSynced: string | null;
  onSync: () => void;
  onDisconnect: () => void;
  onAddJob: () => void;
};

export default function Header({ connected, email, syncing, lastSynced, onSync, onDisconnect, onAddJob }: Props) {
  return (
    <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-lg p-2">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Job Tracker</h1>
            <p className="text-xs text-slate-400">Email-powered application board</p>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {connected && (
            <>
              {lastSynced && (
                <span className="text-xs text-slate-400 hidden sm:block">
                  Last synced: {lastSynced}
                </span>
              )}

              <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs text-slate-300 max-w-[140px] truncate">{email}</span>
              </div>

              <button
                onClick={onAddJob}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Job
              </button>

              <button
                onClick={onSync}
                disabled={syncing}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Emails'}
              </button>

              <button
                onClick={onDisconnect}
                className="flex items-center gap-2 bg-slate-700 hover:bg-red-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </>
          )}

          {!connected && (
            <a
              href="/api/auth/google"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Mail className="w-4 h-4" />
              Connect Gmail
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
