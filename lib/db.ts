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
  await sql`
    CREATE TABLE IF NOT EXISTS user_profile (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      full_name TEXT,
      email TEXT,
      phone TEXT,
      location TEXT,
      linkedin TEXT,
      github TEXT,
      portfolio TEXT,
      summary TEXT,
      skills TEXT,
      work_experience TEXT,
      education TEXT,
      projects TEXT,
      certifications TEXT,
      preferred_titles TEXT,
      preferred_locations TEXT,
      remote_preference TEXT DEFAULT 'any',
      salary_min INTEGER,
      salary_max INTEGER,
      exclude_keywords TEXT,
      include_keywords TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS job_listings (
      id SERIAL PRIMARY KEY,
      external_id TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      remote TEXT,
      salary TEXT,
      description TEXT,
      tags TEXT,
      url TEXT NOT NULL,
      posted_at TEXT,
      fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(external_id, source)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_listing_actions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES job_listings(id),
      action TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, listing_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS generated_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES job_listings(id),
      doc_type TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// Profile types and operations
export type UserProfile = {
  id: number;
  user_id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  summary: string | null;
  skills: string | null;
  work_experience: string | null;
  education: string | null;
  projects: string | null;
  certifications: string | null;
  preferred_titles: string | null;
  preferred_locations: string | null;
  remote_preference: string | null;
  salary_min: number | null;
  salary_max: number | null;
  exclude_keywords: string | null;
  include_keywords: string | null;
  updated_at: string;
};

export async function getProfile(userId: number): Promise<UserProfile | null> {
  await ensureInit();
  const rows = await sql`SELECT * FROM user_profile WHERE user_id = ${userId}`;
  return (rows[0] as UserProfile) ?? null;
}

export async function upsertProfile(userId: number, data: Partial<Omit<UserProfile, 'id' | 'user_id' | 'updated_at'>>): Promise<UserProfile> {
  await ensureInit();
  await sql`
    INSERT INTO user_profile (user_id, full_name, email, phone, location, linkedin, github, portfolio, summary, skills, work_experience, education, projects, certifications, preferred_titles, preferred_locations, remote_preference, salary_min, salary_max, exclude_keywords, include_keywords, updated_at)
    VALUES (${userId}, ${data.full_name ?? null}, ${data.email ?? null}, ${data.phone ?? null}, ${data.location ?? null}, ${data.linkedin ?? null}, ${data.github ?? null}, ${data.portfolio ?? null}, ${data.summary ?? null}, ${data.skills ?? null}, ${data.work_experience ?? null}, ${data.education ?? null}, ${data.projects ?? null}, ${data.certifications ?? null}, ${data.preferred_titles ?? null}, ${data.preferred_locations ?? null}, ${data.remote_preference ?? 'any'}, ${data.salary_min ?? null}, ${data.salary_max ?? null}, ${data.exclude_keywords ?? null}, ${data.include_keywords ?? null}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      location = EXCLUDED.location,
      linkedin = EXCLUDED.linkedin,
      github = EXCLUDED.github,
      portfolio = EXCLUDED.portfolio,
      summary = EXCLUDED.summary,
      skills = EXCLUDED.skills,
      work_experience = EXCLUDED.work_experience,
      education = EXCLUDED.education,
      projects = EXCLUDED.projects,
      certifications = EXCLUDED.certifications,
      preferred_titles = EXCLUDED.preferred_titles,
      preferred_locations = EXCLUDED.preferred_locations,
      remote_preference = EXCLUDED.remote_preference,
      salary_min = EXCLUDED.salary_min,
      salary_max = EXCLUDED.salary_max,
      exclude_keywords = EXCLUDED.exclude_keywords,
      include_keywords = EXCLUDED.include_keywords,
      updated_at = NOW()
  `;
  const rows = await sql`SELECT * FROM user_profile WHERE user_id = ${userId}`;
  return rows[0] as UserProfile;
}

// Job listings
export type JobListing = {
  id: number;
  external_id: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  salary: string | null;
  description: string | null;
  tags: string | null;
  url: string;
  posted_at: string | null;
  fetched_at: string;
};

export async function upsertJobListing(listing: Omit<JobListing, 'id' | 'fetched_at'>): Promise<number> {
  await ensureInit();
  const rows = await sql`
    INSERT INTO job_listings (external_id, source, title, company, location, remote, salary, description, tags, url, posted_at)
    VALUES (${listing.external_id}, ${listing.source}, ${listing.title}, ${listing.company}, ${listing.location ?? null}, ${listing.remote ?? null}, ${listing.salary ?? null}, ${listing.description ?? null}, ${listing.tags ?? null}, ${listing.url}, ${listing.posted_at ?? null})
    ON CONFLICT (external_id, source) DO UPDATE SET
      title = EXCLUDED.title,
      company = EXCLUDED.company,
      location = EXCLUDED.location,
      remote = EXCLUDED.remote,
      salary = EXCLUDED.salary,
      description = EXCLUDED.description,
      tags = EXCLUDED.tags,
      url = EXCLUDED.url,
      posted_at = EXCLUDED.posted_at,
      fetched_at = NOW()
    RETURNING id
  `;
  return (rows[0] as { id: number }).id;
}

export async function getJobListings(limit = 200): Promise<JobListing[]> {
  await ensureInit();
  const rows = await sql`
    SELECT * FROM job_listings ORDER BY fetched_at DESC, posted_at DESC NULLS LAST LIMIT ${limit}
  `;
  return rows as JobListing[];
}

export async function getUserListingActions(userId: number): Promise<{ listing_id: number; action: string }[]> {
  await ensureInit();
  const rows = await sql`SELECT listing_id, action FROM user_listing_actions WHERE user_id = ${userId}`;
  return rows as { listing_id: number; action: string }[];
}

export async function setListingAction(userId: number, listingId: number, action: string): Promise<void> {
  await ensureInit();
  await sql`
    INSERT INTO user_listing_actions (user_id, listing_id, action)
    VALUES (${userId}, ${listingId}, ${action})
    ON CONFLICT (user_id, listing_id) DO UPDATE SET action = EXCLUDED.action, created_at = NOW()
  `;
}

export async function getLikedListings(userId: number): Promise<JobListing[]> {
  await ensureInit();
  const rows = await sql`
    SELECT jl.* FROM job_listings jl
    JOIN user_listing_actions ula ON ula.listing_id = jl.id
    WHERE ula.user_id = ${userId} AND ula.action = 'liked'
    ORDER BY ula.created_at DESC
  `;
  return rows as JobListing[];
}

// Generated documents
export type GeneratedDocument = {
  id: number;
  user_id: number;
  listing_id: number;
  doc_type: string;
  content: string;
  version: number;
  created_at: string;
};

export async function saveDocument(userId: number, listingId: number, docType: string, content: string): Promise<GeneratedDocument> {
  await ensureInit();
  const versionRows = await sql`
    SELECT COALESCE(MAX(version), 0) + 1 as next_version
    FROM generated_documents
    WHERE user_id = ${userId} AND listing_id = ${listingId} AND doc_type = ${docType}
  `;
  const version = (versionRows[0] as { next_version: number }).next_version;
  const rows = await sql`
    INSERT INTO generated_documents (user_id, listing_id, doc_type, content, version)
    VALUES (${userId}, ${listingId}, ${docType}, ${content}, ${version})
    RETURNING *
  `;
  return rows[0] as GeneratedDocument;
}

export async function getDocuments(userId: number, listingId: number): Promise<GeneratedDocument[]> {
  await ensureInit();
  const rows = await sql`
    SELECT * FROM generated_documents
    WHERE user_id = ${userId} AND listing_id = ${listingId}
    ORDER BY doc_type, version DESC
  `;
  return rows as GeneratedDocument[];
}

export async function getLatestDocument(userId: number, listingId: number, docType: string): Promise<GeneratedDocument | null> {
  await ensureInit();
  const rows = await sql`
    SELECT * FROM generated_documents
    WHERE user_id = ${userId} AND listing_id = ${listingId} AND doc_type = ${docType}
    ORDER BY version DESC LIMIT 1
  `;
  return (rows[0] as GeneratedDocument) ?? null;
}
