'use client';

import { useState } from 'react';
import { Building2, MapPin, Link, ChevronDown, ChevronUp, Clock, Trash2, Edit2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

const UPDATE_COLORS: Record<string, string> = {
  'Application Confirmed': 'text-blue-400',
  'Screening Call Scheduled': 'text-yellow-400',
  'Interview Invitation': 'text-purple-400',
  'Offer Received': 'text-green-400',
  'Application Rejected': 'text-red-400',
  'Status Update': 'text-slate-400',
};

type Props = {
  job: Job;
  onDelete: (id: number) => void;
  onEdit: (job: Job) => void;
};

export default function JobCard({ job, onDelete, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);

  const timeAgo = job.last_updated
    ? formatDistanceToNow(new Date(job.last_updated), { addSuffix: true })
    : null;

  const appliedDate = job.applied_date
    ? new Date(job.applied_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-slate-700 rounded-md p-1.5 flex-shrink-0">
              <Building2 className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <span className="text-sm font-semibold text-white truncate">{job.company}</span>
          </div>
          <p className="text-xs text-slate-400 pl-8 truncate">{job.position}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(job)}
            className="p-1 text-slate-400 hover:text-blue-400 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(job.id)}
            className="p-1 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-3 flex flex-wrap gap-2">
        {job.location && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <MapPin className="w-3 h-3" />
            {job.location}
          </span>
        )}
        {job.job_url && (
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            onClick={e => e.stopPropagation()}
          >
            <Link className="w-3 h-3" />
            View Job
          </a>
        )}
      </div>

      {/* Dates */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        {appliedDate && <span>Applied {appliedDate}</span>}
        {timeAgo && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </span>
        )}
      </div>

      {/* Updates */}
      {job.updates.length > 0 && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            <span>{job.updates.length} email update{job.updates.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="mt-2 space-y-2 max-h-40 card-scroll pr-1">
              {job.updates.map(update => (
                <div key={update.id} className="bg-slate-700/50 rounded-lg p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium ${UPDATE_COLORS[update.update_type] ?? 'text-slate-400'}`}>
                      {update.update_type}
                    </span>
                    {update.received_at && (
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(update.received_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  {update.email_subject && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{update.email_subject}</p>
                  )}
                  {update.message && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{update.message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {job.notes && (
        <div className="mt-3 border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-400 line-clamp-2">{job.notes}</p>
        </div>
      )}
    </div>
  );
}
