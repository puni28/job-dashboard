import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById, isEmailProcessed, markEmailProcessed, findJobByThreadId, createJob, updateJob, addJobUpdate, getJobsByUser } from '@/lib/db';
import { fetchJobEmails } from '@/lib/gmail';
import { classifyEmail, getStatusFromEmailType, getUpdateLabel } from '@/lib/emailParser';

const STATUS_PRIORITY: Record<string, number> = {
  Applied: 1,
  Screening: 2,
  Interview: 3,
  Offer: 4,
  Rejected: 5,
};

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await getUserById(userId);
  if (!user?.access_token) {
    return NextResponse.json({ error: 'Email not connected' }, { status: 400 });
  }

  let pageToken: string | undefined;
  try {
    const body = await req.json();
    pageToken = body.pageToken ?? undefined;
  } catch {
    pageToken = undefined;
  }

  try {
    const { messages: emails, nextPageToken } = await fetchJobEmails(userId, pageToken);
    let added = 0;
    let updated = 0;
    let skipped = 0;

    // Sort oldest first so we process applications before updates
    emails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const email of emails) {
      if (await isEmailProcessed(userId, email.id)) {
        skipped++;
        continue;
      }

      const classification = classifyEmail(email);
      if (!classification.isJobRelated) {
        await markEmailProcessed(userId, email.id);
        skipped++;
        continue;
      }

      const emailDate = new Date(email.date).toISOString();
      const newStatus = getStatusFromEmailType(classification.emailType);

      // Check if we have an existing job for this thread
      const existingJob = await findJobByThreadId(userId, email.threadId);

      if (existingJob) {
        // Update status only if it's a "higher priority" status
        const currentPriority = STATUS_PRIORITY[existingJob.status] ?? 0;
        const newPriority = STATUS_PRIORITY[newStatus] ?? 0;

        if (newPriority > currentPriority || classification.emailType === 'rejected') {
          await updateJob(existingJob.id, {
            status: newStatus,
            last_updated: emailDate,
          });
        }

        await addJobUpdate({
          job_id: existingJob.id,
          update_type: getUpdateLabel(classification.emailType),
          message: email.snippet,
          email_subject: email.subject,
          received_at: emailDate,
        });

        updated++;
      } else if (classification.emailType === 'application' || classification.emailType === 'update') {
        // Only create new jobs from application confirmations
        // For updates without a matching thread, try to match by company name
        const allJobs = await getJobsByUser(userId);
        const companyMatch = allJobs.find(j =>
          j.company.toLowerCase().includes(classification.company.toLowerCase()) ||
          classification.company.toLowerCase().includes(j.company.toLowerCase())
        );

        if (companyMatch && classification.emailType === 'update') {
          await addJobUpdate({
            job_id: companyMatch.id,
            update_type: getUpdateLabel(classification.emailType),
            message: email.snippet,
            email_subject: email.subject,
            received_at: emailDate,
          });
          updated++;
        } else {
          const job = await createJob({
            user_id: userId,
            company: classification.company,
            position: classification.position,
            status: newStatus,
            applied_date: emailDate,
            last_updated: emailDate,
            email_thread_id: email.threadId,
            email_message_id: email.id,
            email_subject: email.subject,
            job_url: null,
            location: null,
            notes: null,
          });

          await addJobUpdate({
            job_id: job.id,
            update_type: getUpdateLabel(classification.emailType),
            message: email.snippet,
            email_subject: email.subject,
            received_at: emailDate,
          });

          added++;
        }
      } else {
        // Interview/offer/rejection email without matching thread — create job
        const job = await createJob({
          user_id: userId,
          company: classification.company,
          position: classification.position,
          status: newStatus,
          applied_date: emailDate,
          last_updated: emailDate,
          email_thread_id: email.threadId,
          email_message_id: email.id,
          email_subject: email.subject,
          job_url: null,
          location: null,
          notes: null,
        });

        await addJobUpdate({
          job_id: job.id,
          update_type: getUpdateLabel(classification.emailType),
          message: email.snippet,
          email_subject: email.subject,
          received_at: emailDate,
        });

        added++;
      }

      await markEmailProcessed(userId, email.id);
    }

    return NextResponse.json({
      success: true,
      stats: { added, updated, skipped, total: emails.length },
      nextPageToken,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return NextResponse.json({ error: 'Sync failed', detail: String(err) }, { status: 500 });
  }
}
