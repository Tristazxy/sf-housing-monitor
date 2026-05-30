import * as cheerio from 'cheerio';
import { Listing } from '../types';
import { browserGetHtml } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new' | 'is_saved'>;

function extractNeighborhood(text: string): string | null {
  const sfNeighborhoods = [
    'SOMA', 'Mission', 'Castro', 'Noe Valley', 'Pacific Heights', 'Marina',
    'North Beach', 'Financial District', 'Tenderloin', 'Hayes Valley',
    'Haight', 'Sunset', 'Richmond', 'Potrero', 'Bernal', 'Dogpatch',
    'Russian Hill', 'Nob Hill', 'Fillmore', 'Twin Peaks', 'Embarcadero',
    'South Beach', 'Mission Bay', 'Rincon Hill', 'Glen Park', 'Cow Hollow',
  ];
  for (const n of sfNeighborhoods) {
    if (text.includes(n)) return n;
  }
  return null;
}

function detectAmenities(text: string): { has_laundry: boolean; has_parking: boolean; has_view: boolean } {
  const lower = text.toLowerCase();
  return {
    has_laundry: /in.?unit laundry|washer.?dryer|w\/d|in-unit w\/d/.test(lower),
    has_parking: /parking|garage/.test(lower),
    has_view: /bay view|city view|water view|panoramic|floor.to.ceiling/.test(lower),
  };
}

export async function scrapeRedfin(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const url = 'https://www.redfin.com/city/17151/CA/San-Francisco/apartments-for-rent?maxPrice=6000&minBedrooms=2&amenities=laundry_in_unit';
    const html = browserGetHtml(url);
    const $ = cheerio.load(html);

    // Redfin embeds data in __NEXT_DATA__
    const scriptContent = $('script#__NEXT_DATA__').text();
    if (scriptContent) {
      const data = JSON.parse(scriptContent);
      const homes =
        data?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ??
        data?.props?.pageProps?.homes ??
        [];

      for (const result of (homes as Record<string, unknown>[]).slice(0, 60)) {
        const price = result.price
          ? parseInt(String(result.price).replace(/[^0-9]/g, ''))
          : result.listingPrice
          ? parseInt(String(result.listingPrice).replace(/[^0-9]/g, ''))
          : 0;
        if (!price || price === 0) continue;

        const address = String(result.address ?? result.streetLine ?? '');
        const title = address || 'SF Rental';

        const detailUrl = result.url
          ? `https://www.redfin.com${result.url}`
          : result.listingId
          ? `https://www.redfin.com/city/17151/CA/San-Francisco/home/${result.listingId}`
          : null;
        if (!detailUrl) continue;

        const neighborhood = extractNeighborhood(`${result.neighborhood ?? ''} ${title}`);
        const amenities = detectAmenities(String(result.remarksAccessibility ?? result.amenities ?? ''));

        const imageUrl = result.primaryPhoto
          ? String(result.primaryPhoto)
          : (result.photos as Array<{ url?: string }>)?.[0]?.url ?? null;

        listings.push({
          url: detailUrl,
          title,
          price,
          beds: result.beds != null ? parseFloat(String(result.beds)) : null,
          baths: result.baths != null ? parseFloat(String(result.baths)) : null,
          sqft: result.sqFt != null ? parseInt(String(result.sqFt).replace(/,/g, '')) : null,
          address: address || null,
          neighborhood,
          floor: null,
          has_laundry: true, // URL filtered with amenities=laundry_in_unit
          has_parking: amenities.has_parking,
          has_view: amenities.has_view,
          is_sublease: false,
          platform: 'redfin',
          image_url: imageUrl as string | null,
          description: null,
          posted_at: null,
        });
      }
    }

    // DOM fallback — Redfin property cards
    if (listings.length === 0) {
      $('[data-rf-test-id="mapHomeCard"], .HomeCard, [class*="home-card"]').each((_, el) => {
        const $el = $(el);
        const priceText = $el.find('[data-rf-test-id="abp-price"], [class*="price"]').first().text();
        const price = parseInt(priceText.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) return;

        const title = $el.find('[data-rf-test-id="homecard-address"], address').first().text().trim() || 'SF Rental';
        const href = $el.find('a').first().attr('href');
        if (!href) return;

        const listingUrl = href.startsWith('http') ? href : `https://www.redfin.com${href}`;
        const imgUrl = $el.find('img').first().attr('src') ?? null;
        const detailText = $el.text();
        const bedsMatch = detailText.match(/(\d+)\s*(?:bd|bed)/i);
        const bathsMatch = detailText.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath)/i);

        listings.push({
          url: listingUrl,
          title,
          price,
          beds: bedsMatch ? parseInt(bedsMatch[1]) : null,
          baths: bathsMatch ? parseFloat(bathsMatch[1]) : null,
          sqft: null,
          address: title,
          neighborhood: extractNeighborhood(title),
          floor: null,
          has_laundry: true,
          has_parking: false,
          has_view: false,
          is_sublease: false,
          platform: 'redfin',
          image_url: imgUrl,
          description: null,
          posted_at: null,
        });
      });
    }

    return { listings };
  } catch (err) {
    return {
      listings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
