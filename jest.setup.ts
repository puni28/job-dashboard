import '@testing-library/jest-dom';

// Load UAT environment variables for tests
// NODE_ENV is set to 'test' automatically by Jest
process.env.SESSION_SECRET = 'test-session-secret-32-chars-long!!';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

// DATABASE_URL is intentionally not set here — tests mock the DB layer
// to avoid hitting a real database. Set DATABASE_URL in .env.uat when
// running integration tests against the UAT Neon database.
