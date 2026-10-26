import { WorkerJobClient,type WorkerJob } from '../core/worker-client.ts';
import type { WorkerPort } from '../core/worker-protocol.ts';
import type { PracticeInput,PracticeProgress,PracticeResult } from './practice-job.ts';
import { createPolicySnapshot,restorePolicySnapshot,type PolicySnapshot } from './policy-snapshot.ts';

/** Own one cancellable job. Only complete on-policy batches may replace the saved snapshot. */
export class PracticeSession {
  private readonly client:WorkerJobClient<PracticeInput,PracticeProgress,PracticeResult>;
  private latest:PolicySnapshot|undefined;
  private epoch=0;
  constructor(factory:()=>WorkerPort){this.client=new WorkerJobClient(factory);}
  get completedSnapshot(){return this.latest;}
  start(input:PracticeInput,onProgress?:(value:PracticeProgress)=>void):WorkerJob<PracticeProgress,PracticeResult> {
    const token=++this.epoch;
    this.latest=createPolicySnapshot(restorePolicySnapshot(input.snapshot),input.snapshot);
    const job=this.client.start(input,value=>{
      if(token!==this.epoch)return;
      this.latest=createPolicySnapshot(restorePolicySnapshot(value.snapshot),value.snapshot);
      onProgress?.(value);
    });
    return {...job,promise:job.promise.then(result=>{
      if(token===this.epoch)this.latest=createPolicySnapshot(restorePolicySnapshot(result.snapshot),result.snapshot);
      return result;
    })};
  }
  pause(){this.client.pause();}
  resume(){this.client.resume();}
  cancel(){this.epoch++;this.client.cancel();}
  dispose(){this.epoch++;this.client.dispose();}
}
