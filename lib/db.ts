import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Settings, DEFAULT_SETTINGS, Listing } from './types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'housing.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      beds REAL,
      baths REAL,
      sqft INTEGER,
      address TEXT,
      neighborhood TEXT,
      floor INTEGER,
      has_laundry INTEGER NOT NULL DEFAULT 0,
      has_parking INTEGER NOT NULL DEFAULT 0,
      has_view INTEGER NOT NULL DEFAULT 0,
      is_sublease INTEGER NOT NULL DEFAULT 0,
      platform TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      posted_at TEXT,
      scraped_at TEXT NOT NULL,
      is_new INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    );
  `);

  // Add is_saved column if it doesn't exist yet (migration)
  try {
    db.exec(`ALTER TABLE listings ADD COLUMN is_saved INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — ignore
  }

  // Purge any non-SF listings already in the DB
  const nonSFCities = [
    'Oakland', 'Berkeley', 'Emeryville', 'Alameda', 'San Leandro', 'Hayward',
    'Fremont', 'Union City', 'Newark', 'Milpitas',
    'San Jose', 'Santa Clara', 'Sunnyvale', 'Mountain View', 'Palo Alto',
    'Menlo Park', 'Redwood City', 'San Mateo', 'Burlingame', 'Millbrae',
    'South San Francisco', 'Brisbane', 'Daly City', 'Pacifica',
    'Sausalito', 'Tiburon', 'Corte Madera', 'San Rafael', 'Novato',
    'Walnut Creek', 'Concord', 'Livermore', 'Pleasanton', 'Dublin', 'San Ramon',
  ];
  for (const city of nonSFCities) {
    db.prepare(
      `DELETE FROM listings WHERE (address LIKE ? OR address LIKE ?) AND is_saved = 0`
    ).run(`%${city}, CA%`, `%${city},CA%`);
  }
}

export function getSettings(): Settings {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  const settings = { ...DEFAULT_SETTINGS };

  if (map.price_min !== undefined) settings.price_min = parseInt(map.price_min);
  if (map.price_max !== undefined) settings.price_max = parseInt(map.price_max);
  if (map.beds_min !== undefined) settings.beds_min = parseInt(map.beds_min);
  if (map.baths_min !== undefined) settings.baths_min = parseInt(map.baths_min);
  if (map.require_laundry !== undefined) settings.require_laundry = map.require_laundry === 'true';
  if (map.require_parking !== undefined) settings.require_parking = map.require_parking === 'true';
  if (map.require_high_floor !== undefined) settings.require_high_floor = map.require_high_floor === 'true';
  if (map.require_view !== undefined) settings.require_view = map.require_view === 'true';
  if (map.accept_subleases !== undefined) settings.accept_subleases = map.accept_subleases === 'true';
  if (map.scrape_interval !== undefined) settings.scrape_interval = parseInt(map.scrape_interval);
  if (map.neighborhoods !== undefined) {
    try {
      settings.neighborhoods = JSON.parse(map.neighborhoods);
    } catch {
      settings.neighborhoods = [];
    }
  }

  return settings;
}

export function saveSettings(settings: Partial<Settings>): void {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  const upsertMany = db.transaction((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      upsert.run(key, value);
    }
  });

  const entries: [string, string][] = [];
  for (const [key, val] of Object.entries(settings)) {
    if (Array.isArray(val)) {
      entries.push([key, JSON.stringify(val)]);
    } else {
      entries.push([key, String(val)]);
    }
  }

  upsertMany(entries);
}

export function getListings(filters?: {
  price_max?: number;
  price_min?: number;
  beds_min?: number;
  baths_min?: number;
  require_laundry?: boolean;
  require_parking?: boolean;
  require_high_floor?: boolean;
  require_view?: boolean;
  neighborhoods?: string[];
  accept_subleases?: boolean;
  limit?: number;
  offset?: number;
}): Listing[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters?.price_max) {
    conditions.push('price <= ?');
    params.push(filters.price_max);
  }
  if (filters?.price_min) {
    conditions.push('price >= ?');
    params.push(filters.price_min);
  }
  if (filters?.beds_min) {
    conditions.push('(beds IS NULL OR beds >= ?)');
    params.push(filters.beds_min);
  }
  if (filters?.baths_min) {
    conditions.push('(baths IS NULL OR baths >= ?)');
    params.push(filters.baths_min);
  }
  // Always require in-unit laundry
  conditions.push('has_laundry = 1');

  // Always exclude high-crime neighborhoods
  const EXCLUDED_NEIGHBORHOODS = ['Tenderloin', 'Civic', 'Van Ness', 'Visitacion Valley', 'Excelsior', 'Bayview'];
  const excludePlaceholders = EXCLUDED_NEIGHBORHOODS.map(() => '?').join(', ');
  conditions.push(`(neighborhood IS NULL OR neighborhood NOT IN (${excludePlaceholders}))`);
  params.push(...EXCLUDED_NEIGHBORHOODS);

  if (filters?.accept_subleases === false) {
    conditions.push('is_sublease = 0');
  }
  if (filters?.neighborhoods && filters.neighborhoods.length > 0) {
    const placeholders = filters.neighborhoods.map(() => '?').join(', ');
    conditions.push(`neighborhood IN (${placeholders})`);
    params.push(...filters.neighborhoods);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters?.limit ?? 200;
  const offset = filters?.offset ?? 0;

  const rows = db
    .prepare(`SELECT * FROM listings ${where} ORDER BY scraped_at DESC, posted_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[];

  return rows.map(row => ({
    ...row,
    has_laundry: Boolean(row.has_laundry),
    has_parking: Boolean(row.has_parking),
    has_view: Boolean(row.has_view),
    is_sublease: Boolean(row.is_sublease),
    is_new: Boolean(row.is_new),
    is_saved: Boolean(row.is_saved),
  })) as Listing[];
}

export function upsertListings(listings: Omit<Listing, 'id' | 'scraped_at' | 'is_new'>[]): number {
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO listings (url, title, price, beds, baths, sqft, address, neighborhood, floor,
      has_laundry, has_parking, has_view, is_sublease, platform, image_url, description,
      posted_at, scraped_at, is_new)
    VALUES (@url, @title, @price, @beds, @baths, @sqft, @address, @neighborhood, @floor,
      @has_laundry, @has_parking, @has_view, @is_sublease, @platform, @image_url, @description,
      @posted_at, @scraped_at, @is_new)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      price = excluded.price,
      beds = excluded.beds,
      baths = excluded.baths,
      sqft = excluded.sqft,
      address = excluded.address,
      neighborhood = excluded.neighborhood,
      floor = excluded.floor,
      has_laundry = excluded.has_laundry,
      has_parking = excluded.has_parking,
      has_view = excluded.has_view,
      is_sublease = excluded.is_sublease,
      image_url = COALESCE(excluded.image_url, listings.image_url),
      description = COALESCE(excluded.description, listings.description),
      scraped_at = excluded.scraped_at
  `);

  let inserted = 0;
  const insertMany = db.transaction((items: Omit<Listing, 'id' | 'scraped_at' | 'is_new'>[]) => {
    for (const item of items) {
      // Check if URL already exists
      const existing = db.prepare('SELECT id FROM listings WHERE url = ?').get(item.url);
      if (!existing) {
        inserted++;
      }
      insert.run({
        ...item,
        has_laundry: item.has_laundry ? 1 : 0,
        has_parking: item.has_parking ? 1 : 0,
        has_view: item.has_view ? 1 : 0,
        is_sublease: item.is_sublease ? 1 : 0,
        scraped_at: now,
        is_new: existing ? 0 : 1,
      });
    }
  });

  insertMany(listings);
  return inserted;
}

export function toggleSavedListing(id: number): boolean {
  const db = getDb();
  const row = db.prepare('SELECT is_saved FROM listings WHERE id = ?').get(id) as { is_saved: number } | undefined;
  if (!row) return false;
  const newVal = row.is_saved ? 0 : 1;
  db.prepare('UPDATE listings SET is_saved = ? WHERE id = ?').run(newVal, id);
  return Boolean(newVal);
}

export function getSavedListings(): Listing[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM listings WHERE is_saved = 1 ORDER BY scraped_at DESC').all() as Record<string, unknown>[];
  return rows.map(row => ({
    ...row,
    has_laundry: Boolean(row.has_laundry),
    has_parking: Boolean(row.has_parking),
    has_view: Boolean(row.has_view),
    is_sublease: Boolean(row.is_sublease),
    is_new: Boolean(row.is_new),
    is_saved: Boolean(row.is_saved),
  })) as Listing[];
}

export function getListingCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM listings').get() as { count: number };
  return row.count;
}

export function getNewListingCount(): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = db.prepare('SELECT COUNT(*) as count FROM listings WHERE scraped_at > ?').get(cutoff) as { count: number };
  return row.count;
}
