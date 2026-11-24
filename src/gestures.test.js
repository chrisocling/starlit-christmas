import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyGesture, GestureStabilizer } from './gestures.js';

function hand(shape){
  const points=Array.from({length:21},()=>({x:0,y:0,z:0}));
  points[1]={x:-.3,y:.12,z:0};points[2]={x:-.6,y:.3,z:0};points[3]={x:-.8,y:.55,z:0};points[4]={x:-1,y:.75,z:0};
  for(const [i,x] of [[5,-.55],[9,-.18],[13,.2],[17,.53]]){
    points[i]={x,y:.35,z:0};points[i+1]={x,y:.8,z:0};points[i+2]={x,y:shape==='fist'?.55:1.15,z:0};points[i+3]={x,y:shape==='fist'?.3:1.5,z:0};
  }
  if(shape==='fist')points[4]={x:-.5,y:.4,z:0};
  if(shape==='pinch'){points[8]={x:-.5,y:.97,z:0};points[4]={x:-.57,y:.98,z:0};}
  return points;
}
test('distinguishes an open palm, a closed fist, and a fingertip pinch',()=>{
  assert.equal(classifyGesture(hand('open')),'scatter');
  assert.equal(classifyGesture(hand('fist')),'tree');
  assert.equal(classifyGesture(hand('pinch')),'heart');
});
test('gestures remain recognizable after rotation, mirroring, translation, and scaling',()=>{
  for(const [shape,expected] of [['open','scatter'],['fist','tree'],['pinch','heart']]){
    const transformed=hand(shape).map(p=>({x:2+(-p.x*Math.cos(1.4)-p.y*Math.sin(1.4))*.04,y:3+(-p.x*Math.sin(1.4)+p.y*Math.cos(1.4))*.04,z:0}));
    assert.equal(classifyGesture(transformed),expected);
  }
});
test('ignores absent, incomplete, nonfinite, and degenerate landmarks',()=>{
  for(const input of [undefined,[],hand('open').slice(1),Array(21).fill({x:0,y:0}),Array(21).fill({x:NaN,y:0})])assert.equal(classifyGesture(input),null);
});
test('requires a sustained gesture and only emits each change once',()=>{
  const s=new GestureStabilizer();
  assert.equal(s.update('heart',0),null);assert.equal(s.update('heart',200),null);assert.equal(s.update('heart',300),'heart');assert.equal(s.update('heart',1000),null);
  assert.equal(s.update('tree',1100),null);assert.equal(s.update('tree',1400),'tree');
});
test('brief tracking loss and changing candidates reset the hold period',()=>{
  const s=new GestureStabilizer();
  s.update('scatter',0);s.update(null,200);assert.equal(s.update('scatter',250),null);assert.equal(s.update('tree',400),null);assert.equal(s.update('tree',650),null);assert.equal(s.update('tree',700),'tree');
});
test('cooldown prevents flicker and reset allows the same gesture to trigger again',()=>{
  const s=new GestureStabilizer({hold:100,cooldown:800});
  s.update('heart',0);assert.equal(s.update('heart',101),'heart');s.update('tree',110);assert.equal(s.update('tree',250),null);assert.equal(s.update('tree',950),'tree');s.reset();s.update('tree',1000);assert.equal(s.update('tree',1101),'tree');
});
