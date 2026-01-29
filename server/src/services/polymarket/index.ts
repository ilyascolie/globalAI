import axios from 'axios';
import NodeCache from 'node-cache';
import { geocoderService } from '../geocoder/index.js';
import type {
  Prediction,
  PredictionLocation,
  PredictionOutcome,
  PolymarketEvent,
  PolymarketMarket,
  PredictionFilters,
} from '../../types/index.js';

// Polymarket API endpoints
const POLYMARKET_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

// Cache predictions for 5 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const CACHE_KEY = 'polymarket_predictions';

export class PolymarketService {
  private lastFetchTime: Date | null = null;

  /**
   * Fetch all geographically-relevant predictions from Polymarket
   */
  async getPredictions(filters?: PredictionFilters): Promise<Prediction[]> {
    // Check cache first
    const cached = cache.get<Prediction[]>(CACHE_KEY);
    if (cached) {
      return this.applyFilters(cached, filters);
    }

    try {
      const predictions = await this.fetchAndProcessMarkets();
      cache.set(CACHE_KEY, predictions);
      this.lastFetchTime = new Date();
      return this.applyFilters(predictions, filters);
    } catch (error) {
      console.error('Error fetching Polymarket data:', error);
      // Return cached data if available, even if stale
      const staleCache = cache.get<Prediction[]>(CACHE_KEY);
      if (staleCache) {
        return this.applyFilters(staleCache, filters);
      }
      throw error;
    }
  }

  /**
   * Fetch markets from Polymarket API and process them
   */
  private async fetchAndProcessMarkets(): Promise<Prediction[]> {
    const predictions: Prediction[] = [];

    try {
      // Fetch events (grouped markets)
      const eventsResponse = await axios.get<PolymarketEvent[]>(
        `${POLYMARKET_API_BASE}/events`,
        {
          params: {
            active: true,
            closed: false,
            limit: 100,
          },
          timeout: 10000,
        }
      );

      const events = eventsResponse.data || [];

      for (const event of events) {
        // Process each market in the event
        for (const market of event.markets || []) {
          const prediction = this.processMarket(market, event);
          if (prediction) {
            predictions.push(prediction);
          }
        }
      }

      // Also fetch individual markets
      const marketsResponse = await axios.get<PolymarketMarket[]>(
        `${POLYMARKET_API_BASE}/markets`,
        {
          params: {
            active: true,
            closed: false,
            limit: 100,
          },
          timeout: 10000,
        }
      );

      const markets = marketsResponse.data || [];

      for (const market of markets) {
        // Skip if already processed as part of an event
        if (predictions.find((p) => p.marketId === market.id)) {
          continue;
        }
        const prediction = this.processMarket(market);
        if (prediction) {
          predictions.push(prediction);
        }
      }
    } catch (error) {
      console.error('Polymarket API error:', error);
      // Continue with whatever we have
    }

    // Sort by volume (most liquid first)
    predictions.sort((a, b) => b.volume - a.volume);

    return predictions;
  }

  /**
   * Process a single market into a Prediction
   */
  private processMarket(
    market: PolymarketMarket,
    event?: PolymarketEvent
  ): Prediction | null {
    const question = market.question || event?.title || '';

    // Check if geographically relevant
    if (!geocoderService.isGeographicallyRelevant(question)) {
      return null;
    }

    // Extract locations
    const geoExtraction = geocoderService.extractLocations(question);
    if (geoExtraction.locations.length === 0) {
      return null;
    }

    // Parse outcomes and prices
    const outcomes = this.parseOutcomes(market);
    const primaryProbability = outcomes.length > 0 ? outcomes[0].probability : 0.5;

    // Parse volume
    const volume = parseFloat(market.volume || '0') || market.volumeNum || 0;

    // Parse end date
    const endDate = new Date(market.endDate || event?.endDate || Date.now() + 86400000);

    // Check if closing soon (< 24h)
    const closingSoon = endDate.getTime() - Date.now() < 24 * 60 * 60 * 1000;

    // Detect category
    const category = geocoderService.detectCategory(question);

    // Convert locations
    const locations: PredictionLocation[] = geoExtraction.locations.map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      confidence: loc.confidence,
      name: loc.name,
    }));

    return {
      marketId: market.id,
      question,
      probability: primaryProbability,
      volume,
      endDate,
      locations,
      category,
      url: `https://polymarket.com/event/${market.slug || market.id}`,
      outcomes,
      closingSoon,
    };
  }

  /**
   * Parse outcome names and probabilities from market data
   */
  private parseOutcomes(market: PolymarketMarket): PredictionOutcome[] {
    const outcomes: PredictionOutcome[] = [];

    try {
      const outcomeNames = market.outcomes ? JSON.parse(market.outcomes) : ['Yes', 'No'];
      const outcomePrices = market.outcomePrices
        ? JSON.parse(market.outcomePrices)
        : [0.5, 0.5];

      for (let i = 0; i < outcomeNames.length; i++) {
        outcomes.push({
          name: outcomeNames[i],
          probability: parseFloat(outcomePrices[i]) || 0.5,
        });
      }
    } catch {
      // Default to binary market
      outcomes.push({ name: 'Yes', probability: 0.5 });
      outcomes.push({ name: 'No', probability: 0.5 });
    }

    return outcomes;
  }

  /**
   * Apply filters to predictions
   */
  private applyFilters(
    predictions: Prediction[],
    filters?: PredictionFilters
  ): Prediction[] {
    if (!filters) {
      return predictions;
    }

    return predictions.filter((p) => {
      // Probability filter
      if (filters.minProbability !== undefined && p.probability < filters.minProbability) {
        return false;
      }
      if (filters.maxProbability !== undefined && p.probability > filters.maxProbability) {
        return false;
      }

      // Volume filter
      if (filters.minVolume !== undefined && p.volume < filters.minVolume) {
        return false;
      }

      // Category filter
      if (filters.categories && filters.categories.length > 0) {
        if (!filters.categories.includes(p.category)) {
          return false;
        }
      }

      // Closing soon filter
      if (filters.closingSoon !== undefined && p.closingSoon !== filters.closingSoon) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get a single prediction by market ID
   */
  async getPredictionById(marketId: string): Promise<Prediction | null> {
    const predictions = await this.getPredictions();
    return predictions.find((p) => p.marketId === marketId) || null;
  }

  /**
   * Get last fetch time
   */
  getLastFetchTime(): Date | null {
    return this.lastFetchTime;
  }

  /**
   * Force refresh cache
   */
  async refresh(): Promise<void> {
    cache.del(CACHE_KEY);
    await this.getPredictions();
  }
}

export const polymarketService = new PolymarketService();
