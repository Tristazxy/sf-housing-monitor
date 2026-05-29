'use client';

interface FilterBarProps {
  totalCount: number;
  filteredCount: number;
  onToggleFilter: (filterAll: boolean) => void;
  showAll: boolean;
  sortBy: 'newest' | 'price_asc' | 'price_desc';
  onSortChange: (sort: 'newest' | 'price_asc' | 'price_desc') => void;
  platforms: string[];
  selectedPlatforms: string[];
  onPlatformToggle: (platform: string) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  craigslist: 'Craigslist',
  zillow: 'Zillow',
  'apartments.com': 'Apartments.com',
  hotpads: 'HotPads',
  padmapper: 'PadMapper',
};

export default function FilterBar({
  totalCount,
  filteredCount,
  onToggleFilter,
  showAll,
  sortBy,
  onSortChange,
  platforms,
  selectedPlatforms,
  onPlatformToggle,
}: FilterBarProps) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Result count */}
        <div className="text-sm text-slate-400 mr-auto">
          <span className="font-semibold text-white">{filteredCount}</span>
          {filteredCount !== totalCount && (
            <span> of <span className="text-white">{totalCount}</span></span>
          )}{' '}
          listings
        </div>

        {/* Show all toggle */}
        <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg p-1">
          <button
            onClick={() => onToggleFilter(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              !showAll
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Filtered
          </button>
          <button
            onClick={() => onToggleFilter(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              showAll
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All
          </button>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => onSortChange(e.target.value as 'newest' | 'price_asc' | 'price_desc')}
          className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>

        {/* Platform filters */}
        {platforms.length > 0 && (
          <div className="flex items-center gap-1.5">
            {platforms.map(p => (
              <button
                key={p}
                onClick={() => onPlatformToggle(p)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium ${
                  selectedPlatforms.includes(p)
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-500 border border-slate-600/50 hover:text-slate-300'
                }`}
              >
                {PLATFORM_LABELS[p] ?? p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
