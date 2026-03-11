/**
 * Unit tests for /api/jobs routes.
 *
 * Both the session module and the DB layer are mocked so no real database or
 * cookie infrastructure is required during the test run.
 */

import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/session', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  getJobsByUser: jest.fn(),
  createJob: jest.fn(),
  getJobById: jest.fn(),
  updateJob: jest.fn(),
  deleteJob: jest.fn(),
  getJobUpdates: jest.fn(),
}));

import { getSession } from '@/lib/session';
import { getJobsByUser, createJob, getJobById, updateJob, deleteJob, getJobUpdates } from '@/lib/db';

// Lazy-import the routes after mocks are in place
import { GET, POST } from '@/app/api/jobs/route';
import { PUT, DELETE } from '@/app/api/jobs/[id]/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockGetJobsByUser = getJobsByUser as jest.MockedFunction<typeof getJobsByUser>;
const mockCreateJob = createJob as jest.MockedFunction<typeof createJob>;
const mockGetJobById = getJobById as jest.MockedFunction<typeof getJobById>;
const mockUpdateJob = updateJob as jest.MockedFunction<typeof updateJob>;
const mockDeleteJob = deleteJob as jest.MockedFunction<typeof deleteJob>;
const mockGetJobUpdates = getJobUpdates as jest.MockedFunction<typeof getJobUpdates>;

const TEST_USER_ID = 42;

const sampleJob = {
  id: 1,
  user_id: TEST_USER_ID,
  company: 'Acme Corp',
  position: 'Software Engineer',
  status: 'Applied' as const,
  applied_date: '2024-03-01T00:00:00.000Z',
  last_updated: '2024-03-01T00:00:00.000Z',
  email_thread_id: null,
  email_message_id: null,
  email_subject: null,
  job_url: null,
  location: 'Remote',
  notes: null,
  created_at: '2024-03-01T00:00:00.000Z',
};

function makeRequest(url: string, method: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

// ─── GET /api/jobs ────────────────────────────────────────────────────────────

describe('GET /api/jobs', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetSession.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns jobs with updates for authenticated user', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobsByUser.mockResolvedValue([sampleJob]);
    mockGetJobUpdates.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].company).toBe('Acme Corp');
    expect(data.jobs[0].updates).toEqual([]);
  });

  it('returns empty array when user has no jobs', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobsByUser.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toEqual([]);
  });
});

// ─── POST /api/jobs ───────────────────────────────────────────────────────────

describe('POST /api/jobs', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetSession.mockReturnValue(null);

    const req = makeRequest('http://localhost/api/jobs', 'POST', {
      company: 'Stripe',
      position: 'Engineer',
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when company is missing', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);

    const req = makeRequest('http://localhost/api/jobs', 'POST', {
      position: 'Engineer',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/required/i);
  });

  it('returns 400 when position is missing', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);

    const req = makeRequest('http://localhost/api/jobs', 'POST', {
      company: 'Stripe',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates and returns a new job', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockCreateJob.mockResolvedValue(sampleJob);

    const req = makeRequest('http://localhost/api/jobs', 'POST', {
      company: 'Acme Corp',
      position: 'Software Engineer',
      status: 'Applied',
      location: 'Remote',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.job.company).toBe('Acme Corp');
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: TEST_USER_ID,
        company: 'Acme Corp',
        position: 'Software Engineer',
        status: 'Applied',
        location: 'Remote',
      })
    );
  });
});

// ─── PUT /api/jobs/[id] ───────────────────────────────────────────────────────

describe('PUT /api/jobs/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetSession.mockReturnValue(null);

    const req = makeRequest('http://localhost/api/jobs/1', 'PUT', { status: 'Interview' });
    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when job does not exist', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobById.mockResolvedValue(null);

    const req = makeRequest('http://localhost/api/jobs/999', 'PUT', { status: 'Interview' });
    const res = await PUT(req, { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('returns 404 when job belongs to a different user', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobById.mockResolvedValue({ ...sampleJob, user_id: 99 });

    const req = makeRequest('http://localhost/api/jobs/1', 'PUT', { status: 'Interview' });
    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(404);
  });

  it('updates and returns the job', async () => {
    const updatedJob = { ...sampleJob, status: 'Interview' as const };
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobById.mockResolvedValue(sampleJob);
    mockUpdateJob.mockResolvedValue(updatedJob);

    const req = makeRequest('http://localhost/api/jobs/1', 'PUT', { status: 'Interview' });
    const res = await PUT(req, { params: { id: '1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.job.status).toBe('Interview');
  });
});

// ─── DELETE /api/jobs/[id] ────────────────────────────────────────────────────

describe('DELETE /api/jobs/[id]', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetSession.mockReturnValue(null);

    const req = makeRequest('http://localhost/api/jobs/1', 'DELETE');
    const res = await DELETE(req, { params: { id: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 404 when job does not exist', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobById.mockResolvedValue(null);

    const req = makeRequest('http://localhost/api/jobs/999', 'DELETE');
    const res = await DELETE(req, { params: { id: '999' } });
    expect(res.status).toBe(404);
  });

  it('deletes the job and returns success', async () => {
    mockGetSession.mockReturnValue(TEST_USER_ID);
    mockGetJobById.mockResolvedValue(sampleJob);
    mockDeleteJob.mockResolvedValue(undefined);

    const req = makeRequest('http://localhost/api/jobs/1', 'DELETE');
    const res = await DELETE(req, { params: { id: '1' } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockDeleteJob).toHaveBeenCalledWith(1);
  });
});
