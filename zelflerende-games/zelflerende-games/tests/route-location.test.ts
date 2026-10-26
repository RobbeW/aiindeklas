import test from 'node:test';import assert from 'node:assert/strict';
import {readRoute,routeUrl} from '../src/app/route-location.ts';
test('deep links restore valid game stages and reject stages from a different game',()=>{
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=car&step=population')),{page:'car',step:'population'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=flappy&step=population')),{page:'flappy',step:'play'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=__proto__')),{page:'home'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=data&step=teach')),{page:'data'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=games&step=teach')),{page:'games'});
});
test('route changes preserve deployment path and unrelated parameters, clearing stale game steps',()=>{
 const current=new URL('https://example.test/aiindeklas/zelflerende-games/?view=car&step=teach&theme=test#main');
 assert.equal(routeUrl(current,'flappy','compare'),'/aiindeklas/zelflerende-games/?view=flappy&step=compare&theme=test#main');
 assert.equal(routeUrl(current,'data'),'/aiindeklas/zelflerende-games/?view=data&theme=test#main');
 assert.equal(routeUrl(current,'home'),'/aiindeklas/zelflerende-games/?theme=test#main');
});
test('Flappy arena deep links work without adding a fifth reflection step',()=>{
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=flappy&step=arena&lesson=experiment')),{page:'flappy',step:'arena',lesson:'experiment'});
 assert.deepEqual(readRoute(new URL('https://example.test/tool/?view=car&step=arena')),{page:'car',step:'play'});
 assert.equal(routeUrl(new URL('https://example.test/aiindeklas/zelflerende-games/'),'flappy','arena','experiment'),'/aiindeklas/zelflerende-games/?view=flappy&step=arena&lesson=experiment');
});
