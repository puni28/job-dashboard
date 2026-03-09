import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
const DB_PATH = path.join(dataDir, 'jobs.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initializeDb(_db);
  }
  return _db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      token_expiry INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS job_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      update_type TEXT NOT NULL,
      message TEXT,
      email_subject TEXT,
      received_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    CREATE TABLE IF NOT EXISTS processed_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email_id TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, email_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
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
export function upsertUser(email: string, accessToken: string, refreshToken: string, expiry: number): User {
  const db = getDb();
  db.prepare(`
    INSERT INTO users (email, access_token, refresh_token, token_expiry)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, refresh_token),
      token_expiry = excluded.token_expiry
  `).run(email, accessToken, refreshToken, expiry);
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User;
}

export function getUserById(id: number): User | null {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as User | null;
}

export function updateUserTokens(id: number, accessToken: string, expiry: number) {
  getDb().prepare('UPDATE users SET access_token = ?, token_expiry = ? WHERE id = ?').run(accessToken, expiry, id);
}

export function deleteUser(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM processed_emails WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM job_updates WHERE job_id IN (SELECT id FROM jobs WHERE user_id = ?)').run(id);
  db.prepare('DELETE FROM jobs WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// Job operations
export function getJobsByUser(userId: number): Job[] {
  return getDb().prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Job[];
}

export function getJobById(id: number): Job | null {
  return getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | null;
}

export function createJob(job: Omit<Job, 'id' | 'created_at'>): Job {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO jobs (user_id, company, position, status, applied_date, last_updated, email_thread_id, email_message_id, email_subject, job_url, location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.user_id, job.company, job.position, job.status,
    job.applied_date, job.last_updated, job.email_thread_id,
    job.email_message_id, job.email_subject, job.job_url, job.location, job.notes
  );
  return getJobById(result.lastInsertRowid as number) as Job;
}

export function updateJob(id: number, updates: Partial<Job>): Job | null {
  const db = getDb();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'user_id' && k !== 'created_at');
  if (fields.length === 0) return getJobById(id);
  const set = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f]);
  db.prepare(`UPDATE jobs SET ${set} WHERE id = ?`).run(...values, id);
  return getJobById(id);
}

export function deleteJob(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM job_updates WHERE job_id = ?').run(id);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
}

export function findJobByThreadId(userId: number, threadId: string): Job | null {
  return getDb().prepare('SELECT * FROM jobs WHERE user_id = ? AND email_thread_id = ?').get(userId, threadId) as Job | null;
}

// Job updates
export function addJobUpdate(update: Omit<JobUpdate, 'id' | 'created_at'>): JobUpdate {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO job_updates (job_id, update_type, message, email_subject, received_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(update.job_id, update.update_type, update.message, update.email_subject, update.received_at);
  return db.prepare('SELECT * FROM job_updates WHERE id = ?').get(result.lastInsertRowid) as JobUpdate;
}

export function getJobUpdates(jobId: number): JobUpdate[] {
  return getDb().prepare('SELECT * FROM job_updates WHERE job_id = ? ORDER BY created_at DESC').all(jobId) as JobUpdate[];
}

// Processed emails
export function markEmailProcessed(userId: number, emailId: string) {
  getDb().prepare(`
    INSERT OR IGNORE INTO processed_emails (user_id, email_id) VALUES (?, ?)
  `).run(userId, emailId);
}

export function isEmailProcessed(userId: number, emailId: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM processed_emails WHERE user_id = ? AND email_id = ?').get(userId, emailId);
  return !!row;
}
