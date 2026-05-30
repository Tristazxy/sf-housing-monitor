import * as cheerio from 'cheerio';
import { Listing } from '../types';
import { browserGetHtml } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new' | 'is_saved'>;

function detectAmenities(text: string): { has_laundry: boolean; has_parking: boolean; has_view: boolean; floor: number | null } {
  const lower = text.toLowerCase();
  return {
    has_laundry: /in.?unit laundry|washer.?dryer|w\/d|laundry in unit|in.?unit w\/d/.test(lower),
    has_parking: /parking|garage/.test(lower),
    has_view: /bay view|city view|water view|panoramic|floor.to.ceiling|views/.test(lower),
    floor: null,
  };
}

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

export async function scrapeZumper(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const url = 'https://www.zumper.com/apartments-for-rent/san-francisco-ca?min_price=0&max_price=6000&beds=2&amenities=laundry_in_unit';
    const html = browserGetHtml(url);
    const $ = cheerio.load(html);

    // Zumper uses __NEXT_DATA__ with listing data
    const scriptContent = $('script#__NEXT_DATA__').text();
    if (scriptContent) {
      const data = JSON.parse(scriptContent);
      const props = data?.props?.pageProps ?? {};

      // Zumper embeds listings in various paths
      const listingsData =
        props?.listings ??
        props?.initialReduxState?.listings?.paginatedListings?.listings ??
        props?.initialState?.listings?.listings ??
        [];

      const items = Array.isArray(listingsData) ? listingsData : Object.values(listingsData);

      for (const item of (items as Record<string, unknown>[]).slice(0, 60)) {
        const priceStr = item.price ?? item.listed_price ?? item.rent;
        const price = parseInt(String(priceStr ?? '0').replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) continue;

        const id = item.id ?? item.listingId;
        const slug = item.slug ?? item.url_slug;
        const listingUrl = slug
          ? `https://www.zumper.com/apartments-for-rent/${slug}`
          : id
          ? `https://www.zumper.com/l/p${id}`
          : null;
        if (!listingUrl) continue;

        const street = String(item.street ?? item.address ?? '');
        const city = String(item.city ?? '');
        const title = street || city || 'SF Rental';

        const amenityList = (item.amenities as string[] | undefined) ?? [];
        const amenityText = [...amenityList, String(item.description ?? '')].join(' ');
        const amenities = detectAmenities(amenityText);

        const neighborhood = extractNeighborhood(
          `${item.neighborhood ?? ''} ${item.area ?? ''} ${title}`
        );

        const photos = (item.photos ?? item.images) as Array<{ url?: string; src?: string }> | undefined;
        const imageUrl = photos?.[0]?.url ?? photos?.[0]?.src ?? null;

        listings.push({
          url: listingUrl,
          title,
          price,
          beds: item.beds != null ? parseFloat(String(item.beds)) : null,
          baths: item.baths != null ? parseFloat(String(item.baths)) : null,
          sqft: item.sqft != null ? parseInt(String(item.sqft)) : null,
          address: street || null,
          neighborhood,
          floor: null,
          has_laundry: true, // URL filtered with amenities=laundry_in_unit
          has_parking: amenities.has_parking,
          has_view: amenities.has_view,
          is_sublease: false,
          platform: 'zumper',
          image_url: imageUrl as string | null,
          description: item.description ? String(item.description).slice(0, 500) : null,
          posted_at: item.available_date ? String(item.available_date) : null,
        });
      }
    }

    // DOM fallback — Zumper listing cards
    if (listings.length === 0) {
      $('[data-tid="listing-card"], [class*="ListingCard"], article[class*="listing"]').each((_, el) => {
        const $el = $(el);
        const priceText = $el.find('[class*="price"], [data-tid*="price"]').first().text();
        const price = parseInt(priceText.replace(/[^0-9]/g, ''));
        if (isNaN(price) || price === 0) return;

        const title = $el.find('[class*="address"], [class*="street"]').first().text().trim() || 'SF Rental';
        const href = $el.find('a').first().attr('href');
        if (!href) return;

        const listingUrl = href.startsWith('http') ? href : `https://www.zumper.com${href}`;
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
          platform: 'zumper',
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
