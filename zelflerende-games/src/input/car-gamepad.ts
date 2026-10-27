import type { CarControl } from '../car/physics.ts';
import { mapGamepadAxis } from './gamepad.ts';

export interface CarPad {readonly connected:boolean;readonly axes:readonly number[];readonly buttons?:readonly {readonly pressed:boolean;readonly value?:number}[];}
export type CarPadProvider=()=>readonly (CarPad|null)[];
export const getCarPads:CarPadProvider=()=>{if(typeof navigator==='undefined'||!navigator.getGamepads)throw new Error('Gamepad API unavailable');return navigator.getGamepads();};
const neutral:CarControl=Object.freeze({action:0,throttle:0,brake:0});
/** Read one session-local controller index, or the first connected controller when omitted. */
export function readCarGamepad(index?:number,getPads:CarPadProvider=getCarPads):CarControl {
  try{
    const pads=getPads(),pad=index===undefined?pads.find(p=>p?.connected):pads[index];
    if(!pad?.connected)return neutral;
    const left=!!pad.buttons?.[14]?.pressed,right=!!pad.buttons?.[15]?.pressed;
    const axis=pad.axes[0]??0;
    const action=left||right?(left===right?0:left?1:2):mapGamepadAxis(axis);
    const pedal=(i:number)=>{const button=pad.buttons?.[i],value=button?.value??(button?.pressed?1:0);return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;};
    return Object.freeze({action,throttle:pedal(7),brake:pedal(6)});
  }catch{return neutral;}
}
