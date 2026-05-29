'use client';

import { useState, useEffect, useCallback } from 'react';
import { Listing } from '@/lib/types';
import ListingCard from './ListingCard';
import FilterBar from './FilterBar';

const SEEN_KEY = 'sf-housing-seen-listings';
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

function loadSeenIds(): Set<number> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<number>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

export default function ListingsGrid() {
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [newBanner, setNewBanner] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    setSeenIds(loadSeenIds());
  }, []);

  const fetchListings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const url = showAll ? '/api/listings?filtered=false' : '/api/listings';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { listings: Listing[] } = await res.json();

      setAllListings(prev => {
        const prevCount = prev.length;
        const newCount = data.listings.length;
        if (silent && newCount > prevCount) {
          const diff = newCount - prevCount;
          setNewBanner(`${diff} new listing${diff > 1 ? 's' : ''} found!`);
          setTimeout(() => setNewBanner(null), 8000);
        }
        setLastCount(newCount);
        return data.listings;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showAll]);

  // Initial load
  useEffect(() => {
    fetchListings(false);
  }, [fetchListings]);

  // Poll every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchListings(true), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchListings]);

  const handleSeen = (id: number) => {
    setSeenIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveSeenIds(next);
      return next;
    });
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  // Get unique platforms
  const platforms = [...new Set(allListings.map(l => l.platform))].sort();

  // Apply client-side sort + platform filter
  let displayed = [...allListings];

  if (selectedPlatforms.length > 0) {
    displayed = displayed.filter(l => selectedPlatforms.includes(l.platform));
  }

  if (sortBy === 'price_asc') {
    displayed.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    displayed.sort((a, b) => b.price - a.price);
  }
  // newest: already sorted by DB query

  if (loading && allListings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading listings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-400 font-medium mb-2">Error loading listings</p>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button
          onClick={() => fetchListings(false)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (allListings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <p className="text-slate-300 font-medium mb-2">No listings yet</p>
        <p className="text-slate-500 text-sm">Hit "Refresh Now" to scan all platforms for current listings.</p>
      </div>
    );
  }

  return (
    <div>
      {/* New listings banner */}
      {newBanner && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-green-400 font-medium text-sm">{newBanner}</span>
          </div>
          <button onClick={() => setNewBanner(null)} className="text-green-500/60 hover:text-green-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <FilterBar
        totalCount={allListings.length}
        filteredCount={displayed.length}
        onToggleFilter={setShowAll}
        showAll={showAll}
        sortBy={sortBy}
        onSortChange={setSortBy}
        platforms={platforms}
        selectedPlatforms={selectedPlatforms}
        onPlatformToggle={handlePlatformToggle}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayed.map(listing => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isSeen={seenIds.has(listing.id)}
            onSeen={handleSeen}
          />
        ))}
      </div>

      {displayed.length === 0 && allListings.length > 0 && (
        <div className="text-center py-16 text-slate-400">
          <p>No listings match current filters.</p>
          <button
            onClick={() => setSelectedPlatforms([])}
            className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Clear platform filters
          </button>
        </div>
      )}

      {/* Manual platforms section */}
      <div className="mt-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Check manually (login required)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="https://www.facebook.com/marketplace/sanfrancisco/propertyrentals"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border border-dashed border-slate-700 rounded-xl px-4 py-3 hover:border-slate-500 hover:bg-slate-800/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Facebook Marketplace SF</p>
              <p className="text-xs text-slate-500">Rentals &amp; rooms</p>
            </div>
            <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 ml-auto shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <a
            href="https://nextdoor.com/for_sale_and_free/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border border-dashed border-slate-700 rounded-xl px-4 py-3 hover:border-slate-500 hover:bg-slate-800/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Nextdoor</p>
              <p className="text-xs text-slate-500">Neighborhood rentals &amp; rooms</p>
            </div>
            <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 ml-auto shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      {/* Polling indicator */}
      <div className="mt-8 text-center text-xs text-slate-600">
        Auto-refreshes every 5 minutes • {lastCount} listings in DB
      </div>
    </div>
  );
}
