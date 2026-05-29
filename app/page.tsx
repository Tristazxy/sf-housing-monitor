import ListingsGrid from '@/components/ListingsGrid';
import RefreshButton from '@/components/RefreshButton';
import { getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const settings = getSettings();

  const activeCriteria = [
    `Up to $${settings.price_max.toLocaleString()}/mo`,
    settings.beds_min > 0 ? `${settings.beds_min}+ bed` : 'Studio/1bd OK',
    settings.baths_min > 0 ? `${settings.baths_min}+ bath` : null,
    settings.require_laundry ? 'In-unit laundry' : null,
    settings.require_view ? 'View required' : null,
    settings.require_high_floor ? 'High floor (5+)' : null,
    settings.require_parking ? 'Parking' : null,
    settings.accept_subleases ? 'Subleases OK' : null,
  ].filter(Boolean);

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">SF Rentals</h1>
          <p className="text-slate-400 text-sm">
            Live listings from Craigslist, Reddit, Zillow, Apartments.com, HotPads, and PadMapper
          </p>

          {/* Active criteria chips */}
          {activeCriteria.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {activeCriteria.map(c => (
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

      {/* Listings */}
      <ListingsGrid />
    </div>
  );
}
