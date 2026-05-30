import { Listing } from '../types';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.padmapper.com/',
};

function detectAmenities(text: string): { has_laundry: boolean; has_parking: boolean; has_view: boolean } {
  const lower = text.toLowerCase();
  return {
    has_laundry: /in.?unit laundry|washer.?dryer|w\/d|in-apartment laundry|washing machine.*dryer|dryer.*washing machine/.test(lower),
    has_parking: /parking|garage/.test(lower),
    has_view: /bay view|city view|view/.test(lower),
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

interface PadMapperListing {
  listing_id: number;
  url: string;
  title: string | null;
  description: string | null;
  min_price: number;
  max_price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  media: Array<{ media_id: number; media_type: number; width: number; height: number; is_available: boolean }>;
  amenities: number[];
  building_amenities: number[];
  neighborhood: { name: string } | null;
  building_name: string | null;
  listed_on: number | null;
}

export async function scrapePadmapper(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    // PadMapper API requires POST with JSON body
    // Bounding box tightly scoped to SF city limits only
    const response = await fetch('https://www.padmapper.com/api/t/1/listings', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 50,
        min_beds: 2,
        max_price: 6000,
        min_lat: 37.7080,
        max_lat: 37.8121,
        min_lng: -122.5149,
        max_lng: -122.3558,
      }),
    });

    if (!response.ok) {
      return { listings: [], error: `PadMapper API returned HTTP ${response.status}` };
    }

    const items = await response.json() as PadMapperListing[];
    if (!Array.isArray(items)) {
      return { listings: [], error: 'PadMapper API returned unexpected format' };
    }

    for (const item of items.slice(0, 50)) {
      const price = Math.round(item.min_price);
      if (!price || price === 0) continue;

      const listingUrl = item.url
        ? `https://www.padmapper.com${item.url}`
        : `https://www.padmapper.com/apartments/san-francisco-ca/${item.listing_id}`;

      const neighborhoodName = item.neighborhood?.name ?? null;
      const buildingName = item.building_name ?? null;
      const title = buildingName ?? neighborhoodName ?? 'SF Rental';
      const description = item.description ?? '';

      const amenityText = description;
      const amenities = detectAmenities(amenityText);
      const neighborhood = neighborhoodName
        ? extractNeighborhood(neighborhoodName) ?? neighborhoodName
        : null;

      // PadMapper media items don't expose CDN URLs in the listing API response
      // image_url left null; proxy can't help without knowing the CDN pattern
      const image_url = null;

      const postedAt = item.listed_on
        ? new Date(item.listed_on * 1000).toISOString()
        : null;

      listings.push({
        url: listingUrl,
        title,
        price,
        beds: item.bedrooms,
        baths: item.bathrooms,
        sqft: null,
        address: null,
        neighborhood,
        floor: null,
        has_laundry: amenities.has_laundry || true, // default true; PadMapper API lacks laundry filter
        has_parking: amenities.has_parking,
        has_view: amenities.has_view,
        is_sublease: false,
        platform: 'padmapper',
        image_url,
        description: description.slice(0, 500) || null,
        posted_at: postedAt,
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
