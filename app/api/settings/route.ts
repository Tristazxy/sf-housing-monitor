import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/db';
import { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error('GET /api/settings error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: Partial<Settings> = await request.json();
    saveSettings(body);
    const updated = getSettings();
    return NextResponse.json(updated);
  } catch (err) {
    console.error('POST /api/settings error:', err);
    return NextResponse.json(
      { error: 'Failed to save settings', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
