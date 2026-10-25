export const FRAME_STEP_MS=1000/60,MAX_FRAME_DELTA_MS=100;
export function advanceFixedFrame<Action>(deltaMs:number,accumulatorMs:number,consumeAction:()=>Action,step:(action:Action)=>void){
  if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(accumulatorMs)||accumulatorMs<0)throw new RangeError('frame delta and accumulator must be finite non-negative numbers');
  let remaining=accumulatorMs+Math.min(deltaMs,MAX_FRAME_DELTA_MS),steps=0;
  while(remaining+1e-7>=FRAME_STEP_MS){step(consumeAction());remaining-=FRAME_STEP_MS;steps++;}
  return Object.freeze({accumulatorMs:Math.max(0,remaining),steps});
}
