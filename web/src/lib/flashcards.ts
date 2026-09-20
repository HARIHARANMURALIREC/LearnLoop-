import { supabase } from './supabase'

/** Turn a missed question into a flashcard (once per question; re-misses don't reset an existing card). */
export async function addFlashcard(userId: string, skillId: string, question: string, correct: string, wrong: string) {
  await supabase.from('flashcards').upsert(
    { user_id: userId, skill_id: skillId, question_text: question, correct_answer: correct, wrong_answer: wrong },
    { onConflict: 'user_id,question_text', ignoreDuplicates: true },
  )
}
