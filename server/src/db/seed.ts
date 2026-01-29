import { v4 as uuidv4 } from 'uuid';
import { pool } from './index.js';
import { insertEvents } from './eventRepository.js';
import { NewsEvent, EventCategory } from '../types/index.js';
import logger from '../utils/logger.js';

const categories: EventCategory[] = [
  'conflict',
  'politics',
  'disaster',
  'economics',
  'health',
  'technology',
  'environment',
];

const sampleEvents: Partial<NewsEvent>[] = [
  {
    title: 'Climate Summit Reaches Historic Agreement in Paris',
    summary: 'World leaders agree on new emissions targets during international climate conference.',
    lat: 48.8566,
    lng: 2.3522,
    source: 'Reuters',
    category: 'environment',
    url: 'https://example.com/climate-summit',
  },
  {
    title: 'Major Earthquake Strikes Central Japan',
    summary: 'A 7.1 magnitude earthquake causes widespread damage in the Honshu region.',
    lat: 35.6762,
    lng: 139.6503,
    source: 'AP News',
    category: 'disaster',
    url: 'https://example.com/japan-earthquake',
  },
  {
    title: 'Tech Giants Face New EU Regulations',
    summary: 'European Union announces stricter digital market regulations affecting major technology companies.',
    lat: 50.8503,
    lng: 4.3517,
    source: 'BBC',
    category: 'technology',
    url: 'https://example.com/eu-tech-regulations',
  },
  {
    title: 'Tensions Rise in South China Sea',
    summary: 'Naval exercises by multiple nations increase regional tensions.',
    lat: 15.0,
    lng: 117.0,
    source: 'GDELT',
    category: 'conflict',
    url: 'https://example.com/south-china-sea',
  },
  {
    title: 'Global Stock Markets Rally on Economic Data',
    summary: 'Positive employment figures drive gains across international markets.',
    lat: 40.7128,
    lng: -74.006,
    source: 'NewsAPI',
    category: 'economics',
    url: 'https://example.com/stock-rally',
  },
  {
    title: 'New Vaccine Shows Promise in Clinical Trials',
    summary: 'Phase 3 trials indicate high efficacy for new respiratory disease vaccine.',
    lat: 51.5074,
    lng: -0.1278,
    source: 'Reuters',
    category: 'health',
    url: 'https://example.com/vaccine-trials',
  },
  {
    title: 'Presidential Election Results Contested',
    summary: 'Opposition parties dispute preliminary election results amid calls for recount.',
    lat: -15.7801,
    lng: -47.9292,
    source: 'AP News',
    category: 'politics',
    url: 'https://example.com/election-contested',
  },
  {
    title: 'Wildfires Spread Across Australian Outback',
    summary: 'Emergency services battle multiple fire fronts as drought conditions persist.',
    lat: -25.2744,
    lng: 133.7751,
    source: 'BBC',
    category: 'disaster',
    url: 'https://example.com/australia-fires',
  },
  {
    title: 'UN Security Council Debates Middle East Crisis',
    summary: 'Emergency session called to address escalating regional conflicts.',
    lat: 40.7489,
    lng: -73.968,
    source: 'GDELT',
    category: 'conflict',
    url: 'https://example.com/un-debate',
  },
  {
    title: 'Arctic Ice Reaches Record Low',
    summary: 'Scientists report unprecedented ice melt affecting global sea levels.',
    lat: 71.7069,
    lng: -42.6043,
    source: 'NewsAPI',
    category: 'environment',
    url: 'https://example.com/arctic-ice',
  },
];

async function seedDatabase(): Promise<void> {
  logger.info('Starting database seeding...');

  const events: NewsEvent[] = sampleEvents.map((event, index) => ({
    id: uuidv4(),
    title: event.title!,
    summary: event.summary || '',
    lat: event.lat!,
    lng: event.lng!,
    timestamp: new Date(Date.now() - index * 3600000), // Stagger by hours
    source: event.source!,
    category: event.category!,
    intensity: Math.floor(Math.random() * 50) + 25,
    url: event.url!,
    gdeltTone: (Math.random() - 0.5) * 10,
    sourceCount: Math.floor(Math.random() * 5) + 1,
  }));

  // Add more random events
  for (let i = 0; i < 50; i++) {
    events.push({
      id: uuidv4(),
      title: `Global Event ${i + 1}: ${categories[i % categories.length]} Development`,
      summary: `Summary for global event ${i + 1} covering recent developments.`,
      lat: (Math.random() - 0.5) * 160, // -80 to 80
      lng: (Math.random() - 0.5) * 360, // -180 to 180
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7), // Within last week
      source: ['Reuters', 'AP News', 'BBC', 'GDELT', 'NewsAPI'][Math.floor(Math.random() * 5)],
      category: categories[i % categories.length],
      intensity: Math.floor(Math.random() * 80) + 10,
      url: `https://example.com/event-${i + 1}`,
      gdeltTone: (Math.random() - 0.5) * 10,
      sourceCount: Math.floor(Math.random() * 8) + 1,
    });
  }

  const inserted = await insertEvents(events);
  logger.info(`Seeded ${inserted} events into database`);
}

seedDatabase()
  .then(() => {
    logger.info('Seeding completed successfully');
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Seeding failed:', error);
    pool.end();
    process.exit(1);
  });

export default seedDatabase;
