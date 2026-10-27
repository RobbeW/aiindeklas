import { MAX_ANSWER_LENGTH, type LessonPage } from '../flappy/lesson-notes.ts';
export type { LessonPage };
export const CAR_LESSON_STEPS=['play','edit','tracks','population','compare','teach','practice'] as const;
export type CarLessonStep=typeof CAR_LESSON_STEPS[number];
export interface CarLessonAnswers {readonly prediction:string;readonly reflection:string;}
export type CarLessonNotes=Partial<Record<CarLessonStep,CarLessonAnswers>>;
export function validateCarLessonNotes(value:unknown):CarLessonNotes|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid car lesson notes');
 const out:CarLessonNotes={};
 for(const [step,row] of Object.entries(value)){
  if(!CAR_LESSON_STEPS.includes(step as CarLessonStep)||!row||typeof row!=='object'||Array.isArray(row))throw new Error('Invalid car lesson answer');
  const a=row as Record<string,unknown>;
  if(Object.keys(a).length!==2||typeof a.prediction!=='string'||typeof a.reflection!=='string'||a.prediction.length>MAX_ANSWER_LENGTH||a.reflection.length>MAX_ANSWER_LENGTH)throw new Error('Invalid car lesson answer fields');
  out[step as CarLessonStep]=Object.freeze({prediction:a.prediction,reflection:a.reflection});
 }
 return Object.freeze(out);
}
