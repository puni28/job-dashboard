'use client';

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

type Column = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
};

const COLUMNS: Column[] = [
  { id: 'Applied',    label: 'Applied',    color: 'text-blue-400',   bgColor: 'bg-blue-500/10',   borderColor: 'border-blue-500/30',   dotColor: 'bg-blue-400' },
  { id: 'Screening',  label: 'Screening',  color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/30', dotColor: 'bg-yellow-400' },
  { id: 'Interview',  label: 'Interview',  color: 'text-purple-400', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/30', dotColor: 'bg-purple-400' },
  { id: 'Offer',      label: 'Offer',      color: 'text-green-400',  bgColor: 'bg-green-500/10',  borderColor: 'border-green-500/30',  dotColor: 'bg-green-400' },
  { id: 'Rejected',   label: 'Rejected',   color: 'text-red-400',    bgColor: 'bg-red-500/10',    borderColor: 'border-red-500/30',    dotColor: 'bg-red-400' },
];

type Props = {
  jobs: Job[];
  onDelete: (id: number) => void;
  onEdit: (job: Job) => void;
};

export default function JobBoard({ jobs, onDelete, onEdit }: Props) {
  const byStatus = (status: string) => jobs.filter(j => j.status === status);

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
    <div className="kanban-scroll flex gap-4 pb-4 min-h-0">
      {COLUMNS.map(col => {
        const colJobs = byStatus(col.id);
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-72 flex flex-col"
          >
            {/* Column Header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${col.bgColor} border ${col.borderColor} border-b-0`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bgColor} ${col.color} border ${col.borderColor}`}>
                {colJobs.length}
              </span>
            </div>

            {/* Cards */}
            <div className={`flex-1 p-2 border ${col.borderColor} border-t-0 rounded-b-xl bg-slate-900/50 min-h-24 card-scroll max-h-[calc(100vh-200px)]`}>
              {colJobs.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-xs text-slate-600">
                  No applications
                </div>
              ) : (
                <div className="space-y-3">
                  {colJobs.map(job => (
                    <JobCard key={job.id} job={job} onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
