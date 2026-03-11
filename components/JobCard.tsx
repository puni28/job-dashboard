'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp, Clock, Trash2, Edit2, ExternalLink, Mail, Bookmark } from 'lucide-react';
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
  email_thread_id: string | null;
  updates: JobUpdate[];
};

type Props = {
  job: Job;
  onDelete: (id: number) => void;
  onEdit: (job: Job) => void;
};

const STATUS_CONFIG: Record<string, {
  color: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  progress: number;
  label: string;
}> = {
  'Applied':   { color: 'text-blue-400',   bgColor: 'bg-blue-500/15',   borderColor: 'border-blue-500/40',   ringColor: '#60a5fa', progress: 20,  label: 'APPLIED' },
  'Screening': { color: 'text-yellow-400', bgColor: 'bg-yellow-500/15', borderColor: 'border-yellow-500/40', ringColor: '#fbbf24', progress: 45,  label: 'REVIEW' },
  'Interview': { color: 'text-purple-400', bgColor: 'bg-purple-500/15', borderColor: 'border-purple-500/40', ringColor: '#a78bfa', progress: 70,  label: 'INTERVIEW' },
  'Offer':     { color: 'text-green-400',  bgColor: 'bg-green-500/15',  borderColor: 'border-green-500/40',  ringColor: '#34d399', progress: 100, label: 'OFFERED' },
  'Rejected':  { color: 'text-red-400',    bgColor: 'bg-red-500/15',    borderColor: 'border-red-500/40',    ringColor: '#f87171', progress: 100, label: 'REJECTED' },
};

const UPDATE_COLORS: Record<string, string> = {
  'Application Confirmed':  'text-blue-400',
  'Screening Call Scheduled': 'text-yellow-400',
  'Interview Invitation':   'text-purple-400',
  'Offer Received':         'text-green-400',
  'Application Rejected':   'text-red-400',
  'Status Update':          'text-slate-400',
};

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-amber-600',
  'bg-rose-600', 'bg-indigo-600', 'bg-pink-600', 'bg-teal-600',
  'bg-cyan-600', 'bg-orange-600',
];

function getAvatarColor(company: string): string {
  const idx = company.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function StatusCircle({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['Applied'];
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (cfg.progress / 100) * circ;

  return (
    <div className={`flex-shrink-0 flex flex-col items-center justify-center w-20 self-stretch rounded-r-xl ${cfg.bgColor} border-l ${cfg.borderColor}`}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={r}
          fill="none"
          stroke={cfg.ringColor}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className={`text-[9px] font-bold mt-0.5 px-1 text-center leading-tight ${cfg.color}`}>
        {cfg.label}
      </span>
    </div>
  );
}

export default function JobCard({ job, onDelete, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);

  const avatarColor = getAvatarColor(job.company);
  const initial = job.company.charAt(0).toUpperCase();

  const appliedDate = job.applied_date
    ? formatDistanceToNow(new Date(job.applied_date), { addSuffix: true })
    : null;

  const gmailThreadUrl = job.email_thread_id
    ? `https://mail.google.com/mail/u/0/#all/${job.email_thread_id}`
    : null;

  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG['Applied'];

  return (
    <div className={`bg-slate-800/60 border ${statusCfg.borderColor} rounded-xl hover:border-opacity-80 transition-all group overflow-hidden`}>
      {/* Main row */}
      <div className="flex">
        {/* Card body */}
        <div className="flex gap-4 p-4 flex-1 min-w-0">
          {/* Company avatar */}
          <div className={`flex-shrink-0 w-12 h-12 ${avatarColor} rounded-xl flex items-center justify-center shadow-lg`}>
            <span className="text-white font-bold text-xl">{initial}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title + actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white truncate leading-snug">{job.position}</h3>
                <p className="text-sm text-slate-400 mt-0.5">{job.company}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => onEdit(job)}
                    className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-700/60"
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(job.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-700/60"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Bookmark className="w-4 h-4 text-slate-600 hover:text-slate-300 cursor-pointer transition-colors" />
              </div>
            </div>

            {/* Metadata row */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {job.location && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {job.location}
                </span>
              )}
              {appliedDate && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  Applied {appliedDate}
                </span>
              )}
            </div>

            {/* Bottom row: tags + actions */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
              {/* Tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Email updates toggle */}
                {job.updates.length > 0 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1.5 text-xs bg-slate-700/60 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-600/50 transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    {job.updates.length} email{job.updates.length !== 1 ? 's' : ''}
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
                {/* Status pill */}
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusCfg.bgColor} ${statusCfg.color} ${statusCfg.borderColor}`}>
                  {job.status}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {gmailThreadUrl && (
                  <a
                    href={gmailThreadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-400 transition-colors"
                    title="Open in Gmail"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    View Email
                  </a>
                )}
                {job.job_url && (
                  <a
                    href={job.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Apply Now
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status circle panel */}
        <StatusCircle status={job.status} />
      </div>

      {/* Expanded email updates */}
      {expanded && job.updates.length > 0 && (
        <div className="border-t border-slate-700/60 p-4 space-y-2 max-h-52 card-scroll">
          {job.updates.map(update => (
            <div key={update.id} className="bg-slate-900/60 rounded-lg p-3 border border-slate-700/40">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${UPDATE_COLORS[update.update_type] ?? 'text-slate-400'}`}>
                  {update.update_type}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {update.received_at && (
                    <span className="text-xs text-slate-500">
                      {formatDistanceToNow(new Date(update.received_at), { addSuffix: true })}
                    </span>
                  )}
                  {/* Link to Gmail thread for this update */}
                  {gmailThreadUrl && (
                    <a
                      href={gmailThreadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors"
                      title="Open email in Gmail"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden sm:inline">Gmail</span>
                    </a>
                  )}
                </div>
              </div>
              {update.email_subject && (
                <p className="text-xs text-slate-300 mt-1 truncate font-medium">{update.email_subject}</p>
              )}
              {update.message && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{update.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {job.notes && (
        <div className="border-t border-slate-700/60 px-4 py-3">
          <p className="text-xs text-slate-400 line-clamp-2 italic">{job.notes}</p>
        </div>
      )}
    </div>
  );
}
