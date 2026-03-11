'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import SyncToast from '@/components/SyncToast';
import { Save, RefreshCw, User, Briefcase, GraduationCap, Settings, Code } from 'lucide-react';

type Profile = {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
  skills: string;
  work_experience: string;
  education: string;
  projects: string;
  certifications: string;
  preferred_titles: string;
  preferred_locations: string;
  remote_preference: string;
  salary_min: string;
  salary_max: string;
  exclude_keywords: string;
  include_keywords: string;
};

const EMPTY: Profile = {
  full_name: '', email: '', phone: '', location: '',
  linkedin: '', github: '', portfolio: '',
  summary: '', skills: '', work_experience: '',
  education: '', projects: '', certifications: '',
  preferred_titles: '', preferred_locations: '',
  remote_preference: 'any', salary_min: '', salary_max: '',
  exclude_keywords: '', include_keywords: '',
};

type Toast = { message: string; type: 'success' | 'error' | 'info' };
type Section = 'personal' | 'resume' | 'preferences';

function Field({ label, name, value, onChange, multiline = false, placeholder = '', hint = '' }: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void;
  multiline?: boolean; placeholder?: string; hint?: string;
}) {
  const cls = "w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 placeholder-slate-500 resize-none";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          rows={5}
          className={cls}
        />
      ) : (
        <input
          type="text"
          name={name}
          value={value}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [section, setSection] = useState<Section>('personal');

  const showToast = (message: string, type: Toast['type']) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/status');
    const data = await res.json();
    setConnected(data.connected);
    setUserEmail(data.email ?? null);
    if (!data.connected) router.push('/');
  }, [router]);

  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      if (data.profile) {
        setProfile(p => ({
          ...p,
          ...Object.fromEntries(
            Object.entries(data.profile).map(([k, v]) => [k, v == null ? '' : String(v)])
          ),
        }));
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchStatus();
      await fetchProfile();
      setLoading(false);
    };
    init();
  }, [fetchStatus, fetchProfile]);

  const handleChange = (name: string, value: string) => {
    setProfile(p => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...profile,
        salary_min: profile.salary_min ? parseInt(profile.salary_min) : null,
        salary_max: profile.salary_max ? parseInt(profile.salary_max) : null,
      };
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast('Profile saved!', 'success');
      } else {
        showToast('Save failed. Try again.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Gmail?')) return;
    await fetch('/api/disconnect', { method: 'POST' });
    router.push('/');
  };

  const SECTIONS = [
    { id: 'personal' as Section, label: 'Personal Info', icon: User },
    { id: 'resume' as Section, label: 'Resume Content', icon: Briefcase },
    { id: 'preferences' as Section, label: 'Job Preferences', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header
        connected={connected}
        email={userEmail}
        syncing={false}
        lastSynced={null}
        onSync={() => {}}
        onDisconnect={handleDisconnect}
        onAddJob={() => {}}
      />

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Your Profile</h2>
            <p className="text-sm text-slate-400 mt-1">This powers resume generation and job matching. Fill it in once and keep it updated.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 bg-slate-800/50 border border-slate-700 p-1 rounded-xl w-fit mb-6">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  section === s.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Personal Info */}
        {section === 'personal' && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Full Name" name="full_name" value={profile.full_name} onChange={handleChange} placeholder="Jane Smith" />
              <Field label="Email" name="email" value={profile.email} onChange={handleChange} placeholder="jane@example.com" />
              <Field label="Phone" name="phone" value={profile.phone} onChange={handleChange} placeholder="+1 555 000 0000" />
              <Field label="Location" name="location" value={profile.location} onChange={handleChange} placeholder="San Francisco, CA" />
              <Field label="LinkedIn URL" name="linkedin" value={profile.linkedin} onChange={handleChange} placeholder="https://linkedin.com/in/..." />
              <Field label="GitHub URL" name="github" value={profile.github} onChange={handleChange} placeholder="https://github.com/..." />
            </div>
            <Field label="Portfolio / Website" name="portfolio" value={profile.portfolio} onChange={handleChange} placeholder="https://yoursite.com" />
          </div>
        )}

        {/* Resume Content */}
        {section === 'resume' && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 flex flex-col gap-5">
            <Field
              label="Professional Summary"
              name="summary"
              value={profile.summary}
              onChange={handleChange}
              multiline
              placeholder="A 2-3 sentence overview of your experience, expertise, and what you bring to a role."
            />
            <Field
              label="Skills"
              name="skills"
              value={profile.skills}
              onChange={handleChange}
              placeholder="React, TypeScript, Node.js, Python, AWS, PostgreSQL, Docker..."
              hint="Comma-separated. Be specific — these are used for matching and resume tailoring."
            />
            <Field
              label="Work Experience"
              name="work_experience"
              value={profile.work_experience}
              onChange={handleChange}
              multiline
              placeholder={`Company Name — Job Title | Jan 2022 – Present\n• Built X which achieved Y using Z\n• Led a team of N engineers to deliver...\n\nPrevious Company — Job Title | 2019 – 2022\n• ...`}
              hint="Write it naturally. AI will reformat and tailor it for each role."
            />
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-700/30 border border-slate-700 rounded-lg px-3 py-2">
              <GraduationCap className="w-4 h-4 flex-shrink-0" />
              Fill in education, projects, and certifications to improve resume quality.
            </div>
            <Field
              label="Education"
              name="education"
              value={profile.education}
              onChange={handleChange}
              multiline
              placeholder={`B.S. Computer Science — State University | 2018\nRelevant coursework: Algorithms, Distributed Systems`}
            />
            <Field
              label="Projects"
              name="projects"
              value={profile.projects}
              onChange={handleChange}
              multiline
              placeholder={`Project Name: Brief description of what it does and the tech used. Link if public.\n\nProject Name: ...`}
            />
            <Field
              label="Certifications"
              name="certifications"
              value={profile.certifications}
              onChange={handleChange}
              placeholder="AWS Solutions Architect, Google Cloud Professional, ..."
            />
          </div>
        )}

        {/* Job Preferences */}
        {section === 'preferences' && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
              <Code className="w-4 h-4 text-blue-400 flex-shrink-0" />
              These preferences are used to filter and score job listings automatically.
            </div>
            <Field
              label="Preferred Job Titles"
              name="preferred_titles"
              value={profile.preferred_titles}
              onChange={handleChange}
              placeholder="Frontend Engineer, Full Stack Developer, React Developer"
              hint="Comma-separated. Used as search terms and for title matching score."
            />
            <Field
              label="Preferred Locations"
              name="preferred_locations"
              value={profile.preferred_locations}
              onChange={handleChange}
              placeholder="San Francisco, New York, Remote"
              hint="Comma-separated. Or just 'Remote' if you only want remote roles."
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Remote Preference</label>
              <select
                value={profile.remote_preference}
                onChange={e => handleChange('remote_preference', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-200 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="any">Any (remote, hybrid, or onsite)</option>
                <option value="remote">Remote only</option>
                <option value="hybrid">Hybrid or remote</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum Salary ($)" name="salary_min" value={profile.salary_min} onChange={handleChange} placeholder="80000" />
              <Field label="Maximum Salary ($)" name="salary_max" value={profile.salary_max} onChange={handleChange} placeholder="150000" />
            </div>
            <Field
              label="Must-Include Keywords"
              name="include_keywords"
              value={profile.include_keywords}
              onChange={handleChange}
              placeholder="React, TypeScript"
              hint="Only show jobs that mention at least one of these. Comma-separated."
            />
            <Field
              label="Exclude Keywords"
              name="exclude_keywords"
              value={profile.exclude_keywords}
              onChange={handleChange}
              placeholder="blockchain, PHP, Salesforce"
              hint="Hide jobs that mention any of these. Comma-separated."
            />
          </div>
        )}

        {/* Save button at bottom too */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </main>

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
