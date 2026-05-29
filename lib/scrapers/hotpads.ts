import * as cheerio from 'cheerio';
import { Listing } from '../types';
import { browserGetHtml } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

function detectAmenities(text: string): { has_laundry: boolean; has_parking: boolean; has_view: boolean; floor: number | null } {
  const lower = text.toLowerCase();
  return {
    has_laundry: /in.?unit laundry|washer.?dryer|w\/d/.test(lower),
    has_parking: /parking|garage/.test(lower),
    has_view: /bay view|city view|view/.test(lower),
    floor: null,
  };
}

function extractNeighborhood(text: string): string | null {
  const sfNeighborhoods = [
    'SOMA', 'Mission', 'Castro', 'Noe Valley', 'Pacific Heights', 'Marina',
    'North Beach', 'Financial District', 'Tenderloin', 'Hayes Valley',
    'Haight', 'Sunset', 'Richmond', 'Potrero', 'Bernal', 'Dogpatch',
    'Russian Hill', 'Nob Hill', 'Fillmore', 'Twin Peaks', 'Embarcadero',
    'South Beach', 'Mission Bay',
  ];
  for (const n of sfNeighborhoods) {
    if (text.includes(n)) return n;
  }
  return null;
}

export async function scrapeHotpads(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const apiUrl = 'https://hotpads.com/san-francisco-ca/apartments-for-rent?beds=1&maxPrice=4000&rental=true';

    const html = browserGetHtml(apiUrl);
    const $ = cheerio.load(html);

    // Try to find __NEXT_DATA__ or embedded JSON
    const scriptContent = $('script#__NEXT_DATA__').text();
    if (scriptContent) {
      const data = JSON.parse(scriptContent);

      // Navigate HotPads data structure
      const props = data?.props?.pageProps ?? {};
      const searchResults = props?.listings ?? props?.searchResults ?? props?.data?.listings ?? [];

      const items = Array.isArray(searchResults) ? searchResults : Object.values(searchResults);

      for (const item of (items as Record<string, unknown>[]).slice(0, 50)) {
        const priceStr = item.price ?? item.rentedPrice ?? item.minPrice;
        const price = parseInt(String(priceStr).replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) continue;

        const title = String(item.alias ?? item.street ?? (item.address as Record<string, unknown>)?.street ?? 'SF Rental');
        const listingUrl = item.url
          ? `https://hotpads.com${item.url}`
          : `https://hotpads.com/san-francisco-ca/apartments-for-rent`;

        const amenityText = [
          ...((item.amenities as string[]) ?? []),
          ...((item.features as string[]) ?? []),
          String(item.description ?? ''),
        ].join(' ');

        const amenities = detectAmenities(amenityText);
        const neighborhood = extractNeighborhood(
          `${item.neighborhood ?? ''} ${(item.address as Record<string, unknown>)?.city ?? ''} ${title}`
        );

        listings.push({
          url: listingUrl,
          title,
          price,
          beds: (item.beds ?? item.bedrooms ?? null) as number | null,
          baths: (item.baths ?? item.bathrooms ?? null) as number | null,
          sqft: (item.sqft ?? item.squareFeet ?? null) as number | null,
          address: String((item.address as Record<string, unknown>)?.street ?? title),
          neighborhood,
          floor: amenities.floor,
          has_laundry: amenities.has_laundry,
          has_parking: amenities.has_parking,
          has_view: amenities.has_view,
          is_sublease: false,
          platform: 'hotpads',
          image_url: ((item.photos as Array<Record<string, unknown>>)?.[0]?.url ?? item.imageUrl ?? null) as string | null,
          description: item.description ? String(item.description).slice(0, 500) : null,
          posted_at: (item.availableDate ?? item.listedDate ?? null) as string | null,
        });
      }
    }

    // DOM fallback
    if (listings.length === 0) {
      $('[data-testid="listing-card"], [class*="ListingCard"]').each((_, el) => {
        const $el = $(el);
        const priceText = $el.find('[class*="price"], [data-testid*="price"]').first().text();
        const price = parseInt(priceText.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) return;

        const title = $el.find('[class*="address"], [class*="street"]').first().text().trim() || 'SF Rental';
        const href = $el.find('a').first().attr('href');
        if (!href) return;

        const listingUrl = href.startsWith('http') ? href : `https://hotpads.com${href}`;
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
          has_laundry: false,
          has_parking: false,
          has_view: false,
          is_sublease: false,
          platform: 'hotpads',
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
