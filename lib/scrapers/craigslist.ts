import { Listing } from '../types';
import { browserNavigate, browserGetText, browserGetLinks, browserGetCurrentHtml, browserRunJS, browserSleep } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new' | 'is_saved'>;

function detectAmenities(text: string) {
  const lower = text.toLowerCase();
  const has_laundry = /in.?unit laundry|washer.?dryer|w\/d in unit|w\/d\(|laundry in unit/.test(lower);
  const has_parking = /parking|garage|carport/.test(lower);
  const has_view = /bay view|city view|ocean view|water view|panoramic|views|floor.to.ceiling|glass window|floor-to-ceiling windows/.test(lower);
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

/** Extract post ID from a Craigslist URL like .../d/title-words-7654321.html */
function extractPostId(url: string): string | null {
  const m = url.match(/(\d{7,13})\.html$/);
  return m ? m[1] : null;
}

/**
 * Build a postId → imageUrl map from the rendered HTML.
 * Craigslist image URLs embed the post ID: images.craigslist.org/d/{pid}/...
 * So we just scan the HTML for those URLs — no need to find data-pid separately.
 */
function buildImageMap(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const html = browserGetCurrentHtml();
    // The post ID is directly in the image URL path: /d/{pid}/filename.jpg
    const re = /(https:\/\/images\.craigslist\.org\/d\/(\d+)\/[^\s"'<>]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const fullUrl = m[1];
      const pid = m[2];
      if (!map.has(pid)) map.set(pid, fullUrl);
    }
  } catch { /* non-fatal */ }
  return map;
}

async function scrapeSearchPage(url: string, isSublease: boolean): Promise<ListingRow[]> {
  browserNavigate(url);

  // Scroll to trigger lazy image loading
  try {
    browserRunJS('window.scrollTo(0, document.body.scrollHeight * 0.33)');
    browserSleep(500);
    browserRunJS('window.scrollTo(0, document.body.scrollHeight * 0.66)');
    browserSleep(500);
    browserRunJS('window.scrollTo(0, document.body.scrollHeight)');
    browserSleep(800);
    browserRunJS('window.scrollTo(0, 0)');
    browserSleep(300);
  } catch { /* scroll errors are non-fatal */ }

  const links = browserGetLinks();
  const text = browserGetText();
  const imageMap = buildImageMap();

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
    const re = new RegExp(escaped + '[\\s\\S]{0,250}?\\$(\\d[\\d,]+)', 'i');
    const m = text.match(re);
    if (!m) continue;

    const price = parseInt(m[1].replace(/,/g, ''));
    if (!price || price < 100 || price > 15000) continue;

    const section = m[0];

    // Beds — match "2br", "2 bed", "2bd", "2b/1b" patterns, cap at 10
    const isStudio = /studio/i.test(rawTitle) || /studio/i.test(section.slice(0, 80));
    let beds: number | null = null;
    if (isStudio) {
      beds = 0;
    } else {
      const bm =
        section.match(/\b(\d)\s*br\b/i) ||
        rawTitle.match(/\b(\d)\s*(?:br|bed(?:room)?s?)\b/i) ||
        section.match(/\b(\d)\s*b(?:ed(?:room)?s?)?\s*\/\s*\d/i) ||
        section.match(/\b(\d)\s*(?:bedroom|bed)\b/i);
      if (bm) {
        const n = parseInt(bm[1]);
        beds = n <= 10 ? n : null;
      }
    }

    // Sqft — 3-4 digit number followed by ft2/sqft
    const sqftMatch = section.match(/(\d{3,4})\s*(?:ft2|sq\s*ft|sqft)/i);
    const sqft = sqftMatch ? parseInt(sqftMatch[1]) : null;

    const amenities = detectAmenities(rawTitle + ' ' + section);
    const neighborhood = extractNeighborhood(section) || extractNeighborhood(rawTitle);
    const baths = parseBaths(section) ?? parseBaths(rawTitle);

    const title = rawTitle.replace(/^no\s+image\s*/i, '').trim() || rawTitle;

    // Look up image by post ID (most reliable) or full URL
    const postId = extractPostId(link.href);
    const image_url =
      (postId ? imageMap.get(postId) : null) ??
      imageMap.get(link.href) ??
      null;

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
      has_laundry: true, // URL filtered with laundry=1
      has_parking: amenities.has_parking,
      has_view: amenities.has_view,
      is_sublease: isSublease,
      platform: 'craigslist',
      image_url,
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
    // /apa = apartments only (no rooms, no subleases)
    const apaListings = await scrapeSearchPage(
      'https://sfbay.craigslist.org/search/sfc/apa?min_bedrooms=2&max_price=6000&sort=date&laundry=1&private_room=0',
      false
    );
    listings.push(...apaListings);
  } catch (err) {
    errors.push(`apartments: ${err instanceof Error ? err.message : String(err)}`);
  }
  // /sub (subleases) and /roo (rooms) intentionally excluded — apartments only

  const seen = new Set<string>();
  const deduped = listings.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  return { listings: deduped, error: errors.length > 0 ? errors.join('; ') : undefined };
}
