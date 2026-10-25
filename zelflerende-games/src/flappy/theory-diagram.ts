import { PHYSICS } from './physics.ts';
import { PIPE_GAP,PIPE_WIDTH,type WorldState } from './world.ts';
/** Decorative 2D game view; every object name is ordinary HTML outside this SVG. */
export function gameCabinet(world:WorldState,x=0,y=0){
 const bird=`${import.meta.env.BASE_URL}assets/flappy/redbird-midflap.png`;
 return `<g transform="translate(${x} ${y})"><rect class="td-case" x="-8" y="-8" width="376" height="496" rx="14"/><svg width="360" height="480" viewBox="0 0 360 480"><rect class="td-screen" width="360" height="480"/>${world.pipes.filter(p=>p.x+PIPE_WIDTH>=0&&p.x<=360).map(p=>`<path class="td-green" d="M${p.x} 0h${PIPE_WIDTH}v${p.gapCenter-PIPE_GAP/2}h-${PIPE_WIDTH}zM${p.x} ${p.gapCenter+PIPE_GAP/2}h${PIPE_WIDTH}V440h-${PIPE_WIDTH}z"/>`).join('')}<rect class="td-ground" y="440" width="360" height="40"/><image href="${bird}" x="${PHYSICS.birdX-27}" y="${world.bird.y-19}" width="54" height="38" style="image-rendering:pixelated"/></svg></g>`;
}
/** Kept as a geometry utility for consumers; explainers use object platforms instead. */
export const diagramFloor='<path class="td-shadow" d="m24 354 333-169 414 169-334 179z"/><path class="td-floor" d="m24 336 333-169 414 169-334 179z"/>';
/** Neutral chip geometry; the AI-model label belongs in upright HTML. */
export function modelChip(){return'<g class="td-model"><path d="m334 243 122-64 122 64-122 64z"/><path d="m334 243 122 64v26l-122-64zm122 64 122-64v26l-122 64z"/><path class="td-chip" d="m411 236 45-24 45 24-45 24z"/><path class="td-pins" d="m407 241-25 14m40-6-25 14m40-6-25 14m62-30 25 14m-40-6 25 14m-40-6 25 14"/></g>';}
