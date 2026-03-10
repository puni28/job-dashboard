'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import JobBoard from '@/components/JobBoard';
import JobModal from '@/components/JobModal';
import SyncToast from '@/components/SyncToast';
import { Mail, ArrowRight, Shield, Zap, RefreshCw } from 'lucide-react';

type JobUpdate = {
  id: number;
  update_type: string;
  message: string | null;
  email_subject: string | null;
  received_at: string | null;
  created_at: string;
};

type Job = {
  id: number;
  company: string;
  position: string;
  status: string;
  applied_date: string | null;
  last_updated: string | null;
  job_url: string | null;
  location: string | null;
  notes: string | null;
  updates: JobUpdate[];
};

type Toast = { message: string; type: 'success' | 'error' | 'info' };

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (message: string, type: Toast['type']) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/status');
    const data = await res.json();
    setConnected(data.connected);
    setUserEmail(data.email ?? null);
    return data.connected;
  }, []);

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/jobs');
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const isConnected = await fetchStatus();
      if (isConnected) {
        await fetchJobs();
      }
      setLoading(false);

      // Check URL params for feedback
      const params = new URLSearchParams(window.location.search);
      if (params.get('connected') === 'true') {
        showToast('Gmail connected! Click "Sync Emails" to import your applications.', 'success');
        window.history.replaceState({}, '', '/');
      } else if (params.get('error')) {
        showToast(`Connection failed: ${params.get('error')}`, 'error');
        window.history.replaceState({}, '', '/');
      }
    };
    init();
  }, [fetchStatus, fetchJobs]);

  const handleSync = async () => {
    setSyncing(true);
    let totalAdded = 0;
    let totalUpdated = 0;
    let pageToken: string | null = null;
    let page = 0;

    try {
      do {
        page++;
        const res: Response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageToken }),
        });
        const data = await res.json();

        if (!res.ok) {
          showToast(data.error ?? 'Sync failed. Please try again.', 'error');
          return;
        }

        totalAdded += data.stats.added;
        totalUpdated += data.stats.updated;
        pageToken = data.nextPageToken ?? null;

        // Refresh jobs after each batch so the board updates progressively
        await fetchJobs();
      } while (pageToken);

      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      setLastSynced(now);

      if (totalAdded === 0 && totalUpdated === 0) {
        showToast('Inbox synced — no new job emails found.', 'info');
      } else {
        showToast(
          `Synced! ${totalAdded > 0 ? `${totalAdded} new job${totalAdded !== 1 ? 's' : ''} added` : ''}${totalAdded > 0 && totalUpdated > 0 ? ', ' : ''}${totalUpdated > 0 ? `${totalUpdated} updated` : ''}.`,
          'success'
        );
      }
    } catch {
      showToast('Network error. Check your connection.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Gmail? Your saved job data will be deleted.')) return;
    await fetch('/api/disconnect', { method: 'POST' });
    setConnected(false);
    setUserEmail(null);
    setJobs([]);
    setLastSynced(null);
    showToast('Gmail disconnected.', 'info');
  };

  const handleSaveJob = async (data: Partial<Job>) => {
    if (editingJob) {
      const res = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
      await fetchJobs();
      showToast('Application updated.', 'success');
    } else {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Create failed');
      await fetchJobs();
      showToast('Application added.', 'success');
    }
    setEditingJob(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this job application?')) return;
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    setJobs(prev => prev.filter(j => j.id !== id));
    showToast('Application deleted.', 'info');
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setShowModal(true);
  };

  const handleAddJob = () => {
    setEditingJob(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingJob(null);
  };

  // Stats
  const stats = {
    total: jobs.length,
    active: jobs.filter(j => !['Rejected'].includes(j.status)).length,
    interviews: jobs.filter(j => j.status === 'Interview').length,
    offers: jobs.filter(j => j.status === 'Offer').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        connected={connected}
        email={userEmail}
        syncing={syncing}
        lastSynced={lastSynced}
        onSync={handleSync}
        onDisconnect={handleDisconnect}
        onAddJob={handleAddJob}
      />

      <main className="flex-1 flex flex-col p-6 gap-6 max-w-screen-2xl mx-auto w-full">
        {!connected ? (
          /* Landing / Connect Screen */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-2xl mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/20 border border-blue-500/30 rounded-2xl mb-6">
                <Mail className="w-10 h-10 text-blue-400" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Job Application Tracker
              </h1>
              <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                Connect your Gmail to automatically detect job applications and track status
                updates — all in one place, no manual entry needed.
              </p>

              <a
                href="/api/auth/google"
                className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 shadow-lg shadow-blue-500/20"
              >
                <Mail className="w-5 h-5" />
                Connect Gmail
                <ArrowRight className="w-5 h-5" />
              </a>

              {/* Setup hint */}
              <p className="mt-4 text-sm text-slate-500">
                Requires Google Cloud OAuth credentials.{' '}
                <span className="text-slate-400">Copy <code className="bg-slate-800 px-1 rounded">.env.example</code> to <code className="bg-slate-800 px-1 rounded">.env</code> and add your credentials.</span>
              </p>

              {/* Features */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                {[
                  { icon: Zap, title: 'Auto-detect', desc: 'Scans emails for application confirmations, interviews, and offers' },
                  { icon: RefreshCw, title: 'Live updates', desc: 'Sync anytime to get the latest status from your inbox' },
                  { icon: Shield, title: 'Private', desc: 'Data stored locally on your machine, never sent to third parties' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <Icon className="w-5 h-5 text-blue-400 mb-2" />
                    <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard */
          <>
            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-slate-300' },
                { label: 'Active', value: stats.active, color: 'text-blue-400' },
                { label: 'Interviews', value: stats.interviews, color: 'text-purple-400' },
                { label: 'Offers', value: stats.offers, color: 'text-green-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-center">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Kanban Board */}
            <div className="flex-1">
              <JobBoard jobs={jobs} onDelete={handleDelete} onEdit={handleEdit} />
            </div>
          </>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <JobModal
          job={editingJob}
          onClose={handleCloseModal}
          onSave={handleSaveJob}
        />
      )}

      {/* Toast */}
      {toast && (
        <SyncToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
