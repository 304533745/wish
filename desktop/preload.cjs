'use strict';
const { contextBridge, ipcRenderer } = require('electron');
function request(channel, value) {
  const result = ipcRenderer.sendSync(channel, value);
  if (!result?.ok) throw new Error(result?.error || '桌面存档操作失败。');
  return result.value;
}
contextBridge.exposeInMainWorld('wishDesktop', Object.freeze({
  loadState: () => request('wish:load'),
  saveState: raw => request('wish:save', raw)
}));
