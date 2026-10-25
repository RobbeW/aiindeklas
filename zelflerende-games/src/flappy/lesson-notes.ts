export const FLAPPY_LESSON_STEPS = ['play', 'teach', 'practice', 'compare'] as const;
export const LESSON_PAGES = ['before', 'experiment', 'after'] as const;
export type FlappyLessonStep = typeof FLAPPY_LESSON_STEPS[number];
export type LessonPage = typeof LESSON_PAGES[number];
export interface LessonAnswers { prediction: string; reflection: string; nextTry: string; }
export type FlappyLessonNotes = Partial<Record<FlappyLessonStep, Readonly<LessonAnswers>>>;
export const MAX_ANSWER_LENGTH = 2000;

/** Bounded, plain-text answers; old version-1 experiments may omit them. */
export function validateLessonNotes(value: unknown): FlappyLessonNotes | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid lesson answers');
  const result: FlappyLessonNotes = {};
  for (const [step, answers] of Object.entries(value)) {
    if (!FLAPPY_LESSON_STEPS.includes(step as FlappyLessonStep) || !answers || typeof answers !== 'object' || Array.isArray(answers)) throw new Error('Invalid lesson answers');
    const fields = Object.keys(answers);
    if (fields.length !== 3 || !fields.every(field => ['prediction', 'reflection', 'nextTry'].includes(field))) throw new Error('Invalid lesson answer fields');
    const row = answers as LessonAnswers;
    for (const field of ['prediction', 'reflection', 'nextTry'] as const) {
      if (typeof row[field] !== 'string' || row[field].length > MAX_ANSWER_LENGTH) throw new Error('Lesson answer exceeds limit or is not text');
    }
    result[step as FlappyLessonStep] = Object.freeze({ prediction: row.prediction, reflection: row.reflection, nextTry: row.nextTry });
  }
  return Object.freeze(result);
}
