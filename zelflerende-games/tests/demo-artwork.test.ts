import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile,readdir} from 'node:fs/promises';
import {DEMO_ARTWORK,darwinArtworkPhase} from '../src/demo/artwork.ts';
import {DEMO_SCENES} from '../src/demo/timeline.ts';

test('every demo splash has supplied artwork; actual game scenes keep live renderers',()=>{
 const scenes=DEMO_SCENES.filter(scene=>scene.kind==='splash').map(scene=>scene.id);
 assert.deepEqual(Object.keys(DEMO_ARTWORK).filter(id=>id!=='f-training').sort(),scenes.sort());
 for(const scene of DEMO_SCENES.filter(scene=>scene.kind==='activity'&&scene.id!=='f-training'))assert.equal(DEMO_ARTWORK[scene.id],undefined);
 assert.equal(DEMO_ARTWORK['f-training']!.length,1); // Adjacent explanation, not the live canvas.
});
test('all supplied scene assets exist as valid PNGs with alpha; no artwork is orphaned',async()=>{
 const paths=new Set(Object.values(DEMO_ARTWORK).flat().map(frame=>frame.file));
 const directory=new URL('../public/assets/demo/',import.meta.url);
 assert.deepEqual([...paths].sort(),(await readdir(directory)).filter(file=>file.endsWith('.png')).sort());
 assert.equal(paths.size,14);
 for(const file of paths){
  assert.match(file,/^\d\d-[a-z-]+\.png$/);
  const bytes=await readFile(new URL(file,directory));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(bytes.readUInt32BE(16)>=1900,file);assert.ok(bytes.readUInt32BE(20)>=790,file);assert.equal(bytes[25],6,`${file}: RGBA`);
 }
});
test('Darwin stage boundaries preserve the existing four-second sequence and clamp final frame',()=>{
 assert.deepEqual([0,3999,4000,7999,8000,11999,12000,15999,16000].map(darwinArtworkPhase),[0,0,1,1,2,2,3,3,3]);
 assert.equal(darwinArtworkPhase(-1),0);assert.equal(darwinArtworkPhase(NaN),0);
 const frames=DEMO_ARTWORK['c-darwin']!;assert.equal(frames.length,4);
 assert.match(frames[0]!.alt,/eigen AI-model/);assert.match(frames[3]!.alt,/beste model blijft bewaard/);
});
