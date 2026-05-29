import { scrapeCraigslist } from './craigslist';
import { scrapeZillow } from './zillow';
import { scrapeApartments } from './apartments';
import { scrapeHotpads } from './hotpads';
import { scrapePadmapper } from './padmapper';
import { scrapeReddit } from './reddit';
import { ScrapeResult, Listing } from '../types';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

// Cities that are NOT San Francisco — reject listings whose address names these
const NON_SF_CITIES = [
  'oakland', 'berkeley', 'emeryville', 'alameda', 'san leandro', 'hayward',
  'fremont', 'union city', 'newark', 'milpitas',
  'san jose', 'santa clara', 'sunnyvale', 'mountain view', 'palo alto',
  'menlo park', 'redwood city', 'san mateo', 'burlingame', 'millbrae',
  'south san francisco', 'brisbane', 'daly city', 'pacifica', 'half moon bay',
  'sausalito', 'tiburon', 'corte madera', 'san rafael', 'novato',
  'walnut creek', 'concord', 'pittsburg', 'antioch', 'brentwood',
  'livermore', 'pleasanton', 'dublin', 'san ramon',
  // Richmond CA (the city) — but NOT "Richmond District" which is an SF neighborhood
  'richmond, ca', 'richmond ca',
];

/**
 * Returns true if the listing is in San Francisco proper.
 * If no address is available, we trust the scraper's search URL and accept it.
 */
function isSFListing(listing: ListingRow): boolean {
  const text = [listing.address, listing.title].filter(Boolean).join(' ').toLowerCase();
  if (!text) return true;

  // Explicit SF mention → accept immediately
  if (/\bsan francisco\b|,\s*sf\b/.test(text)) return true;

  // Non-SF city found in the address/title → reject
  for (const city of NON_SF_CITIES) {
    if (text.includes(city)) return false;
  }

  return true;
}

async function runScraper(
  name: string,
  fn: () => Promise<{ listings: ListingRow[]; error?: string }>
): Promise<ScrapeResult> {
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - start;
    console.log(`[${name}] ${result.listings.length} listings in ${elapsed}ms${result.error ? ` (error: ${result.error})` : ''}`);
    return {
      platform: name,
      listings: result.listings,
      error: result.error,
      count: result.listings.length,
    };
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[${name}] failed in ${elapsed}ms:`, err);
    return {
      platform: name,
      listings: [],
      error: err instanceof Error ? err.message : String(err),
      count: 0,
    };
  }
}

export async function runAllScrapers(): Promise<ScrapeResult[]> {
  // Reddit is HTTP-based — run in parallel with itself (multiple subreddits handled internally)
  // Browser-based scrapers share a browse session — run sequentially to avoid conflicts
  const results: ScrapeResult[] = [];

  // Phase 1: HTTP-based scrapers (parallel)
  const [padmapperResult] = await Promise.all([
    runScraper('padmapper', scrapePadmapper),
  ]);
  results.push(padmapperResult);

  // Phase 2: Browser-based scrapers (sequential to avoid browse session conflicts)
  const browserScrapers: Array<{ name: string; fn: () => Promise<{ listings: ListingRow[]; error?: string }> }> = [
    { name: 'craigslist', fn: scrapeCraigslist },
    { name: 'reddit', fn: scrapeReddit },
    { name: 'zillow', fn: scrapeZillow },
    { name: 'apartments.com', fn: scrapeApartments },
    { name: 'hotpads', fn: scrapeHotpads },
  ];

  for (const { name, fn } of browserScrapers) {
    results.push(await runScraper(name, fn));
  }

  return results;
}

export function deduplicateListings(allResults: ScrapeResult[]): ListingRow[] {
  const seen = new Set<string>();
  const deduped: ListingRow[] = [];

  // Sort results: prefer craigslist first (most reliable), then others
  const sorted = [...allResults].sort((a, b) => {
    const order = ['craigslist', 'reddit', 'zillow', 'apartments.com', 'hotpads', 'padmapper'];
    return order.indexOf(a.platform) - order.indexOf(b.platform);
  });

  for (const result of sorted) {
    for (const listing of result.listings) {
      // Reject listings outside San Francisco city limits
      if (!isSFListing(listing)) continue;

      // Normalize URL for deduplication
      const normalizedUrl = listing.url.replace(/\?.*$/, '').replace(/\/$/, '').toLowerCase();
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        deduped.push(listing);
      }
    }
  }

  return deduped;
}
