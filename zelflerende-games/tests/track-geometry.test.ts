import test from 'node:test';import assert from 'node:assert/strict';
import { createRoadGeometry,pointOnTile,rotatePoint,tileCenterline } from '../src/tracks/geometry.ts';
import { TRACK_VERSION,validateCircuit,tilePorts,type Tile } from '../src/tracks/document.ts';
test('all rotations have matching centerlines, analytic inner/outer boundaries and exact ray exits',()=>{
  for(const rotation of [0,1,2,3] as const){
    const tile:Tile={x:1,y:1,kind:'turn',rotation};
    const doc=validateCircuit({version:TRACK_VERSION,width:3,height:3,cells:[tile]});const road=createRoadGeometry(doc,false);
    const line=tileCenterline(tile,tilePorts(tile)[0]!);assert.ok(line.every(p=>road.contains(p)));
    const point=(r:number)=>{const p=rotatePoint({x:100-r/Math.sqrt(2),y:r/Math.sqrt(2)},rotation);return{x:p.x+100,y:p.y+100};};
    assert.equal(pointOnTile(tile,point(24)),true);assert.equal(pointOnTile(tile,point(76)),true);
    assert.equal(pointOnTile(tile,point(23.9)),false);assert.equal(pointOnTile(tile,point(76.1)),false);
    assert.ok(Math.abs(road.rayDistance(point(50),3*Math.PI/4+rotation*Math.PI/2)-26)<1e-7);
    assert.ok(Math.abs(road.rayDistance(point(50),-Math.PI/4+rotation*Math.PI/2)-26)<1e-7);
  }
});
test('straight seams have no collision gap and raycasts pass joins until a real road exit',()=>{
  const road=createRoadGeometry(validateCircuit({version:TRACK_VERSION,width:3,height:3,cells:[0,1,2].map(y=>({x:1,y,kind:'straight',rotation:0}))}),false);
  assert.ok(road.contains({x:150,y:99.999}));assert.ok(road.contains({x:150,y:100.001}));
  assert.equal(road.rayDistance({x:150,y:50},0),26);
  assert.equal(road.rayDistance({x:150,y:50},Math.PI/2,350),250);
  assert.equal(road.rayDistance({x:0,y:0},0),0);
});
