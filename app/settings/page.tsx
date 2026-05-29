'use client';

import { useState, useEffect } from 'react';
import { Settings, SF_NEIGHBORHOODS } from '@/lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(setSettings)
      .catch(err => setError(err.message));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleNeighborhood = (n: string) => {
    if (!settings) return;
    const current = settings.neighborhoods ?? [];
    setSettings({
      ...settings,
      neighborhoods: current.includes(n)
        ? current.filter(x => x !== n)
        : [...current, n],
    });
  };

  const selectAllNeighborhoods = () => {
    if (!settings) return;
    setSettings({ ...settings, neighborhoods: [...SF_NEIGHBORHOODS] });
  };

  const clearNeighborhoods = () => {
    if (!settings) return;
    setSettings({ ...settings, neighborhoods: [] });
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Search Settings</h1>
        <p className="text-slate-400 text-sm">Configure your ideal SF rental criteria. Listings are filtered at query time.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Price Range */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Price Range
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Min Price / month</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={settings.price_min}
                  onChange={e => setSettings({ ...settings, price_min: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Price / month</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={settings.price_max}
                  onChange={e => setSettings({ ...settings, price_max: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Beds / Baths */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h18M3 6h18M3 18h18" />
            </svg>
            Beds & Baths
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Min Bedrooms</label>
              <select
                value={settings.beds_min}
                onChange={e => setSettings({ ...settings, beds_min: parseInt(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value={0}>Any (Studio+)</option>
                <option value={1}>1+</option>
                <option value={2}>2+</option>
                <option value={3}>3+</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Min Bathrooms</label>
              <select
                value={settings.baths_min}
                onChange={e => setSettings({ ...settings, baths_min: parseFloat(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value={0}>Any</option>
                <option value={1}>1+</option>
                <option value={1.5}>1.5+</option>
                <option value={2}>2+</option>
              </select>
            </div>
          </div>
        </section>

        {/* Must-have Amenities */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Must-Have Amenities
          </h2>
          <div className="space-y-3">
            {[
              { key: 'require_laundry', label: 'In-unit laundry', desc: 'Washer/dryer inside the unit' },
              { key: 'require_parking', label: 'Parking', desc: 'Includes garage or dedicated parking' },
              { key: 'require_high_floor', label: 'High floor (5th+)', desc: 'Unit on 5th floor or higher' },
              { key: 'require_view', label: 'Bay or city view', desc: 'Listing mentions a view' },
            ].map(({ key, label, desc }) => (
              <label
                key={key}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors group"
              >
                <div>
                  <div className="text-sm font-medium text-white">{label}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
                <div className="relative ml-4">
                  <input
                    type="checkbox"
                    checked={settings[key as keyof Settings] as boolean}
                    onChange={e => setSettings({ ...settings, [key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-600 peer-checked:bg-blue-600 rounded-full transition-colors" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm" />
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Subleases */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Listing Types
          </h2>
          <label className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 cursor-pointer transition-colors">
            <div>
              <div className="text-sm font-medium text-white">Include subleases</div>
              <div className="text-xs text-slate-400">Show sublease listings from Craigslist</div>
            </div>
            <div className="relative ml-4">
              <input
                type="checkbox"
                checked={settings.accept_subleases}
                onChange={e => setSettings({ ...settings, accept_subleases: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-600 peer-checked:bg-blue-600 rounded-full transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm" />
            </div>
          </label>
        </section>

        {/* Scrape interval */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Auto-Scrape Interval
          </h2>
          <p className="text-xs text-slate-400 mb-3">How often to automatically scan for new listings (requires a cron job or process manager to trigger the scrape endpoint).</p>
          <div className="flex gap-2">
            {[15, 30, 60].map(minutes => (
              <button
                key={minutes}
                type="button"
                onClick={() => setSettings({ ...settings, scrape_interval: minutes })}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  settings.scrape_interval === minutes
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {minutes === 60 ? '1 hr' : `${minutes} min`}
              </button>
            ))}
          </div>
        </section>

        {/* Neighborhoods */}
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Neighborhoods
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearNeighborhoods}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear
              </button>
              <span className="text-slate-600">|</span>
              <button
                type="button"
                onClick={selectAllNeighborhoods}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                All SF
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {settings.neighborhoods.length === 0
              ? 'All neighborhoods (no filter)'
              : `${settings.neighborhoods.length} selected`}
          </p>
          <div className="flex flex-wrap gap-2">
            {SF_NEIGHBORHOODS.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => toggleNeighborhood(n)}
                className={`text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
                  settings.neighborhoods.includes(n)
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                    : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              saving
                ? 'bg-blue-600/50 text-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-95'
            }`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Saved!
            </span>
          )}

          {error && (
            <span className="text-sm text-red-400">{error}</span>
          )}
        </div>
      </form>
    </div>
  );
}
