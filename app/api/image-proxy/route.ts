import { NextRequest, NextResponse } from 'next/server';

// Allowed image hostnames — prevents SSRF abuse
const ALLOWED_HOSTS = new Set([
  'images.craigslist.org',
  'pics.craigslist.org',
  'photos.zillowstatic.com',
  'ssl.cdn-redfin.com',
  'images1.apartments.com',
  'images2.apartments.com',
  'images3.apartments.com',
  'images4.apartments.com',
  'ap.rdcpix.com',
  'cdn.hotpads.com',
  'images.hotpads.com',
  'img.hotpads.com',
  'media.padmapper.com',
  'padmapper.com',
  'external-preview.redd.it',
  'preview.redd.it',
  'i.redd.it',
]);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
  }

  // Only allow https and known image hosts
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: 'Disallowed host' }, { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        // Spoof Referer so platforms don't block hotlink
        'Referer': `https://${parsed.hostname}/`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // cache 24h
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Proxy fetch failed', details: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
