'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const { StateStore } = require('../desktop/store.cjs');
const temp = path.join(__dirname, '.tmp', '存档测试'); fs.mkdirSync(temp, { recursive: true });
function fixture() {
  const p = E.createProfile({ teacher: '王老师', classroom: '一年级一班', student: '小明' });
  const key = E.identityKey(p.info);
  return { version: 1, selectedPool: 'english', activeKey: key, profiles: { [key]: p } };
}
test('中文用户路径下保存后重新实例化仍保留抽数、机会、保底与选池', () => {
  const dir = fs.mkdtempSync(path.join(temp, '中文老师-')), store = new StateStore(dir), state = fixture();
  assert.equal(store.read(), null);
  state.profiles[state.activeKey] = E.draw(state.profiles[state.activeKey], 'math', 10, () => .99).profile;
  state.selectedPool = 'math'; store.save(JSON.stringify(state));
  const restored = JSON.parse(new StateStore(dir).read());
  assert.deepEqual(restored, state); assert.equal(restored.profiles[state.activeKey].pools.math.pity, 10);
  assert.equal(restored.profiles[state.activeKey].tickets, 90);
});
test('成功写入保留上一份备份；无效写入拒绝且原文件不变', () => {
  const store = new StateStore(fs.mkdtempSync(path.join(temp, '原子保存-'))), state = fixture(), first = JSON.stringify(state);
  store.save(first); state.selectedPool = 'math'; store.save(JSON.stringify(state));
  assert.equal(fs.readFileSync(store.filename + '.bak', 'utf8'), first);
  const before = store.read(); assert.throws(() => store.save('{'), SyntaxError); assert.equal(store.read(), before);
  assert.equal(fs.existsSync(store.filename + '.tmp'), false);
});
test('损坏存档不被自动覆盖；明确导入可恢复且保留损坏原文件', () => {
  const store = new StateStore(fs.mkdtempSync(path.join(temp, '损坏恢复-'))), raw = JSON.stringify(fixture());
  store.save(raw); fs.writeFileSync(store.filename, '{broken');
  assert.throws(() => store.read()); assert.throws(() => store.save(raw));
  assert.equal(fs.readFileSync(store.filename, 'utf8'), '{broken');
  store.restore(raw); assert.equal(store.read(), raw);
  const retained = fs.readdirSync(path.dirname(store.filename)).find(name => name.includes('.before-import-'));
  assert.equal(fs.readFileSync(path.join(path.dirname(store.filename), retained), 'utf8'), '{broken');
});
test('另一个电脑导入备份恢复完整档案，坏导入不改已有记录', () => {
  const source = new StateStore(fs.mkdtempSync(path.join(temp, '原电脑-'))), target = new StateStore(fs.mkdtempSync(path.join(temp, '新电脑-'))), state = fixture();
  state.profiles[state.activeKey] = E.draw(state.profiles[state.activeKey], 'chinese', 10, () => .99).profile;
  source.save(JSON.stringify(state)); target.restore(source.read()); assert.deepEqual(JSON.parse(target.read()), state);
  assert.throws(() => target.restore(JSON.stringify({ ...state, selectedPool: 'unknown' })));
  assert.deepEqual(JSON.parse(target.read()), state);
});
