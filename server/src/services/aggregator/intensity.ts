import { RawNewsItem, EventCategory } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

interface MergedEventData {
  canonicalItem: RawNewsItem;
  sourceCount: number;
  sources: string[];
}

// High-impact keywords that increase intensity
const INTENSITY_KEYWORDS: Record<string, number> = {
  // Extreme events
  breaking: 15,
  urgent: 12,
  emergency: 15,
  crisis: 12,
  'mass casualty': 20,
  massacre: 18,
  genocide: 20,
  'war crime': 18,

  // Scale indicators
  thousands: 8,
  millions: 12,
  billions: 15,
  nationwide: 10,
  worldwide: 12,
  global: 10,
  unprecedented: 10,
  historic: 8,
  'record-breaking': 8,

  // Severity indicators
  deadly: 12,
  fatal: 10,
  catastrophic: 15,
  devastating: 12,
  massive: 8,
  major: 6,
  severe: 8,
  critical: 10,

  // Immediacy indicators
  imminent: 10,
  immediate: 8,
  underway: 6,
  ongoing: 5,
  escalating: 8,
  intensifying: 8,

  // Impact indicators
  collapse: 10,
  explosion: 8,
  destruction: 10,
  shutdown: 6,
  blockade: 8,
};

export class IntensityService {
  private readonly sourceCountWeight: number;
  private readonly toneWeight: number;
  private readonly recencyDecayHours: number;
  private readonly categoryMultipliers: Record<string, number>;

  constructor() {
    this.sourceCountWeight = config.intensity.sourceCountWeight;
    this.toneWeight = config.intensity.toneWeight;
    this.recencyDecayHours = config.intensity.recencyDecayHours;
    this.categoryMultipliers = config.intensity.categoryMultipliers;
  }

  /**
   * Calculate intensity score for a merged event
   *
   * Formula:
   * intensity = (
   *   sourceCount * sourceCountWeight +
   *   abs(gdeltTone) * toneWeight +
   *   keywordScore +
   *   recencyBonus
   * ) * categoryMultiplier
   *
   * Normalized to 0-100 range
   */
  calculateIntensity(event: MergedEventData, category: EventCategory): number {
    const item = event.canonicalItem;

    // 1. Source count score (more sources = bigger story)
    const sourceScore = Math.min(event.sourceCount, 10) * this.sourceCountWeight;

    // 2. GDELT tone score (stronger sentiment = more significant)
    let toneScore = 0;
    if (item.gdeltTone !== undefined) {
      toneScore = Math.abs(item.gdeltTone) * this.toneWeight;
    }

    // 3. Keyword analysis score
    const keywordScore = this.analyzeKeywords(item);

    // 4. Recency bonus (decays over 24 hours)
    const recencyBonus = this.calculateRecencyBonus(item.timestamp);

    // 5. Category multiplier
    const categoryMultiplier = this.categoryMultipliers[category] || 1.0;

    // Calculate raw intensity
    let rawIntensity = (sourceScore + toneScore + keywordScore + recencyBonus) * categoryMultiplier;

    // Normalize to 0-100 scale
    // Max theoretical score: ~200 (10*20 + 10*10 + 50 + 20) * 1.5 = ~300
    const maxExpected = 150;
    const normalizedIntensity = Math.min(100, Math.round((rawIntensity / maxExpected) * 100));

    logger.debug(
      `Intensity for "${item.title.substring(0, 40)}...": ` +
        `sources=${sourceScore.toFixed(1)}, tone=${toneScore.toFixed(1)}, ` +
        `keywords=${keywordScore.toFixed(1)}, recency=${recencyBonus.toFixed(1)}, ` +
        `multiplier=${categoryMultiplier}, final=${normalizedIntensity}`
    );

    return normalizedIntensity;
  }

  private analyzeKeywords(item: RawNewsItem): number {
    const text = `${item.title} ${item.summary || ''}`.toLowerCase();
    let score = 0;

    for (const [keyword, weight] of Object.entries(INTENSITY_KEYWORDS)) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);

      if (matches) {
        score += weight * matches.length;
      }
    }

    // Cap keyword score
    return Math.min(score, 50);
  }

  private calculateRecencyBonus(timestamp: Date): number {
    const now = Date.now();
    const eventTime = timestamp.getTime();
    const hoursAgo = (now - eventTime) / (1000 * 60 * 60);

    if (hoursAgo < 0) {
      // Future timestamp (data error), no bonus
      return 0;
    }

    if (hoursAgo <= 1) {
      // Within last hour: full bonus
      return 20;
    } else if (hoursAgo <= this.recencyDecayHours) {
      // Linear decay over 24 hours
      return 20 * (1 - hoursAgo / this.recencyDecayHours);
    }

    // Older than decay window: no bonus
    return 0;
  }

  // Recalculate intensity for existing events (for periodic updates)
  recalculateIntensity(
    event: { sourceCount: number; gdeltTone?: number; timestamp: Date; title: string; summary?: string },
    category: EventCategory
  ): number {
    const mockMergedEvent: MergedEventData = {
      canonicalItem: {
        title: event.title,
        summary: event.summary,
        url: '',
        timestamp: event.timestamp,
        source: '',
        gdeltTone: event.gdeltTone,
      },
      sourceCount: event.sourceCount,
      sources: [],
    };

    return this.calculateIntensity(mockMergedEvent, category);
  }

  // Batch calculate intensities
  calculateBatch(
    events: MergedEventData[],
    categoryFn: (item: RawNewsItem) => EventCategory
  ): Map<MergedEventData, number> {
    const results = new Map<MergedEventData, number>();

    for (const event of events) {
      const category = categoryFn(event.canonicalItem);
      const intensity = this.calculateIntensity(event, category);
      results.set(event, intensity);
    }

    return results;
  }

  // Get intensity thresholds for UI display
  getIntensityThresholds(): { low: number; medium: number; high: number; critical: number } {
    return {
      low: 25,
      medium: 50,
      high: 75,
      critical: 90,
    };
  }

  // Describe intensity level
  describeIntensity(intensity: number): string {
    const thresholds = this.getIntensityThresholds();

    if (intensity >= thresholds.critical) {
      return 'critical';
    } else if (intensity >= thresholds.high) {
      return 'high';
    } else if (intensity >= thresholds.medium) {
      return 'medium';
    } else if (intensity >= thresholds.low) {
      return 'low';
    }
    return 'minimal';
  }
}

export const intensityService = new IntensityService();
export default intensityService;
