(function () {
  'use strict';
  const E = window.WishEngine;
  const STORAGE_KEY = 'jieluo-wish-v1';
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let storageError = '', toastTimer, busy = false, dirty = false, view = 'collection';
  let database = { version: 1, activeKey: null, selectedPool: 'english', profiles: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.version !== 1 || !stored.profiles || typeof stored.profiles !== 'object' || Array.isArray(stored.profiles) || !Object.entries(stored.profiles).every(([key, value]) => E.isValidProfile(value) && key === E.identityKey(value.info)) || (stored.activeKey !== null && !Object.hasOwn(stored.profiles, stored.activeKey)) || !E.POOLS[stored.selectedPool]) throw new Error('存档格式异常');
      database = stored;
    }
  } catch (_) { storageError = '本机存档无法读取。为保护已有记录，暂时停止保存和抽卡。请参阅使用说明中的处理方法。'; }
  const profile = () => database.activeKey ? database.profiles[database.activeKey] : null;
  function commit(next) {
    if (storageError) throw new Error(storageError);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch (_) { throw new Error('浏览器无法保存数据，本次操作未执行。请检查浏览器存储权限或剩余空间。'); }
    database = next;
  }
  function toast(message, error = false) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 4200);
  }
  function run(action) { try { return action(); } catch (error) { toast(error.message || '操作未完成，请稍后重试。', true); return null; } }
  function formInfo() { return Object.fromEntries(['teacher', 'classroom', 'student'].map(id => [id, $(id).value.trim()])); }
  function fillIdentity() {
    const p = profile();
    for (const id of ['teacher', 'classroom', 'student']) $(id).value = p?.info[id] || '';
    dirty = false;
  }
  function renderPool() {
    const current = E.POOLS[database.selectedPool];
    document.documentElement.style.setProperty('--accent', current.accent);
    $('pool-nav').innerHTML = Object.values(E.POOLS).map(pool => `<button class="pool-button ${pool.id === 'event' ? 'event' : ''} ${pool.id === current.id ? 'active' : ''}" data-pool="${pool.id}" ${pool.id === current.id ? 'aria-current="true"' : ''}><span class="pool-icon" aria-hidden="true">${pool.icon}</span><span><strong>${pool.name}</strong><small>${pool.id === 'event' ? '全部角色 · 活动祈愿' : pool.rarityBookmarks ? '角色卡 / 漫画书签' : pool.characters.map(id => E.CHARACTERS[id].name).join(' / ')}</small></span></button>`).join('');
    $('pool-tag').textContent = current.id === 'event' ? '限定活动祈愿' : '学科常驻祈愿';
    $('pool-kicker').textContent = current.english;
    $('pool-title').textContent = current.name; $('current-pool').textContent = current.name;
    $('pool-description').textContent = current.description;
    $('character-chips').innerHTML = current.rarityBookmarks ? '<span>R · 狸谱 / 布蕾兹</span><span>SR · 书签卡 × 3</span>' : current.rarityCharacters ? ['R', 'SR', 'SSR'].map(rarity => `<span>${rarity} · ${(current.rarityCharacters[rarity] || current.characters).map(id => E.CHARACTERS[id].name).join(' / ')}</span>`).join('') : current.characters.map(id => `<span>${E.CHARACTERS[id].name}</span>`).join('');
    const featured = current.featuredCards || current.characters.slice(0, 2).map(id => ({ characterId: id, artIndex: 0 }));
    $('featured-cards').innerHTML = featured.map(card => { const character = E.CHARACTERS[card.characterId], rarity = card.rarity || 'SSR'; return `<div class="featured-card ${rarity.toLowerCase()} ${character.rarityShapes?.[rarity] === 'portrait' ? 'portrait' : ''}"><img src="${E.getCardImage(card.characterId, rarity, card.artIndex, current.id)}" alt="${character.name} ${rarity} ${card.label || '卡面'}"><span>${rarity}</span><div class="featured-name">${character.name}<small>${card.label || character.subtitle}</small></div></div>`; }).join('');
    $('wish-banner').style.borderColor = current.accent + '66';
  }
  function emptyState(title, subtitle) { return `<div class="empty-state"><span class="empty-icon" aria-hidden="true">✧</span><p>${escape(title)}</p><small>${escape(subtitle)}</small></div>`; }
  function renderCollection() {
    const p = profile(), cards = p ? Object.values(p.collection) : [], ranks = { SSR: 0, SR: 1, R: 2 };
    cards.sort((a, b) => ranks[a.rarity] - ranks[b.rarity] || (a.bookmarkId || a.characterId).localeCompare(b.bookmarkId || b.characterId));
    $('collection-count').textContent = cards.length;
    $('collection-content').innerHTML = cards.length ? `<div class="collection-list">${cards.map(card => { const c = E.getCardDisplay(card), bookmark = c.kind === 'bookmark', tag = bookmark ? 'button' : 'div'; return `<${tag} class="mini-card ${card.rarity.toLowerCase()} ${bookmark ? 'bookmark' : ['square', 'portrait'].includes(c.shape) ? c.shape : ''}" ${bookmark ? `type="button" data-bookmark-preview="${card.bookmarkId}" aria-label="查看${c.name}完整图片"` : ''}><img src="${c.image}" alt="${c.name} ${card.rarity} 卡面" loading="lazy"><span class="rarity-${card.rarity.toLowerCase()}">${card.rarity}</span><strong>${c.name}</strong></${tag}>`; }).join('')}</div>` : emptyState('属于你的相遇，还未开始', '完成第一次祈愿，点亮你的卡牌与书签收藏。');
    $('history-content').innerHTML = p?.history.length ? `<div class="history-list">${p.history.map(item => `<div class="history-row"><span>第 ${item.sequence} 抽</span><strong>${E.getCardDisplay(item).name}<em class="rarity-${item.rarity.toLowerCase()}">${item.rarity}</em><small>${item.bookmarkId ? '四格漫画书签' : item.guaranteed ? '80 抽保底' : '常规祈愿'}</small></strong><span>${E.POOLS[item.poolId].name}<small>${formatTime(item.time)}</small></span><span>${item.duplicate ? '+' + item.fragments + ' 枚碎片' : '新卡入库'}</span></div>`).join('')}</div>` : emptyState('还没有祈愿记录', '每次祈愿的卡牌、稀有度与碎片转化都会记录在这里。');
    $('panel-caption').textContent = view === 'collection' ? '角色卡 / 书签卡' : '最近 200 抽';
  }
  function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? '时间未记录' : escape(date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })); }
  function renderStats() {
    const p = profile(), ready = Boolean(p && !dirty && !busy && !storageError), pity = p?.pools[database.selectedPool].pity || 0, fragments = p?.fragments || 0;
    $('ticket-count').textContent = p ? p.tickets : '—'; $('total-count').textContent = p?.total || 0;
    $('pity-remaining').textContent = E.PITY_LIMIT - pity;
    $('pity-label').textContent = `${pity} / ${E.PITY_LIMIT}`; $('pity-progress').value = pity;
    $('pity-progress').textContent = `${pity} / ${E.PITY_LIMIT}`;
    $('fragment-count').textContent = fragments;
    $('draw-one').disabled = !ready || p.tickets < 1; $('draw-ten').disabled = !ready || p.tickets < 10;
    $('exchange-button').disabled = !ready || fragments < 10;
    $('exchange-hint').textContent = fragments >= 10 ? `可兑换 ${Math.floor(fragments / 10)} 次祈愿 · 每次消耗 10 枚` : `还需 ${10 - fragments} 枚碎片即可兑换`;
    $('identity-status').textContent = dirty ? '信息已修改，请保存后再祈愿' : p ? `${p.info.student} · 档案已保存` : '填写信息，开启你的祈愿';
    $('identity-status').style.color = dirty ? '#e9cf91' : '';
    const hint = storageError ? '存档读取失败，请查看使用说明。' : dirty ? '请先保存修改后的学生信息。' : !p ? '保存完整学生信息后，即可开始祈愿。' : p.tickets === 0 ? '机会已用完，收集碎片可兑换新的祈愿。' : pity === 79 ? '下一次祈愿必得 SSR，祝你好运！' : `${p.info.student}，准备好迎接新的相遇了吗？`;
    $('draw-hint').replaceChildren(document.createTextNode(hint));
    const note = document.createElement('small'); note.textContent = p ? `本卡池累计 ${p.pools[database.selectedPool].total} 抽 · 抽到 SSR 后重置保底` : '测试版初始赠送 100 次抽卡机会';
    $('draw-hint').append(note);
  }
  function render() { renderPool(); renderStats(); renderCollection(); }
  function saveIdentity() {
    const info = E.validateIdentity(formInfo()), key = E.identityKey(info), exists = Object.hasOwn(database.profiles, key);
    commit({ ...database, activeKey: key, profiles: { ...database.profiles, [key]: exists ? database.profiles[key] : E.createProfile(info) } });
    fillIdentity(); render(); toast(exists ? `已切换到 ${info.student} 的档案，继续已有进度。` : `${info.student}，档案已保存！已赠送 100 次测试机会。`);
  }
  function presentResults(results) {
    $('result-title').textContent = results.length === 10 ? '十连祈愿 · 相遇时刻' : '单次祈愿 · 相遇时刻';
    $('result-cards').classList.toggle('single-result', results.length === 1);
    $('result-cards').innerHTML = results.map((item, index) => {
      const card = E.getCardDisplay(item), bookmark = card.kind === 'bookmark';
      const image = `<img src="${card.image}" alt="${card.name} ${item.rarity} 卡面">`;
      return `<div class="result-card ${item.rarity.toLowerCase()} ${bookmark ? 'bookmark' : ['square', 'portrait'].includes(card.shape) ? card.shape : ''}" style="--delay:${index * .035}s"><div class="result-art">${bookmark ? `<button class="bookmark-preview-button" type="button" data-bookmark-preview="${item.bookmarkId}" aria-label="查看${card.name}完整图片">${image}</button>` : image}<span class="rarity-badge rarity-${item.rarity.toLowerCase()}">${item.rarity}</span>${item.duplicate ? '' : '<span class="new-badge">NEW</span>'}</div>${item.guaranteed ? '<span class="guaranteed-label">80 抽保底 SSR</span>' : ''}<div class="result-info"><strong>${card.name}</strong><small>${item.duplicate ? `重复卡 · 转化 ${item.fragments} 枚碎片` : '新卡牌 · 已加入收藏'}</small>${bookmark ? '<span class="bookmark-view-hint">点击图片阅读完整书签</span>' : ''}</div></div>`;
    }).join('');
    const newCards = results.filter(item => !item.duplicate).length, fragments = results.reduce((sum, item) => sum + item.fragments, 0), ssr = results.filter(item => item.rarity === 'SSR').length;
    $('result-summary').textContent = `获得 ${newCards} 张新卡牌${ssr ? ` · 其中抽出 ${ssr} 张 SSR` : ''} · 重复卡转化 ${fragments} 枚能量碎片`;
    $('result-dialog').showModal();
  }
  function draw(count) {
    if (busy || $('result-dialog').open) throw new Error('请先收下本次祈愿结果。');
    if (!profile() || dirty) throw new Error('请先填写并保存完整学生信息。');
    busy = true;
    try {
      const outcome = E.draw(profile(), database.selectedPool, count);
      commit({ ...database, profiles: { ...database.profiles, [database.activeKey]: outcome.profile } });
      render(); presentResults(outcome.results);
      return { results: outcome.results, tickets: outcome.profile.tickets, fragments: outcome.profile.fragments, pityRemaining: 80 - outcome.profile.pools[database.selectedPool].pity };
    } finally { busy = false; renderStats(); }
  }
  function exchange() {
    if (!profile() || dirty || busy) throw new Error('请先保存学生信息。');
    const next = E.exchange(profile());
    commit({ ...database, profiles: { ...database.profiles, [database.activeKey]: next } }); renderStats(); toast('兑换成功！消耗 10 枚碎片，获得 1 次抽卡机会。');
    return { tickets: next.tickets, fragments: next.fragments };
  }
  function selectPool(id) {
    if (!E.POOLS[id]) throw new Error('请选择有效卡池。');
    commit({ ...database, selectedPool: id }); render();
    return { currentPool: E.POOLS[id].name, pityRemaining: 80 - (profile()?.pools[id].pity || 0) };
  }
  function selectView(next) {
    view = next;
    for (const name of ['collection', 'history']) { const active = name === view; $(name + '-tab').setAttribute('aria-selected', String(active)); $(name + '-tab').tabIndex = active ? 0 : -1; $(name + '-content').hidden = !active; }
    $('panel-caption').textContent = view === 'collection' ? '角色卡 / 书签卡' : '最近 200 抽';
  }
  $('identity-form').addEventListener('submit', event => { event.preventDefault(); run(saveIdentity); });
  $('identity-form').addEventListener('input', () => { dirty = !profile() || E.identityKey(formInfo()) !== database.activeKey; renderStats(); });
  $('pool-nav').addEventListener('click', event => { const button = event.target.closest('[data-pool]'); if (button) run(() => selectPool(button.dataset.pool)); });
  $('draw-one').addEventListener('click', () => run(() => draw(1))); $('draw-ten').addEventListener('click', () => run(() => draw(10)));
  $('exchange-button').addEventListener('click', () => run(exchange));
  $('close-results').addEventListener('click', () => $('result-dialog').close()); $('finish-results').addEventListener('click', () => $('result-dialog').close());
  $('rules-button').addEventListener('click', () => $('rules-dialog').showModal());
  $('close-rules').addEventListener('click', () => $('rules-dialog').close()); $('acknowledge-rules').addEventListener('click', () => $('rules-dialog').close());
  document.body.addEventListener('click', event => {
    const button = event.target.closest('[data-bookmark-preview]');
    if (!button) return;
    const bookmark = E.BOOKMARKS[button.dataset.bookmarkPreview];
    if (!bookmark) return;
    $('bookmark-title').textContent = bookmark.name + ' · 四格漫画书签';
    $('bookmark-image').src = bookmark.image; $('bookmark-image').alt = bookmark.name + '完整漫画';
    $('bookmark-dialog').showModal();
  });
  $('close-bookmark').addEventListener('click', () => $('bookmark-dialog').close());
  for (const name of ['collection', 'history']) {
    $(name + '-tab').addEventListener('click', () => selectView(name));
    $(name + '-tab').addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const target = event.key === 'Home' ? 'collection' : event.key === 'End' ? 'history' : name === 'collection' ? 'history' : 'collection'; selectView(target); $(target + '-tab').focus(); } });
  }
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY || event.key === null) {
      storageError = '另一网页窗口修改了本机档案。请刷新本页后继续，以避免覆盖新进度。';
      renderStats(); toast(storageError, true);
    }
  });
  fillIdentity(); render();
  if (storageError) toast(storageError, true);

  // 在支持该浏览器接口时提供与页面按钮相同的操作；普通浏览器自动跳过。
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const tools = [
      { name: 'read_wish_status', description: '读取当前界络祈愿的卡池、抽卡次数、保底与碎片，不返回学生姓名。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ currentPool: database.selectedPool, total: profile()?.total || 0, pityRemaining: 80 - (profile()?.pools[database.selectedPool].pity || 0), tickets: profile()?.tickets || 0, fragments: profile()?.fragments || 0 }) },
      { name: 'select_wish_pool', description: '切换并保存当前卡池，保留各卡池保底进度。', inputSchema: { type: 'object', properties: { poolId: { type: 'string', enum: Object.keys(E.POOLS) } }, required: ['poolId'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => selectPool(input?.poolId) },
      { name: 'draw_wish_cards', description: '为已保存的学生档案完成单抽或十连，消耗机会并保存卡牌、保底和碎片，展示结果。', inputSchema: { type: 'object', properties: { count: { type: 'integer', enum: [1, 10] } }, required: ['count'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => draw(input?.count) },
      { name: 'exchange_wish_fragment', description: '消耗当前档案10枚碎片，兑换1次抽卡机会并保存。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: exchange }
    ];
    for (const tool of tools) { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (_) { /* 浏览器未完整实现时继续提供普通页面功能。 */ } }
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
