import test from 'node:test';import assert from 'node:assert/strict';
import {ArenaControllers,type ArenaPad} from '../src/input/arena-controllers.ts';
const pad=(index:number,pressed=false,mapping='standard',button=0):ArenaPad=>({index,id:`controller-${index}`,connected:true,mapping,buttons:Array.from({length:4},(_,i)=>({pressed:i===button&&pressed}))});
function ready(){const c=new ArenaControllers();c.poll([pad(2,true),pad(4,true),pad(7,true)],'lobby');c.poll([pad(2),pad(4),pad(7)],'lobby');c.poll([pad(2,true),pad(4,true),pad(7,true)],'lobby');return c;}
test('three devices claim independent seats; joining is not ready or a flap; second press readies',()=>{
 const c=new ArenaControllers();assert.deepEqual(c.poll([pad(2,true),null,pad(4,true),pad(7,true)],'lobby').joined,[0,1,2]);assert.equal(c.allReady,false);assert.deepEqual(c.consume(),[0,0,0]);
 c.poll([pad(2,true),pad(4,true),pad(7,true)],'lobby');assert.equal(c.allReady,false);
 c.poll([pad(2),pad(4),pad(7)],'lobby');assert.deepEqual(c.poll([pad(2,true),pad(4,true),pad(7,true)],'lobby').readied,[0,1,2]);assert.equal(c.allReady,true);
 c.poll([pad(2,true),pad(4,true),pad(7,true),pad(9,true)],'lobby');assert.equal(c.seats.length,3);assert.equal(c.seats[2]?.index,7);
});
test('fresh presses queue one flap for one fixed step; holding and ready/countdown never leak',()=>{
 const c=ready();c.barrier([pad(2,true),pad(4,true),pad(7,true)]);c.poll([pad(2,true),pad(4,true),pad(7,true)],'game');assert.deepEqual(c.consume(),[0,0,0]);
 c.poll([pad(2),pad(4),pad(7)],'countdown');c.poll([pad(2,true),pad(4),pad(7)],'countdown');c.poll([pad(2,true),pad(4),pad(7)],'game');assert.deepEqual(c.consume(),[0,0,0]);
 c.poll([pad(2),pad(4),pad(7)],'game');c.poll([pad(2),pad(4,true),pad(7,true)],'game');assert.deepEqual(c.consume(),[0,1,1]);assert.deepEqual(c.consume(),[0,0,0]);
});
test('disconnect clears pending flaps; replacement requires explicit fresh press and keeps other seats',()=>{
 const c=ready();c.poll([pad(2),pad(4),pad(7)],'game');c.poll([pad(2,true),null,pad(7)],'game');assert.equal(c.allConnected,false);assert.deepEqual(c.consume(),[0,0,0]);
 c.poll([pad(2),pad(4),pad(7)],'paused');assert.equal(c.seats[1]?.connected,false);
 const events=c.poll([pad(2),pad(4,true),pad(7)],'paused');assert.deepEqual(events.joined,[1]);assert.equal(c.allConnected,true);assert.equal(c.seats[0]?.index,2);
});
test('unknown mapping learns one button, reset blocks held buttons from claiming new seats',()=>{
 const c=new ArenaControllers();c.poll([pad(5,true,'',2)],'lobby');assert.equal(c.seats[0]?.button,2);assert.equal(c.seats[0]?.standard,false);
 c.reset([pad(5,true,'',2)]);c.poll([pad(5,true,'',2)],'lobby');assert.equal(c.seats[0],undefined);
 c.poll([pad(5,false,'',2)],'lobby');c.poll([pad(5,true,'',2)],'lobby');assert.ok(c.seats.some(s=>s?.index===5));
});
