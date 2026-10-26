import type { ControlTourStep } from '../ui/control-tour.ts';
import type { FlappyLessonStep } from './lesson-notes.ts';
export function flappyTourSteps(step:FlappyLessonStep):readonly ControlTourStep[]{
 const tours:Record<FlappyLessonStep,ControlTourStep[]>={
  play:[
   {selector:'#duel-start',title:'Start samen',body:'Met Start beginnen beide vogels aan dezelfde reeks. De computer rechts is nog niet getraind.'},
   {selector:'#duel-player-canvas',title:'Hier speel jij',body:'Flap met Spatie of ↑. Je ziet het hele speelveld. Waar let je op voordat je drukt?'},
   {selector:'#duel-computer-canvas',title:'Kijk ook naar de computer',body:'Deze vogel kiest willekeurig. Hij leert tijdens deze wedstrijd nog niets.'},
   {selector:'#duel-restart',title:'Probeer opnieuw',body:'Met Opnieuw beginnen beide vogels opnieuw. Sluit de rondleiding en start wanneer je wilt.'}],
  teach:[
   {selector:'.record-toggle',title:'Neem je keuzes op',body:'Start een opname en speel zelf. Rond de poging af om je voorbeeld te bewaren. Daarna volgt een aparte testpoging.'},
   {selector:'#teach-canvas',title:'Doe verschillende situaties voor',body:'De opname bewaart wat de vogel kan waarnemen en of je flapte of wachtte. Wat gebeurt er als je alleen wachten voordoet?'},
   {selector:'#train-button',title:'Train met je voorbeelden',body:'Neem één poging op en train je AI-model. Verzamel daarna drie opnamen en vervolgens meer. Test telkens opnieuw.'},
   {selector:'#clone-button',title:'Test de imitatie',body:'Laat de imitatie een nieuwe reeks spelen. Tijdens deze test verandert het model niet.'}],
  practice:[
   {selector:'#practice-budget',title:'Kies trainingsrondes',body:'In één ronde speelt iedere vogel één poging. Daarna leert het gedeelde AI-model van alle resultaten.'},
   {selector:'#practice-start',title:'Laat zelfstandig oefenen',body:'Je hebt eerst een getrainde imitatie nodig. Nu sturen beloningen de veranderingen aan het model.'},
   {selector:'#practice-pause',title:'Blijf zelf controleren',body:'Je kunt het oefenen pauzeren of stoppen. De rondleiding heeft lopende activiteiten gepauzeerd; hervat ze daarna zelf.'},
   {selector:'.parallel-canvas',title:'Kijk hoe de vogels leren',body:'Alle vogels gebruiken hetzelfde AI-model. Na hun pogingen gaan beloningen en straffen terug naar het model. De volgende ronde gebruikt de aangepaste versie.'}],
  compare:[
   {selector:'#compare-run',title:'Gebruik dezelfde tests',body:'De bewaarde modellen krijgen dezelfde drie vaste testreeksen. Er wordt tijdens deze vergelijking niet getraind.'},
   {selector:'#human-start',title:'Speel ook zelf',body:'Jij krijgt diezelfde testpogingen. Je acties worden hier niet als trainingsvoorbeelden bewaard.'},
   {selector:'#compare-chart',title:'Vergelijk meerdere uitkomsten',body:'Bekijk de gemiddelde score én de spreiding. Een losse hoge score is niet genoeg om een conclusie te trekken.'}]
 };
 return tours[step];
}
