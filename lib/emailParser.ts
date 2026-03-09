import { GmailMessage } from './gmail';

export type JobApplicationInfo = {
  company: string;
  position: string;
  emailType: 'application' | 'screening' | 'interview' | 'offer' | 'rejected' | 'update';
  appliedDate: string;
};

// --- Detection Patterns ---

const APPLICATION_PATTERNS = [
  /thank you for (your )?appl(ying|ication)/i,
  /we (have |'ve )received your application/i,
  /application (has been |was )?received/i,
  /application (has been |was )?submitted/i,
  /successfully applied/i,
  /your application (to|for|at)/i,
  /we got your application/i,
  /application confirmation/i,
  /thanks for applying/i,
  /applied (to|for|at)/i,
  /we received your resume/i,
];

const SCREENING_PATTERNS = [
  /initial (phone )?screen/i,
  /phone (screen|interview|call)/i,
  /introductory call/i,
  /recruiter (screen|call)/i,
  /we'd like to learn more about you/i,
  /next step(s)? in (the|our) (hiring |)process/i,
  /recruiter would like to connect/i,
];

const INTERVIEW_PATTERNS = [
  /we'd like to (invite you|schedule|move forward)/i,
  /interview (invitation|request|scheduled|confirmed)/i,
  /invite you (for |to )(an |a )interview/i,
  /technical (interview|assessment|challenge)/i,
  /coding (challenge|test|assessment)/i,
  /schedule (an |a )interview/i,
  /we are (pleased|happy|excited) to (invite|move)/i,
  /next round/i,
  /on-?site interview/i,
  /video (interview|call)/i,
  /hiring manager/i,
];

const OFFER_PATTERNS = [
  /offer letter/i,
  /job offer/i,
  /pleased to offer/i,
  /excited to (extend|offer)/i,
  /offer of employment/i,
  /we('d like to|would like to) offer you/i,
  /compensation package/i,
  /start date/i,
  /welcome (aboard|to the team)/i,
];

const REJECTION_PATTERNS = [
  /unfortunately.{0,100}(not|won't|will not|unable)/i,
  /we('ve| have) decided (to |)move forward with other/i,
  /not (selected|moving forward|a fit|the right fit)/i,
  /we will not be moving forward/i,
  /position has been filled/i,
  /did not (progress|advance|move forward)/i,
  /we ('ve|have) decided not to/i,
  /application (was |has been |)not successful/i,
  /not (selected|chosen) for (the |this )/i,
  /regret to inform/i,
  /we went with (another|a different)/i,
  /keep your (resume|profile) on file/i,
];

// --- Company Extraction ---

function extractCompanyFromSubject(subject: string): string {
  // "Thank you for applying to [Company]"
  const patterns = [
    /applying (?:to|at|for(?: a position at)?)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[!|,|.]|$)/,
    /application (?:to|at|for|received from)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[!|,|.]|$)/,
    /(?:from|at)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[!|,|.]|$)/,
    /([A-Z][A-Za-z0-9\s&.,'-]+?)\s+(?:Application|Career|Jobs|Recruiting)/i,
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }
  return '';
}

function extractCompanyFromEmail(from: string): string {
  // Extract from email address domain
  const emailMatch = from.match(/@([a-zA-Z0-9.-]+)\./);
  if (emailMatch) {
    const domain = emailMatch[1];
    // Skip common email providers
    const skipDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'mail', 'email',
      'workday', 'greenhouse', 'lever', 'jobvite', 'icims', 'taleo', 'bamboohr',
      'ashbyhq', 'rippling', 'breezy', 'recruitee', 'smartrecruiters', 'myworkday'];
    if (!skipDomains.includes(domain.toLowerCase())) {
      return domain.split('.')[0]
        .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  // Extract display name from "Company Name <email@company.com>"
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    return nameMatch[1].trim()
      .replace(/\s*(careers?|jobs?|recruiting|talent|hr|noreply|no-reply)\s*/gi, '')
      .replace(/\bat\b/gi, '')
      .trim();
  }
  return '';
}

function extractCompanyFromBody(body: string, subject: string): string {
  const patterns = [
    /thank you for (?:your )?interest in\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[!.,]|\.)/,
    /joining the\s+([A-Z][A-Za-z0-9\s&.,'-]+?)\s+team/i,
    /interest in working (?:at|with|for)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[!.,]|\.)/,
    /your application (?:to|at|for|with)\s+([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s*[!.,]|\.)/,
  ];

  for (const pattern of patterns) {
    const match = (body || subject).match(pattern);
    if (match?.[1] && match[1].trim().length > 1) {
      return match[1].trim();
    }
  }
  return '';
}

function extractPositionFromSubject(subject: string): string {
  const patterns = [
    /application for:?\s+(.+?)(?:\s+(?:at|@|-)\s+|$)/i,
    /applied (?:for|to):?\s+(.+?)(?:\s+(?:at|@|-)\s+|$)/i,
    /(?:position|role|job):?\s+(.+?)(?:\s+(?:at|@|-)\s+|$)/i,
    /(?:your )?application:?\s+(.+?)(?:\s+(?:at|@|-)\s+|$)/i,
    /(.+?)\s+(?:at|@)\s+[A-Z]/,
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match?.[1]) {
      const pos = match[1].trim().replace(/^(for|the|a|an)\s+/i, '');
      if (pos.length > 2 && pos.length < 100) return pos;
    }
  }
  return 'Position';
}

// --- Main Detection ---

export type EmailClassification = {
  isJobRelated: boolean;
  emailType: 'application' | 'screening' | 'interview' | 'offer' | 'rejected' | 'update';
  company: string;
  position: string;
  confidence: number;
};

export function classifyEmail(msg: GmailMessage): EmailClassification {
  const text = `${msg.subject} ${msg.snippet} ${msg.body}`.toLowerCase();
  const subject = msg.subject;
  const body = msg.body || msg.snippet;

  // Check email type
  let emailType: EmailClassification['emailType'] = 'update';
  let confidence = 0;

  if (REJECTION_PATTERNS.some(p => p.test(text))) {
    emailType = 'rejected';
    confidence = 85;
  } else if (OFFER_PATTERNS.some(p => p.test(text))) {
    emailType = 'offer';
    confidence = 90;
  } else if (INTERVIEW_PATTERNS.some(p => p.test(text))) {
    emailType = 'interview';
    confidence = 80;
  } else if (SCREENING_PATTERNS.some(p => p.test(text))) {
    emailType = 'screening';
    confidence = 75;
  } else if (APPLICATION_PATTERNS.some(p => p.test(text))) {
    emailType = 'application';
    confidence = 85;
  } else {
    return { isJobRelated: false, emailType: 'update', company: '', position: '', confidence: 0 };
  }

  // Extract company and position
  const company =
    extractCompanyFromSubject(subject) ||
    extractCompanyFromBody(body, subject) ||
    extractCompanyFromEmail(msg.from) ||
    'Unknown Company';

  const position = extractPositionFromSubject(subject);

  return {
    isJobRelated: true,
    emailType,
    company,
    position,
    confidence,
  };
}

export function getStatusFromEmailType(
  emailType: EmailClassification['emailType']
): 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected' {
  const map: Record<string, 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Rejected'> = {
    application: 'Applied',
    screening: 'Screening',
    interview: 'Interview',
    offer: 'Offer',
    rejected: 'Rejected',
    update: 'Applied',
  };
  return map[emailType] ?? 'Applied';
}

export function getUpdateLabel(emailType: EmailClassification['emailType']): string {
  const labels: Record<string, string> = {
    application: 'Application Confirmed',
    screening: 'Screening Call Scheduled',
    interview: 'Interview Invitation',
    offer: 'Offer Received',
    rejected: 'Application Rejected',
    update: 'Status Update',
  };
  return labels[emailType] ?? 'Update';
}
