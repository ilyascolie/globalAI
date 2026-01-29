import fuzzball from 'fuzzball';
import { v4 as uuidv4 } from 'uuid';
import { RawNewsItem, NewsEvent, EventCategory } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

interface DeduplicationCandidate {
  item: RawNewsItem;
  normalizedTitle: string;
}

interface MergedEvent {
  canonicalItem: RawNewsItem;
  sources: string[];
  sourceUrls: string[];
  sourceCount: number;
}

export class DeduplicationService {
  private readonly fuzzyThreshold: number;
  private readonly radiusKm: number;
  private readonly timeWindowHours: number;

  constructor() {
    this.fuzzyThreshold = config.deduplication.fuzzyThreshold;
    this.radiusKm = config.deduplication.radiusKm;
    this.timeWindowHours = config.deduplication.timeWindowHours;
  }

  deduplicate(items: RawNewsItem[]): MergedEvent[] {
    if (items.length === 0) return [];

    logger.info(`Deduplicating ${items.length} news items...`);

    // Prepare candidates with normalized titles
    const candidates: DeduplicationCandidate[] = items.map((item) => ({
      item,
      normalizedTitle: this.normalizeTitle(item.title),
    }));

    const merged: MergedEvent[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < candidates.length; i++) {
      if (processed.has(i)) continue;

      const currentGroup: DeduplicationCandidate[] = [candidates[i]];
      processed.add(i);

      // Find all similar items
      for (let j = i + 1; j < candidates.length; j++) {
        if (processed.has(j)) continue;

        if (this.areSimilar(candidates[i], candidates[j])) {
          currentGroup.push(candidates[j]);
          processed.add(j);
        }
      }

      // Merge the group into a single event
      merged.push(this.mergeGroup(currentGroup));
    }

    logger.info(`Deduplicated to ${merged.length} unique events`);
    return merged;
  }

  private normalizeTitle(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private areSimilar(a: DeduplicationCandidate, b: DeduplicationCandidate): boolean {
    // Check time window
    const timeDiff = Math.abs(
      a.item.timestamp.getTime() - b.item.timestamp.getTime()
    );
    const hoursApart = timeDiff / (1000 * 60 * 60);

    if (hoursApart > this.timeWindowHours) {
      return false;
    }

    // Check location proximity if both have coordinates
    if (
      a.item.location?.lat !== undefined &&
      a.item.location?.lng !== undefined &&
      b.item.location?.lat !== undefined &&
      b.item.location?.lng !== undefined
    ) {
      const distance = this.haversineDistance(
        a.item.location.lat,
        a.item.location.lng,
        b.item.location.lat,
        b.item.location.lng
      );

      if (distance > this.radiusKm) {
        return false;
      }
    }

    // Fuzzy title matching
    const similarity = fuzzball.ratio(a.normalizedTitle, b.normalizedTitle) / 100;

    return similarity >= this.fuzzyThreshold;
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private mergeGroup(group: DeduplicationCandidate[]): MergedEvent {
    // Sort by quality indicators:
    // 1. Has location coordinates
    // 2. Has image
    // 3. Has summary
    // 4. Has GDELT tone
    // 5. Most recent
    const sorted = [...group].sort((a, b) => {
      const scoreA = this.qualityScore(a.item);
      const scoreB = this.qualityScore(b.item);
      return scoreB - scoreA;
    });

    const canonical = sorted[0].item;
    const sources = [...new Set(group.map((c) => c.item.source))];
    const sourceUrls = [...new Set(group.map((c) => c.item.url))];

    // Merge best attributes from all items
    let bestLocation = canonical.location;
    let bestImageUrl = canonical.imageUrl;
    let bestSummary = canonical.summary;
    let gdeltTone = canonical.gdeltTone;

    for (const candidate of group) {
      const item = candidate.item;

      // Prefer location with coordinates
      if (
        !bestLocation?.lat &&
        item.location?.lat !== undefined
      ) {
        bestLocation = item.location;
      }

      // Prefer any image
      if (!bestImageUrl && item.imageUrl) {
        bestImageUrl = item.imageUrl;
      }

      // Prefer longer summary
      if (
        item.summary &&
        (!bestSummary || item.summary.length > bestSummary.length)
      ) {
        bestSummary = item.summary;
      }

      // Take GDELT tone if available
      if (gdeltTone === undefined && item.gdeltTone !== undefined) {
        gdeltTone = item.gdeltTone;
      }
    }

    return {
      canonicalItem: {
        ...canonical,
        location: bestLocation,
        imageUrl: bestImageUrl,
        summary: bestSummary,
        gdeltTone,
      },
      sources,
      sourceUrls,
      sourceCount: sources.length,
    };
  }

  private qualityScore(item: RawNewsItem): number {
    let score = 0;

    if (item.location?.lat !== undefined) score += 100;
    if (item.imageUrl) score += 50;
    if (item.summary && item.summary.length > 50) score += 30;
    if (item.gdeltTone !== undefined) score += 20;

    // Prefer more recent items
    const ageMinutes = (Date.now() - item.timestamp.getTime()) / (1000 * 60);
    score -= Math.min(ageMinutes, 1000);

    return score;
  }

  // Convert merged events to NewsEvent format
  convertToNewsEvents(
    mergedEvents: MergedEvent[],
    classifyFn: (item: RawNewsItem) => EventCategory,
    calculateIntensityFn: (event: MergedEvent) => number
  ): NewsEvent[] {
    return mergedEvents.map((merged) => {
      const item = merged.canonicalItem;

      return {
        id: uuidv4(),
        title: item.title,
        summary: item.summary || '',
        lat: item.location?.lat || 0,
        lng: item.location?.lng || 0,
        timestamp: item.timestamp,
        source: merged.sources.join(', '),
        category: classifyFn(item),
        intensity: calculateIntensityFn(merged),
        url: item.url,
        imageUrl: item.imageUrl,
        gdeltTone: item.gdeltTone,
        sourceCount: merged.sourceCount,
      };
    });
  }
}

export const deduplicationService = new DeduplicationService();
export default deduplicationService;
