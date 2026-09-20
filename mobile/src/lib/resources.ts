// AUTO-COPIED from web/src/lib/resources.ts by scripts/sync-shared.sh — edit the web file, not this one.
export type ResourceType = 'video' | 'article' | 'docs' | 'course' | 'practice' | 'book'
export interface Resource { title: string; type: ResourceType; provider: string; why: string; minutes: number; search_query: string }

/**
 * The AI names a resource and a search query but never a URL (models invent links).
 * We build a search link, so it always resolves; the UI labels these as suggestions.
 */
export function resourceUrl(r: Resource): string {
  const q = encodeURIComponent(`${r.provider} ${r.search_query}`.trim())
  return r.type === 'video' ? `https://www.youtube.com/results?search_query=${q}` : `https://www.google.com/search?q=${q}`
}
export const TYPE_META: Record<ResourceType, { label: string; icon: string }> = {
  video: { label: 'Video', icon: '▶️' }, article: { label: 'Article', icon: '📰' }, docs: { label: 'Docs', icon: '📚' },
  course: { label: 'Course', icon: '🎓' }, practice: { label: 'Practice', icon: '🛠️' }, book: { label: 'Book', icon: '📖' },
}
