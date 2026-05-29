import { NextResponse } from 'next/server';
import { getSavedListings } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const listings = getSavedListings();
    return NextResponse.json({ listings });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch saved listings', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
