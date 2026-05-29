import { NextRequest, NextResponse } from 'next/server';
import { getListings, getSettings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const applyFilters = searchParams.get('filtered') !== 'false';

    let filters = {};
    if (applyFilters) {
      const settings = getSettings();
      filters = {
        price_min: settings.price_min > 0 ? settings.price_min : undefined,
        price_max: settings.price_max,
        beds_min: settings.beds_min,
        baths_min: settings.baths_min,
        require_laundry: settings.require_laundry,
        require_parking: settings.require_parking,
        require_high_floor: settings.require_high_floor,
        require_view: settings.require_view,
        neighborhoods: settings.neighborhoods.length > 0 ? settings.neighborhoods : undefined,
        accept_subleases: settings.accept_subleases,
      };
    }

    const limit = parseInt(searchParams.get('limit') ?? '200');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const listings = getListings({ ...filters, limit, offset });

    return NextResponse.json({ listings, total: listings.length });
  } catch (err) {
    console.error('GET /api/listings error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch listings', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
