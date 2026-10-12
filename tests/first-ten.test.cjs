'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const fresh = () => E.createProfile({ teacher: '王老师', classroom: '测试班', student: '测试学生' });
const sequence = values => { let i = 0; return () => values[i++ % values.length]; };

test('首次十连整组概率边界正确，稀有卡随机落在任意位置，其余均为R', () => {
  for (const poolId of Object.keys(E.POOLS)) {
    for (const [rate, rarity] of [[0, 'SSR'], [.019999, 'SSR'], [.02, 'SR'], [.079999, 'SR'], [.08, 'R'], [.999999, 'R']]) {
      for (let position = 0; position < 10; position++) {
        let call = 0;
        const outcome = E.draw(fresh(), poolId, 10, () => [rate, (position + .5) / 10][call++] ?? 0, undefined, () => 0);
        assert.deepEqual(outcome.results.map(card => card.rarity), Array.from({ length: 10 }, (_, i) => i === position ? rarity : 'R'));
        assert.ok(outcome.results.every(card => !card.guaranteed));
        assert.equal(outcome.profile.tickets, 90); assert.equal(outcome.profile.total, 10);
        assert.equal(outcome.profile.pools[poolId].firstTenUsed, true);
        assert.equal(outcome.profile.pools[poolId].pity, rarity === 'SSR' ? 9 - position : 10);
      }
    }
  }
});
test('均匀覆盖随机区间，每池单抽和首次十连均为2% SSR、6% SR、92% R', () => {
  for (const poolId of Object.keys(E.POOLS)) {
    const singles = { SSR: 0, SR: 0, R: 0 }, batches = { SSR: 0, SR: 0, R: 0 };
    for (let i = 0; i < 1000; i++) {
      const rate = (i + .5) / 1000;
      singles[E.draw(fresh(), poolId, 1, sequence([rate, .5]), undefined, () => 0).results[0].rarity]++;
      let call = 0;
      const cards = E.draw(fresh(), poolId, 10, () => call++ === 0 ? rate : .5, undefined, () => 0).results;
      batches[cards.find(card => card.rarity !== 'R')?.rarity || 'R']++;
    }
    assert.deepEqual(singles, { SSR: 20, SR: 60, R: 920 }); assert.deepEqual(batches, singles);
  }
});
test('后续十连保留逐抽SSR 2%、SR 8%、R 90%，可以有多张稀有卡', () => {
  for (const poolId of Object.keys(E.POOLS)) {
    const p = JSON.parse(JSON.stringify(E.draw(fresh(), poolId, 10, () => .9).profile));
    for (const [rate, rarity] of [[.019999, 'SSR'], [.02, 'SR'], [.079999, 'SR'], [.08, 'SR'], [.099999, 'SR'], [.1, 'R']]) {
      const outcome = E.draw(p, poolId, 10, sequence([rate, .5]), undefined, () => 0);
      assert.ok(outcome.results.every(card => card.rarity === rarity && !card.guaranteed));
    }
  }
});
test('首次十连资格按档案和卡池独立，单抽、兑换和JSON恢复不会重置', () => {
  let p = fresh(); p.tickets = 200;
  for (let i = 0; i < 12; i++) p = E.draw(p, 'english', 1, () => .9).profile;
  assert.equal(p.pools.english.firstTenUsed, false);
  p = E.exchange(p); assert.equal(p.pools.english.firstTenUsed, false);
  p = E.draw(p, 'english', 10, () => .9).profile;
  p = JSON.parse(JSON.stringify(p)); assert.ok(E.isValidProfile(p));
  assert.equal(p.pools.english.firstTenUsed, true); assert.equal(p.pools.math.firstTenUsed, false);
  let call = 0;
  const math = E.draw(p, 'math', 10, () => call++ === 0 ? .05 : .5);
  assert.equal(math.results.filter(card => card.rarity === 'SR').length, 1);
  assert.equal(math.profile.pools.english.firstTenUsed, true);
  assert.equal(fresh().pools.english.firstTenUsed, false);
});
test('旧存档迁移不丢记录，>=10抽视为已使用，少于10抽的资格固定保存', () => {
  for (const total of [0, 9, 10, 210]) {
    const p = fresh(); for (const progress of Object.values(p.pools)) delete progress.firstTenUsed;
    p.total = total; p.pools.english = { total, pity: total % 80 }; p.tickets = 200;
    const snapshot = JSON.stringify(p); assert.ok(E.isValidProfile(p));
    const saved = E.draw(p, 'english', 1, () => .9).profile;
    assert.equal(JSON.stringify(p), snapshot); assert.equal(saved.pools.english.firstTenUsed, total >= 10);
    const cards = E.draw(JSON.parse(JSON.stringify(saved)), 'english', 10, () => .05).results;
    assert.equal(cards.filter(card => card.rarity === 'SR').length, total >= 10 ? 10 : 1);
  }
  const invalid = fresh(); invalid.pools.math.firstTenUsed = 'false'; assert.equal(E.isValidProfile(invalid), false);
});
test('首次十连各位置正确触发80抽保底，保底优先于整组R或SR', () => {
  for (const poolId of Object.keys(E.POOLS)) for (let position = 0; position < 10; position++) {
    const p = fresh(); p.total = 79 - position; p.pools[poolId] = { total: p.total, pity: p.total, firstTenUsed: false };
    for (const rate of [.9, .05]) {
      let call = 0;
      const outcome = E.draw(p, poolId, 10, () => [rate, (position + .5) / 10][call++] ?? .9);
      assert.equal(outcome.results[position].rarity, 'SSR'); assert.equal(outcome.results[position].guaranteed, true);
      assert.equal(outcome.profile.pools[poolId].pity, 9 - position);
      assert.equal(outcome.results.filter(card => card.rarity === 'SSR').length, 1);
    }
  }
});
test('首次十连随机失败或机会不足不会扣费或消耗首次资格', () => {
  const p = fresh(), before = JSON.stringify(p); let call = 0;
  assert.throws(() => E.draw(p, 'math', 10, () => ++call === 5 ? 1 : .05), /随机数/);
  assert.equal(JSON.stringify(p), before);
  p.tickets = 9; assert.throws(() => E.draw(p, 'math', 10), /不足/);
  assert.equal(p.pools.math.firstTenUsed, false);
});
