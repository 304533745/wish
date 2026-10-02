'use strict';
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const MAX_BYTES = 25 * 1024 * 1024;

function validateState(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('存档文件格式异常或超过 25 MB。');
  const state = JSON.parse(raw);
  if (state.version !== 1 || !state.profiles || typeof state.profiles !== 'object' || Array.isArray(state.profiles) ||
      !Object.entries(state.profiles).every(([key, value]) => E.isValidProfile(value) && key === E.identityKey(value.info)) ||
      (state.activeKey !== null && !Object.hasOwn(state.profiles, state.activeKey)) || !E.POOLS[state.selectedPool]) {
    throw new Error('存档格式异常。原文件已保留，请从有效备份恢复。');
  }
  return state;
}

function atomicWrite(filename, content) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temp = filename + '.tmp';
  let fd;
  try {
    fd = fs.openSync(temp, 'w');
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(temp, filename);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

class StateStore {
  constructor(directory) { this.filename = path.join(directory, 'records.json'); }
  read() {
    if (!fs.existsSync(this.filename)) return null;
    const raw = fs.readFileSync(this.filename, 'utf8'); validateState(raw); return raw;
  }
  save(raw) {
    validateState(raw);
    const previous = this.read(); // Refuse to overwrite an unreadable original.
    if (previous !== null) atomicWrite(this.filename + '.bak', previous);
    atomicWrite(this.filename, raw);
  }
  restore(raw) {
    validateState(raw);
    if (fs.existsSync(this.filename)) {
      // Keep the original even when the user explicitly restores a corrupt file.
      fs.copyFileSync(this.filename, this.filename + '.before-import-' + Date.now());
    }
    atomicWrite(this.filename, raw);
  }
}

module.exports = { StateStore, validateState, atomicWrite };
