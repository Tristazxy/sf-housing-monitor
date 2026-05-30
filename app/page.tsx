import ListingsGrid from '@/components/ListingsGrid';
import RefreshButton from '@/components/RefreshButton';
import { getSettings, getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const AUTO_PLATFORMS = [
  { key: 'craigslist',     label: 'Craigslist',     url: 'https://sfbay.craigslist.org/search/sfc/apa?min_bedrooms=2&max_price=6000&sort=date&laundry=1',  color: 'purple' },
  { key: 'reddit',         label: 'Reddit',          url: 'https://www.reddit.com/r/SFBayHousing/new/',                                                       color: 'orange' },
  { key: 'zillow',         label: 'Zillow',          url: 'https://www.zillow.com/san-francisco-ca/rentals/?price=0-6000&beds=2-2&amenities=laundryInUnit',   color: 'blue' },
  { key: 'apartments.com', label: 'Apartments.com',  url: 'https://www.apartments.com/san-francisco-ca/2-bedrooms-under-6000/?so=2&wr-dr=1',                  color: 'teal' },
  { key: 'hotpads',        label: 'HotPads',         url: 'https://hotpads.com/san-francisco-ca/apartments-for-rent?beds=2&maxPrice=6000&laundry=in-unit',     color: 'red' },
  { key: 'padmapper',      label: 'PadMapper',       url: 'https://www.padmapper.com/apartments/san-francisco-ca?min-bedrooms=2&max-price=6000',               color: 'green' },
  { key: 'zumper',         label: 'Zumper',          url: 'https://www.zumper.com/apartments-for-rent/san-francisco-ca?max_price=6000&beds=2&amenities=laundry_in_unit', color: 'indigo' },
  { key: 'redfin',         label: 'Redfin',          url: 'https://www.redfin.com/city/17151/CA/San-Francisco/apartments-for-rent?maxPrice=6000&minBedrooms=2', color: 'rose' },
  { key: 'rentcafe',       label: 'RentCafe',        url: 'https://www.rentcafe.com/apartments-for-rent/us/ca/san-francisco/?Beds=2&PriceMax=6000&WasherDryer=1', color: 'amber' },
] as const;

const MANUAL_PLATFORMS = [
  { label: 'Facebook Marketplace', url: 'https://www.facebook.com/marketplace/sanfrancisco/propertyrentals', note: 'Login required' },
  { label: 'Nextdoor',             url: 'https://nextdoor.com/for_sale_and_free/',                           note: 'Login required' },
] as const;

const COLOR_CLASSES: Record<string, string> = {
  purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  blue:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  teal:   'bg-teal-500/10 text-teal-400 border-teal-500/20',
  red:    'bg-red-500/10 text-red-400 border-red-500/20',
  green:  'bg-green-500/10 text-green-400 border-green-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  rose:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
  amber:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export default function HomePage() {
  const settings = getSettings();
  const db = getDb();

  // Per-platform listing counts from DB
  const platformCounts = db
    .prepare('SELECT platform, COUNT(*) as cnt FROM listings GROUP BY platform')
    .all() as { platform: string; cnt: number }[];
  const countMap: Record<string, number> = {};
  for (const { platform, cnt } of platformCounts) countMap[platform] = cnt;

  const activeCriteria = [
    `Up to $${settings.price_max.toLocaleString()}/mo`,
    settings.beds_min > 0 ? `${settings.beds_min}BR` : 'Studio OK',
    settings.baths_min > 0 ? `${settings.baths_min}BA` : null,
    settings.require_laundry ? 'In-unit laundry' : null,
    settings.require_view ? 'Views / glass windows' : null,
    settings.require_high_floor ? 'High floor (5+)' : null,
    settings.require_parking ? 'Parking' : null,
    settings.accept_subleases ? null : 'No subleases',
    settings.neighborhoods.length > 0
      ? `Near Ferry Bldg: ${settings.neighborhoods.slice(0, 3).join(', ')}${settings.neighborhoods.length > 3 ? '…' : ''}`
      : null,
    settings.lease_start ? `Move-in: ${settings.lease_start.charAt(0).toUpperCase() + settings.lease_start.slice(1)}` : null,
  ].filter(Boolean);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">SF Rentals</h1>

          {/* Active criteria chips */}
          {activeCriteria.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(activeCriteria as string[]).map(c => (
                <span
                  key={c}
                  className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-full"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          <RefreshButton autoMode={true} intervalMinutes={settings.scrape_interval} />
        </div>
      </div>

      {/* Sources grid */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Auto-scraped sources ({AUTO_PLATFORMS.length})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {AUTO_PLATFORMS.map(p => {
            const count = countMap[p.key] ?? 0;
            return (
              <a
                key={p.key}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col gap-1 border rounded-xl px-3 py-2.5 hover:opacity-80 transition-opacity ${COLOR_CLASSES[p.color]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold truncate">{p.label}</span>
                  <svg className="w-3 h-3 opacity-50 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <span className="text-xs opacity-60">
                  {count > 0 ? `${count} listing${count !== 1 ? 's' : ''}` : 'No data yet'}
                </span>
              </a>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          {MANUAL_PLATFORMS.map(p => (
            <a
              key={p.label}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between border border-dashed border-slate-700 rounded-xl px-3 py-2.5 hover:border-slate-500 hover:bg-slate-800/40 transition-colors group"
            >
              <div>
                <p className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">{p.label}</p>
                <p className="text-xs text-slate-600">{p.note}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>
      </div>

      {/* Listings */}
      <ListingsGrid />
    </div>
  );
}
