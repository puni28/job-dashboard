import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

let dbInitialized = false;

async function ensureInit() {
  if (dbInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      status TEXT DEFAULT 'Applied',
      applied_date TEXT,
      last_updated TEXT,
      email_thread_id TEXT,
      email_message_id TEXT,
      email_subject TEXT,
      job_url TEXT,
      location TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS job_updates (
      id SERIAL PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES jobs(id),
      update_type TEXT NOT NULL,
      message TEXT,
      email_subject TEXT,
      received_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS processed_emails (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      email_id TEXT NOT NULL,
      processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, email_id)
    )
  `;
  dbInitialized = true;
}

export type User = {
  id: number;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: number | null;
};

export type Job = {
  id: number;
  user_id: number;
  company: string;
  position: string;
  status: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected';
  applied_date: string | null;
  last_updated: string | null;
  email_thread_id: string | null;
  email_message_id: string | null;
  email_subject: string | null;
  job_url: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
};

export type JobUpdate = {
  id: number;
  job_id: number;
  update_type: string;
  message: string | null;
  email_subject: string | null;
  received_at: string | null;
  created_at: string;
};

// User operations
export async function upsertUser(email: string, accessToken: string, refreshToken: string, expiry: number): Promise<User> {
  await ensureInit();
  await sql`
    INSERT INTO users (email, access_token, refresh_token, token_expiry)
    VALUES (${email}, ${accessToken}, ${refreshToken}, ${expiry})
    ON CONFLICT (email) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
      token_expiry = EXCLUDED.token_expiry
  `;
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] as User;
}

export async function getUserById(id: number): Promise<User | null> {
  await ensureInit();
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return (rows[0] as User) ?? null;
}

export async function updateUserTokens(id: number, accessToken: string, expiry: number): Promise<void> {
  await sql`UPDATE users SET access_token = ${accessToken}, token_expiry = ${expiry} WHERE id = ${id}`;
}

export async function deleteUser(id: number): Promise<void> {
  await sql`DELETE FROM processed_emails WHERE user_id = ${id}`;
  await sql`DELETE FROM job_updates WHERE job_id IN (SELECT id FROM jobs WHERE user_id = ${id})`;
  await sql`DELETE FROM jobs WHERE user_id = ${id}`;
  await sql`DELETE FROM users WHERE id = ${id}`;
}

// Job operations
export async function getJobsByUser(userId: number): Promise<Job[]> {
  await ensureInit();
  const rows = await sql`SELECT * FROM jobs WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows as Job[];
}

export async function getJobById(id: number): Promise<Job | null> {
  const rows = await sql`SELECT * FROM jobs WHERE id = ${id}`;
  return (rows[0] as Job) ?? null;
}

export async function createJob(job: Omit<Job, 'id' | 'created_at'>): Promise<Job> {
  const rows = await sql`
    INSERT INTO jobs (user_id, company, position, status, applied_date, last_updated, email_thread_id, email_message_id, email_subject, job_url, location, notes)
    VALUES (${job.user_id}, ${job.company}, ${job.position}, ${job.status}, ${job.applied_date}, ${job.last_updated}, ${job.email_thread_id}, ${job.email_message_id}, ${job.email_subject}, ${job.job_url}, ${job.location}, ${job.notes})
    RETURNING *
  `;
  return rows[0] as Job;
}

export async function updateJob(id: number, updates: Partial<Job>): Promise<Job | null> {
  await sql`
    UPDATE jobs SET
      company = COALESCE(${updates.company ?? null}, company),
      position = COALESCE(${updates.position ?? null}, position),
      status = COALESCE(${updates.status ?? null}, status),
      job_url = COALESCE(${updates.job_url ?? null}, job_url),
      location = COALESCE(${updates.location ?? null}, location),
      notes = COALESCE(${updates.notes ?? null}, notes),
      last_updated = COALESCE(${updates.last_updated ?? null}, last_updated)
    WHERE id = ${id}
  `;
  return getJobById(id);
}

export async function deleteJob(id: number): Promise<void> {
  await sql`DELETE FROM job_updates WHERE job_id = ${id}`;
  await sql`DELETE FROM jobs WHERE id = ${id}`;
}

export async function findJobByThreadId(userId: number, threadId: string): Promise<Job | null> {
  const rows = await sql`SELECT * FROM jobs WHERE user_id = ${userId} AND email_thread_id = ${threadId}`;
  return (rows[0] as Job) ?? null;
}

// Job updates
export async function addJobUpdate(update: Omit<JobUpdate, 'id' | 'created_at'>): Promise<JobUpdate> {
  const rows = await sql`
    INSERT INTO job_updates (job_id, update_type, message, email_subject, received_at)
    VALUES (${update.job_id}, ${update.update_type}, ${update.message}, ${update.email_subject}, ${update.received_at})
    RETURNING *
  `;
  return rows[0] as JobUpdate;
}

export async function getJobUpdates(jobId: number): Promise<JobUpdate[]> {
  const rows = await sql`SELECT * FROM job_updates WHERE job_id = ${jobId} ORDER BY created_at DESC`;
  return rows as JobUpdate[];
}

// Processed emails
export async function markEmailProcessed(userId: number, emailId: string): Promise<void> {
  await sql`
    INSERT INTO processed_emails (user_id, email_id) VALUES (${userId}, ${emailId})
    ON CONFLICT DO NOTHING
  `;
}

export async function isEmailProcessed(userId: number, emailId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM processed_emails WHERE user_id = ${userId} AND email_id = ${emailId}`;
  return rows.length > 0;
}
