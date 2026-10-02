'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const data = path.join(__dirname, '.tmp', '免安装中文账户', 'AppData', 'Roaming', '界络祈愿');
const temp = path.join(__dirname, '.tmp', '中文临时目录');
fs.mkdirSync(temp, { recursive: true });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function open() {
  const port = await freePort();
  const env = { ...process.env, WISH_TEST_USER_DATA: data, TEMP: temp, TMP: temp, PATH: process.env.SystemRoot + '\\System32' }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(path.join(root, 'dist', '界络祈愿 Portable.exe'), ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port], { env, windowsHide: true, stdio: 'ignore' });
  child.on('error', error => console.error(error));
  for (let i = 0; i < 180; i++) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (response.ok) { const browser = await chromium.connectOverCDP('http://127.0.0.1:' + port); const page = browser.contexts()[0].pages()[0]; await page.waitForSelector('#pool-nav button'); return { child, browser, page }; }
    } catch {}
    if (child.exitCode !== null) throw new Error('免安装程序提前退出：' + child.exitCode);
    await pause(500);
  }
  child.kill(); throw new Error('免安装程序启动超时。');
}
async function close(active) {
  await active.page.evaluate(() => window.close()).catch(() => {});
  for (let i = 0; i < 100 && active.child.exitCode === null; i++) await pause(300);
  assert.equal(active.child.exitCode, 0, '免安装包装器应随应用退出');
  await active.browser.close();
}
(async () => {
  let active;
  try {
    active = await open(); const page = active.page;
    assert.equal(await page.evaluate(() => typeof require), 'undefined');
    const student = '免安装测试-' + Date.now();
    await page.locator('#teacher').fill('中文老师'); await page.locator('#classroom').fill('免安装班级'); await page.locator('#student').fill(student); await page.locator('.save-button').click();
    await page.evaluate(() => { Object.defineProperty(crypto, 'getRandomValues', { value: array => { array.fill(0xffffffff); return array; } }); });
    await page.locator('[data-pool="math"]').click(); await page.locator('#draw-ten').click();
    await page.locator('#finish-results').click();
    assert.equal((await page.locator('#total-count').textContent()).trim(), '10');
    const images = JSON.parse(fs.readFileSync(path.join(root, 'build/asset-manifest.json'), 'utf8')).filter(item => /\.(png|jpg|svg)$/i.test(item.path)).map(item => item.path);
    const failed = await page.evaluate(async files => (await Promise.all(files.map(async src => { const img = new Image(); img.src = src; try { await img.decode(); return null; } catch { return src; } }))).filter(Boolean), images);
    assert.deepEqual(failed, []);
    await close(active); active = null;
    active = await open();
    assert.equal(await active.page.locator('#student').inputValue(), student);
    assert.equal((await active.page.locator('#pity-label').textContent()).trim(), '10 / 80');
    assert.equal((await active.page.locator('#total-count').textContent()).trim(), '10');
    await close(active); active = null;
    fs.writeFileSync(path.join(__dirname, 'artifacts', 'portable-report.json'), JSON.stringify({ success: true, data, temp, checks: ['中文路径免安装启动，无 Node PATH', '数学十连及全部39图片可用', '关闭再开保留档案、抽数与保底', '应用与免安装包装器正常退出'] }, null, 2));
    console.log('PASS 免安装版中文路径启动、抽卡、全部图片、重启持久化及正常退出');
  } finally { if (active) await close(active); }
})().catch(error => { console.error(error); process.exitCode = 1; });
