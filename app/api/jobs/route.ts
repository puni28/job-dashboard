import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getJobsByUser, createJob, getJobUpdates } from '@/lib/db';

export async function GET() {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jobs = getJobsByUser(userId);
  const jobsWithUpdates = jobs.map(job => ({
    ...job,
    updates: getJobUpdates(job.id),
  }));

  return NextResponse.json({ jobs: jobsWithUpdates });
}

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { company, position, status, job_url, location, notes } = body;

  if (!company || !position) {
    return NextResponse.json({ error: 'Company and position are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const job = createJob({
    user_id: userId,
    company,
    position,
    status: status || 'Applied',
    applied_date: now,
    last_updated: now,
    email_thread_id: null,
    email_message_id: null,
    email_subject: null,
    job_url: job_url || null,
    location: location || null,
    notes: notes || null,
  });

  return NextResponse.json({ job });
}
