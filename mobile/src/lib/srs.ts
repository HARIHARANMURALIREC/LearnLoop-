// AUTO-COPIED from web/src/lib/srs.ts by scripts/sync-shared.sh — edit the web file, not this one.
// Leitner spaced repetition: 5 boxes, correct answers move a card up (longer wait), misses send it back to box 1.
export const BOX_DAYS = [1, 2, 4, 8, 16]
export interface CardState { box: number; reps: number; lapses: number }

export function review(card: CardState, gotIt: boolean, now = new Date()): CardState & { due_at: string } {
  const box = gotIt ? Math.min(5, card.box + 1) : 1
  const due = new Date(now); due.setDate(due.getDate() + BOX_DAYS[box - 1])
  return { box, reps: card.reps + 1, lapses: card.lapses + (gotIt ? 0 : 1), due_at: due.toISOString() }
}
export const isMastered = (box: number) => box >= 5
