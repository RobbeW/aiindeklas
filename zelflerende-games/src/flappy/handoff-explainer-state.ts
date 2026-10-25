import { stableIdentity } from '../core/identity.ts';
import { flattenPolicyParameters } from '../learning/policy.ts';
import { restorePolicySnapshot,type PolicySnapshot } from '../learning/policy-snapshot.ts';
export type FeedbackMode='examples'|'rewards';
export const feedbackSteps={
 examples:[
  {title:'Bekijk de situatie',text:'Het AI-model leest vijf getallen uit het spelmoment.'},
  {title:'Jouw actie hoort erbij',text:'De opname koppelt die situatie aan flappen of wachten.'},
  {title:'Vergelijk de schatting',text:'Training vergelijkt de kans op flappen met jouw opgenomen actie.'},
  {title:'Oefen met voorbeelden',text:'Tijdens Training past het AI-model zich aan om jouw keuzes beter na te doen.'},
 ],
 rewards:[
  {title:'Kies zelf een actie',text:'Hetzelfde AI-model leest de situatie en kiest flappen of wachten.'},
  {title:'Bekijk het gevolg',text:'Het spel geeft een beloning of straf na de actie.'},
  {title:'Tel gevolgen op',text:'Ook latere beloningen tellen mee in de hele poging.'},
  {title:'Oefen verder',text:'Na volledige pogingen past Training hetzelfde AI-model aan op de gevolgen.'},
 ],
} as const;
/** Read-only identity of the model at the handoff, never an RL result or an update. */
export function inspectHandoff(snapshot?:PolicySnapshot){
 if(!snapshot)return{available:false as const,modelId:undefined,parameters:undefined};
 const fixed=restorePolicySnapshot(snapshot);
 if(snapshot.stage!=='imitation')throw new Error('Gebruik de bewaarde imitatie als startpunt.');
 return{available:true as const,modelId:stableIdentity(fixed.parameters),parameters:Object.freeze(flattenPolicyParameters(fixed.parameters))};
}
export function nextFeedbackStep(step:number){if(!Number.isInteger(step)||step<0||step>3)throw new RangeError('Onbekende uitlegstap');return(step+1)%4;}
