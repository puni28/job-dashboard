import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getJobById, updateJob, deleteJob } from '@/lib/db';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const job = getJobById(parseInt(params.id));
  if (!job || job.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const { company, position, status, job_url, location, notes } = body;

  const updated = updateJob(job.id, {
    company,
    position,
    status,
    job_url,
    location,
    notes,
    last_updated: new Date().toISOString(),
  });

  return NextResponse.json({ job: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const job = getJobById(parseInt(params.id));
  if (!job || job.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  deleteJob(job.id);
  return NextResponse.json({ success: true });
}
