'use client';

import { useState } from 'react';
import { Listing } from '@/lib/types';
import { formatDistanceToNow } from '@/lib/utils';

interface ListingCardProps {
  listing: Listing;
  isSeen: boolean;
  onSeen: (id: number) => void;
  onSaveToggle?: (id: number, isSaved: boolean) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  craigslist: 'bg-purple-900/50 text-purple-300 border border-purple-700',
  zillow: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  'apartments.com': 'bg-green-900/50 text-green-300 border border-green-700',
  hotpads: 'bg-orange-900/50 text-orange-300 border border-orange-700',
  padmapper: 'bg-pink-900/50 text-pink-300 border border-pink-700',
};

const PLATFORM_LABELS: Record<string, string> = {
  craigslist: 'Craigslist',
  zillow: 'Zillow',
  'apartments.com': 'Apartments.com',
  hotpads: 'HotPads',
  padmapper: 'PadMapper',
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function ListingCard({ listing, isSeen, onSeen, onSaveToggle }: ListingCardProps) {
  const [saved, setSaved] = useState(listing.is_saved);
  const [saving, setSaving] = useState(false);
  const isNew = listing.is_new;
  const platformColor = PLATFORM_COLORS[listing.platform] ?? 'bg-slate-700 text-slate-300';
  const platformLabel = PLATFORM_LABELS[listing.platform] ?? listing.platform;

  const postedAgo = listing.posted_at
    ? formatDistanceToNow(new Date(listing.posted_at))
    : listing.scraped_at
    ? formatDistanceToNow(new Date(listing.scraped_at))
    : null;

  const handleClick = () => {
    onSeen(listing.id);
    window.open(listing.url, '_blank', 'noopener,noreferrer');
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}/save`, { method: 'POST' });
      if (res.ok) {
        const data: { is_saved: boolean } = await res.json();
        setSaved(data.is_saved);
        onSaveToggle?.(listing.id, data.is_saved);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`relative group bg-slate-800 rounded-xl overflow-hidden border transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 cursor-pointer ${
        isSeen ? 'border-slate-700 opacity-80' : 'border-slate-600'
      }`}
    >
      {/* Image */}
      <div className="relative h-44 bg-slate-700 overflow-hidden">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        )}

        {/* NEW badge */}
        {isNew && !isSeen && (
          <div className="absolute top-2 left-2">
            <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-md">
              NEW
            </span>
          </div>
        )}

        {/* Sublease badge */}
        {listing.is_sublease && (
          <div className="absolute top-2 right-2">
            <span className="bg-yellow-500/90 text-yellow-900 text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
              Sublease
            </span>
          </div>
        )}

        {/* Seen overlay */}
        {isSeen && (
          <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
            <span className="text-slate-400 text-xs font-medium">Viewed</span>
          </div>
        )}

        {/* Save / heart button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-lg ${
            saved
              ? 'bg-red-500 text-white'
              : 'bg-slate-900/70 text-slate-300 hover:bg-slate-700/90 hover:text-red-400'
          }`}
          title={saved ? 'Remove from saved' : 'Save listing'}
        >
          <svg className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Price + Platform */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="text-2xl font-bold text-white leading-none">
            {formatPrice(listing.price)}
            <span className="text-sm font-normal text-slate-400">/mo</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${platformColor}`}>
            {platformLabel}
          </span>
        </div>

        {/* Title / Address */}
        <p className="text-slate-200 text-sm font-medium mb-1 line-clamp-1" title={listing.title}>
          {listing.title}
        </p>

        {/* Neighborhood */}
        {listing.neighborhood && (
          <p className="text-slate-400 text-xs mb-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {listing.neighborhood}
          </p>
        )}

        {/* Beds / Baths / Sqft */}
        <div className="flex items-center gap-3 text-slate-300 text-xs mb-3">
          {listing.beds !== null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 6h18M3 18h18" />
              </svg>
              {listing.beds === 0 ? 'Studio' : `${listing.beds} bed`}
            </span>
          )}
          {listing.baths !== null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {listing.baths} bath
            </span>
          )}
          {listing.sqft !== null && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              {listing.sqft.toLocaleString()} sqft
            </span>
          )}
        </div>

        {/* Amenity badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {listing.has_laundry && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                <circle cx="12" cy="12" r="4" strokeWidth="2" />
              </svg>
              Laundry
            </span>
          )}
          {listing.has_parking && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                <path d="M8 15V9h5a3 3 0 010 6H8z" strokeWidth="2" />
              </svg>
              Parking
            </span>
          )}
          {listing.has_view && (
            <span className="inline-flex items-center gap-1 text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </span>
          )}
          {listing.floor !== null && listing.floor >= 5 && (
            <span className="inline-flex items-center gap-1 text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 rounded-full">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              Floor {listing.floor}
            </span>
          )}
        </div>

        {/* Footer: date + link */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-700">
          <span className="text-slate-500 text-xs">
            {postedAgo ? `${postedAgo} ago` : 'Recently posted'}
          </span>
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            View listing
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
