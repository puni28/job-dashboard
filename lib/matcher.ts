import type { JobListing, UserProfile } from './db';

export type ScoredListing = JobListing & { score: number; matchedSkills: string[] };

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9#+.\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

export function scoreListings(listings: JobListing[], profile: UserProfile): ScoredListing[] {
  const skillsRaw = profile.skills || '';
  const titlesRaw = profile.preferred_titles || '';
  const includeRaw = profile.include_keywords || '';
  const excludeRaw = profile.exclude_keywords || '';
  const remotePreference = profile.remote_preference || 'any';

  const skills = skillsRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const preferredTitles = titlesRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const includeKw = includeRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const excludeKw = excludeRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  return listings.map(listing => {
    const corpus = [
      listing.title,
      listing.company,
      listing.description || '',
      listing.tags || '',
      listing.location || '',
    ].join(' ').toLowerCase();

    const corpusTokens = tokenize(corpus);

    // Hard exclude
    if (excludeKw.some(kw => corpus.includes(kw))) {
      return { ...listing, score: 0, matchedSkills: [] };
    }

    // Hard include (must have at least one if specified)
    if (includeKw.length > 0 && !includeKw.some(kw => corpus.includes(kw))) {
      return { ...listing, score: 0, matchedSkills: [] };
    }

    // Remote filter
    if (remotePreference === 'remote') {
      const isRemote = listing.remote === 'remote' || corpus.includes('remote');
      if (!isRemote) return { ...listing, score: 0, matchedSkills: [] };
    }

    let score = 0;
    const matchedSkills: string[] = [];

    // Title match (0-40 points)
    if (preferredTitles.length > 0) {
      const titleTokens = tokenize(listing.title);
      const titleScore = preferredTitles.reduce((best, preferred) => {
        const prefTokens = tokenize(preferred);
        const overlap = prefTokens.filter(t => titleTokens.includes(t)).length;
        return Math.max(best, overlap / prefTokens.length);
      }, 0);
      score += titleScore * 40;
    } else {
      score += 20; // neutral if no preference set
    }

    // Skills match (0-50 points)
    if (skills.length > 0) {
      const matched = skills.filter(skill => {
        const skillTokens = tokenize(skill);
        return skillTokens.every(t => corpusTokens.includes(t));
      });
      matchedSkills.push(...matched.map(s => s));
      score += (matched.length / Math.min(skills.length, 10)) * 50;
    } else {
      score += 25; // neutral
    }

    // Recency bonus (0-10 points)
    if (listing.posted_at) {
      const daysOld = (Date.now() - new Date(listing.posted_at).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysOld / 3);
    }

    return { ...listing, score: Math.min(Math.round(score), 99), matchedSkills };
  });
}
