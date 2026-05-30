import * as cheerio from 'cheerio';
import { Listing } from '../types';
import { browserGetHtml } from '../browser-scraper';

type ListingRow = Omit<Listing, 'id' | 'scraped_at' | 'is_new'>;

function detectAmenities(text: string): { has_laundry: boolean; has_parking: boolean; has_view: boolean; floor: number | null } {
  const lower = text.toLowerCase();
  const has_laundry = /in.?unit laundry|washer.?dryer|w\/d in unit/.test(lower);
  const has_parking = /parking|garage|carport/.test(lower);
  const has_view = /bay view|city view|view/.test(lower);
  let floor: number | null = null;
  const floorMatch = lower.match(/(\d+)(?:st|nd|rd|th)?\s*floor/) || lower.match(/floor\s*(\d+)/);
  if (floorMatch) floor = parseInt(floorMatch[1]);
  return { has_laundry, has_parking, has_view, floor };
}

function extractNeighborhood(text: string): string | null {
  const sfNeighborhoods = [
    'SOMA', 'Mission', 'Castro', 'Noe Valley', 'Pacific Heights', 'Marina',
    'North Beach', 'Financial District', 'Tenderloin', 'Hayes Valley',
    'Haight', 'Sunset', 'Richmond', 'Potrero', 'Bernal', 'Dogpatch',
    'Russian Hill', 'Nob Hill', 'Chinatown', 'Japantown', 'Fillmore',
    'Twin Peaks', 'Embarcadero', 'South Beach', 'Mission Bay', 'Cow Hollow',
  ];
  for (const n of sfNeighborhoods) {
    if (text.includes(n)) return n;
  }
  return null;
}

export async function scrapeZillow(): Promise<{ listings: ListingRow[]; error?: string }> {
  const listings: ListingRow[] = [];

  try {
    const url = 'https://www.zillow.com/san-francisco-ca/rentals/?price=0-6000&beds=2-2&amenities=laundryInUnit';

    const html = browserGetHtml(url);
    const $ = cheerio.load(html);

    // Zillow embeds data in __NEXT_DATA__ script tag
    const scriptContent = $('script#__NEXT_DATA__').text();
    if (scriptContent) {
      const data = JSON.parse(scriptContent);
      const searchResults = data?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults ?? [];

      for (const result of searchResults.slice(0, 50)) {
        const price = result.unformattedPrice ?? result.price?.replace(/[^0-9]/g, '');
        if (!price) continue;

        const priceNum = parseInt(String(price).replace(/[^0-9]/g, ''));
        if (isNaN(priceNum) || priceNum === 0) continue;

        const title = result.address ?? result.streetAddress ?? 'SF Rental';
        const url_listing = result.detailUrl
          ? `https://www.zillow.com${result.detailUrl}`
          : result.hdpData?.homeInfo?.zpid
          ? `https://www.zillow.com/homedetails/${result.hdpData.homeInfo.zpid}_zpid/`
          : null;

        if (!url_listing) continue;

        const beds = result.beds ?? result.hdpData?.homeInfo?.bedrooms ?? null;
        const baths = result.baths ?? result.hdpData?.homeInfo?.bathrooms ?? null;
        const sqft = result.area ?? result.hdpData?.homeInfo?.livingArea ?? null;
        const imageUrl = result.imgSrc ?? result.carouselPhotos?.[0]?.url ?? null;
        const neighborhood = extractNeighborhood(title);
        const amenities = detectAmenities(title);

        listings.push({
          url: url_listing,
          title,
          price: priceNum,
          beds: beds ? parseFloat(beds) : null,
          baths: baths ? parseFloat(baths) : null,
          sqft: sqft ? parseInt(sqft) : null,
          address: result.address ?? null,
          neighborhood,
          floor: amenities.floor,
          has_laundry: true, // URL filtered with amenities=laundryInUnit
          has_parking: amenities.has_parking,
          has_view: amenities.has_view,
          is_sublease: false,
          platform: 'zillow',
          image_url: imageUrl,
          description: null,
          posted_at: null,
        });
      }
    }

    if (listings.length === 0) {
      // Try parsing listing cards directly
      $('[data-test="property-card"]').each((_, el) => {
        const priceEl = $(el).find('[data-test="property-card-price"]');
        const priceText = priceEl.text().replace(/[^0-9]/g, '');
        const price = parseInt(priceText);
        if (isNaN(price) || price === 0) return;

        const addressEl = $(el).find('address');
        const title = addressEl.text().trim() || 'SF Rental';

        const linkEl = $(el).find('a[href*="/homedetails/"]').first();
        const href = linkEl.attr('href');
        if (!href) return;

        const url_listing = href.startsWith('http') ? href : `https://www.zillow.com${href}`;
        const imgEl = $(el).find('img').first();
        const imageUrl = imgEl.attr('src') ?? null;

        const detailText = $(el).text();
        const bedsMatch = detailText.match(/(\d+)\s*(?:bd|bed)/i);
        const bathsMatch = detailText.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath)/i);

        listings.push({
          url: url_listing,
          title,
          price,
          beds: bedsMatch ? parseInt(bedsMatch[1]) : null,
          baths: bathsMatch ? parseFloat(bathsMatch[1]) : null,
          sqft: null,
          address: title,
          neighborhood: extractNeighborhood(title),
          floor: null,
          has_laundry: true, // URL filtered with amenities=laundryInUnit
          has_parking: false,
          has_view: false,
          is_sublease: false,
          platform: 'zillow',
          image_url: imageUrl,
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
