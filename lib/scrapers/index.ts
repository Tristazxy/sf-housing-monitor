import { scrapeCraigslist } from './craigslist';
import { scrapeZillow } from './zillow';
import { scrapeApartments } from './apartments';
import { scrapeHotpads } from './hotpads';
import { scrapePadmapper } from './padmapper';
import { scrapeReddit } from './reddit';
import { ScrapeResult, Listing } from '../types';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

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
