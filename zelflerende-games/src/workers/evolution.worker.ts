/// <reference lib="webworker" />
import { CAR_MAX_PLAYBACK_SPEED } from '../config/workload-presets.ts';
import { runEvolutionJob,type EvolutionInput } from '../evolution/generation-job.ts';
import type { WorkerCommand,WorkerEvent } from '../core/worker-protocol.ts';

const scope=self as DedicatedWorkerGlobalScope;
type LocalCommand=WorkerCommand<EvolutionInput>|{readonly type:'speed';readonly jobId:string;readonly speed:number};
let active:{id:string;paused:boolean;cancelled:boolean;speed:number}|undefined;
scope.addEventListener('message',(event:MessageEvent<unknown>)=>{
  const message=event.data as LocalCommand;
  if(!message||typeof message!=='object'||typeof message.jobId!=='string')return;
  if(message.type==='start'){
    if(active){scope.postMessage({type:'error',jobId:message.jobId,code:'busy',message:'Evolution worker already has an active job'} satisfies WorkerEvent);return;}
    const state={id:message.jobId,paused:false,cancelled:false,speed:message.payload.visualSpeed??1};active=state;
    let lastGeneration=0;
    void runEvolutionJob(message.payload,{isCancelled:()=>state.cancelled,isPaused:()=>state.paused,getSpeed:()=>state.speed,onProgress:progress=>{if(message.payload.generationStep&&progress.completedGenerations>lastGeneration&&progress.completedGenerations<message.payload.generationBudget)state.paused=true;lastGeneration=progress.completedGenerations;if(!state.cancelled)scope.postMessage({type:'progress',jobId:state.id,progress} satisfies WorkerEvent);}})
      .then(result=>{if(!state.cancelled)scope.postMessage({type:'complete',jobId:state.id,result} satisfies WorkerEvent);})
      .catch((error:unknown)=>{if(!state.cancelled)scope.postMessage({type:'error',jobId:state.id,code:error instanceof Error?error.name:'Error',message:error instanceof Error?error.message:String(error)} satisfies WorkerEvent);})
      .finally(()=>{if(active===state)active=undefined;});
    return;
  }
  if(!active||message.jobId!==active.id)return;
  if(message.type==='pause')active.paused=true;
  else if(message.type==='resume')active.paused=false;
  else if(message.type==='cancel')active.cancelled=true;
  else if(message.type==='speed'&&Number.isFinite(message.speed)&&message.speed>=.5&&message.speed<=CAR_MAX_PLAYBACK_SPEED)active.speed=message.speed;
});
export {};
