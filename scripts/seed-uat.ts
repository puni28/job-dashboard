/**
 * UAT Database Seed Script
 *
 * Populates the UAT database with a realistic set of test users and jobs so
 * testers can exercise the full application without needing real Gmail data.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-uat.ts
 *
 * Prerequisites:
 *   - Copy .env.uat.example → .env.uat and fill in DATABASE_URL
 *   - Run: dotenv -e .env.uat -- npx ts-node scripts/seed-uat.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Load .env.uat before running this script.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ─── Schema helpers ───────────────────────────────────────────────────────────

async function ensureSchema() {
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
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const UAT_USER_EMAIL = 'uat-tester@example.com';

const SEED_JOBS = [
  {
    company: 'Acme Corp',
    position: 'Senior Frontend Engineer',
    status: 'Applied',
    applied_date: '2024-02-01T10:00:00.000Z',
    last_updated: '2024-02-01T10:00:00.000Z',
    location: 'Remote',
    job_url: 'https://acme.example.com/jobs/123',
    notes: 'Referred by John Doe',
    updates: [
      { update_type: 'Application Confirmed', message: 'Your application has been received.', email_subject: 'Thank you for applying to Acme Corp', received_at: '2024-02-01T12:00:00.000Z' },
    ],
  },
  {
    company: 'Globex Industries',
    position: 'Full-Stack Developer',
    status: 'Screening',
    applied_date: '2024-02-05T09:00:00.000Z',
    last_updated: '2024-02-07T14:30:00.000Z',
    location: 'New York, NY',
    job_url: null,
    notes: null,
    updates: [
      { update_type: 'Application Confirmed', message: null, email_subject: 'Application Received', received_at: '2024-02-05T11:00:00.000Z' },
      { update_type: 'Screening Call Scheduled', message: 'A recruiter would like to connect with you.', email_subject: 'Recruiter Screen – Globex Industries', received_at: '2024-02-07T14:30:00.000Z' },
    ],
  },
  {
    company: 'Initech Solutions',
    position: 'Backend Engineer',
    status: 'Interview',
    applied_date: '2024-01-20T08:00:00.000Z',
    last_updated: '2024-02-10T16:00:00.000Z',
    location: 'Austin, TX',
    job_url: 'https://initech.example.com/careers',
    notes: 'Strong tech stack match',
    updates: [
      { update_type: 'Application Confirmed', message: null, email_subject: 'Thanks for applying', received_at: '2024-01-20T09:00:00.000Z' },
      { update_type: 'Screening Call Scheduled', message: null, email_subject: 'Intro call', received_at: '2024-01-28T10:00:00.000Z' },
      { update_type: 'Interview Invitation', message: "We'd like to invite you for a technical interview.", email_subject: 'Technical Interview – Initech Solutions', received_at: '2024-02-10T16:00:00.000Z' },
    ],
  },
  {
    company: 'Umbrella Technologies',
    position: 'DevOps Engineer',
    status: 'Offer',
    applied_date: '2024-01-10T07:00:00.000Z',
    last_updated: '2024-02-15T11:00:00.000Z',
    location: 'San Francisco, CA',
    job_url: null,
    notes: 'Salary negotiation in progress',
    updates: [
      { update_type: 'Application Confirmed', message: null, email_subject: 'Application received', received_at: '2024-01-10T08:00:00.000Z' },
      { update_type: 'Interview Invitation', message: null, email_subject: 'On-site interview', received_at: '2024-01-25T09:00:00.000Z' },
      { update_type: 'Offer Received', message: 'We are pleased to extend an offer of employment.', email_subject: 'Offer Letter – Umbrella Technologies', received_at: '2024-02-15T11:00:00.000Z' },
    ],
  },
  {
    company: 'Initrode Corp',
    position: 'Software Engineer',
    status: 'Rejected',
    applied_date: '2024-01-15T10:00:00.000Z',
    last_updated: '2024-02-12T13:00:00.000Z',
    location: 'Remote',
    job_url: null,
    notes: null,
    updates: [
      { update_type: 'Application Confirmed', message: null, email_subject: 'Application received', received_at: '2024-01-15T11:00:00.000Z' },
      { update_type: 'Application Rejected', message: 'Unfortunately, we will not be moving forward.', email_subject: 'Update on your application – Initrode Corp', received_at: '2024-02-12T13:00:00.000Z' },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱  Seeding UAT database...\n');

  await ensureSchema();
  console.log('✅  Schema ready');

  // Remove any existing UAT data so the script is idempotent
  const existingUsers = await sql`SELECT id FROM users WHERE email = ${UAT_USER_EMAIL}`;
  if (existingUsers.length > 0) {
    const userId = existingUsers[0].id as number;
    await sql`DELETE FROM processed_emails WHERE user_id = ${userId}`;
    await sql`DELETE FROM job_updates WHERE job_id IN (SELECT id FROM jobs WHERE user_id = ${userId})`;
    await sql`DELETE FROM jobs WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;
    console.log('🗑   Cleared existing UAT data');
  }

  // Insert UAT test user (no real tokens needed)
  const userRows = await sql`
    INSERT INTO users (email, access_token, refresh_token, token_expiry)
    VALUES (${UAT_USER_EMAIL}, 'uat-access-token', 'uat-refresh-token', ${Date.now() + 3600 * 1000})
    RETURNING id
  `;
  const userId = userRows[0].id as number;
  console.log(`👤  Created UAT user: ${UAT_USER_EMAIL} (id=${userId})`);

  // Insert jobs + updates
  for (const jobData of SEED_JOBS) {
    const { updates, ...jobFields } = jobData;

    const jobRows = await sql`
      INSERT INTO jobs (user_id, company, position, status, applied_date, last_updated, location, job_url, notes)
      VALUES (
        ${userId},
        ${jobFields.company},
        ${jobFields.position},
        ${jobFields.status},
        ${jobFields.applied_date},
        ${jobFields.last_updated},
        ${jobFields.location},
        ${jobFields.job_url},
        ${jobFields.notes}
      )
      RETURNING id
    `;
    const jobId = jobRows[0].id as number;

    for (const update of updates) {
      await sql`
        INSERT INTO job_updates (job_id, update_type, message, email_subject, received_at)
        VALUES (${jobId}, ${update.update_type}, ${update.message}, ${update.email_subject}, ${update.received_at})
      `;
    }

    console.log(`   📋  ${jobFields.status.padEnd(10)} — ${jobFields.company}: ${jobFields.position}`);
  }

  console.log('\n✅  UAT seed complete!');
  console.log(`\nLogin hint: set a session cookie for user id=${userId} to bypass OAuth during UAT.`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
