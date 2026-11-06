import defaults from '../content/website-defaults.json';
import { websiteCollections } from './website-model.mjs';
import { createWebsiteLoader } from './website-loader.mjs';

export interface WebsiteContent {
  globals: (typeof defaults.website_globals)[number];
  common: (typeof defaults.website_common)[number];
  home: (typeof defaults.website_home)[number];
  practices: Record<'legal' | 'data', (typeof defaults.website_practices)[number]>;
  people: Record<'tatiana' | 'henry', (typeof defaults.website_people)[number]>;
  faq: WebsiteFaq[];
  steps: WebsiteStep[];
  /** Empty unless published testimonials exist in the CMS: hide the section when empty. */
  testimonials: WebsiteTestimonial[];
}

interface WebsiteRow { id: string; locale: 'es' | 'en'; sort: number | null }
export interface WebsiteFaq extends WebsiteRow { area: 'legal' | 'data' | 'general'; question: string; answer: string }
export interface WebsiteStep extends WebsiteRow { title: string; description: string }
export interface WebsiteTestimonial extends WebsiteRow { area: 'legal' | 'data'; quote: string; author: string; role: string }

// These are build-time settings, never browser credentials. Snapshot is safe before CMS activation.
export const getWebsiteContent = createWebsiteLoader({
  source: import.meta.env.WEBSITE_CONTENT_SOURCE || 'snapshot',
  collections: websiteCollections,
}) as (locale: 'es' | 'en') => Promise<WebsiteContent>;
