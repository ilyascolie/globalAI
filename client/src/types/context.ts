// Context enrichment types

export interface WikipediaSummary {
  title: string;
  extract: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  pageUrl: string;
}

export interface CountryInfo {
  name: string;
  officialName: string;
  code: string; // ISO 3166-1 alpha-2
  flag: string; // Flag emoji or URL
  capital: string;
  population: number;
  region: string;
  subregion: string;
  languages: string[];
  currencies: string[];
  timezones: string[];
}

export interface HistoricalContext {
  regionName: string;
  eventCountPastMonth: number;
  eventCountPastWeek: number;
  dominantCategories: Array<{
    category: string;
    count: number;
  }>;
  significantEvents: Array<{
    id: string;
    title: string;
    timestamp: Date;
  }>;
}

export interface EventContext {
  locationSummary?: WikipediaSummary;
  entitySummaries: WikipediaSummary[];
  countryInfo?: CountryInfo;
  historicalContext?: HistoricalContext;
  loading: boolean;
  error?: string;
}
