import { Listing } from '../types';
import { browserNavigate, browserGetText, browserGetLinks } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

const HOUSING_KEYWORDS = /apt|apartment|studio|1br|2br|bedroom|sublease|sublet|rent|rental|available|unit|room/i;
const SF_KEYWORDS = /san francisco|sf|soma|mission|castro|noe valley|pacific heights|marina|north beach|tenderloin|hayes valley|haight|sunset|richmond|potrero|bernal|dogpatch|russian hill|nob hill|fillmore|twin peaks|embarcadero|south beach|mission bay|cow hollow/i;

function parsePrice(text: string): number | null {
  const patterns = [
    /\$([\d,]+)/,
    /([\d,]+)\s*(?:\/mo|per\s*month|a\s*month)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseInt(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 300 && val < 20000) return val;
    }
  }
  return null;
}

function parseBeds(text: string): number | null {
  const lower = text.toLowerCase();
  if (/studio/.test(lower)) return 0;
  const match = lower.match(/(\d+)\s*(?:br|bed|bedroom)/);
  if (match) return parseInt(match[1]);
  return null;
}

function detectAmenities(text: string) {
  const lower = text.toLowerCase();
  return {
    has_laundry: /in.?unit laundry|washer.?dryer|w\/d/.test(lower),
    has_parking: /parking|garage|carport/.test(lower),
    has_view: /bay view|city view|view/.test(lower),
  };
}

function extractNeighborhood(text: string): string | null {
  const hoods = [
    'SOMA', 'Mission', 'Castro', 'Noe Valley', 'Pacific Heights', 'Marina',
    'North Beach', 'Financial District', 'Tenderloin', 'Hayes Valley',
    'Haight', 'Sunset', 'Richmond', 'Potrero', 'Bernal', 'Dogpatch',
    'Russian Hill', 'Nob Hill', 'Fillmore', 'Twin Peaks', 'Embarcadero',
    'South Beach', 'Mission Bay', 'Cow Hollow',
  ];
  for (const n of hoods) {
    if (text.includes(n)) return n;
  }
  return null;
}

async function scrapeSubreddit(subreddit: string): Promise<ListingRow[]> {
  // Use RSS feed via browse binary — avoids Reddit API 403
  const url = `https://www.reddit.com/r/${subreddit}/new/.rss?limit=100`;
  browserNavigate(url);

  const links = browserGetLinks();
  const text = browserGetText();

  // RSS links follow pattern: reddit.com/r/subreddit/comments/...
  const postLinks = links.filter(l =>
    /reddit\.com\/r\/[^/]+\/comments\//.test(l.href)
  );

  const listings: ListingRow[] = [];

  for (const link of postLinks) {
    const title = link.text.trim();
    if (!title) continue;

    const fullText = title + ' ' + text;
    if (!HOUSING_KEYWORDS.test(title) && !HOUSING_KEYWORDS.test(fullText.slice(0, 300))) continue;
    if (!SF_KEYWORDS.test(fullText.slice(0, 500))) continue;

    const price = parsePrice(fullText.slice(0, 500));
    if (!price) continue;

    const isSublease = /sublease|sublet/i.test(fullText.slice(0, 300));
    const beds = parseBeds(title);
    const amenities = detectAmenities(title);
    const neighborhood = extractNeighborhood(title) || extractNeighborhood(fullText.slice(0, 300));

    listings.push({
      url: link.href,
      title,
      price,
      beds: beds ?? null,
      baths: null,
      sqft: null,
      address: null,
      neighborhood,
      floor: null,
      has_laundry: amenities.has_laundry,
      has_parking: amenities.has_parking,
      has_view: amenities.has_view,
      is_sublease: isSublease,
      platform: 'reddit',
      image_url: null,
      description: null,
      posted_at: null,
    });
  }

  return listings;
}

export async function scrapeReddit(): Promise<{ listings: ListingRow[]; error?: string }> {
  const subreddits = ['SFBayHousing', 'SFRentals'];
  const allListings: ListingRow[] = [];
  const errors: string[] = [];

  // Sequential — shares the browse session with other browser scrapers
  for (const subreddit of subreddits) {
    try {
      const listings = await scrapeSubreddit(subreddit);
      allListings.push(...listings);
    } catch (err) {
      errors.push(`r/${subreddit}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const seen = new Set<string>();
  const deduped = allListings.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  return {
    listings: deduped,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
