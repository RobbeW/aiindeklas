export type TrainingGymStatus='running'|'stopping'|'complete'|'cancelled'|'error';
export interface TrainingGymState {readonly status:TrainingGymStatus;readonly completed:number;readonly budget:number;readonly message:string;}
export type TrainingGymEvent={type:'progress';completed:number}|{type:'stop'}|{type:'complete';completed:number}|{type:'cancelled'|'error';message:string};
export function startTrainingGym(budget:number):TrainingGymState{
 if(!Number.isSafeInteger(budget)||budget<1)throw new Error('Invalid training budget');
 return{status:'running',completed:0,budget,message:'De computer oefent met je voorbeelden.'};
}
/** A final update is not a saved result. Terminal states ignore late worker updates. */
export function updateTrainingGym(state:TrainingGymState,event:TrainingGymEvent):TrainingGymState{
 if(!['running','stopping'].includes(state.status))return state;
 if(event.type==='progress'){
  if(state.status!=='running'||!Number.isSafeInteger(event.completed)||event.completed<state.completed||event.completed>state.budget)return state;
  return{...state,completed:event.completed,message:event.completed===state.budget?'Het resultaat wordt afgerond…':state.message};
 }
 if(event.type==='stop')return{...state,status:'stopping',message:'Training stoppen…'};
 if(event.type==='complete'){
  if(state.status!=='running')return state;
  if(event.completed!==state.budget)return{...state,status:'error',message:'De training is niet volledig afgerond. Bekijk de melding bij je voorbeelden.'};
  return{...state,status:'complete',completed:event.completed,message:'Je AI-model is klaar. Kies Test jouw AI-model.'};
 }
 return{...state,status:event.type,message:event.message};
}
