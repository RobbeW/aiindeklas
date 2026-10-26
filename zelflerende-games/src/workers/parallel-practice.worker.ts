/// <reference lib="webworker" />
import { runParallelPractice, type ParallelPracticeInput } from '../learning/parallel-practice.ts';
import type { WorkerCommand } from '../core/worker-protocol.ts';
import { comparePracticeModels } from '../learning/practice-check.ts';
const scope=self as DedicatedWorkerGlobalScope;
let active:{id:string;paused:boolean;cancelled:boolean}|undefined;
scope.addEventListener('message',(event:MessageEvent<WorkerCommand<ParallelPracticeInput>>)=>{
  const m=event.data;if(!m||typeof m.jobId!=='string')return;
  if(m.type==='start'){
    if(active){scope.postMessage({type:'error',jobId:m.jobId,message:'Parallel practice worker busy'});return;}
    const state={id:m.jobId,paused:false,cancelled:false};active=state;
    void runParallelPractice(m.payload,{isCancelled:()=>state.cancelled,isPaused:()=>state.paused,
      onProgress:progress=>{if(!state.cancelled)scope.postMessage({type:'progress',jobId:state.id,progress});}})
      .then(result=>{if(!state.cancelled)scope.postMessage({type:'complete',jobId:state.id,result:{...result,modelCheck:comparePracticeModels(m.payload.snapshot,result.snapshot)}});})
      .catch((e:unknown)=>{if(!state.cancelled)scope.postMessage({type:'error',jobId:state.id,message:e instanceof Error?e.message:String(e)});})
      .finally(()=>{if(active===state)active=undefined;});
  }else if(active?.id===m.jobId){if(m.type==='pause')active.paused=true;if(m.type==='resume')active.paused=false;if(m.type==='cancel')active.cancelled=true;}
});
export {};
