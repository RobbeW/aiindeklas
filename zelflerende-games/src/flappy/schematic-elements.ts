import type { WorldState } from './world.ts';
import { PHYSICS } from './physics.ts';
import { PIPE_GAP,PIPE_WIDTH } from './world.ts';
export const birdAsset=()=>`${import.meta.env.BASE_URL}assets/flappy/redbird-midflap.png`;
export function gameSnapshot(world:WorldState){return`<svg class="se-game" viewBox="0 0 360 480" aria-hidden="true" focusable="false"><rect width="360" height="480" rx="12" fill="#eef0df"/>${world.pipes.filter(p=>p.x+PIPE_WIDTH>0&&p.x<360).map(p=>`<path fill="#83bd51" stroke="#40572b" stroke-width="3" d="M${p.x} 0h${PIPE_WIDTH}v${p.gapCenter-PIPE_GAP/2}h-${PIPE_WIDTH}zM${p.x} ${p.gapCenter+PIPE_GAP/2}h${PIPE_WIDTH}V${PHYSICS.groundY}h-${PIPE_WIDTH}z"/>`).join('')}<rect y="440" width="360" height="40" fill="#bfa77d"/><image href="${birdAsset()}" x="${PHYSICS.birdX-22}" y="${world.bird.y-15}" width="44" height="31"/></svg>`;}
export const chipIcon='<svg class="se-chip" viewBox="0 0 120 90" aria-hidden="true"><path fill="#d3c7e6" stroke="#25221d" stroke-width="2" d="m10 35 50-25 50 25-50 25z m0 0 50 25v18L10 53z m50 25 50-25v18L60 78z"/><path fill="#fffdf7" stroke="#25221d" stroke-width="2" d="m35 35 25-13 25 13-25 13z"/></svg>';
export const diagramNote='<p class="se-note">Uitlegvoorbeeld · je experiment blijft ongewijzigd.</p>';
export const money=(n:number)=>n.toLocaleString('nl-BE',{minimumFractionDigits:2,maximumFractionDigits:2});
export function number(n:number){return n.toLocaleString('nl-BE',{maximumFractionDigits:2});}
