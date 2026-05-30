import * as cheerio from 'cheerio';
import { Listing } from '../types';
import { browserGetHtml } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new' | 'is_saved'>;

function detectAmenities(text: string): { has_laundry: boolean; has_parking: boolean; has_view: boolean; floor: number | null } {
  const lower = text.toLowerCase();
  return {
    has_laundry: /in.?unit laundry|washer.?dryer|w\/d/.test(lower),
    has_parking: /parking|garage|carport/.test(lower),
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

export async function scrapeApartments(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const url = 'https://www.apartments.com/san-francisco-ca/2-bedrooms-under-6000/?so=2&wr-dr=1';
    const html = browserGetHtml(url);
    const $ = cheerio.load(html);

    // Apartments.com uses article[data-listingid] for listings
    $('article[data-listingid]').each((_, el) => {
      const $el = $(el);
      const listingId = $el.attr('data-listingid');

      const titleEl = $el.find('.property-title, .js-placardTitle, [class*="title"]').first();
      const title = titleEl.text().trim();

      const priceEl = $el.find('.price-range, [class*="price"], .rent').first();
      const priceText = priceEl.text().replace(/[^0-9\-]/g, '');
      const prices = priceText.split('-').map(p => parseInt(p)).filter(p => !isNaN(p));
      const price = prices[0];

      if (!price || price === 0) return;

      const addressEl = $el.find('address, .property-address, [class*="address"]').first();
      const address = addressEl.text().trim() || null;

      const linkEl = $el.find('a[href*="apartments.com"]').first();
      const href = linkEl.attr('href');
      if (!href && !listingId) return;

      const listingUrl = href ?? `https://www.apartments.com/${listingId}/`;

      const imgEl = $el.find('img').first();
      const imageUrl = imgEl.attr('src') ?? imgEl.attr('data-src') ?? null;

      const detailText = $el.text();
      const bedsMatch = detailText.match(/(\d+)\s*(?:bd|bed|Bed)/);
      const bathsMatch = detailText.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|Bath)/);
      const sqftMatch = detailText.match(/([\d,]+)\s*(?:sq\s*ft|sqft)/i);

      const amenityText = $el.find('[class*="amenity"], [class*="feature"]').text();
      const amenities = detectAmenities(`${title} ${address ?? ''} ${amenityText}`);
      const neighborhood = extractNeighborhood(`${title} ${address ?? ''}`);

      listings.push({
        url: listingUrl,
        title: title || address || 'SF Rental',
        price,
        beds: bedsMatch ? parseInt(bedsMatch[1]) : null,
        baths: bathsMatch ? parseFloat(bathsMatch[1]) : null,
        sqft: sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, '')) : null,
        address,
        neighborhood,
        floor: amenities.floor,
        has_laundry: true, // URL filtered with washer/dryer in unit
        has_parking: amenities.has_parking,
        has_view: amenities.has_view,
        is_sublease: false,
        platform: 'apartments.com',
        image_url: imageUrl && !imageUrl.includes('placeholder') ? imageUrl : null,
        description: null,
        posted_at: null,
      });
    });

    // Fallback: try JSON-LD data
    if (listings.length === 0) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).text());
          const items = Array.isArray(data) ? data : [data];
          for (const item of items) {
            if (item['@type'] === 'Apartment' || item['@type'] === 'ApartmentComplex') {
              const price = parseInt(item.offers?.price ?? item.offers?.lowPrice ?? '0');
              if (!price) continue;

              listings.push({
                url: item.url ?? url,
                title: item.name ?? 'SF Rental',
                price,
                beds: null,
                baths: null,
                sqft: null,
                address: item.address?.streetAddress ?? null,
                neighborhood: extractNeighborhood(item.address?.addressLocality ?? ''),
                floor: null,
                has_laundry: true, // URL filtered with washer/dryer in unit
                has_parking: false,
                has_view: false,
                is_sublease: false,
                platform: 'apartments.com',
                image_url: item.image ?? null,
                description: item.description?.slice(0, 500) ?? null,
                posted_at: null,
              });
            }
          }
        } catch {
          // ignore JSON parse errors
        }
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
