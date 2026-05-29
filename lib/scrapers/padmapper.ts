import * as cheerio from 'cheerio';
import { Listing } from '../types';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.padmapper.com/',
};

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

export async function scrapePadmapper(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    // PadMapper has a public API endpoint
    // Bounding box tightly scoped to SF city limits only
    const apiUrl = 'https://www.padmapper.com/api/t/1/listings?' +
      new URLSearchParams({
        'limit': '50',
        'min_beds': '1',
        'max_price': '4000',
        'min_lat': '37.7080',
        'max_lat': '37.8121',
        'min_lng': '-122.5149',
        'max_lng': '-122.3558',
        'cats': '0',
        'dogs': '0',
      }).toString();

    const response = await fetch(apiUrl, {
      headers: {
        ...HEADERS,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Fallback to HTML scrape
      return scrapePadmapperHtml();
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      return scrapePadmapperHtml();
    }

    const data = await response.json() as Record<string, unknown>;

    const items: Record<string, unknown>[] = Array.isArray(data)
      ? data as Record<string, unknown>[]
      : (data.data as Record<string, unknown>[]) ?? (data.listings as Record<string, unknown>[]) ?? [];

    for (const item of items.slice(0, 50)) {
      const priceStr = (item.price ?? item.min_price ?? item.rent) as string | number | undefined;
      const price = parseInt(String(priceStr ?? '0').replace(/[^0-9]/g, ''));
      if (isNaN(price) || price === 0) continue;

      const id = item.id ?? item.listing_id;
      const slug = item.slug ?? item.url_slug;
      const listingUrl = slug
        ? `https://www.padmapper.com/apartments/${slug}`
        : id
        ? `https://www.padmapper.com/apartments/${id}`
        : 'https://www.padmapper.com/apartments/san-francisco-ca';

      const street = (item.street ?? item.address) as string | undefined;
      const title = street ?? 'SF Rental';

      const amenityText = [
        ...(Array.isArray(item.amenities) ? item.amenities as string[] : []),
        String(item.description ?? ''),
      ].join(' ');

      const amenities = detectAmenities(amenityText);

      const lat = item.lat as number | undefined;
      const lng = item.lng as number | undefined;
      const neighborhood = extractNeighborhood(
        `${item.neighborhood ?? ''} ${item.city ?? ''} ${title}`
      );

      const photos = (item.photos ?? item.images) as Array<{ url?: string; src?: string }> | undefined;

      listings.push({
        url: listingUrl,
        title,
        price,
        beds: item.beds != null ? parseFloat(String(item.beds)) : null,
        baths: item.baths != null ? parseFloat(String(item.baths)) : null,
        sqft: item.sqft != null ? parseInt(String(item.sqft)) : null,
        address: street ?? null,
        neighborhood,
        floor: amenities.floor,
        has_laundry: amenities.has_laundry,
        has_parking: amenities.has_parking,
        has_view: amenities.has_view,
        is_sublease: false,
        platform: 'padmapper',
        image_url: photos?.[0]?.url ?? photos?.[0]?.src ?? null,
        description: item.description ? String(item.description).slice(0, 500) : null,
        posted_at: item.listed_at ? String(item.listed_at) : null,
      });

      void lat; void lng; // suppress unused warnings
    }

    return { listings };
  } catch (err) {
    return {
      listings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function scrapePadmapperHtml(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const url = 'https://www.padmapper.com/apartments/san-francisco-ca?min-bedrooms=1&max-price=4000';
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      return { listings: [], error: `PadMapper HTML returned HTTP ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // PadMapper embeds data in script tags
    $('script').each((_, el) => {
      const content = $(el).html() ?? '';
      if (!content.includes('"listings"') && !content.includes('"price"')) return;

      const jsonMatch = content.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});?\s*$/);
      if (!jsonMatch) return;

      try {
        const state = JSON.parse(jsonMatch[1]);
        const listingsData = state?.listings?.list ?? state?.search?.listings ?? [];

        for (const item of Object.values(listingsData).slice(0, 50)) {
          const listing = item as Record<string, unknown>;
          const price = parseInt(String(listing.price ?? '0').replace(/[^0-9]/g, ''));
          if (isNaN(price) || price === 0) continue;

          const id = listing.id;
          listings.push({
            url: `https://www.padmapper.com/apartments/${id}`,
            title: String(listing.street ?? 'SF Rental'),
            price,
            beds: listing.beds != null ? parseFloat(String(listing.beds)) : null,
            baths: listing.baths != null ? parseFloat(String(listing.baths)) : null,
            sqft: listing.sqft != null ? parseInt(String(listing.sqft)) : null,
            address: listing.street ? String(listing.street) : null,
            neighborhood: extractNeighborhood(String(listing.neighborhood ?? listing.street ?? '')),
            floor: null,
            has_laundry: false,
            has_parking: false,
            has_view: false,
            is_sublease: false,
            platform: 'padmapper',
            image_url: null,
            description: null,
            posted_at: null,
          });
        }
      } catch {
        // ignore
      }
    });

    return { listings };
  } catch (err) {
    return {
      listings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
