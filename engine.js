(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WishEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CHARACTERS = Object.freeze({
    lipu: { id: 'lipu', name: '狸谱', subtitle: '灵感的同行者', image: 'assets/characters/lipu.svg', rarityImages: { R: ['assets/characters/lipu-r-04.png', 'assets/characters/lipu-r-06.png', 'assets/characters/lipu-r-09.png', 'assets/characters/lipu-r-10.png', 'assets/characters/lipu-r-14.png'], SR: ['assets/characters/lipu-sr-01.png', 'assets/characters/lipu-sr-02.png'] }, rarityShapes: { R: 'square', SR: 'portrait' }, color: '#a999ee' },
    blaze: { id: 'blaze', name: '布蕾兹', subtitle: '跃动的星火', image: 'assets/characters/blaze.svg', rarityImages: { R: ['assets/characters/blaze-r-01.png', 'assets/characters/blaze-r-02.png', 'assets/characters/blaze-r-03.png'], SSR: ['assets/characters/blaze-ssr.jpg', 'assets/characters/blaze-ssr-scene.jpg'] }, rarityShapes: { R: 'square' }, color: '#efb585' },
    leyou: { id: 'leyou', name: '乐游', subtitle: '寻找无限可能', image: 'assets/characters/leyou.svg', rarityImages: { R: ['assets/characters/leyou-r-01.png', 'assets/characters/leyou-r-02.png', 'assets/characters/leyou-r-03.png'], SSR: 'assets/characters/leyou-ssr.png' }, rarityShapes: { R: 'square', SSR: 'portrait' }, color: '#77cbbc' },
    liyan: { id: 'liyan', name: '李岩', subtitle: '字里行间的相遇', image: 'assets/characters/liyan.svg', rarityImages: { R: ['assets/characters/liyan-r-01.png', 'assets/characters/liyan-r-02.png', 'assets/characters/liyan-r-03.png'], SSR: 'assets/characters/liyan-ssr.jpg' }, rarityShapes: { R: 'square', SSR: 'portrait' }, color: '#8db6e6' }
  });
  const BOOKMARKS = Object.freeze({
    'english-bookmark-01': { id: 'english-bookmark-01', name: '书签卡 01', image: 'assets/bookmarks/english-sr-01.jpg', kind: 'bookmark' },
    'english-bookmark-02': { id: 'english-bookmark-02', name: '书签卡 02', image: 'assets/bookmarks/english-sr-02.jpg', kind: 'bookmark' },
    'english-bookmark-03': { id: 'english-bookmark-03', name: '书签卡 03', image: 'assets/bookmarks/english-sr-03.jpg', kind: 'bookmark' }
  });
  const POOLS = Object.freeze({
    english: { id: 'english', name: '英语卡池', icon: 'A', english: 'ENGLISH WISH', characters: ['lipu', 'blaze'], rarityCharacters: { SSR: ['blaze'] }, rarityBookmarks: { SR: Object.keys(BOOKMARKS) }, featuredCards: [{ characterId: 'blaze', artIndex: 0, label: '单人版' }, { characterId: 'blaze', artIndex: 1, label: '组合场景版' }], description: '本期 SSR：布蕾兹双卡面 · SR：四格漫画书签。', accent: '#a99aef' },
    math: { id: 'math', name: '数学卡池', icon: 'π', english: 'MATHEMATICS WISH', characters: ['leyou', 'lipu'], rarityCharacters: { SR: ['lipu'], SSR: ['leyou'] }, cardImages: { lipu: { R: ['assets/characters/lipu-r-08.png', 'assets/characters/lipu-r-11.png', 'assets/characters/lipu-r-12.png', 'assets/characters/lipu-r-13.png', 'assets/characters/lipu-r-15.png'] } }, featuredCards: [{ characterId: 'leyou', rarity: 'SSR', artIndex: 0 }, { characterId: 'lipu', rarity: 'SR', artIndex: 0, label: '自拍版' }], description: '本期 SSR：乐游 · SR：狸谱双卡面。', accent: '#77cbbc' },
    chinese: { id: 'chinese', name: '语文卡池', icon: '文', english: 'CHINESE WISH', characters: ['lipu', 'liyan'], rarityCharacters: { SR: ['lipu'], SSR: ['liyan'] }, cardImages: { lipu: { R: ['assets/characters/lipu-r-01.png', 'assets/characters/lipu-r-02.png', 'assets/characters/lipu-r-03.png', 'assets/characters/lipu-r-05.png', 'assets/characters/lipu-r-07.png'], SR: 'assets/characters/lipu-sr-chinese.png' } }, featuredCards: [{ characterId: 'lipu', rarity: 'SR', artIndex: 0, label: '本期语文卡面' }, { characterId: 'liyan', rarity: 'SSR', artIndex: 0 }], description: '本期 SSR：李岩 · SR：狸谱。', accent: '#8db6e6' },
    event: { id: 'event', name: '限定活动卡池', icon: '✦', english: 'SPECIAL EVENT WISH', characters: ['lipu', 'blaze', 'leyou', 'liyan'], description: '四位伙伴齐聚，让每一份期待都有回应。', accent: '#e6c986' }
  });
  const INITIAL_TICKETS = 100;
  const PITY_LIMIT = 80;
  function getCardArtworks(characterId, rarity, artworkPool) {
    return POOLS[artworkPool]?.cardImages?.[characterId]?.[rarity] || CHARACTERS[characterId]?.rarityImages?.[rarity];
  }
  function getCardImage(characterId, rarity, artIndex = 0, artworkPool) {
    const character = CHARACTERS[characterId];
    const artwork = getCardArtworks(characterId, rarity, artworkPool);
    return Array.isArray(artwork) ? artwork[artIndex] || artwork[0] : artwork || character.image;
  }
  function getCardDisplay(card) {
    if (card.bookmarkId) return BOOKMARKS[card.bookmarkId];
    return { ...CHARACTERS[card.characterId], kind: 'character', shape: CHARACTERS[card.characterId].rarityShapes?.[card.rarity], image: getCardImage(card.characterId, card.rarity, card.artIndex, card.artworkPool) };
  }
  function isValidCard(card, key) {
    if (!card || typeof card !== 'object') return false;
    if (card.artworkPool !== undefined && !POOLS[card.artworkPool]?.cardImages?.[card.characterId]?.[card.rarity]) return false;
    if (card.bookmarkId) return Boolean(BOOKMARKS[card.bookmarkId] && card.rarity === 'SR' && key === card.bookmarkId + ':SR');
    return Boolean(CHARACTERS[card.characterId] && ['R', 'SR', 'SSR'].includes(card.rarity) && key === card.characterId + ':' + card.rarity);
  }
  function identityKey(info) { return JSON.stringify(['teacher', 'classroom', 'student'].map(key => String(info[key] || '').trim())); }
  function validateIdentity(info) {
    const result = {};
    for (const key of ['teacher', 'classroom', 'student']) {
      if (typeof info?.[key] !== 'string' || !info[key].trim() || info[key].trim().length > 30) throw new Error('请完整填写任课老师、班级和学生姓名，每项不超过 30 个字。');
      result[key] = info[key].trim();
    }
    return result;
  }
  function createProfile(info) {
    return { info: validateIdentity(info), tickets: INITIAL_TICKETS, fragments: 0, total: 0, pools: Object.fromEntries(Object.keys(POOLS).map(id => [id, { total: 0, pity: 0 }])), collection: {}, history: [] };
  }
  function randomUnit() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) { const array = new Uint32Array(1); crypto.getRandomValues(array); return array[0] / 4294967296; }
    return Math.random();
  }
  function sample(rng) { const value = rng(); if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机数必须在 0 到 1 之间。'); return value; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function draw(profile, poolId, count, rng = randomUnit, now = () => new Date().toISOString(), artRng = randomUnit) {
    if (!POOLS[poolId]) throw new Error('请选择有效卡池。');
    if (count !== 1 && count !== 10) throw new Error('仅支持单抽和十连抽。');
    if (!isValidProfile(profile)) throw new Error('学生档案无效，请重新保存信息。');
    if (profile.tickets < count) throw new Error('抽卡机会不足，可使用能量碎片兑换。');
    const next = clone(profile), results = [], pool = POOLS[poolId];
    for (let i = 0; i < count; i++) {
      const guaranteed = next.pools[poolId].pity === PITY_LIMIT - 1;
      const rate = guaranteed ? 0 : sample(rng);
      const rarity = guaranteed || rate < 0.02 ? 'SSR' : rate < 0.20 ? 'SR' : 'R';
      const bookmarkCandidates = pool.rarityBookmarks?.[rarity];
      const candidates = bookmarkCandidates || pool.rarityCharacters?.[rarity] || pool.characters;
      const selectedId = candidates[Math.floor(sample(rng) * candidates.length)];
      const characterId = bookmarkCandidates ? null : selectedId;
      const bookmarkId = bookmarkCandidates ? selectedId : null;
      const artworkSource = pool.cardImages?.[characterId]?.[rarity] ? { artworkPool: poolId } : {};
      const artworks = getCardArtworks(characterId, rarity, poolId);
      const artIndex = Array.isArray(artworks) && artworks.length > 1 ? Math.floor(sample(artRng) * artworks.length) : 0;
      const cardKey = selectedId + ':' + rarity, duplicate = Boolean(next.collection[cardKey]);
      const fragments = duplicate ? (rarity === 'SSR' ? 2 : 1) : 0;
      next.total++; next.pools[poolId].total++; next.tickets--; next.fragments += fragments;
      next.pools[poolId].pity = rarity === 'SSR' ? 0 : next.pools[poolId].pity + 1;
      const result = { sequence: next.total, poolId, characterId, ...(bookmarkId ? { bookmarkId } : {}), rarity, cardKey, artIndex, ...artworkSource, duplicate, fragments, guaranteed, time: now() };
      if (!duplicate) next.collection[cardKey] = { characterId, ...(bookmarkId ? { bookmarkId } : {}), rarity, artIndex, ...artworkSource, obtainedAt: result.time };
      next.history.unshift(result); results.push(result);
    }
    next.history = next.history.slice(0, 200);
    return { profile: next, results };
  }
  function exchange(profile) {
    if (!isValidProfile(profile)) throw new Error('学生档案无效。');
    if (profile.fragments < 10) throw new Error('兑换需要 10 枚能量碎片。');
    const next = clone(profile); next.fragments -= 10; next.tickets++; return next;
  }
  function isValidProfile(profile) {
    try {
      validateIdentity(profile.info);
      if (!['tickets', 'fragments', 'total'].every(key => Number.isSafeInteger(profile[key]) && profile[key] >= 0)) return false;
      if (!Object.keys(POOLS).every(id => Number.isSafeInteger(profile.pools?.[id]?.total) && profile.pools[id].total >= 0 && Number.isInteger(profile.pools[id].pity) && profile.pools[id].pity >= 0 && profile.pools[id].pity < PITY_LIMIT)) return false;
      if (Object.values(profile.pools).reduce((sum, p) => sum + p.total, 0) !== profile.total) return false;
      if (!profile.collection || typeof profile.collection !== 'object' || Array.isArray(profile.collection)) return false;
      if (!Object.entries(profile.collection).every(([key, card]) => isValidCard(card, key))) return false;
      return Array.isArray(profile.history) && profile.history.length <= 200 && profile.history.every(item => POOLS[item.poolId] && isValidCard(item, item.cardKey) && (item.bookmarkId ? POOLS[item.poolId].rarityBookmarks?.[item.rarity]?.includes(item.bookmarkId) : POOLS[item.poolId].characters.includes(item.characterId)) && Number.isSafeInteger(item.sequence) && item.sequence > 0 && item.sequence <= profile.total && typeof item.duplicate === 'boolean' && item.fragments === (item.duplicate ? (item.rarity === 'SSR' ? 2 : 1) : 0));
    } catch (_) { return false; }
  }
  return Object.freeze({ CHARACTERS, BOOKMARKS, POOLS, INITIAL_TICKETS, PITY_LIMIT, getCardImage, getCardDisplay, identityKey, validateIdentity, createProfile, draw, exchange, isValidProfile });
});
