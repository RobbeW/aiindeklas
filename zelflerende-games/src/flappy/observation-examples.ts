import { FlappyEnvironment } from './environment.ts';
import { PHYSICS } from './physics.ts';
import { PIPE_GAP, PIPE_WIDTH } from './world.ts';
import { generateReferenceDemonstration } from './reference-demonstrations.ts';

export interface ObservationExample {
  readonly step: number;
  readonly action: 0 | 1;
  readonly observation: readonly number[];
  readonly height: number;
  readonly verticalSpeed: number;
  readonly distance: number;
  readonly gapTop: number;
  readonly gapBottom: number;
}

/** Decorative 2D game view of the same real coordinates shown by the readout. */
export function renderObservationGeometry(example: ObservationExample, selected: number, birdAsset: string): string {
 const pipeX=example.distance+PHYSICS.birdX;
 const boundedSpeed=Math.max(-100,Math.min(100,example.verticalSpeed));
 const overlays=[
  `<path d="M24 0v${example.height}"/>`,
  `<path d="M${PHYSICS.birdX+24} ${example.height}v${boundedSpeed*.55}"/>`,
  `<path d="M${PHYSICS.birdX} ${example.height+28}H${pipeX}"/>`,
  `<path d="M${pipeX} ${example.gapTop}h${PIPE_WIDTH}"/>`,
  `<path d="M${pipeX} ${example.gapBottom}h${PIPE_WIDTH}"/>`,
 ];
 const markerX=selected===0?24:selected===1?PHYSICS.birdX+24:Math.max(20,Math.min(PHYSICS.worldWidth-20,pipeX));
 const markerY=selected===0?example.height:selected===1?example.height+boundedSpeed*.55:selected===3?example.gapTop:selected===4?example.gapBottom:example.height+28;
 return `<div class="sch-flow oe__flow">
  <div class="sch-object"><span class="sch-label">Speelveld</span><div class="sch-platform oe__game-platform"><svg class="oe__scene" viewBox="0 0 ${PHYSICS.worldWidth} ${PHYSICS.worldHeight}" aria-hidden="true" focusable="false"><rect class="oe__game-bg" width="360" height="480"/><path class="oe__pipe" d="M${pipeX} 0h${PIPE_WIDTH}v${example.gapTop}h-${PIPE_WIDTH}zM${pipeX} ${example.gapBottom}h${PIPE_WIDTH}V${PHYSICS.groundY}h-${PIPE_WIDTH}z"/><rect class="oe__ground" y="${PHYSICS.groundY}" width="360" height="${PHYSICS.worldHeight-PHYSICS.groundY}"/><image class="oe__bird" href="${birdAsset}" x="${PHYSICS.birdX-18}" y="${example.height-13}" width="36" height="26" preserveAspectRatio="xMidYMid meet"/>${overlays.map((overlay,i)=>`<g class="oe__overlay" ${selected===i?'':'hidden'}>${overlay}</g>`).join('')}<circle class="oe__selected-point" cx="${markerX}" cy="${markerY}" r="7"/></svg></div></div>
  <span class="sch-arrow" aria-hidden="true">→</span>
  <div class="sch-object"><span class="sch-label">AI-model</span><div class="sch-platform oe__model-platform"><span class="sch-big">5 getallen</span><span class="sch-small">samen bepalen de kans op flappen</span></div></div>
 </div>`;
}

/** Replay actual pre-action frames from a labelled synthetic reference episode. */
export function createObservationExamples(): readonly ObservationExample[] {
  const episode = generateReferenceDemonstration(1000, 'observation-example-1000');
  const environment = new FlappyEnvironment();
  environment.reset({ seed: episode.seed });
  const wanted = new Set([60, 80, 100, 120, 140]);
  const examples: ObservationExample[] = [];
  for (const frame of episode.frames) {
    const world = environment.world;
    const observation = environment.getObservation();
    if (wanted.has(frame.step)) {
      const pipe = world.pipes.find((candidate) => candidate.x + PIPE_WIDTH >= PHYSICS.birdX - PHYSICS.radius);
      if (!pipe) throw new Error('reference frame has no upcoming pipe');
      const center = pipe.gapCenter;
      examples.push(Object.freeze({
        step: frame.step, action: frame.action, observation,
        height: world.bird.y,
        verticalSpeed: world.bird.velocityY,
        distance: pipe.x - PHYSICS.birdX,
        gapTop: center - PIPE_GAP / 2,
        gapBottom: center + PIPE_GAP / 2,
      }));
    }
    if(examples.length===wanted.size)break;
    environment.step(frame.action);
  }
  if (examples.length < 3) throw new Error('reference episode did not contain enough observation examples');
  return Object.freeze(examples);
}
