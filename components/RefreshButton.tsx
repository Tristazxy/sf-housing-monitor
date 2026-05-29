'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ScrapeResult {
  success: boolean;
  total: number;
  new: number;
  elapsed_ms: number;
  sources: Array<{ platform: string; count: number; error: string | null }>;
  error?: string;
}

interface RefreshButtonProps {
  onRefreshComplete?: (result: ScrapeResult) => void;
  autoMode?: boolean;
  intervalMinutes?: number;
}

export default function RefreshButton({ onRefreshComplete, autoMode = false, intervalMinutes = 30 }: RefreshButtonProps) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ScrapeResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [auto, setAuto] = useState(autoMode);
  const [nextScanIn, setNextScanIn] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doScrape = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setLastResult(null);
    try {
      const response = await fetch('/api/scrape', { method: 'POST' });
      const result: ScrapeResult = await response.json();
      setLastResult(result);
      onRefreshComplete?.(result);
    } catch (err) {
      setLastResult({ success: false, total: 0, new: 0, elapsed_ms: 0, sources: [],
        error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setLoading(false);
    }
  }, [loading, onRefreshComplete]);

  // Auto-scrape loop
  useEffect(() => {
    if (!auto) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setNextScanIn(null);
      return;
    }
    const ms = intervalMinutes * 60 * 1000;
    let remaining = ms / 1000;
    setNextScanIn(remaining);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setNextScanIn(remaining);
    }, 1000);

    timerRef.current = setTimeout(async () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      await doScrape();
    }, ms);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [auto, intervalMinutes, doScrape]);

  const handleRefresh = () => doScrape();

  function fmtCountdown(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  return (
    <div className="relative flex items-center gap-2">
      {/* Auto-mode toggle */}
      <button
        onClick={() => setAuto(a => !a)}
        title={auto ? 'Disable auto-scrape' : 'Enable auto-scrape'}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
          auto
            ? 'bg-green-600/20 border border-green-500/40 text-green-400 hover:bg-green-600/30'
            : 'bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${auto ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
        {auto ? (nextScanIn !== null ? `Auto · ${fmtCountdown(nextScanIn)}` : 'Auto ON') : 'Auto OFF'}
      </button>

      <button
        onClick={handleRefresh}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
          loading
            ? 'bg-blue-600/50 text-blue-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 hover:shadow-blue-500/30 active:scale-95'
        }`}
      >
        <svg
          className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {loading ? 'Scanning...' : 'Refresh Now'}
      </button>

      {/* Result popover */}
      {lastResult && !loading && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {lastResult.success ? (
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              <span className="text-sm font-semibold text-white">
                {lastResult.success ? 'Scan Complete' : 'Scan Failed'}
              </span>
            </div>
            <button
              onClick={() => setLastResult(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {lastResult.success ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-white">{lastResult.total}</div>
                  <div className="text-xs text-slate-400">Total</div>
                </div>
                <div className="bg-green-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-400">{lastResult.new}</div>
                  <div className="text-xs text-slate-400">New</div>
                </div>
                <div className="bg-slate-700/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-white">{(lastResult.elapsed_ms / 1000).toFixed(1)}s</div>
                  <div className="text-xs text-slate-400">Time</div>
                </div>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full text-left text-xs text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <svg className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Source breakdown
              </button>

              {showDetails && (
                <div className="mt-2 space-y-1">
                  {lastResult.sources.map(s => (
                    <div key={s.platform} className="flex items-center justify-between text-xs">
                      <span className={`${s.error ? 'text-red-400' : 'text-slate-300'} capitalize`}>
                        {s.platform}
                      </span>
                      <span className={s.error ? 'text-red-400' : 'text-slate-400'}>
                        {s.error ? `Error` : `${s.count} listings`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-red-400">{lastResult.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
