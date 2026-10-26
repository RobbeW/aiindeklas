import type { CarAction } from '../car/config.ts';
export interface GamepadReading {readonly status:'connected'|'disconnected'|'unsupported';readonly action:CarAction;}
export function mapGamepadAxis(value:number,deadzone=.2):CarAction {
  if(!Number.isFinite(value)||value< -1||value>1||!Number.isFinite(deadzone)||deadzone<0||deadzone>=1)throw new Error('Invalid controller axis/deadzone');
  return value< -deadzone?1:value>deadzone?2:0;
}
export function readGamepad(getPads:()=>readonly (Pick<Gamepad,'connected'|'axes'>|null)[]=()=>{if(typeof navigator==='undefined'||!navigator.getGamepads)throw new Error('Gamepad API unavailable');return navigator.getGamepads();}):GamepadReading {
  try{const pads=getPads(),pad=pads.find(p=>p?.connected);if(!pad)return Object.freeze({status:'disconnected',action:0});return Object.freeze({status:'connected',action:mapGamepadAxis(pad.axes[0]??0)});}
  catch{return Object.freeze({status:'unsupported',action:0});}
}
