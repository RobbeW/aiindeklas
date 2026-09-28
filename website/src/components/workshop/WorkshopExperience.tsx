import * as React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Questionnaire, QuestionnaireActions, QuestionnaireChoice, QuestionnaireNext, QuestionnaireProgress, QuestionnairePrevious } from "@/components/questionnaire/questionnaire";
import { rankWorkshopOffers } from "@/lib/workshop-finder.mjs";
import "./workshop-experience.css";

type Answers = Record<string, string>;
type QuestionOption = { id: string; label: string; description: string };
type Question = { id: string; prompt: string; conditionalNeed: string | null; options: QuestionOption[] };
type WorkshopFormat = { type: string; durationMinutes: number | null; maxGroupSize: number | null; unknownCapacity: boolean };
type RelatedItem = { title: string; route: string; kind: "article" | "project" };
type Offer = {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  image: { src: string; alt: string } | null;
  formats: WorkshopFormat[];
  selectedFormat?: WorkshopFormat;
  related: RelatedItem[];
  source: {
    summary?: string;
    programme?: string;
    target_audience?: string;
    duration_display?: string;
    workshop_type?: string;
    location_notes?: string;
    sourceDetails?: Array<{ heading: string; html: string }>;
  };
};
type ExperienceData = {
  offers: Offer[];
  questions: Question[];
  categoryLabels: Record<string, string>;
  subcategoryLabels: Record<string, string>;
  ranking: Record<string, unknown>;
};
type Props = { data: ExperienceData; contactHref: string };

const normalized = (value: string) => value.toLocaleLowerCase("nl-BE");
const firstSentence = (value = "") => {
  const clean = value.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(.{1,220}?[.!?])(?:\s|$)/);
  return match?.[1] ?? (clean.length > 220 ? `${clean.slice(0, 217).trim()}…` : clean);
};
const sectionHtml = (offer: Offer, headings: string[]) => (offer.source.sourceDetails ?? [])
  .filter((section) => headings.some((heading) => normalized(section.heading).includes(normalized(heading))))
  .map((section) => section.html)
  .join("");

function WorkshopMedia({ offer }: { offer: Offer }) {
  return <AspectRatio ratio={16 / 9} className="workshop-media">
    {offer.image
      ? <img src={offer.image.src} alt={offer.image.alt} />
      : <div className="workshop-media__fallback" aria-hidden="true"><span>RW</span></div>}
  </AspectRatio>;
}

function RichSection({ html, fallback }: { html: string; fallback?: string }) {
  return html
    ? <div className="workshop-detail__prose" dangerouslySetInnerHTML={{ __html: html }} />
    : fallback ? <p>{fallback}</p> : null;
}

export function WorkshopDetailContent({ offer, categoryLabel, answers, contactLink, close, containerRef }: {
  offer: Offer;
  categoryLabel: string;
  answers: Answers;
  contactLink: (offer: Offer | null, answers: Answers) => string;
  close: () => void;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  const content = sectionHtml(offer, ["programma", "doelen"]);
  const audience = sectionHtml(offer, ["doelgroep"]);
  const practical = sectionHtml(offer, ["praktische informatie", "prijslijst"]);
  const format = offer.selectedFormat ?? offer.formats[0];
  return <div ref={containerRef} className="workshop-detail" tabIndex={-1}>
    <DialogHeader>
      <DialogTitle>{offer.title}</DialogTitle>
      <DialogDescription>{firstSentence(offer.source.programme ?? offer.source.summary) || "Bekijk de inhoud en praktische informatie van deze sessie."}</DialogDescription>
      <div className="workshop-detail__badges">
        <Badge variant="outline">{categoryLabel}</Badge>
        {format?.durationMinutes ? <Badge variant="secondary">{format.durationMinutes} min.</Badge> : null}
      </div>
    </DialogHeader>
    <WorkshopMedia offer={offer} />
    <Accordion type="single" collapsible>
      <AccordionItem value="inhoud-leerdoelen">
        <AccordionTrigger>Inhoud &amp; leerdoelen</AccordionTrigger>
        <AccordionContent><RichSection html={content} fallback={offer.source.programme} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="doelgroep">
        <AccordionTrigger>Doelgroep</AccordionTrigger>
        <AccordionContent><RichSection html={audience} fallback={offer.source.target_audience} /></AccordionContent>
      </AccordionItem>
      <AccordionItem value="praktische-info">
        <AccordionTrigger>Praktische info</AccordionTrigger>
        <AccordionContent>
          <RichSection html={practical} fallback={[offer.source.duration_display, offer.source.location_notes].filter(Boolean).join(" ")} />
          <a className={`${buttonVariants({ variant: "default" })} workshop-detail__contact`} href={contactLink(offer, answers)}>Bespreek deze sessie</a>
        </AccordionContent>
      </AccordionItem>
      {offer.related.length > 0 ? <AccordionItem value="verder-lezen">
        <AccordionTrigger>Verder lezen</AccordionTrigger>
        <AccordionContent><ul className="workshop-related">{offer.related.slice(0, 2).map((item) =>
          <li key={item.route}><a className={buttonVariants({ variant: "link" })} href={item.route}>{item.title}</a></li>)}</ul></AccordionContent>
      </AccordionItem> : null}
    </Accordion>
    <DialogFooter className="workshop-detail__footer">
      <Button variant="ghost" onClick={close}>Sluiten</Button>
    </DialogFooter>
  </div>;
}

function ResponsiveWorkshopDetail({ offer, open, onOpenChange, answers, contactLink, trigger, labels }: {
  offer: Offer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answers: Answers;
  contactLink: (offer: Offer | null, answers: Answers) => string;
  trigger: HTMLButtonElement | null;
  labels: ExperienceData;
}) {
  const [mobile, setMobile] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 42rem)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  if (!offer) return null;
  const restoreFocus = (event: Event) => { event.preventDefault(); trigger?.focus(); };
  const initialFocus = (event: Event) => { event.preventDefault(); contentRef.current?.focus(); };
  const categoryLabel = offer.subcategory ? labels.subcategoryLabels[offer.subcategory] : labels.categoryLabels[offer.category];
  const content = <WorkshopDetailContent containerRef={contentRef} offer={offer} categoryLabel={categoryLabel ?? offer.category} answers={answers} contactLink={contactLink} close={() => onOpenChange(false)} />;
  return mobile
    ? <Drawer open={open} onOpenChange={onOpenChange}><DrawerContent data-workshop-drawer onOpenAutoFocus={initialFocus} onCloseAutoFocus={restoreFocus}>{content}</DrawerContent></Drawer>
    : <Dialog open={open} onOpenChange={onOpenChange}><DialogContent data-workshop-dialog onOpenAutoFocus={initialFocus} onCloseAutoFocus={restoreFocus}>{content}</DialogContent></Dialog>;
}

function WorkshopCard({ offer, compact, labels, reason, onOpen }: {
  offer: Offer;
  compact?: boolean;
  labels: ExperienceData;
  reason?: string;
  onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const category = offer.subcategory ? labels.subcategoryLabels[offer.subcategory] : labels.categoryLabels[offer.category];
  const format = offer.selectedFormat ?? offer.formats[0];
  return <Card className="workshop-card" data-offer-card={offer.id}>
    <button className="workshop-card__trigger" type="button" onClick={(event) => onOpen(event.currentTarget)}>
      <WorkshopMedia offer={offer} />
      <CardHeader>
        <CardTitle>{offer.title}</CardTitle>
        {!compact && reason ? <CardDescription>{reason}</CardDescription> : null}
      </CardHeader>
      <CardContent className="workshop-card__badges">
        {category ? <Badge variant="outline">{category}</Badge> : null}
        {!compact && format?.durationMinutes ? <Badge variant="secondary">{format.durationMinutes} min.</Badge> : null}
      </CardContent>
    </button>
  </Card>;
}

export default function WorkshopExperience({ data, contactHref }: Props) {
  const [answers, setAnswers] = React.useState<Answers>({});
  const [activeStep, setActiveStep] = React.useState(0);
  const [results, setResults] = React.useState<Offer[] | null>(null);
  const [catalogueMode, setCatalogueMode] = React.useState(false);
  const [selected, setSelected] = React.useState<Offer | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailTrigger, setDetailTrigger] = React.useState<HTMLButtonElement | null>(null);

  const enabledQuestions = (state: Answers) => data.questions.filter((question) => !question.conditionalNeed || state.need === question.conditionalNeed);
  const effectiveAnswers = (state: Answers) => state.need === "vakspecifiek" ? state : Object.fromEntries(Object.entries(state).filter(([key]) => key !== "subject"));
  const questionModels = data.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    enabledWhen: question.conditionalNeed ? (state: Answers) => state.need === question.conditionalNeed : undefined,
  }));
  const optionLabel = (questionId: string, value: string) => data.questions.find((question) => question.id === questionId)?.options.find((option) => option.id === value)?.label ?? value;
  const contactLink = (offer: Offer | null, state: Answers) => {
    const current = effectiveAnswers(state);
    const url = new URL(contactHref, window.location.origin);
    const queryNames: Record<string, string> = { persona: "persona", need: "need", subject: "subject_area", duration: "duration", groupSize: "group_size" };
    for (const [key, value] of Object.entries(current)) if (value && queryNames[key]) url.searchParams.set(queryNames[key], optionLabel(key, value));
    if (offer) {
      url.searchParams.set("offer_id", offer.id);
      url.searchParams.set("offer", offer.title);
    } else url.searchParams.set("workshop_request", "1");
    return `${url.pathname}${url.search}`;
  };
  const finish = (state: Answers) => setResults(rankWorkshopOffers({ offers: data.offers, relatedFor: (offer: Offer) => offer.related }, effectiveAnswers(state), data.ranking) as Offer[]);
  const advance = (questionId: string, state: Answers) => {
    const enabled = enabledQuestions(state);
    const current = enabled.findIndex((question) => question.id === questionId);
    if (current < enabled.length - 1) setActiveStep(current + 1);
    else finish(state);
  };
  const choose = (questionId: string, value: string) => {
    const nextAnswers = effectiveAnswers({ ...answers, [questionId]: value });
    setAnswers(nextAnswers);
    advance(questionId, nextAnswers);
  };
  const openDetail = (offer: Offer, trigger: HTMLButtonElement) => {
    setSelected(offer);
    setDetailTrigger(trigger);
    setDetailOpen(true);
  };
  const matchReason = (offer: Offer) => offer.selectedFormat?.unknownCapacity
    ? "De inhoud past bij je vraag; de groepsgrootte bevestigen we samen."
    : "De inhoud en gepubliceerde vorm sluiten aan bij je keuzes.";

  return <div className="workshop-experience" data-workshop-experience>
    <Card className="workshop-onboarding">
      <CardHeader>
        <CardTitle>Vind een passende keynote of workshop</CardTitle>
        <CardDescription>Je antwoorden blijven bewaard wanneer je teruggaat.</CardDescription>
      </CardHeader>
      <CardContent>
        {results === null ? <Questionnaire
          questions={questionModels}
          activeStep={activeStep}
          answers={answers}
          onActiveStepChange={setActiveStep}
          onAnswersChange={setAnswers}
        >{({ question, answer, previous, step, total }) => {
          const options = data.questions.find((item) => item.id === question.id)?.options ?? [];
          return <>
            <QuestionnaireProgress step={step} total={total} />
            <div className="questionnaire-choices">{options.map((option) => <QuestionnaireChoice
              key={option.id}
              name={question.id}
              value={option.id}
              label={option.label}
              description={option.description}
              selected={answer === option.id}
              onSelect={(value) => choose(question.id, value)}
            />)}</div>
            <QuestionnaireActions>
              {step > 1 ? <QuestionnairePrevious onClick={previous} /> : null}
              {answer ? <QuestionnaireNext onClick={() => advance(question.id, effectiveAnswers(answers))} /> : null}
            </QuestionnaireActions>
          </>;
        }}</Questionnaire> : !catalogueMode ? <section aria-live="polite" data-recommendations>
          <h3>{results.length ? "Dit past het best bij je vraag" : "Geen bevestigde sessie voor deze combinatie"}</h3>
          {results.length ? <div className="workshop-grid">{results.map((offer) => <WorkshopCard
            key={offer.id}
            offer={offer}
            labels={data}
            reason={matchReason(offer)}
            onOpen={(trigger) => openDetail(offer, trigger)}
          />)}</div> : <div className="workshop-empty">
            <p>Ik verzin geen alternatief. Bespreek je vraag rechtstreeks of bekijk het volledige aanbod.</p>
            <a className={buttonVariants()} href={contactLink(null, answers)}>Bespreek je vraag</a>
          </div>}
          <div className="workshop-actions">
            <Button variant="ghost" onClick={() => { setResults(null); setActiveStep(Math.max(0, enabledQuestions(answers).length - 1)); }}>Pas keuzes aan</Button>
            <Button variant="outline" onClick={() => setCatalogueMode(true)}>Bekijk het volledige aanbod</Button>
          </div>
        </section> : <section data-catalogue-mode>
          <h3>Volledig aanbod</h3>
          <div className="workshop-grid workshop-grid--catalogue">{data.offers.map((offer) => <WorkshopCard
            key={offer.id}
            offer={offer}
            compact
            labels={data}
            onOpen={(trigger) => openDetail(offer, trigger)}
          />)}</div>
          <Button variant="ghost" onClick={() => setCatalogueMode(false)}>Terug naar mijn aanbevelingen</Button>
        </section>}
      </CardContent>
    </Card>
    <ResponsiveWorkshopDetail
      offer={selected}
      open={detailOpen}
      onOpenChange={setDetailOpen}
      answers={effectiveAnswers(answers)}
      contactLink={contactLink}
      trigger={detailTrigger}
      labels={data}
    />
  </div>;
}
