'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const info = { teacher: '王老师', classroom: '七年级1班', student: '测试学生' };
const fresh = () => E.createProfile(info);
const sequence = values => { let i = 0; return () => values[i++ % values.length]; };

test('四个卡池包含约定角色，限定池可出现全部四人', () => {
  assert.deepEqual(E.POOLS.english.characters, ['lipu', 'blaze']);
  assert.deepEqual(E.POOLS.math.characters, ['leyou', 'lipu']);
  assert.deepEqual(E.POOLS.chinese.characters, ['lipu', 'liyan']);
  assert.deepEqual(new Set(E.POOLS.event.characters), new Set(Object.keys(E.CHARACTERS)));
  for (const [id, pool] of Object.entries(E.POOLS)) {
    for (let i = 0; i < pool.characters.length; i++) {
      const result = E.draw(fresh(), id, 1, sequence([.5, (i + .5) / pool.characters.length]));
      assert.equal(result.results[0].characterId, pool.characters[i]);
    }
  }
});
test('数学狸谱R使用独立五张卡面，英语卡面和旧收藏保留，跨池仍算重复', () => {
  const mathNumbers = ['08', '11', '12', '13', '15'], englishNumbers = ['04', '06', '09', '10', '14'];
  let p = fresh();
  for (let i = 0; i < 5; i++) {
    const math = E.draw(p, 'math', 1, sequence([.5, .9]), undefined, () => (i + .5) / 5);
    assert.equal(E.getCardDisplay(math.results[0]).image, `assets/characters/lipu-r-${mathNumbers[i]}.png`);
    assert.equal(math.results[0].fragments, i === 0 ? 0 : 1);
    p = JSON.parse(JSON.stringify(math.profile)); assert.ok(E.isValidProfile(p));
    const english = E.draw(fresh(), 'english', 1, sequence([.5, 0]), undefined, () => (i + .5) / 5);
    assert.equal(E.getCardDisplay(english.results[0]).image, `assets/characters/lipu-r-${englishNumbers[i]}.png`);
  }
  assert.equal(p.fragments, 4); assert.equal(Object.keys(p.collection).length, 1);
  assert.equal(E.getCardDisplay(p.collection['lipu:R']).image, 'assets/characters/lipu-r-08.png');
  const crossPool = E.draw(p, 'english', 1, sequence([.5, 0]), undefined, () => .99);
  assert.equal(crossPool.results[0].fragments, 1);
  assert.equal(E.getCardDisplay(crossPool.results[0]).image, 'assets/characters/lipu-r-14.png');
  assert.equal(E.getCardDisplay(crossPool.profile.collection['lipu:R']).image, 'assets/characters/lipu-r-08.png');
  delete p.collection['lipu:R'].artworkPool; delete p.history.at(-1).artworkPool;
  assert.ok(E.isValidProfile(p));
  assert.equal(E.getCardDisplay(p.collection['lipu:R']).image, 'assets/characters/lipu-r-04.png');
});
test('概率边界分别得到 SSR、SR、R', () => {
  for (const [rate, rarity] of [[0, 'SSR'], [.019999, 'SSR'], [.02, 'SR'], [.199999, 'SR'], [.2, 'R'], [.999999, 'R']]) assert.equal(E.draw(fresh(), 'english', 1, sequence([rate, .1])).results[0].rarity, rarity);
});
test('本期英语SSR仅出布蕾兹，R仍含狸谱，限定池保留狸谱SSR', () => {
  for (const characterRate of [0, .25, .5, .999999]) {
    const natural = E.draw(fresh(), 'english', 1, sequence([.01, characterRate]));
    assert.equal(natural.results[0].characterId, 'blaze');
    const nearPity = fresh(); nearPity.total = 79; nearPity.pools.english = { total: 79, pity: 79 };
    const guaranteed = E.draw(nearPity, 'english', 1, () => characterRate);
    assert.equal(guaranteed.results[0].characterId, 'blaze'); assert.equal(guaranteed.results[0].guaranteed, true);
  }
  assert.equal(E.draw(fresh(), 'english', 1, sequence([.9, 0])).results[0].characterId, 'lipu');
  assert.equal(E.draw(fresh(), 'event', 1, sequence([.01, 0])).results[0].characterId, 'lipu');
});
test('本期语文SR仅出独立狸谱卡面，SSR及保底仅出李岩，数学卡面和旧档保留', () => {
  for (const characterRate of [0, .25, .5, .999999]) {
    const sr = E.draw(fresh(), 'chinese', 1, sequence([.1, characterRate]));
    assert.equal(sr.results[0].characterId, 'lipu'); assert.equal(sr.results[0].rarity, 'SR');
    assert.equal(E.getCardDisplay(sr.results[0]).image, 'assets/characters/lipu-sr-chinese.png');
    const ssr = E.draw(fresh(), 'chinese', 1, sequence([.01, characterRate]));
    assert.equal(ssr.results[0].characterId, 'liyan');
    const nearPity = fresh(); nearPity.total = 79; nearPity.pools.chinese = { total: 79, pity: 79 };
    const guaranteed = E.draw(nearPity, 'chinese', 1, () => characterRate);
    assert.equal(guaranteed.results[0].characterId, 'liyan'); assert.equal(guaranteed.results[0].guaranteed, true);
    assert.equal(guaranteed.profile.pools.chinese.pity, 0);
  }
  const chinese = E.draw(fresh(), 'chinese', 1, sequence([.1, .9])).profile;
  const math = E.draw(JSON.parse(JSON.stringify(chinese)), 'math', 1, sequence([.1, 0]), undefined, () => .99);
  assert.equal(E.getCardDisplay(math.results[0]).image, 'assets/characters/lipu-sr-02.png');
  assert.equal(math.results[0].fragments, 1);
  assert.equal(E.getCardDisplay(math.profile.collection['lipu:SR']).image, 'assets/characters/lipu-sr-chinese.png');
  assert.ok(E.isValidProfile(math.profile));
  let legacy = E.draw(fresh(), 'event', 1, sequence([.1, .99])).profile;
  legacy = E.draw(legacy, 'event', 1, sequence([.01, 0])).profile;
  legacy.pools.chinese = { ...legacy.pools.event }; legacy.pools.event = { total: 0, pity: 0 };
  legacy.history.forEach(item => { item.poolId = 'chinese'; });
  assert.ok(E.isValidProfile(legacy));
  const next = E.draw(legacy, 'chinese', 1, sequence([.1, 0]));
  assert.ok(next.profile.collection['liyan:SR']); assert.ok(next.profile.collection['lipu:SSR']);
  assert.equal(next.results[0].characterId, 'lipu'); assert.ok(E.isValidProfile(next.profile));
});
test('本期数学SR仅出狸谱双卡面，自然SSR和80抽保底仅出乐游', () => {
  for (const characterRate of [0, .25, .5, .999999]) {
    assert.equal(E.draw(fresh(), 'math', 1, sequence([.01, characterRate])).results[0].characterId, 'leyou');
    const nearPity = fresh(); nearPity.total = 79; nearPity.pools.math = { total: 79, pity: 79 };
    const guaranteed = E.draw(nearPity, 'math', 1, () => characterRate);
    assert.equal(guaranteed.results[0].characterId, 'leyou'); assert.equal(guaranteed.results[0].guaranteed, true);
    assert.equal(guaranteed.profile.pools.math.pity, 0);
  }
  const first = E.draw(fresh(), 'math', 1, sequence([.1, .99]), undefined, () => 0);
  assert.equal(first.results[0].characterId, 'lipu'); assert.equal(first.results[0].rarity, 'SR');
  assert.equal(E.getCardDisplay(first.results[0]).image, 'assets/characters/lipu-sr-01.png');
  const second = E.draw(JSON.parse(JSON.stringify(first.profile)), 'math', 1, sequence([.1, 0]), undefined, () => .99);
  assert.equal(E.getCardDisplay(second.results[0]).image, 'assets/characters/lipu-sr-02.png');
  assert.equal(second.results[0].duplicate, true); assert.equal(second.profile.fragments, 1);
  assert.equal(second.profile.collection['lipu:SR'].artIndex, 0); assert.ok(E.isValidProfile(second.profile));
});
test('早期数学乐游SR和狸谱SSR记录保留，继续抽卡使用本期范围', () => {
  let legacy = E.draw(fresh(), 'event', 1, sequence([.1, .6])).profile;
  legacy = E.draw(legacy, 'event', 1, sequence([.01, 0])).profile;
  legacy.pools.math = { ...legacy.pools.event }; legacy.pools.event = { total: 0, pity: 0 };
  legacy.history.forEach(item => { item.poolId = 'math'; delete item.artIndex; });
  Object.values(legacy.collection).forEach(card => { delete card.artIndex; });
  assert.ok(E.isValidProfile(legacy));
  const next = E.draw(legacy, 'math', 1, sequence([.1, 0]));
  assert.equal(next.results[0].characterId, 'lipu'); assert.equal(next.results[0].rarity, 'SR');
  assert.ok(next.profile.collection['leyou:SR']); assert.ok(next.profile.collection['lipu:SSR']);
  assert.ok(E.isValidProfile(next.profile));
});
test('三款英语SR书签分别入库，同款重复转化1碎片，保存后仍有效', () => {
  let p = fresh();
  for (let i = 0; i < 3; i++) {
    const outcome = E.draw(p, 'english', 1, sequence([.1, (i + .5) / 3]));
    assert.equal(outcome.results[0].characterId, null);
    assert.equal(outcome.results[0].bookmarkId, `english-bookmark-0${i + 1}`);
    assert.equal(outcome.results[0].duplicate, false); assert.equal(outcome.results[0].fragments, 0);
    p = outcome.profile;
  }
  assert.equal(Object.keys(p.collection).length, 3); assert.equal(p.pools.english.pity, 3);
  const duplicate = E.draw(JSON.parse(JSON.stringify(p)), 'english', 1, sequence([.1, .1]));
  assert.equal(duplicate.results[0].duplicate, true); assert.equal(duplicate.results[0].fragments, 1);
  assert.equal(Object.keys(duplicate.profile.collection).length, 3); assert.ok(E.isValidProfile(duplicate.profile));
  assert.equal(E.getCardDisplay(duplicate.results[0]).name, '书签卡 01');
});
test('旧版英语角色SR存档仍可读取，继续抽卡得到新书签而非角色SR', () => {
  const legacy = E.draw(fresh(), 'chinese', 1, sequence([.1, 0])).profile;
  legacy.pools.english.total = 1; legacy.pools.english.pity = 1;
  legacy.pools.chinese.total = 0; legacy.pools.chinese.pity = 0; legacy.history[0].poolId = 'english';
  assert.ok(E.isValidProfile(legacy));
  const next = E.draw(legacy, 'english', 1, sequence([.1, 0]));
  assert.ok(next.profile.collection['lipu:SR']); assert.ok(next.profile.collection['english-bookmark-01:SR']);
  assert.equal(next.results[0].duplicate, false); assert.ok(E.isValidProfile(next.profile));
});
test('连续79抽未出SSR，第80抽必出并重置，81抽重新计数', () => {
  let p = fresh(); p.tickets = 200;
  for (let i = 0; i < 79; i++) p = E.draw(p, 'english', 1, () => .99).profile;
  assert.equal(p.pools.english.pity, 79); assert.equal(p.total, 79);
  const at80 = E.draw(p, 'english', 1, () => .99);
  assert.equal(at80.results[0].rarity, 'SSR'); assert.equal(at80.results[0].guaranteed, true); assert.equal(at80.profile.pools.english.pity, 0);
  const at81 = E.draw(at80.profile, 'english', 1, () => .99);
  assert.equal(at81.results[0].rarity, 'R'); assert.equal(at81.profile.pools.english.pity, 1);
});
test('提前抽到SSR立即重置保底，下一抽重新开始', () => {
  let p = fresh(); for (let i = 0; i < 35; i++) p = E.draw(p, 'english', 1, () => .9).profile;
  const outcome = E.draw(p, 'english', 1, sequence([.01, .2]));
  assert.equal(outcome.results[0].guaranteed, false); assert.equal(outcome.profile.pools.english.pity, 0);
  assert.equal(E.draw(outcome.profile, 'english', 1, () => .9).profile.pools.english.pity, 1);
});
test('十连跨越80抽边界，在正确抽数保底并计算余下进度', () => {
  let p = fresh(); for (let i = 0; i < 75; i++) p = E.draw(p, 'math', 1, () => .99).profile;
  const outcome = E.draw(p, 'math', 10, () => .99);
  assert.equal(outcome.results.length, 10); assert.equal(outcome.results[4].sequence, 80);
  assert.equal(outcome.results[4].guaranteed, true); assert.equal(outcome.results[4].rarity, 'SSR');
  assert.equal(outcome.profile.pools.math.pity, 5); assert.equal(outcome.profile.total, 85); assert.equal(outcome.profile.tickets, 15);
});
test('十连中提前SSR重置，不会继续触发旧的80抽保底', () => {
  let p = fresh(); for (let i = 0; i < 75; i++) p = E.draw(p, 'english', 1, () => .9).profile;
  const samples = [.9, .1, .01, .1, ...Array(16).fill(.9)]; let index = 0;
  const outcome = E.draw(p, 'english', 10, () => samples[index++]);
  assert.equal(outcome.results[1].rarity, 'SSR'); assert.equal(outcome.results.some(item => item.guaranteed), false); assert.equal(outcome.profile.pools.english.pity, 8);
});
test('各卡池保底独立，切池不清空，累计抽数汇总', () => {
  let p = E.draw(fresh(), 'english', 10, () => .9).profile;
  p = E.draw(p, 'math', 1, () => .9).profile;
  p = E.draw(p, 'chinese', 1, sequence([.01, .1])).profile;
  assert.equal(p.pools.english.pity, 10); assert.equal(p.pools.math.pity, 1); assert.equal(p.pools.chinese.pity, 0); assert.equal(p.pools.event.pity, 0); assert.equal(p.total, 12);
});
test('首次入库，重复R与SR各得1碎片，重复SSR得2碎片', () => {
  let p = fresh();
  for (const [rate, rarity, reward] of [[.5, 'R', 1], [.1, 'SR', 1], [.01, 'SSR', 2]]) {
    const first = E.draw(p, 'english', 1, sequence([rate, .1]));
    assert.equal(first.results[0].duplicate, false); assert.equal(first.results[0].fragments, 0);
    const second = E.draw(first.profile, 'english', 1, sequence([rate, .1]));
    assert.equal(second.results[0].rarity, rarity); assert.equal(second.results[0].duplicate, true); assert.equal(second.results[0].fragments, reward); p = second.profile;
  }
  assert.equal(Object.keys(p.collection).length, 3); assert.equal(p.fragments, 4);
});
test('不同卡池的同角色同稀有度仍算重复，稀有度不同为新卡', () => {
  let p = E.draw(fresh(), 'english', 1, sequence([.9, .1])).profile;
  const repeated = E.draw(p, 'math', 1, sequence([.9, .9]));
  assert.equal(repeated.results[0].characterId, 'lipu'); assert.equal(repeated.results[0].fragments, 1);
  const newRarity = E.draw(repeated.profile, 'chinese', 1, sequence([.1, .1]));
  assert.equal(newRarity.results[0].duplicate, false); assert.equal(Object.keys(newRarity.profile.collection).length, 2);
});
test('十连同批次重复即时转化', () => {
  const outcome = E.draw(fresh(), 'event', 10, () => .9);
  assert.equal(outcome.results[0].duplicate, false); assert.equal(outcome.results.filter(item => item.duplicate).length, 9); assert.equal(outcome.profile.fragments, 9); assert.equal(outcome.profile.tickets, 90);
});
test('兑换只消耗10碎片增加1机会，不影响累计、保底和收藏', () => {
  let p = E.draw(fresh(), 'english', 10, () => .9).profile;
  assert.throws(() => E.exchange(p), /10/);
  p = E.draw(p, 'english', 1, () => .9).profile;
  const next = E.exchange(p);
  assert.equal(next.fragments, 0); assert.equal(next.tickets, p.tickets + 1); assert.equal(next.total, p.total); assert.deepEqual(next.pools, p.pools); assert.deepEqual(next.collection, p.collection); assert.equal(p.fragments, 10);
});
test('机会不足拒绝单抽或十连，不改变原档案', () => {
  const p = fresh(); p.tickets = 9; const snapshot = JSON.stringify(p);
  assert.throws(() => E.draw(p, 'english', 10), /不足/); assert.equal(JSON.stringify(p), snapshot);
  p.tickets = 0; assert.throws(() => E.draw(p, 'english', 1), /不足/);
});
test('操作返回新档案，不原地修改；中途失败无部分扣除', () => {
  const p = fresh(), snapshot = JSON.stringify(p);
  E.draw(p, 'english', 10, () => .9); assert.equal(JSON.stringify(p), snapshot);
  let counter = 0; assert.throws(() => E.draw(p, 'english', 10, () => ++counter === 5 ? 1 : .9), /随机数/); assert.equal(JSON.stringify(p), snapshot);
});
test('档案身份校验和前后空格处理', () => {
  assert.equal(E.identityKey({ ...info, student: ' 测试学生 ' }), E.identityKey(info));
  assert.throws(() => E.createProfile({ ...info, teacher: '  ' }), /填写/);
  assert.throws(() => E.createProfile({ ...info, classroom: '长'.repeat(31) }), /30/);
  const p = E.createProfile({ ...info, student: ' 测试学生 ' }); assert.equal(p.info.student, info.student);
  assert.notEqual(E.identityKey({ ...info, teacher: '李老师' }), E.identityKey(info));
});
test('非法卡池、次数和坏存档被拒绝', () => {
  assert.throws(() => E.draw(fresh(), 'other', 1), /卡池/);
  assert.throws(() => E.draw(fresh(), 'english', 5), /单抽/);
  const p = fresh(); p.pools.english.pity = 80; assert.equal(E.isValidProfile(p), false); assert.throws(() => E.draw(p, 'english', 1), /无效/);
});
test('长时间抽卡保留最近200条，但总抽数完整且保底始终有效', () => {
  let p = fresh(); p.tickets = 1000;
  for (let i = 0; i < 31; i++) p = E.draw(p, 'event', 10, () => .9).profile;
  assert.equal(p.history.length, 200); assert.equal(p.history[0].sequence, 310); assert.equal(p.history.at(-1).sequence, 111); assert.equal(p.total, 310); assert.equal(p.pools.event.pity, 70); assert.ok(E.isValidProfile(p));
});
