import Parser from 'rss-parser';

export type RawListing = {
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
};

// Remotive - free public API
export async function fetchRemotive(search?: string): Promise<RawListing[]> {
  try {
    const url = search
      ? `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(search)}&limit=50`
      : 'https://remotive.com/api/remote-jobs?limit=50';
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs || []).map((j: Record<string, unknown>) => ({
      external_id: String(j.id),
      source: 'Remotive',
      title: String(j.title || ''),
      company: String(j.company_name || ''),
      location: String(j.candidate_required_location || '') || null,
      remote: 'remote',
      salary: j.salary ? String(j.salary) : null,
      description: j.description ? String(j.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000) : null,
      tags: Array.isArray(j.tags) ? (j.tags as string[]).join(', ') : null,
      url: String(j.url || ''),
      posted_at: j.publication_date ? String(j.publication_date) : null,
    }));
  } catch {
    return [];
  }
}

// RemoteOK - free public API
export async function fetchRemoteOK(): Promise<RawListing[]> {
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'JobDashboard/1.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    // First item is metadata, skip it
    const jobs = Array.isArray(data) ? data.slice(1, 51) : [];
    return jobs.map((j: Record<string, unknown>) => ({
      external_id: String(j.id || j.slug || ''),
      source: 'RemoteOK',
      title: String(j.position || ''),
      company: String(j.company || ''),
      location: 'Remote',
      remote: 'remote',
      salary: (j.salary_min || j.salary_max)
        ? `$${j.salary_min || '?'} - $${j.salary_max || '?'}`
        : null,
      description: j.description ? String(j.description).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000) : null,
      tags: Array.isArray(j.tags) ? (j.tags as string[]).join(', ') : null,
      url: j.url ? `https://remoteok.com${j.url}` : `https://remoteok.com/jobs/${j.id}`,
      posted_at: j.date ? String(j.date) : null,
    }));
  } catch {
    return [];
  }
}

// The Muse - free public API
export async function fetchTheMuse(role?: string): Promise<RawListing[]> {
  try {
    const query = role ? `&category=${encodeURIComponent(role)}` : '';
    const res = await fetch(`https://www.themuse.com/api/public/jobs?page=1&descending=true${query}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, 50).map((j: Record<string, unknown>) => {
      const locations = Array.isArray(j.locations)
        ? (j.locations as Record<string, string>[]).map(l => l.name).join(', ')
        : null;
      const levels = Array.isArray(j.levels)
        ? (j.levels as Record<string, string>[]).map(l => l.short_name).join(', ')
        : null;
      const companyObj = j.company as Record<string, unknown> | null;
      return {
        external_id: String(j.id || ''),
        source: 'The Muse',
        title: String(j.name || ''),
        company: companyObj ? String(companyObj.name || '') : '',
        location: locations,
        remote: null,
        salary: null,
        description: j.contents ? String(j.contents).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000) : null,
        tags: levels,
        url: j.refs ? String((j.refs as Record<string, string>).landing_page || '') : '',
        posted_at: j.publication_date ? String(j.publication_date) : null,
      };
    });
  } catch {
    return [];
  }
}

// We Work Remotely - RSS feed
export async function fetchWeWorkRemotely(): Promise<RawListing[]> {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://weworkremotely.com/remote-jobs.rss');
    return (feed.items || []).slice(0, 50).map((item, i) => {
      const titleParts = (item.title || '').split(' at ');
      const title = titleParts[0]?.trim() || item.title || '';
      const company = titleParts[1]?.trim() || 'Unknown';
      return {
        external_id: item.guid || item.link || `wwr-${i}`,
        source: 'We Work Remotely',
        title,
        company,
        location: 'Remote',
        remote: 'remote',
        salary: null,
        description: item.content
          ? String(item.content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000)
          : item.contentSnippet?.slice(0, 3000) ?? null,
        tags: item.categories?.join(', ') ?? null,
        url: item.link || '',
        posted_at: item.pubDate || null,
      };
    });
  } catch {
    return [];
  }
}

// Fetch all sources in parallel
export async function fetchAllSources(searchTerms?: string[]): Promise<RawListing[]> {
  const search = searchTerms?.join(' ');
  const [remotive, remoteok, muse, wwr] = await Promise.allSettled([
    fetchRemotive(search),
    fetchRemoteOK(),
    fetchTheMuse(search),
    fetchWeWorkRemotely(),
  ]);

  const all: RawListing[] = [
    ...(remotive.status === 'fulfilled' ? remotive.value : []),
    ...(remoteok.status === 'fulfilled' ? remoteok.value : []),
    ...(muse.status === 'fulfilled' ? muse.value : []),
    ...(wwr.status === 'fulfilled' ? wwr.value : []),
  ];

  // Deduplicate by title+company
  const seen = new Set<string>();
  return all.filter(j => {
    const key = `${j.title.toLowerCase()}:${j.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
