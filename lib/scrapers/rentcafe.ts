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
    'South Beach', 'Mission Bay', 'Rincon Hill', 'Glen Park',
  ];
  for (const n of sfNeighborhoods) {
    if (text.includes(n)) return n;
  }
  return null;
}

export async function scrapeRentCafe(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const url = 'https://www.rentcafe.com/apartments-for-rent/us/ca/san-francisco/?Beds=2&PriceMax=6000&WasherDryer=1';
    const html = browserGetHtml(url);
    const $ = cheerio.load(html);

    // RentCafe embeds data in script tags or __NEXT_DATA__
    const scriptContent = $('script#__NEXT_DATA__').text();
    if (scriptContent) {
      const data = JSON.parse(scriptContent);
      const props = data?.props?.pageProps ?? {};
      const items = props?.listings ?? props?.data ?? props?.apartments ?? [];

      for (const item of (Array.isArray(items) ? items : []).slice(0, 60) as Record<string, unknown>[]) {
        const price = parseInt(String(item.MinRent ?? item.Price ?? item.price ?? '0').replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) continue;

        const propertyUrl = String(item.PropertyURL ?? item.url ?? '');
        const listingUrl = propertyUrl.startsWith('http')
          ? propertyUrl
          : propertyUrl
          ? `https://www.rentcafe.com${propertyUrl}`
          : null;
        if (!listingUrl) continue;

        const address = String(item.Address ?? item.StreetAddress ?? item.street ?? '');
        const title = String(item.PropertyName ?? item.Name ?? address ?? 'SF Rental');

        listings.push({
          url: listingUrl,
          title,
          price,
          beds: item.Beds != null ? parseFloat(String(item.Beds)) : null,
          baths: item.Baths != null ? parseFloat(String(item.Baths)) : null,
          sqft: item.MinSqFt != null ? parseInt(String(item.MinSqFt)) : null,
          address: address || null,
          neighborhood: extractNeighborhood(`${item.Neighborhood ?? ''} ${title} ${address}`),
          floor: null,
          has_laundry: true, // URL filtered with WasherDryer=1
          has_parking: /parking|garage/i.test(String(item.Amenities ?? '')),
          has_view: /view|panoramic/i.test(String(item.Amenities ?? item.Description ?? '')),
          is_sublease: false,
          platform: 'rentcafe',
          image_url: String(item.Photo ?? item.ImageURL ?? item.image ?? '') || null,
          description: item.Description ? String(item.Description).slice(0, 500) : null,
          posted_at: null,
        });
      }
    }

    // DOM fallback
    if (listings.length === 0) {
      $('.property-card, [class*="PropertyCard"], .listing-item').each((_, el) => {
        const $el = $(el);
        const priceText = $el.find('[class*="price"], [class*="rent"]').first().text();
        const price = parseInt(priceText.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) return;

        const title = $el.find('[class*="property-name"], [class*="title"], h2, h3').first().text().trim() || 'SF Rental';
        const href = $el.find('a[href*="rentcafe.com"]').first().attr('href') ?? $el.find('a').first().attr('href');
        if (!href) return;

        const listingUrl = href.startsWith('http') ? href : `https://www.rentcafe.com${href}`;
        const imgUrl = $el.find('img').first().attr('src') ?? null;
        const detailText = $el.text();
        const bedsMatch = detailText.match(/(\d+)\s*(?:bd|bed|BR)/i);
        const bathsMatch = detailText.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|BA)/i);

        listings.push({
          url: listingUrl,
          title,
          price,
          beds: bedsMatch ? parseInt(bedsMatch[1]) : null,
          baths: bathsMatch ? parseFloat(bathsMatch[1]) : null,
          sqft: null,
          address: null,
          neighborhood: extractNeighborhood(title),
          floor: null,
          has_laundry: true,
          has_parking: false,
          has_view: false,
          is_sublease: false,
          platform: 'rentcafe',
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
