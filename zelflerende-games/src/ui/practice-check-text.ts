import type { PracticeModelCheck } from '../learning/practice-check.ts';
const number = (n:number) => n.toFixed(1).replace('.',',');
export function practiceCheckText(check:PracticeModelCheck):string {
  return `Dezelfde vijf testpogingen · score vóór: ${number(check.before.meanScore)} → na: ${number(check.after.meanScore)} punten. Gemiddelde vliegtijd: ${number(check.before.meanSurvivalSteps/60)} → ${number(check.after.meanSurvivalSteps/60)} s.`;
}
