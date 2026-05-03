// Métricas SEO virão de Google Analytics / Search Console na fase final.
// Por enquanto, sempre lê do seed (mock realista para demo).

import { seoTimeseries as seedSeo, keywords as seedKeywords } from '../../src/app/data/seed';
import type { SeoMetric, KeywordMetric } from '../../src/app/types/schema';

export async function listSeoTimeseries(_range = '30d'): Promise<SeoMetric[]> {
  return seedSeo;
}

export async function listKeywords(): Promise<KeywordMetric[]> {
  return seedKeywords;
}
