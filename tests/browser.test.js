'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const testRoot = __dirname;
const artifacts = path.join(testRoot, 'artifacts');
const temp = path.join(testRoot, '.tmp');
fs.mkdirSync(artifacts, { recursive: true }); fs.mkdirSync(temp, { recursive: true });
process.env.TEMP = temp; process.env.TMP = temp; process.env.TMPDIR = temp;
const { chromium } = require('playwright');
const origin = process.env.WISH_TEST_URL || 'http://127.0.0.1:4173/';
const executablePath = process.env.WISH_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const context = await chromium.launchPersistentContext(path.join(temp, 'edge-profile'), { executablePath, headless: true, viewport: { width: 1440, height: 1080 }, downloadsPath: artifacts, tracesDir: artifacts, args: ['--disable-breakpad', '--disable-crash-reporter', '--no-first-run'] });
  const errors = [], failedRequests = [], checks = [];
  function check(label) { checks.push(label); console.log('PASS ' + label); }
  const page = await context.newPage();
  context.on('page', p => p.on('pageerror', error => errors.push(error.message)));
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) failedRequests.push(response.url() + ': ' + response.status()); });
  await context.addInitScript(() => {
    // 确定性随机数仅用于自动化上下文；不修改正式项目的概率。
    Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor(.9 * 4294967296)); return array; } });
    const registry = new Map();
    Object.defineProperty(document, 'modelContext', { value: { registerTool(tool) { registry.set(tool.name, tool); } } });
    window.__wishTestRegistry = registry;
  });
  const content = async id => (await page.locator('#' + id).textContent()).trim();
  const close = async () => page.locator('#finish-results').click();
  const save = async student => {
    await page.locator('#teacher').fill('王老师'); await page.locator('#classroom').fill('七年级1班'); await page.locator('#student').fill(student); await page.locator('.save-button').click();
  };
  const one = async () => { await page.locator('#draw-one').click(); assert.ok(await page.locator('#result-dialog').isVisible()); await close(); };
  const ten = async () => { await page.locator('#draw-ten').click(); assert.equal(await page.locator('.result-card').count(), 10); await close(); };
  try {
    await page.goto(origin); await page.evaluate(() => localStorage.clear()); await page.reload();
    assert.equal(await page.title(), '界络祈愿 · 校园抽卡测试版');
    assert.deepEqual(await page.locator('.featured-card img').evaluateAll(images => images.map(image => image.getAttribute('src'))), ['assets/characters/blaze-ssr.jpg', 'assets/characters/blaze-ssr-scene.jpg']);
    assert.ok((await page.locator('#featured-cards').textContent()).includes('单人版'));
    assert.ok((await page.locator('#featured-cards').textContent()).includes('组合场景版'));
    assert.ok(await page.locator('#draw-one').isDisabled()); assert.ok(await page.locator('#draw-ten').isDisabled());
    assert.equal(await content('pity-remaining'), '80');
    check('页面正常打开，未保存身份时禁止抽卡');
    await page.locator('#teacher').fill('王老师'); await page.locator('.save-button').click(); assert.equal(await content('ticket-count'), '—');
    check('未填写完整的身份不能建立档案');
    await save('测试学生甲'); assert.equal(await content('ticket-count'), '100'); assert.ok(await page.locator('#draw-one').isEnabled());
    await page.locator('#draw-one').click(); assert.equal(await page.locator('.result-card').count(), 1); assert.match(await page.locator('.result-info').textContent(), /新卡牌/); await close();
    assert.equal(await content('total-count'), '1'); assert.equal(await content('pity-remaining'), '79'); assert.equal(await content('ticket-count'), '99');
    check('保存身份获得100机会，单抽正确扣除和入库');
    await ten(); assert.equal(await content('total-count'), '11'); assert.equal(await content('fragment-count'), '10'); assert.equal(await content('ticket-count'), '89');
    await page.locator('#exchange-button').click(); assert.equal(await content('fragment-count'), '0'); assert.equal(await content('ticket-count'), '90'); assert.equal(await content('pity-remaining'), '69');
    assert.ok(await page.locator('#exchange-button').isDisabled());
    check('十连逐张展示、重复自动转化，兑换只改变碎片和机会');
    await page.locator('[data-pool="math"]').click(); assert.equal(await content('current-pool'), '数学卡池'); assert.equal(await content('pity-remaining'), '80');
    await page.locator('[data-pool="chinese"]').click(); assert.deepEqual(await page.locator('#character-chips span').allTextContents(), ['R · 狸谱 / 李岩', 'SR · 狸谱', 'SSR · 李岩']);
    assert.deepEqual(await page.locator('.featured-card img').evaluateAll(images => images.map(image => image.getAttribute('src'))), ['assets/characters/lipu-sr-chinese.png', 'assets/characters/liyan-ssr.jpg']);
    assert.deepEqual(await page.locator('.featured-card>span').allTextContents(), ['SR', 'SSR']);
    await page.locator('[data-pool="event"]').click(); assert.equal(await page.locator('#character-chips span').count(), 4);
    await page.locator('[data-pool="english"]').click(); assert.equal(await content('pity-remaining'), '69');
    check('四池角色正确，切换保留独立保底进度');
    for (let i = 0; i < 6; i++) await ten();
    for (let i = 0; i < 8; i++) await one();
    assert.equal(await content('total-count'), '79'); assert.equal(await content('pity-remaining'), '1');
    await page.locator('#draw-one').click(); assert.equal(await page.locator('.rarity-badge').textContent(), 'SSR'); assert.equal(await page.locator('.result-info strong').textContent(), '布蕾兹'); assert.match(await page.locator('.guaranteed-label').textContent(), /80/); await close();
    assert.equal(await content('total-count'), '80'); assert.equal(await content('pity-remaining'), '80');
    check('真实页面第80抽必为SSR，结果标注保底并重置');
    await page.evaluate(() => { Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(0); return array; } }); });
    await one(); const fragmentsBefore = Number(await content('fragment-count'));
    await page.locator('#draw-one').click(); assert.match(await page.locator('.result-info').textContent(), /转化 2 枚/); await close();
    assert.equal(Number(await content('fragment-count')), fragmentsBefore + 2);
    check('实际页面重复SSR自动转化2枚碎片');
    await page.locator('#history-tab').click(); assert.ok(await page.locator('#history-content').isVisible()); assert.equal(await page.locator('.history-row').count(), 82);
    await page.locator('#history-tab').press('ArrowLeft'); assert.equal(await page.locator('#collection-tab').getAttribute('aria-selected'), 'true');
    check('收藏、抽卡记录和键盘切换正常');
    const beforeReload = [await content('ticket-count'), await content('fragment-count'), await content('total-count')];
    await page.reload(); assert.deepEqual([await content('ticket-count'), await content('fragment-count'), await content('total-count')], beforeReload); assert.equal(await page.locator('#student').inputValue(), '测试学生甲');
    check('刷新恢复学生身份、机会、抽数和碎片');
    await page.locator('#student').fill('测试学生乙'); assert.ok(await page.locator('#draw-one').isDisabled()); assert.ok(await page.locator('#exchange-button').isDisabled());
    await page.locator('.save-button').click(); assert.equal(await content('ticket-count'), '100'); assert.equal(await content('total-count'), '0'); assert.equal(await content('collection-count'), '0');
    await save('测试学生甲'); assert.deepEqual([await content('ticket-count'), await content('fragment-count'), await content('total-count')], beforeReload);
    await page.locator('.save-button').click(); assert.equal(await content('ticket-count'), beforeReload[0]);
    check('学生档案独立，编辑时禁止抽卡，恢复和重复保存不重赠机会');
    const webTools = await page.evaluate(async () => {
      const registry = window.__wishTestRegistry, names = [...registry.keys()];
      const result = await registry.get('select_wish_pool').execute({ poolId: 'math' });
      const status = await registry.get('read_wish_status').execute({});
      let rejected = false; try { await registry.get('select_wish_pool').execute({ poolId: 'invalid' }); } catch (_) { rejected = true; }
      return { names, result, status, rejected };
    });
    assert.equal(webTools.names.length, 4); assert.equal(webTools.status.currentPool, 'math'); assert.ok(webTools.rejected); assert.equal(await content('current-pool'), '数学卡池');
    await page.evaluate(async () => { await window.__wishTestRegistry.get('draw_wish_cards').execute({ count: 1 }); }); assert.ok(await page.locator('#result-dialog').isVisible()); await close();
    const totalBeforeExchange = await content('total-count');
    await page.evaluate(async () => window.__wishTestRegistry.get('exchange_wish_fragment').execute({})); assert.equal(await content('total-count'), totalBeforeExchange);
    await page.locator('[data-pool="english"]').click();
    check('页面操作接口注册、有效操作和非法输入均通过，与按钮共用状态');
    const beforeFault = await content('total-count');
    await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Test quota error', 'QuotaExceededError'); }; });
    await page.locator('#draw-one').click(); assert.equal(await content('total-count'), beforeFault); assert.ok(await page.locator('#result-dialog').isHidden()); assert.match(await content('toast'), /未执行/); await page.reload();
    check('保存失败时不扣机会、不显示未保存结果');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, 'desktop.png'), fullPage: true });
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      assert.ok(metrics.scroll <= metrics.client, `Horizontal overflow at ${width}: ${JSON.stringify(metrics)}`);
      assert.ok(await page.locator('#draw-ten').isVisible());
    }
    await page.setViewportSize({ width: 390, height: 950 }); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(artifacts, 'mobile.png'), fullPage: true });
    await page.locator('#rules-button').evaluate(element => element.click()); assert.ok(await page.locator('#rules-dialog').isVisible()); await page.locator('#rules-dialog').press('Escape'); assert.ok(await page.locator('#rules-dialog').isHidden());
    await page.locator('#draw-ten').click(); assert.equal(await page.locator('.result-card').count(), 10);
    await page.locator('.result-card').evaluateAll(cards => Promise.all(cards.flatMap(card => card.getAnimations()).map(animation => animation.finished)));
    await page.screenshot({ path: path.join(artifacts, 'mobile-results.png'), fullPage: false }); await close();
    check('360至1440像素无横向溢出，手机十连弹窗和规则弹窗正常');
    await page.setViewportSize({ width: 1440, height: 1080 }); await save('测试学生丙');
    for (let i = 0; i < 10; i++) await ten();
    assert.equal(await content('ticket-count'), '0'); assert.ok(await page.locator('#draw-one').isDisabled()); assert.ok(await page.locator('#draw-ten').isDisabled());
    await page.locator('#exchange-button').click(); assert.equal(await content('ticket-count'), '1'); assert.ok(await page.locator('#draw-one').isEnabled()); assert.ok(await page.locator('#draw-ten').isDisabled());
    check('机会用尽禁止抽卡，兑换1次机会后只开启单抽');
    await save('测试学生甲');
    const other = await context.newPage(); await other.goto(origin);
    await other.locator('#teacher').fill('王老师'); await other.locator('#classroom').fill('七年级1班'); await other.locator('#student').fill('测试学生乙'); await other.locator('.save-button').click();
    await page.waitForFunction(() => document.getElementById('draw-one').disabled);
    assert.match(await content('toast'), /另一网页窗口/); await other.close(); await page.reload();
    check('另一个窗口修改档案后本窗口停止操作并提示刷新');
    const filePage = await context.newPage(); await filePage.goto(pathToFileURL(path.join(testRoot, '..', 'index.html')).href);
    await filePage.evaluate(() => localStorage.clear()); await filePage.reload();
    await filePage.locator('#teacher').fill('老师'); await filePage.locator('#classroom').fill('测试班'); await filePage.locator('#student').fill('直接打开测试'); await filePage.locator('.save-button').click();
    await filePage.locator('#draw-ten').click(); assert.equal(await filePage.locator('.result-card').count(), 10); await filePage.locator('#finish-results').click();
    await filePage.reload(); assert.equal(await filePage.locator('#total-count').textContent(), '10'); await filePage.close();
    check('双击HTML的file模式可抽卡并恢复存档');
    await save('书签测试学生');
    for (let index = 0; index < 3; index++) {
      await page.evaluate(i => {
        const values = [.1, (i + .5) / 3]; let call = 0;
        Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor(values[call++ % 2] * 4294967296)); return array; } });
      }, index);
      await page.locator('#draw-one').click();
      assert.equal(await page.locator('.result-info strong').textContent(), `书签卡 0${index + 1}`);
      assert.equal(await page.locator('.result-card').getAttribute('class'), 'result-card sr bookmark');
      await page.locator('.bookmark-preview-button').click();
      await page.waitForFunction(() => { const img = document.getElementById('bookmark-image'); return img.complete && img.naturalWidth > 0; });
      assert.equal(await page.locator('#bookmark-image').getAttribute('src'), `assets/bookmarks/english-sr-0${index + 1}.jpg`);
      await page.locator('#close-bookmark').click(); await close();
    }
    assert.equal(await content('collection-count'), '3'); assert.equal(await content('fragment-count'), '0');
    await page.evaluate(() => { let call = 0; Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor([.1, .1][call++ % 2] * 4294967296)); return array; } }); });
    await one(); assert.equal(await content('fragment-count'), '1'); assert.equal(await content('collection-count'), '3');
    await page.reload(); assert.equal(await content('collection-count'), '3'); assert.equal(await content('fragment-count'), '1');
    await page.locator('#history-tab').click(); assert.match(await page.locator('#history-content').textContent(), /书签卡 01/); await page.locator('#collection-tab').click();
    await page.setViewportSize({ width: 390, height: 950 });
    await page.locator('[data-bookmark-preview="english-bookmark-03"]').click();
    await page.waitForFunction(() => { const img = document.getElementById('bookmark-image'); return img.complete && img.naturalWidth > 0; });
    await page.screenshot({ path: path.join(artifacts, 'bookmark-mobile.png'), fullPage: false });
    await page.locator('#close-bookmark').click();
    check('三款SR书签分别收藏，完整图片可查看，同款重复转化1碎片并刷新恢复');
    await page.setViewportSize({ width: 1440, height: 1080 });
    await save('数学素材测试学生'); await page.locator('[data-pool="math"]').click();
    assert.deepEqual(await page.locator('.featured-card img').evaluateAll(images => images.map(image => image.getAttribute('src'))), ['assets/characters/leyou-ssr.png', 'assets/characters/lipu-sr-01.png']);
    assert.deepEqual(await page.locator('.featured-card>span').allTextContents(), ['SSR', 'SR']);
    assert.match(await content('character-chips'), /SR · 狸谱SSR · 乐游/);
    await page.locator('.featured-card img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path: path.join(artifacts, 'math-sr-desktop.png'), fullPage: true });
    for (let index = 0; index < 2; index++) {
      await page.evaluate(i => {
        const values = [.1, .99, i === 0 ? 0 : .99]; let call = 0;
        Object.defineProperty(crypto, 'getRandomValues', { configurable: true, value: array => { array.fill(Math.floor(values[call++ % 3] * 4294967296)); return array; } });
      }, index);
      await page.locator('#draw-one').click();
      assert.equal(await page.locator('.result-info strong').textContent(), '狸谱');
      assert.equal(await page.locator('.rarity-badge').textContent(), 'SR');
      assert.equal(await page.locator('.result-art img').getAttribute('src'), `assets/characters/lipu-sr-0${index + 1}.png`);
      await page.locator('.result-art img').evaluate(image => image.decode());
      assert.equal(await page.locator('.result-art img').evaluate(image => getComputedStyle(image).objectFit), 'contain');
      if (index === 1) {
        assert.match(await page.locator('.result-info').textContent(), /转化 1 枚/);
        await page.setViewportSize({ width: 390, height: 950 });
        await page.locator('.result-card').evaluateAll(cards => Promise.all(cards.flatMap(card => card.getAnimations()).map(animation => animation.finished)));
        await page.screenshot({ path: path.join(artifacts, 'math-sr-mobile-result.png'), fullPage: false });
      }
      await close();
    }
    assert.equal(await content('fragment-count'), '1'); assert.equal(await content('collection-count'), '1');
    await page.reload(); assert.equal(await page.locator('.mini-card.sr img').getAttribute('src'), 'assets/characters/lipu-sr-01.png');
    assert.equal(await content('fragment-count'), '1');
    await page.evaluate(() => {
      const database = JSON.parse(localStorage.getItem('jieluo-wish-v1')), p = database.profiles[database.activeKey];
      p.total += 77; p.pools.math.total += 77; p.pools.math.pity = 79;
      localStorage.setItem('jieluo-wish-v1', JSON.stringify(database));
    });
    await page.reload(); assert.equal(await content('pity-remaining'), '1');
    await page.locator('#draw-one').click();
    assert.equal(await page.locator('.result-info strong').textContent(), '乐游');
    assert.equal(await page.locator('.rarity-badge').textContent(), 'SSR');
    assert.equal(await page.locator('.result-art img').getAttribute('src'), 'assets/characters/leyou-ssr.png');
    assert.ok(await page.locator('.guaranteed-label').isVisible()); await close();
    assert.equal(await content('pity-remaining'), '80');
    await page.setViewportSize({ width: 390, height: 950 }); await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, 'math-sr-mobile.png'), fullPage: true });
    check('数学展示区SSR/SR标注正确，狸谱双SR完整显示、重复兑换与刷新恢复，保底仅出乐游');
    assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
    check('无页面运行错误或资源加载失败');
    fs.writeFileSync(path.join(artifacts, 'browser-report.json'), JSON.stringify({ passed: checks.length, checks, errors, failedRequests }, null, 2));
    console.log(`Completed: ${checks.length} browser checks passed.`);
  } finally { await context.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
