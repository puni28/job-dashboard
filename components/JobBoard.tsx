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
  updates: JobUpdate[];
};

const FILTERS = [
  { id: 'Applied',   label: 'Applied',   color: 'text-blue-400',   activeBg: 'bg-blue-600',   dotColor: 'bg-blue-400' },
  { id: 'Screening', label: 'Screening', color: 'text-yellow-400', activeBg: 'bg-yellow-500', dotColor: 'bg-yellow-400' },
  { id: 'Interview', label: 'Interview', color: 'text-purple-400', activeBg: 'bg-purple-600', dotColor: 'bg-purple-400' },
  { id: 'Offer',     label: 'Offer',     color: 'text-green-400',  activeBg: 'bg-green-600',  dotColor: 'bg-green-400' },
  { id: 'Rejected',  label: 'Rejected',  color: 'text-red-400',    activeBg: 'bg-red-600',    dotColor: 'bg-red-400' },
] as const;

type Props = {
  jobs: Job[];
  onDelete: (id: number) => void;
  onEdit: (job: Job) => void;
};

export default function JobBoard({ jobs, onDelete, onEdit }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>('Applied');

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

  const countByStatus = (status: string) => jobs.filter(j => j.status === status).length;
  const filteredJobs = jobs.filter(j => j.status === activeFilter);
  const activeFilterDef = FILTERS.find(f => f.id === activeFilter)!;

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => {
          const isActive = activeFilter === f.id;
          const count = countByStatus(f.id);
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                isActive
                  ? `${f.activeBg} text-white border-transparent shadow-sm`
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-white/70' : f.dotColor}`} />
              {f.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className={`w-2 h-2 rounded-full ${activeFilterDef.dotColor} mb-3`} />
          <p className="text-slate-500 text-sm">No <span className={activeFilterDef.color}>{activeFilter}</span> applications</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-500">{filteredJobs.length} application{filteredJobs.length !== 1 ? 's' : ''}</p>
          {filteredJobs.map(job => (
            <JobCard key={job.id} job={job} onDelete={onDelete} onEdit={onEdit} />
          ))}
        </div>
      )}
    </div>
  );
}
