export interface Listing {
  id: number;
  url: string;
  title: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  address: string | null;
  neighborhood: string | null;
  floor: number | null;
  has_laundry: boolean;
  has_parking: boolean;
  has_view: boolean;
  is_sublease: boolean;
  platform: string;
  image_url: string | null;
  description: string | null;
  posted_at: string | null;
  scraped_at: string;
  is_new: boolean;
  is_saved: boolean;
}

export interface Settings {
  price_min: number;
  price_max: number;
  beds_min: number;
  baths_min: number;
  require_laundry: boolean;
  require_parking: boolean;
  require_high_floor: boolean;
  require_view: boolean;
  neighborhoods: string[];
  accept_subleases: boolean;
  scrape_interval: number; // minutes
}

export const DEFAULT_SETTINGS: Settings = {
  price_min: 0,
  price_max: 4000,
  beds_min: 0,
  baths_min: 1,
  require_laundry: true,
  require_parking: false,
  require_high_floor: true,
  require_view: true,
  neighborhoods: [],
  accept_subleases: true,
  scrape_interval: 30,
};

export const SF_NEIGHBORHOODS = [
  'SOMA',
  'Mission District',
  'Castro',
  'Noe Valley',
  'Pacific Heights',
  'Marina',
  'North Beach',
  'Financial District',
  'Tenderloin',
  'Hayes Valley',
  'Lower Haight',
  'Upper Haight',
  'Inner Sunset',
  'Outer Sunset',
  'Inner Richmond',
  'Outer Richmond',
  'Potrero Hill',
  'Bernal Heights',
  'Glen Park',
  'Excelsior',
  'Bayview',
  'Dogpatch',
  'Russian Hill',
  'Nob Hill',
  'Chinatown',
  'Japantown',
  'Western Addition',
  'Fillmore',
  'Cole Valley',
  'Duboce Triangle',
  'Eureka Valley',
  'Twin Peaks',
  'Diamond Heights',
  'Visitacion Valley',
  'Crocker Amazon',
  'Ingleside',
  'West Portal',
  'Forest Hill',
  'Lakeshore',
  'Sunset District',
  'Presidio Heights',
  'Cow Hollow',
  'Embarcadero',
  'Rincon Hill',
  'South Beach',
  'Mission Bay',
  'Treasure Island',
];

export interface ScrapeResult {
  platform: string;
  listings: Omit<Listing, 'id' | 'scraped_at' | 'is_new'>[];
  error?: string;
  count: number;
}
