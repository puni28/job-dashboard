'use client';

import { useState } from 'react';
import JobCard from './JobCard';

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
  email_thread_id: string | null;
  updates: JobUpdate[];
};

type Tab = {
  id: string;
  label: string;
  dotColor: string;
  activeTextColor: string;
};

const TABS: Tab[] = [
  { id: 'all',       label: 'All Jobs',     dotColor: 'bg-slate-400',   activeTextColor: 'text-slate-200' },
  { id: 'Applied',   label: 'Applied',      dotColor: 'bg-blue-400',    activeTextColor: 'text-blue-300' },
  { id: 'Screening', label: 'Reviewing',    dotColor: 'bg-yellow-400',  activeTextColor: 'text-yellow-300' },
  { id: 'Interview', label: 'Interviewing', dotColor: 'bg-purple-400',  activeTextColor: 'text-purple-300' },
  { id: 'Offer',     label: 'Offered',      dotColor: 'bg-green-400',   activeTextColor: 'text-green-300' },
  { id: 'Rejected',  label: 'Rejected',     dotColor: 'bg-red-400',     activeTextColor: 'text-red-300' },
];

type Props = {
  jobs: Job[];
  onDelete: (id: number) => void;
  onEdit: (job: Job) => void;
};

export default function JobBoard({ jobs, onDelete, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState('all');

  const filteredJobs = activeTab === 'all'
    ? jobs
    : jobs.filter(j => j.status === activeTab);

  const countByStatus = (id: string) =>
    id === 'all' ? jobs.length : jobs.filter(j => j.status === id).length;

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">📭</div>
        <h2 className="text-xl font-semibold text-slate-300 mb-2">No applications yet</h2>
        <p className="text-slate-500 max-w-sm">
          Connect your Gmail and click <strong className="text-slate-400">Sync Emails</strong> to automatically
          import your job applications, or add one manually.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tab Navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 kanban-scroll">
        {TABS.map(tab => {
          const count = countByStatus(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? `bg-slate-800 border-slate-600 ${tab.activeTextColor}`
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
              }`}
            >
              {isActive && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tab.dotColor}`} />}
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-800/60 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Job List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-slate-500 text-sm">No applications in this category yet.</p>
          </div>
        ) : (
          filteredJobs.map(job => (
            <JobCard key={job.id} job={job} onDelete={onDelete} onEdit={onEdit} />
          ))
        )}
      </div>
    </div>
  );
}
