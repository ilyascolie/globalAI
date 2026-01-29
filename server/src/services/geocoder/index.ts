import nlp from 'compromise';
import {
  COUNTRY_CENTROIDS,
  ORGANIZATION_LOCATIONS,
  MARKET_PATTERNS,
  CATEGORY_PATTERNS,
} from './locationMappings.js';
import type {
  GeoExtraction,
  ExtractedLocation,
  PredictionCategory,
} from '../../types/index.js';

export class GeocoderService {
  /**
   * Extract geographic locations from a market question
   */
  extractLocations(question: string): GeoExtraction {
    const locations: ExtractedLocation[] = [];
    let method: 'pattern' | 'nlp' | 'manual' = 'nlp';

    // First, try pattern matching (highest confidence)
    const patternLocations = this.matchPatterns(question);
    if (patternLocations.length > 0) {
      method = 'pattern';
      locations.push(...patternLocations);
    }

    // Then try organization-based matching
    const orgLocations = this.matchOrganizations(question);
    for (const loc of orgLocations) {
      if (!locations.find((l) => l.lat === loc.lat && l.lng === loc.lng)) {
        locations.push(loc);
      }
    }

    // Finally, try NLP extraction for remaining entities
    const nlpLocations = this.extractWithNLP(question);
    for (const loc of nlpLocations) {
      if (!locations.find((l) => l.lat === loc.lat && l.lng === loc.lng)) {
        locations.push(loc);
      }
    }

    // Calculate overall confidence
    const confidence =
      locations.length > 0
        ? locations.reduce((sum, loc) => sum + loc.confidence, 0) / locations.length
        : 0;

    return {
      locations,
      confidence,
      method: locations.length > 0 ? method : 'nlp',
    };
  }

  /**
   * Match predefined patterns for common market types
   */
  private matchPatterns(question: string): ExtractedLocation[] {
    const locations: ExtractedLocation[] = [];

    for (const { pattern, locations: locs } of MARKET_PATTERNS) {
      if (pattern.test(question)) {
        for (const loc of locs) {
          locations.push({
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            confidence: loc.confidence,
            type: 'country',
          });
        }
      }
    }

    return locations;
  }

  /**
   * Match organization mentions and return member locations
   */
  private matchOrganizations(question: string): ExtractedLocation[] {
    const locations: ExtractedLocation[] = [];
    const upperQuestion = question.toUpperCase();

    for (const [org, locs] of Object.entries(ORGANIZATION_LOCATIONS)) {
      if (upperQuestion.includes(org)) {
        // Only include first few member locations for organizations
        const orgLocs = locs.slice(0, 3);
        for (const loc of orgLocs) {
          locations.push({
            name: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            confidence: 0.75,
            type: 'organization',
          });
        }
      }
    }

    return locations;
  }

  /**
   * Use NLP to extract location entities from text
   */
  private extractWithNLP(question: string): ExtractedLocation[] {
    const locations: ExtractedLocation[] = [];
    const doc = nlp(question);

    // Extract place names
    const places = doc.places().out('array') as string[];

    for (const place of places) {
      const location = this.resolveLocation(place);
      if (location) {
        locations.push(location);
      }
    }

    // Also check for country demonyms and names in the text
    for (const [countryKey, data] of Object.entries(COUNTRY_CENTROIDS)) {
      const allNames = [countryKey, ...data.aliases];
      for (const name of allNames) {
        if (question.toLowerCase().includes(name.toLowerCase())) {
          // Avoid duplicates
          if (!locations.find((l) => l.lat === data.lat && l.lng === data.lng)) {
            locations.push({
              name: countryKey,
              lat: data.lat,
              lng: data.lng,
              confidence: 0.7,
              type: 'country',
            });
          }
          break;
        }
      }
    }

    return locations;
  }

  /**
   * Resolve a place name to coordinates
   */
  private resolveLocation(placeName: string): ExtractedLocation | null {
    const normalized = placeName.trim();

    // Check country centroids first
    for (const [countryKey, data] of Object.entries(COUNTRY_CENTROIDS)) {
      if (
        countryKey.toLowerCase() === normalized.toLowerCase() ||
        data.aliases.some((alias) => alias.toLowerCase() === normalized.toLowerCase())
      ) {
        return {
          name: countryKey,
          lat: data.lat,
          lng: data.lng,
          confidence: 0.8,
          type: 'country',
        };
      }
    }

    return null;
  }

  /**
   * Detect market category from question text
   */
  detectCategory(question: string): PredictionCategory {
    for (const { pattern, category } of CATEGORY_PATTERNS) {
      if (pattern.test(question)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Check if market is geographically relevant (has extractable locations)
   */
  isGeographicallyRelevant(question: string): boolean {
    const extraction = this.extractLocations(question);
    return extraction.locations.length > 0 && extraction.confidence > 0.3;
  }
}

export const geocoderService = new GeocoderService();
