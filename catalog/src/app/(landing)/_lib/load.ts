import '@/genpm';
import { draftMode } from 'next/headers';
import { getEntry } from '@/lib/content';
import type { LandingData } from './landings';

export async function loadLanding(slug: string) {
  const { isEnabled } = await draftMode();
  return getEntry<LandingData>('landings', slug, { draft: isEnabled });
}
