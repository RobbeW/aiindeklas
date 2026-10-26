/// <reference lib="webworker" />
import { runPracticeJob,type PracticeInput } from '../learning/practice-job.ts';
import type { WorkerCommand } from '../core/worker-protocol.ts';
const scope=self as DedicatedWorkerGlobalScope;
let active:{id:string;paused:boolean;cancelled:boolean}|undefined;
scope.addEventListener('message',(event:MessageEvent<WorkerCommand<PracticeInput>>)=>{
  const m=event.data;if(!m||typeof m.jobId!=='string')return;
  if(m.type==='start') {
    if(active){scope.postMessage({type:'error',jobId:m.jobId,message:'Practice worker busy'});return;}
    const state={id:m.jobId,paused:false,cancelled:false};active=state;
    void runPracticeJob(m.payload,{isCancelled:()=>state.cancelled,isPaused:()=>state.paused,
      onProgress:progress=>{if(!state.cancelled)scope.postMessage({type:'progress',jobId:state.id,progress});}})
      .then(result=>{if(!state.cancelled)scope.postMessage({type:'complete',jobId:state.id,result});})
      .catch((e:unknown)=>{if(!state.cancelled)scope.postMessage({type:'error',jobId:state.id,message:e instanceof Error?e.message:String(e)});})
      .finally(()=>{if(active===state)active=undefined;});
  } else if(active?.id===m.jobId) {
    if(m.type==='pause')active.paused=true;
    if(m.type==='resume')active.paused=false;
    if(m.type==='cancel')active.cancelled=true;
  }
});
export {};
