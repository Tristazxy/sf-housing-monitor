import { NextResponse } from 'next/server';
import { runAllScrapers, deduplicateListings } from '@/lib/scrapers/index';
import { upsertListings } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  try {
    console.log('[scrape] Starting all scrapers...');
    const startTime = Date.now();

    const results = await runAllScrapers();
    const allListings = deduplicateListings(results);

    console.log(`[scrape] Got ${allListings.length} unique listings across all platforms`);

    const newCount = upsertListings(allListings);
    const elapsed = Date.now() - startTime;

    const summary = results.map(r => ({
      platform: r.platform,
      count: r.count,
      error: r.error ?? null,
    }));

    console.log(`[scrape] Done in ${elapsed}ms, ${newCount} new listings`);

    return NextResponse.json({
      success: true,
      total: allListings.length,
      new: newCount,
      elapsed_ms: elapsed,
      sources: summary,
    });
  } catch (err) {
    console.error('[scrape] Fatal error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
