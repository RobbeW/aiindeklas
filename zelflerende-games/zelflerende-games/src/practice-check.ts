import { PracticeSession } from './learning/practice-session.ts';
import { BernoulliPolicy } from './learning/policy.ts';
import { createPolicySnapshot } from './learning/policy-snapshot.ts';
const session=new PracticeSession(()=>new Worker(new URL('./workers/practice.worker.ts',import.meta.url),{type:'module'}));
const start=document.querySelector<HTMLButtonElement>('#start')!;
const cancel=document.querySelector<HTMLButtonElement>('#cancel')!;
const status=document.querySelector<HTMLElement>('#status')!;
let beats=0;
const timer=setInterval(()=>{document.querySelector('#heartbeat')!.textContent=`Main-thread heartbeat ${++beats}`;},100);
start.onclick=()=>{
  start.disabled=true;cancel.disabled=false;
  const job=session.start({snapshot:createPolicySnapshot(new BernoulliPolicy(1222),{stage:'imitation',datasetProvenance:['synthetic_reference:untrained_diagnostic']}),episodeBudget:512,stepBudget:100000,environmentSeed:1100,actionSeed:9000},p=>{
    status.textContent=JSON.stringify({episodes:p.episodes,steps:p.steps,simulatedSeconds:p.simulatedSeconds,elapsedMs:p.elapsedMs,stepsPerSecond:p.stepsPerSecond,trainedEpisodes:p.trainedEpisodes});
  });
  void job.promise.then(r=>{status.textContent=`Complete ${JSON.stringify(r.reason)}; ${r.episodes} attempts, ${r.steps} steps, ${Math.round(r.stepsPerSecond)} steps/sec`;})
    .catch(e=>{status.textContent=e.message;}).finally(()=>{start.disabled=false;cancel.disabled=true;});
};
cancel.onclick=()=>session.cancel();
window.addEventListener('pagehide',()=>{session.dispose();clearInterval(timer);});
