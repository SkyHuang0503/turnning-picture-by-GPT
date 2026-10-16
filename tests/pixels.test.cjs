const { test } = require('node:test');
const assert = require('node:assert/strict');
const { replaceColors, normalizeRegion } = require('../pixels.js');
const region = { x: 0, y: 0, width: 3, height: 2 };
const ranges = [[200, 240], [200, 240], [200, 240]];
const source = new Uint8ClampedArray([
  200, 200, 200, 255, 240, 240, 240, 128, 220, 199, 220, 255,
  210, 220, 230, 255, 220, 220, 220, 0, 241, 220, 220, 255,
]);
test('inclusive RGB bounds, all-channel matching, alpha preservation and immutable input', () => {
  const before = source.slice();
  const result = replaceColors(source, 3, 2, region, ranges, [255, 255, 255]);
  assert.equal(result.matched, 3);
  assert.equal(result.changed, 3);
  assert.deepEqual([...result.data], [255,255,255,255, 255,255,255,128, 220,199,220,255, 255,255,255,255, 220,220,220,0, 241,220,220,255]);
  assert.deepEqual(source, before);
});
test('replacement is restricted to the selected rectangle', () => {
  const result = replaceColors(source, 3, 2, { x: 1, y: 0, width: 1, height: 2 }, ranges, [1, 2, 3]);
  assert.equal(result.changed, 1);
  assert.deepEqual([...result.data.slice(0, 12)], [200,200,200,255, 1,2,3,128, 220,199,220,255]);
  assert.deepEqual(result.data.slice(12), source.slice(12));
});
test('matching target color counts as matched but not changed', () => {
  const result = replaceColors(new Uint8ClampedArray([220,220,220,255]), 1, 1, region, ranges, [220,220,220]);
  assert.equal(result.matched, 1);
  assert.equal(result.changed, 0);
});
test('selection clips to image boundaries', () => {
  assert.deepEqual(normalizeRegion({x: -3, y: 9, width: 99, height: 99}, 3, 2), {x:0,y:1,width:3,height:1});
  assert.deepEqual(normalizeRegion({x:2,y:0,width:0,height:-1},3,2), {x:2,y:0,width:1,height:1});
});
test('invalid range and image input are rejected', () => {
  assert.throws(() => replaceColors(source, 3, 2, region, [[240,200], [0,255], [0,255]], [0,0,0]), /RGB/);
  assert.throws(() => replaceColors(source, 3, 2, region, [[0,256], [0,255], [0,255]], [0,0,0]), /RGB/);
  assert.throws(() => replaceColors(source, 2, 2, region, ranges, [0,0,0]), /圖片/);
});
