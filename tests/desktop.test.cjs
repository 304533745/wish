'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const asar = require('@electron/asar');
const { _electron: electron } = require('playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(__dirname, 'artifacts'); fs.mkdirSync(artifacts, { recursive: true });
const data = process.env.WISH_TEST_USER_DATA || path.join(__dirname, '.tmp', '中文老师账户', 'AppData', 'Roaming', '界络祈愿');
const executable = process.env.WISH_TEST_EXE || path.join(root, 'dist', 'win-unpacked', '界络祈愿.exe');
const report = { executable, data, checks: [], errors: [], failedRequests: [] };
const env = { ...process.env, WISH_TEST_USER_DATA: data, PATH: process.env.SystemRoot + '\\System32', TEMP: path.join(__dirname, '.tmp'), TMP: path.join(__dirname, '.tmp') }; delete env.ELECTRON_RUN_AS_NODE;
function check(name) { report.checks.push(name); console.log('PASS ' + name); }
async function launch() {
  const app = await electron.launch({ executablePath: executable, args: [], env, timeout: 60000 });
  const page = await app.firstWindow(); await page.waitForLoadState('load'); await page.waitForSelector('#pool-nav button');
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) report.failedRequests.push(response.url()); });
  return { app, page };
}
async function deterministic(page) {
  await page.evaluate(() => { Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor(.99 * 4294967296)); return array; } }); });
}
async function save(page, student) {
  await page.locator('#teacher').fill('桌面测试老师'); await page.locator('#classroom').fill('中文测试班级'); await page.locator('#student').fill(student); await page.locator('.save-button').click();
}
const value = async (page, id) => (await page.locator('#' + id).textContent()).trim();
async function draw(page, count) {
  await page.evaluate(n => { document.getElementById(n === 10 ? 'draw-ten' : 'draw-one').click(); }, count);
  assert.equal(await page.locator('.result-card').count(), count);
  await page.locator('#result-dialog').waitFor({ state: 'visible' });
}
async function closeResult(page) { await page.evaluate(() => document.getElementById('finish-results').click()); }
(async () => {
  let active;
  try {
    active = await launch(); let { app, page } = active;
    assert.equal(await page.evaluate(() => typeof require), 'undefined');
    assert.equal(await page.evaluate(() => typeof window.wishDesktop?.saveState), 'function');
    await app.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      for (let attempt = 0; attempt < 100 && !window.isVisible(); attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    });
    const loaded = await app.evaluate(({ app, BrowserWindow }) => ({ packaged: app.isPackaged, appPath: app.getAppPath(), userData: app.getPath('userData'), title: BrowserWindow.getAllWindows()[0].getTitle(), visible: BrowserWindow.getAllWindows()[0].isVisible() }));
    assert.ok(loaded.packaged); assert.equal(loaded.userData, data); assert.ok(loaded.appPath.endsWith('app.asar'));
    assert.equal(loaded.title, '界络祈愿'); assert.ok(loaded.visible);
    check('安装版直接启动现有页面，无需 Node、浏览器或本地服务器，渲染器隔离正常');
    await save(page, '四池测试学生-' + Date.now()); await deterministic(page);
    for (const pool of ['english', 'math', 'chinese', 'event']) {
      await page.locator(`[data-pool="${pool}"]`).click(); await draw(page, 10);
      assert.ok(await page.locator('.result-card').evaluateAll(cards => cards.every(card => getComputedStyle(card).animationName !== 'none')));
      await page.locator('.result-card').evaluateAll(cards => Promise.all(cards.flatMap(card => card.getAnimations().map(animation => animation.finished))));
      await page.screenshot({ path: path.join(artifacts, 'desktop-' + pool + '.png') });
      await closeResult(page); assert.equal(await value(page, 'pity-label'), '10 / 80');
      check(pool + ' 卡池十连、抽数、保底进度和原有动画正常');
    }
    assert.equal(await value(page, 'total-count'), '40'); assert.equal(await value(page, 'ticket-count'), '60');
    for (const pool of ['english', 'math', 'chinese', 'event']) {
      await save(page, '首次十连桌面测试-' + pool + '-' + Date.now());
      await page.locator(`[data-pool="${pool}"]`).click();
      await page.evaluate(() => {
        let call = 0;
        Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor(([.05, .35][call++] ?? .5) * 4294967296)); return array; } });
      });
      await draw(page, 10);
      assert.deepEqual(await page.locator('.rarity-badge').allTextContents(), ['R', 'R', 'R', 'SR', 'R', 'R', 'R', 'R', 'R', 'R']);
      await closeResult(page);
      const state = JSON.parse(fs.readFileSync(path.join(data, 'records.json'), 'utf8'));
      assert.equal(state.profiles[state.activeKey].pools[pool].firstTenUsed, true);
    }
    await app.close(); active = null;
    active = await launch(); ({ app, page } = active);
    assert.equal(await value(page, 'total-count'), '10');
    await page.evaluate(() => {
      Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor(.085 * 4294967296)); return array; } });
    });
    await draw(page, 10); assert.ok((await page.locator('.rarity-badge').allTextContents()).every(rarity => rarity === 'SR')); await closeResult(page);
    await draw(page, 1); assert.equal(await page.locator('.rarity-badge').textContent(), 'R'); await closeResult(page);
    check('四池首次十连仅一张随机位置SR，退出重开保存资格，后续十连与单抽使用各自概率');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build/asset-manifest.json'), 'utf8'));
    const packed = manifest.map(entry => ({ path: entry.path, sha256: crypto.createHash('sha256').update(asar.extractFile(loaded.appPath, entry.path.split('/').join(path.sep))).digest('hex') }));
    assert.deepEqual(packed, manifest.map(entry => ({ path: entry.path, sha256: entry.sha256 })));
    const images = manifest.filter(item => /\.(png|jpe?g|svg)$/i.test(item.path)).map(item => item.path);
    const failures = await page.evaluate(async files => {
      const results = await Promise.all(files.map(async src => { const img = new Image(); img.src = src; try { await img.decode(); return img.naturalWidth > 0 ? null : src; } catch { return src; } })); return results.filter(Boolean);
    }, images);
    assert.deepEqual(failures, []); check('全部页面与素材 SHA256 一致，全部 ' + images.length + ' 张图片解码成功');
    await page.locator('[data-pool="english"]').click(); await save(page, '80抽保底测试学生-' + Date.now());
    for (let i = 0; i < 7; i++) { await draw(page, 10); await closeResult(page); }
    for (let i = 0; i < 9; i++) { await draw(page, 1); await closeResult(page); }
    assert.equal(await value(page, 'total-count'), '79'); assert.equal(await value(page, 'pity-remaining'), '1');
    assert.equal(await value(page, 'ticket-count'), '21');
    const student = await page.locator('#student').inputValue();
    const stored = JSON.parse(fs.readFileSync(path.join(data, 'records.json'), 'utf8'));
    assert.equal(stored.profiles[stored.activeKey].pools.english.pity, 79); assert.ok(fs.existsSync(path.join(data, 'records.json.bak')));
    await app.close(); active = null;
    active = await launch(); const reopened = active.page;
    assert.equal(await reopened.locator('#student').inputValue(), student);
    assert.equal(await value(reopened, 'current-pool'), '英语卡池'); assert.equal(await value(reopened, 'pity-remaining'), '1');
    assert.equal(await value(reopened, 'total-count'), '79'); assert.equal(await value(reopened, 'ticket-count'), '21');
    await deterministic(reopened); await draw(reopened, 1);
    assert.equal(await reopened.locator('.rarity-badge').textContent(), 'SSR'); assert.ok(await reopened.locator('.guaranteed-label').isVisible());
    await closeResult(reopened); assert.equal(await value(reopened, 'pity-remaining'), '80'); assert.equal(await value(reopened, 'total-count'), '80');
    check('关闭后重新打开恢复身份、机会、选池与第79抽保底；第80抽SSR并重置');
    const persistence = JSON.parse(fs.readFileSync(path.join(data, 'records.json'), 'utf8'));
    assert.equal(Object.keys(persistence.profiles).length, stored.profiles ? Object.keys(stored.profiles).length : 0);
    const menuLabels = await active.app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.flatMap(item => item.submenu?.items.map(child => child.label) || []));
    assert.ok(menuLabels.includes('导出备份…')); assert.ok(menuLabels.includes('导入备份 / 网页版存档…'));
    const backupPath = path.join(data, '中文存档导出.json');
    await active.app.evaluate(({ dialog, Menu }, filename) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename });
      Menu.getApplicationMenu().items.find(item => item.label === '数据').submenu.items.find(item => item.label === '导出备份…').click();
    }, backupPath);
    for (let i = 0; i < 50 && !fs.existsSync(backupPath); i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(JSON.parse(fs.readFileSync(backupPath, 'utf8')), persistence);
    await reopened.locator('[data-pool="math"]').click();
    await active.app.evaluate(({ dialog, Menu }, filename) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filename] });
      dialog.showMessageBox = async () => ({ response: 1 });
      Menu.getApplicationMenu().items.find(item => item.label === '数据').submenu.items.find(item => item.label === '导入备份 / 网页版存档…').click();
    }, backupPath);
    await reopened.waitForFunction(() => document.getElementById('current-pool').textContent === '英语卡池');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data, 'records.json'), 'utf8')), persistence);
    check('中文路径可读写，真实菜单导出与导入备份恢复全部档案');
    assert.deepEqual(report.errors, []); assert.deepEqual(report.failedRequests, []);
    await active.app.close(); active = null;
    await new Promise(resolve => setTimeout(resolve, 1500));
    const escapedExe = executable.replaceAll("'", "''");
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', `@(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${escapedExe}' }).Count`], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0); assert.equal(Number(result.stdout.trim()), 0);
    check('关闭后主进程和 Chromium 子进程全部退出');
    report.passed = report.checks.length;
    fs.writeFileSync(path.join(artifacts, process.env.WISH_TEST_REPORT || 'desktop-report.json'), JSON.stringify(report, null, 2));
    console.log('Completed desktop checks: ' + report.passed);
  } finally { if (active) await active.app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
