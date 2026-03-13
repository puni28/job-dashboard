import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { setResumeFileText, getProfile } from '@/lib/db';

// pdf-parse is kept as a serverComponentsExternalPackage so webpack doesn't bundle it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const { name, size, type } = file as File;

  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 });
  }

  const ext = name.split('.').pop()?.toLowerCase();
  let text = '';

  if (ext === 'txt' || type === 'text/plain') {
    text = await (file as File).text();
  } else if (ext === 'pdf' || type === 'application/pdf') {
    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const parsed = await pdfParse(buffer);
    text = parsed.text as string;
  } else {
    return NextResponse.json({ error: 'Only PDF and TXT files are supported' }, { status: 400 });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return NextResponse.json({ error: 'Could not extract text from the file' }, { status: 400 });
  }

  await setResumeFileText(userId, trimmed);

  return NextResponse.json({ success: true, chars: trimmed.length });
}

export async function GET(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await getProfile(userId);
  return NextResponse.json({ hasResume: !!profile?.resume_file_text, chars: profile?.resume_file_text?.length ?? 0 });
}

export async function DELETE(req: NextRequest) {
  const userId = getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await setResumeFileText(userId, null);
  return NextResponse.json({ success: true });
}
