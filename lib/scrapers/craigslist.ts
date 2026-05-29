import { Listing } from '../types';
import { browserNavigate, browserGetText, browserGetLinks, browserRunJS, browserSleep } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

function parsePrice(text: string): number | null {
  const m = text.match(/\$?([\d,]+)/);
  if (!m) return null;
  return parseInt(m[1].replace(/,/g, ''));
}

function detectAmenities(text: string) {
  const lower = text.toLowerCase();
  const has_laundry = /in.?unit laundry|washer.?dryer|w\/d in unit|w\/d\(|laundry in unit/.test(lower);
  const has_parking = /parking|garage|carport/.test(lower);
  const has_view = /bay view|city view|ocean view|water view|panoramic|views/.test(lower);
  let floor: number | null = null;
  const fm = lower.match(/(\d+)(?:st|nd|rd|th)?\s*floor/) || lower.match(/floor\s*(\d+)/);
  if (fm) floor = parseInt(fm[1]);
  return { has_laundry, has_parking, has_view, floor };
}

function parseBaths(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:ba|bath)/);
  return m ? parseFloat(m[1]) : null;
}

function extractNeighborhood(text: string): string | null {
  const hoods = [
    'soma', 'south beach', 'mission district', 'mission', 'castro', 'noe valley',
    'pacific heights', 'pac hts', 'marina', 'cow hollow', 'north beach', 'telegraph hill',
    'financial district', 'tenderloin', 'hayes valley', 'haight ashbury', 'haight',
    'sunset', 'parkside', 'richmond', 'seacliff', 'potrero', 'bernal heights', 'bernal',
    'glen park', 'excelsior', 'bayview', 'dogpatch', 'russian hill', 'nob hill',
    'lower nob hill', 'chinatown', 'japantown', 'western addition', 'fillmore',
    'cole valley', 'twin peaks', 'west portal', 'forest hill', 'embarcadero',
    'rincon hill', 'mission bay', 'presidio', 'inner richmond', 'outer richmond',
    'inner sunset', 'outer sunset', 'polk gulch', 'lower pac hts', 'downtown',
    'civic', 'van ness', 'alamo square', 'nopa', 'ingleside', 'visitacion valley',
  ];
  const lower = text.toLowerCase();
  for (const h of hoods) {
    if (lower.includes(h)) {
      return h.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

function extractImageMapFromJS(): Map<string, string> {
  // Use JS to query DOM directly — captures lazy-loaded images too
  const js = `JSON.stringify(Array.from(document.querySelectorAll("a.main[href*='/d/']")).reduce((m, a) => { const img = a.querySelector("img"); if (img?.src && img.src.includes("craigslist.org")) m[a.href] = img.src; return m; }, {}))`;
  try {
    const raw = browserRunJS(js);
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

async function scrapeSearchPage(url: string, isSublease: boolean): Promise<ListingRow[]> {
  browserNavigate(url);

  // Scroll to trigger lazy image loading across the full page
  try {
    browserRunJS('window.scrollTo(0, document.body.scrollHeight * 0.33)');
    browserSleep(400);
    browserRunJS('window.scrollTo(0, document.body.scrollHeight * 0.66)');
    browserSleep(400);
    browserRunJS('window.scrollTo(0, document.body.scrollHeight)');
    browserSleep(600);
    browserRunJS('window.scrollTo(0, 0)');
  } catch { /* scroll errors are non-fatal */ }

  const links = browserGetLinks();
  const text = browserGetText();
  const imageMap = extractImageMapFromJS();

  // Filter to actual listing links (e.g. /sfc/apa/d/... or /sfc/sub/d/...)
  const listingLinks = links.filter(l =>
    /craigslist\.org\/sfc\/(?:apa|sub|roo)\/d\/.+\.html$/.test(l.href)
  );

  const listings: ListingRow[] = [];

  for (const link of listingLinks) {
    const rawTitle = link.text.trim();
    if (!rawTitle || rawTitle.toLowerCase() === 'no image') continue;

    // Find this title in the text blob to extract price/metadata
    const escaped = rawTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped + '[\\s\\S]{0,200}?\\$(\\d[\\d,]+)', 'i');
    const m = text.match(re);
    if (!m) continue;

    const price = parseInt(m[1].replace(/,/g, ''));
    if (!price || price < 100 || price > 15000) continue;

    const section = m[0]; // full matched chunk: title + metadata + price

    // Beds
    const bedsMatch = section.match(/(\d+)br/i) || rawTitle.match(/(\d+)\s*(?:br|bed)/i);
    const isStudio = /studio/i.test(rawTitle) || /studio/i.test(section.slice(0, 80));
    const beds = isStudio ? 0 : (bedsMatch ? parseInt(bedsMatch[1]) : null);

    // Sqft
    const sqftMatch = section.match(/(\d{3,4})ft2/i);
    const sqft = sqftMatch ? parseInt(sqftMatch[1]) : null;

    const amenities = detectAmenities(rawTitle + ' ' + section);
    const neighborhood = extractNeighborhood(section) || extractNeighborhood(rawTitle);
    const baths = parseBaths(rawTitle);

    // Clean title: strip leading "no image" artifacts
    const title = rawTitle.replace(/^no\s+image\s*/i, '').trim() || rawTitle;

    listings.push({
      url: link.href,
      title,
      price,
      beds,
      baths,
      sqft,
      address: null,
      neighborhood,
      floor: amenities.floor,
      has_laundry: true, // Craigslist URL filtered with laundry=1
      has_parking: amenities.has_parking,
      has_view: amenities.has_view,
      is_sublease: isSublease,
      platform: 'craigslist',
      image_url: imageMap.get(link.href) ?? null,
      description: null,
      posted_at: null,
    });
  }

  return listings;
}

export async function scrapeCraigslist(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];
  const errors: string[] = [];

  try {
    // laundry=1 = W/D in unit; private_room=0 = no single-room listings
    const apaListings = await scrapeSearchPage(
      'https://sfbay.craigslist.org/search/sfc/apa?min_bedrooms=0&max_price=4000&sort=date&laundry=1&private_room=0',
      false
    );
    listings.push(...apaListings);
  } catch (err) {
    errors.push(`apartments: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const subListings = await scrapeSearchPage(
      'https://sfbay.craigslist.org/search/sfc/sub?min_bedrooms=0&max_price=4000&sort=date&laundry=1&private_room=0',
      true
    );
    listings.push(...subListings);
  } catch (err) {
    errors.push(`subleases: ${err instanceof Error ? err.message : String(err)}`);
  }

  const seen = new Set<string>();
  const deduped = listings.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  return { listings: deduped, error: errors.length > 0 ? errors.join('; ') : undefined };
}
