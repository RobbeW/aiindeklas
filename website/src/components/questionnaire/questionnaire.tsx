import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QuestionnaireAnswers = Record<string, string>;
export interface QuestionnaireQuestion {
  id: string;
  prompt: string;
  enabledWhen?: (answers: QuestionnaireAnswers) => boolean;
}
interface RenderState {
  question: QuestionnaireQuestion;
  answer?: string;
  step: number;
  total: number;
  setAnswer: (value: string) => void;
  previous: () => void;
  next: () => void;
}
interface QuestionnaireProps {
  questions: QuestionnaireQuestion[];
  activeStep: number;
  answers: QuestionnaireAnswers;
  onActiveStepChange: (step: number) => void;
  onAnswersChange: (answers: QuestionnaireAnswers) => void;
  children: (state: RenderState) => React.ReactNode;
  className?: string;
}

export function Questionnaire({ questions, activeStep, answers, onActiveStepChange, onAnswersChange, children, className }: QuestionnaireProps) {
  const enabled = questions.filter((question) => !question.enabledWhen || question.enabledWhen(answers));
  const safeStep = Math.min(Math.max(activeStep, 0), Math.max(enabled.length - 1, 0));
  const question = enabled[safeStep];
  if (!question) return null;
  const previous = () => onActiveStepChange(Math.max(0, safeStep - 1));
  const next = () => onActiveStepChange(Math.min(enabled.length - 1, safeStep + 1));
  const setAnswer = (value: string) => onAnswersChange({ ...answers, [question.id]: value });
  return <div className={cn("questionnaire", className)} data-questionnaire-step={safeStep + 1}><fieldset><legend>{question.prompt}</legend>{children({ question, answer: answers[question.id], step: safeStep + 1, total: enabled.length, setAnswer, previous, next })}</fieldset></div>;
}

export interface QuestionnaireChoiceProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onSelect"> {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (value: string) => void;
}
export function QuestionnaireChoice({ value, label, description, selected, onSelect, className, ...props }: QuestionnaireChoiceProps) {
  return <label className={cn("questionnaire-choice", className)}><input {...props} type="radio" value={value} checked={selected} onChange={() => onSelect(value)} /><span className="questionnaire-choice__body"><strong>{label}</strong><span>{description}</span><span className="questionnaire-choice__check" aria-hidden="true">✓</span></span></label>;
}

export function QuestionnaireProgress({ step, total, className }: { step: number; total: number; className?: string }) {
  return <div className={cn("questionnaire-progress", className)}><span>Stap {step} van {total}</span><progress aria-label={`Stap ${step} van ${total}`} value={step} max={total}>{step} / {total}</progress></div>;
}
export function QuestionnaireActions(props: React.HTMLAttributes<HTMLDivElement>) { return <div {...props} className={cn("questionnaire-actions", props.className)} />; }
export function QuestionnairePrevious(props: ButtonProps) { return <Button variant="ghost" {...props}>{props.children ?? "Terug"}</Button>; }
export function QuestionnaireNext(props: ButtonProps) { return <Button {...props}>{props.children ?? "Volgende"}</Button>; }
