import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SceneTransition} from '../src/demo/scene-transition.ts';

test('holds old scene until preparation then swaps once and excludes paused time',async()=>{
 const opacity:number[][]=[];let ready!:()=>void,swaps=0,finishes=0;
 const transition=new SceneTransition((a,b)=>opacity.push([a,b]),false);
 const pending=transition.start(()=>new Promise<void>(resolve=>{ready=resolve;}),()=>swaps++,()=>finishes++);
 transition.tick(1000,false);assert.equal(swaps,0);assert.deepEqual(opacity.at(-1),[1,0]);
 ready();await pending;transition.tick(180,true);assert.equal(swaps,0);
 transition.tick(179,false);assert.equal(swaps,0);transition.tick(1,false);assert.equal(swaps,1);
 transition.tick(260,false);assert.equal(finishes,1);assert.equal(transition.active,false);assert.deepEqual(opacity.at(-1),[0,1]);
});
test('replacement and cancellation ignore late preparation and stale errors',async()=>{
 let ready!:()=>void,reject!: (e:Error)=>void,swaps=0;
 const transition=new SceneTransition(()=>{},false);
 const old=transition.start(()=>new Promise<void>((resolve,fail)=>{ready=resolve;reject=fail;}),()=>swaps++,()=>{});
 const next=transition.start(async()=>{},()=>swaps++,()=>{});await next;ready();await old;
 transition.tick(180,false);assert.equal(swaps,1);transition.cancel();transition.tick(1000,false);assert.equal(transition.active,false);
 const stale=transition.start(()=>new Promise<void>((_resolve,fail)=>{reject=fail;}),()=>swaps++,()=>{});
 transition.cancel();reject(new Error('late'));await stale;assert.equal(swaps,1);
});
test('reduced motion swaps on an unpaused tick with no fade duration',async()=>{
 let swaps=0,done=0;const transition=new SceneTransition(()=>{},true);
 await transition.start(async()=>{},()=>swaps++,()=>done++);assert.equal(swaps,0);assert.equal(transition.active,true);
 transition.tick(0,false);assert.equal(swaps,1);assert.equal(done,1);assert.equal(transition.active,false);
});
test('reduced preparation completion cannot swap while the operator is paused',async()=>{
 let ready!:()=>void,swaps=0,done=0;const opacities:number[][]=[];
 const transition=new SceneTransition((a,b)=>opacities.push([a,b]),true);
 const preparation=transition.start(()=>new Promise<void>(r=>{ready=r;}),()=>swaps++,()=>done++);
 transition.tick(10,true);ready();await preparation;transition.tick(1000,true);
 assert.equal(swaps,0);assert.equal(done,0);assert.equal(transition.active,true);assert.deepEqual(opacities.at(-1),[1,0]);
 transition.tick(0,false);assert.equal(swaps,1);assert.equal(done,1);assert.equal(transition.active,false);assert.deepEqual(opacities.at(-1),[0,1]);
});
