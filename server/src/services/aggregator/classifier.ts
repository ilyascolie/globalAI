import { RawNewsItem, EventCategory } from '../../types/index.js';
import logger from '../../utils/logger.js';

interface CategoryKeywords {
  category: EventCategory;
  keywords: string[];
  weight: number;
}

const CATEGORY_DEFINITIONS: CategoryKeywords[] = [
  {
    category: 'conflict',
    keywords: [
      'war',
      'military',
      'attack',
      'bomb',
      'explosion',
      'troops',
      'soldier',
      'battle',
      'conflict',
      'violence',
      'strike',
      'missile',
      'weapon',
      'army',
      'navy',
      'air force',
      'combat',
      'killed',
      'casualties',
      'hostage',
      'terrorist',
      'terrorism',
      'insurgent',
      'rebel',
      'militia',
      'invasion',
      'offensive',
      'defense',
      'ceasefire',
      'airstrike',
      'drone strike',
      'ambush',
      'shootout',
      'gunfire',
      'assassination',
      'warfare',
    ],
    weight: 1.5,
  },
  {
    category: 'politics',
    keywords: [
      'election',
      'vote',
      'president',
      'prime minister',
      'parliament',
      'congress',
      'senate',
      'government',
      'minister',
      'policy',
      'legislation',
      'law',
      'bill',
      'campaign',
      'candidate',
      'democrat',
      'republican',
      'party',
      'coalition',
      'opposition',
      'referendum',
      'diplomat',
      'diplomacy',
      'summit',
      'treaty',
      'sanction',
      'ambassador',
      'foreign affairs',
      'state department',
      'political',
      'governor',
      'mayor',
      'council',
      'judiciary',
      'supreme court',
    ],
    weight: 1.2,
  },
  {
    category: 'disaster',
    keywords: [
      'earthquake',
      'flood',
      'hurricane',
      'tornado',
      'tsunami',
      'volcano',
      'wildfire',
      'fire',
      'storm',
      'cyclone',
      'typhoon',
      'drought',
      'landslide',
      'avalanche',
      'disaster',
      'emergency',
      'evacuation',
      'rescue',
      'casualties',
      'damage',
      'destruction',
      'collapse',
      'accident',
      'crash',
      'derailment',
      'explosion',
      'blast',
      'survivors',
      'death toll',
      'missing',
      'natural disaster',
      'climate disaster',
      'heatwave',
      'cold wave',
      'blizzard',
    ],
    weight: 1.4,
  },
  {
    category: 'economics',
    keywords: [
      'economy',
      'economic',
      'market',
      'stock',
      'trade',
      'inflation',
      'recession',
      'gdp',
      'unemployment',
      'job',
      'employment',
      'bank',
      'banking',
      'interest rate',
      'federal reserve',
      'central bank',
      'currency',
      'dollar',
      'euro',
      'investment',
      'investor',
      'profit',
      'revenue',
      'earnings',
      'business',
      'company',
      'corporation',
      'merger',
      'acquisition',
      'bankruptcy',
      'debt',
      'deficit',
      'budget',
      'tax',
      'tariff',
      'export',
      'import',
      'supply chain',
    ],
    weight: 1.0,
  },
  {
    category: 'health',
    keywords: [
      'health',
      'medical',
      'hospital',
      'doctor',
      'patient',
      'disease',
      'virus',
      'pandemic',
      'epidemic',
      'outbreak',
      'vaccine',
      'vaccination',
      'covid',
      'coronavirus',
      'infection',
      'treatment',
      'medicine',
      'pharmaceutical',
      'drug',
      'cancer',
      'heart',
      'mental health',
      'who',
      'world health',
      'cdc',
      'fda',
      'clinical trial',
      'research',
      'study',
      'symptoms',
      'diagnosis',
      'healthcare',
      'insurance',
      'mortality',
      'life expectancy',
    ],
    weight: 1.1,
  },
  {
    category: 'technology',
    keywords: [
      'technology',
      'tech',
      'ai',
      'artificial intelligence',
      'machine learning',
      'software',
      'hardware',
      'computer',
      'internet',
      'cyber',
      'hack',
      'data',
      'digital',
      'app',
      'smartphone',
      'apple',
      'google',
      'microsoft',
      'amazon',
      'facebook',
      'meta',
      'tesla',
      'spacex',
      'startup',
      'innovation',
      'robot',
      'automation',
      'chip',
      'semiconductor',
      'cryptocurrency',
      'bitcoin',
      'blockchain',
      'cloud',
      'privacy',
      'security',
      '5g',
      'electric vehicle',
    ],
    weight: 0.9,
  },
  {
    category: 'environment',
    keywords: [
      'climate',
      'environment',
      'environmental',
      'global warming',
      'carbon',
      'emission',
      'pollution',
      'renewable',
      'solar',
      'wind',
      'energy',
      'green',
      'sustainable',
      'conservation',
      'wildlife',
      'species',
      'biodiversity',
      'deforestation',
      'ocean',
      'sea level',
      'ice',
      'glacier',
      'arctic',
      'antarctic',
      'coral',
      'reef',
      'plastic',
      'recycling',
      'ecosystem',
      'nature',
      'forest',
      'rainforest',
      'endangered',
      'extinction',
      'paris agreement',
      'cop',
      'climate summit',
    ],
    weight: 1.0,
  },
];

// GDELT theme to category mapping
const GDELT_THEME_MAP: Record<string, EventCategory> = {
  TERROR: 'conflict',
  KILL: 'conflict',
  PROTEST: 'politics',
  MILITARY: 'conflict',
  ARMED_CONFLICT: 'conflict',
  NATURAL_DISASTER: 'disaster',
  EARTHQUAKE: 'disaster',
  FLOOD: 'disaster',
  EPIDEMIC: 'health',
  HEALTH: 'health',
  ELECTION: 'politics',
  GOVERNMENT: 'politics',
  ECONOMY: 'economics',
  BUSINESS: 'economics',
  TECHNOLOGY: 'technology',
  SCIENCE: 'technology',
  ENVIRONMENT: 'environment',
  CLIMATE: 'environment',
};

export class ClassifierService {
  classify(item: RawNewsItem): EventCategory {
    const scores: Record<EventCategory, number> = {
      conflict: 0,
      politics: 0,
      disaster: 0,
      economics: 0,
      health: 0,
      technology: 0,
      environment: 0,
    };

    // Combine title and summary for analysis
    const text = `${item.title} ${item.summary || ''}`.toLowerCase();

    // Check GDELT themes first if available
    if (item.themes && item.themes.length > 0) {
      for (const theme of item.themes) {
        const themeUpper = theme.toUpperCase();
        for (const [key, category] of Object.entries(GDELT_THEME_MAP)) {
          if (themeUpper.includes(key)) {
            scores[category] += 3; // Strong signal from GDELT themes
          }
        }
      }
    }

    // Keyword-based classification
    for (const definition of CATEGORY_DEFINITIONS) {
      for (const keyword of definition.keywords) {
        // Check for word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${this.escapeRegex(keyword)}\\b`, 'gi');
        const matches = text.match(regex);

        if (matches) {
          scores[definition.category] += matches.length * definition.weight;
        }
      }
    }

    // Use GDELT tone for conflict/disaster boost
    if (item.gdeltTone !== undefined && item.gdeltTone < -5) {
      // Very negative tone suggests conflict or disaster
      scores.conflict += 1;
      scores.disaster += 1;
    }

    // Find category with highest score
    let maxScore = 0;
    let maxCategory: EventCategory = 'politics'; // Default

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category as EventCategory;
      }
    }

    // If no keywords matched, try to infer from source
    if (maxScore === 0) {
      if (item.source.toLowerCase().includes('tech')) {
        maxCategory = 'technology';
      } else if (item.source.toLowerCase().includes('business')) {
        maxCategory = 'economics';
      }
    }

    logger.debug(`Classified "${item.title.substring(0, 50)}..." as ${maxCategory}`);
    return maxCategory;
  }

  classifyBatch(items: RawNewsItem[]): Map<RawNewsItem, EventCategory> {
    const results = new Map<RawNewsItem, EventCategory>();

    for (const item of items) {
      results.set(item, this.classify(item));
    }

    return results;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Get category distribution from a list of items
  getCategoryDistribution(items: RawNewsItem[]): Record<EventCategory, number> {
    const distribution: Record<EventCategory, number> = {
      conflict: 0,
      politics: 0,
      disaster: 0,
      economics: 0,
      health: 0,
      technology: 0,
      environment: 0,
    };

    for (const item of items) {
      const category = this.classify(item);
      distribution[category]++;
    }

    return distribution;
  }
}

export const classifierService = new ClassifierService();
export default classifierService;
