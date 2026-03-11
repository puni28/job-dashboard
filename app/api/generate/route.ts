import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSession } from '@/lib/session';
import { getProfile, getJobListings, saveDocument } from '@/lib/db';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { listingId, type } = await req.json();
  if (!listingId || !['resume', 'cover_letter'].includes(type)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const profile = await getProfile(userId);
  if (!profile) {
    return NextResponse.json({ error: 'Please complete your profile first' }, { status: 400 });
  }

  const listings = await getJobListings(300);
  const listing = listings.find(l => l.id === listingId);
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const profileText = buildProfileText(profile);
  const jobText = buildJobText(listing);

  let prompt: string;
  if (type === 'resume') {
    prompt = buildResumePrompt(profileText, jobText);
  } else {
    prompt = buildCoverLetterPrompt(profileText, jobText);
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0].type === 'text' ? message.content[0].text : '';
  const doc = await saveDocument(userId, listingId, type, content);

  return NextResponse.json({ document: doc });
}

function buildProfileText(p: Awaited<ReturnType<typeof getProfile>>): string {
  if (!p) return '';
  return `
NAME: ${p.full_name || 'Not set'}
EMAIL: ${p.email || 'Not set'}
PHONE: ${p.phone || 'Not set'}
LOCATION: ${p.location || 'Not set'}
LINKEDIN: ${p.linkedin || ''}
GITHUB: ${p.github || ''}
PORTFOLIO: ${p.portfolio || ''}

PROFESSIONAL SUMMARY:
${p.summary || 'Not provided'}

SKILLS:
${p.skills || 'Not provided'}

WORK EXPERIENCE:
${p.work_experience || 'Not provided'}

EDUCATION:
${p.education || 'Not provided'}

PROJECTS:
${p.projects || 'Not provided'}

CERTIFICATIONS:
${p.certifications || 'Not provided'}
`.trim();
}

function buildJobText(l: { title: string; company: string; location: string | null; salary: string | null; description: string | null; tags: string | null }): string {
  return `
JOB TITLE: ${l.title}
COMPANY: ${l.company}
LOCATION: ${l.location || 'Not specified'}
SALARY: ${l.salary || 'Not specified'}
TAGS/SKILLS: ${l.tags || 'Not specified'}

JOB DESCRIPTION:
${l.description || 'Not provided'}
`.trim();
}

function buildResumePrompt(profile: string, job: string): string {
  return `You are an expert resume writer. Using the candidate's profile below, create a tailored, ATS-optimized resume for the specific job posting.

IMPORTANT RULES:
- Only use information from the candidate's profile — do not fabricate experience or skills
- Use the job description's own keywords and language naturally
- Reorder and emphasize experiences most relevant to this role
- Keep it to one page worth of content
- Format it cleanly in plain text with clear sections
- Write bullet points that start with strong action verbs and include measurable results where the profile provides them
- Tailor the summary/objective to this specific role

---
CANDIDATE PROFILE:
${profile}

---
JOB POSTING:
${job}

---
Now write the tailored resume. Use this structure:
[FULL NAME]
[Email] | [Phone] | [Location] | [LinkedIn] | [GitHub/Portfolio]

SUMMARY
[2-3 sentence tailored summary]

SKILLS
[Comma-separated list of relevant skills]

EXPERIENCE
[Company Name] — [Job Title] | [Dates]
• [Bullet]
• [Bullet]

EDUCATION
[Degree, Institution, Year]

PROJECTS (if relevant)
[Project Name]: [Brief description]

CERTIFICATIONS (if any)
[Certification name]`;
}

function buildCoverLetterPrompt(profile: string, job: string): string {
  return `You are an expert career coach. Using the candidate's profile below, write a compelling, personalized cover letter for this specific job posting.

IMPORTANT RULES:
- Do not start with "I am writing to express my interest" — use a strong, specific opening hook
- Connect 2-3 specific experiences from the candidate's history to the company's stated needs
- Mirror the company's tone (infer from job description language)
- Keep it to 3-4 paragraphs, concise and impactful
- End with a confident call to action
- Address it to "Hiring Team" if no specific name is available
- Only use facts from the candidate's profile — no fabrication
- Reference the company name and role title naturally

---
CANDIDATE PROFILE:
${profile}

---
JOB POSTING:
${job}

---
Now write the cover letter:`;
}
