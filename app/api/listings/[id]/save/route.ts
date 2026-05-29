import { NextRequest, NextResponse } from 'next/server';
import { toggleSavedListing } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const listingId = parseInt(id);
    if (isNaN(listingId)) {
      return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
    }
    const isSaved = toggleSavedListing(listingId);
    return NextResponse.json({ is_saved: isSaved });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to toggle saved', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
