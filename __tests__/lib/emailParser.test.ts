import { classifyEmail, getStatusFromEmailType, getUpdateLabel } from '@/lib/emailParser';
import type { GmailMessage } from '@/lib/gmail';

function makeMsg(overrides: Partial<GmailMessage>): GmailMessage {
  return {
    id: 'msg-001',
    threadId: 'thread-001',
    subject: '',
    from: 'noreply@company.com',
    date: '2024-03-01',
    snippet: '',
    body: '',
    ...overrides,
  };
}

// ─── classifyEmail ────────────────────────────────────────────────────────────

describe('classifyEmail', () => {
  describe('application emails', () => {
    it('detects "thank you for applying" confirmation', () => {
      const msg = makeMsg({
        subject: 'Thank you for applying to Acme Corp',
        snippet: 'We have received your application.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('application');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('detects "application received" confirmation', () => {
      const msg = makeMsg({
        subject: 'Application Received – Software Engineer',
        snippet: 'Your application has been received.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('application');
    });

    it('detects "successfully applied" confirmation', () => {
      const msg = makeMsg({
        subject: 'You successfully applied for Frontend Developer at TechCo',
        snippet: '',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('application');
    });
  });

  describe('screening emails', () => {
    it('detects phone screen invite', () => {
      const msg = makeMsg({
        subject: 'Initial phone screen invitation',
        snippet: 'We would like to schedule a recruiter screen.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('screening');
    });

    it('detects introductory call invite', () => {
      const msg = makeMsg({
        subject: 'Introductory call with Acme Recruiter',
        snippet: '',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('screening');
    });
  });

  describe('interview emails', () => {
    it('detects technical interview invitation', () => {
      const msg = makeMsg({
        subject: 'Technical interview invitation – Backend Engineer',
        snippet: "We'd like to invite you for an interview.",
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('interview');
    });

    it('detects coding challenge', () => {
      const msg = makeMsg({
        subject: 'Coding challenge for Software Engineer role',
        snippet: 'Please complete the coding assessment.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('interview');
    });

    it('detects next round notification', () => {
      const msg = makeMsg({
        subject: 'Moving to the next round',
        snippet: 'You are invited to the next round of interviews.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('interview');
    });
  });

  describe('offer emails', () => {
    it('detects offer letter', () => {
      const msg = makeMsg({
        subject: 'Offer letter – Senior Engineer at Acme',
        snippet: 'We are pleased to extend an offer of employment.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('offer');
    });

    it('detects "welcome aboard" message', () => {
      const msg = makeMsg({
        subject: 'Welcome aboard!',
        snippet: 'We are excited to have you join the team.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('offer');
    });
  });

  describe('rejection emails', () => {
    it('detects standard rejection', () => {
      const msg = makeMsg({
        subject: 'Your application status',
        snippet: 'Unfortunately, we will not be moving forward with your application.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('rejected');
    });

    it('detects "regret to inform" rejection', () => {
      const msg = makeMsg({
        subject: 'Update on your application',
        snippet: 'We regret to inform you that you have not been selected.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('rejected');
    });

    it('detects "position has been filled" rejection', () => {
      const msg = makeMsg({
        subject: 'Position update',
        snippet: 'The position has been filled.',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(true);
      expect(result.emailType).toBe('rejected');
    });
  });

  describe('non-job emails', () => {
    it('ignores unrelated promotional emails', () => {
      const msg = makeMsg({
        subject: '50% off your next order!',
        snippet: 'Shop now and save big.',
        from: 'promo@shop.com',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(false);
    });

    it('ignores newsletter emails', () => {
      const msg = makeMsg({
        subject: 'Your weekly digest',
        snippet: 'Here are the top stories this week.',
        from: 'newsletter@medium.com',
      });
      const result = classifyEmail(msg);
      expect(result.isJobRelated).toBe(false);
    });
  });

  describe('company extraction', () => {
    it('extracts company from subject "applying to [Company]"', () => {
      const msg = makeMsg({
        subject: 'Thank you for applying to Stripe',
        snippet: '',
      });
      const result = classifyEmail(msg);
      expect(result.company).toBe('Stripe');
    });

    it('extracts company from sender email domain', () => {
      const msg = makeMsg({
        subject: 'Thank you for applying',
        snippet: 'We received your application.',
        from: 'careers@airbnb.com',
      });
      const result = classifyEmail(msg);
      expect(result.company).toBeTruthy();
    });

    it('falls back to "Unknown Company" when company cannot be extracted', () => {
      const msg = makeMsg({
        subject: 'Thank you for applying',
        snippet: 'We received your application.',
        from: 'noreply@greenhouse.io',
      });
      const result = classifyEmail(msg);
      expect(result.company).toBe('Unknown Company');
    });
  });
});

// ─── getStatusFromEmailType ───────────────────────────────────────────────────

describe('getStatusFromEmailType', () => {
  it.each([
    ['application', 'Applied'],
    ['screening', 'Screening'],
    ['interview', 'Interview'],
    ['offer', 'Offer'],
    ['rejected', 'Rejected'],
    ['update', 'Applied'],
  ] as const)('maps %s → %s', (emailType, expectedStatus) => {
    expect(getStatusFromEmailType(emailType)).toBe(expectedStatus);
  });
});

// ─── getUpdateLabel ───────────────────────────────────────────────────────────

describe('getUpdateLabel', () => {
  it.each([
    ['application', 'Application Confirmed'],
    ['screening', 'Screening Call Scheduled'],
    ['interview', 'Interview Invitation'],
    ['offer', 'Offer Received'],
    ['rejected', 'Application Rejected'],
    ['update', 'Status Update'],
  ] as const)('returns correct label for %s', (emailType, expectedLabel) => {
    expect(getUpdateLabel(emailType)).toBe(expectedLabel);
  });
});
