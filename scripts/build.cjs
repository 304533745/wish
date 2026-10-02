'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const mode = process.argv[2];
if (!['dir', 'dist'].includes(mode)) throw new Error('构建参数必须是 dir 或 dist。');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]); }
async function prepareWindowsTools(cache) {
  // This official archive also contains macOS symlinks. Extract only Windows/Linux
  // tools so building on Windows does not require administrator/developer mode.
  const directory = path.join(cache, 'winCodeSign', 'winCodeSign-2.6.0');
  if (fs.existsSync(path.join(directory, 'rcedit-x64.exe'))) return;
  const archive = path.join(cache, 'winCodeSign', 'winCodeSign-2.6.0.7z');
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  if (!fs.existsSync(archive)) {
    console.log('下载官方 Windows 打包工具（首次构建）…');
    const response = await fetch('https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z');
    if (!response.ok) throw new Error('打包工具下载失败：' + response.status);
    fs.writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  }
  const expected = 'e8b408d9df413c2dd7b346684d07b5a37b4f880dbc73bf8f63af50f62fe90fc958e39a6c32d1ee2f0bf7bd1724895af7671d5c6cdc8b94147c493c0275c1f0b4';
  if (crypto.createHash('sha512').update(fs.readFileSync(archive)).digest('hex') !== expected) throw new Error('打包工具校验失败，请移走缓存中的 winCodeSign-2.6.0.7z 后重试。');
  const result = spawnSync(require('7zip-bin').path7za, ['x', archive, '-o' + directory, '-y', '-xr!darwin'], { windowsHide: true, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr || result.stdout);
}
(async () => {
  const build = path.join(root, 'build'); fs.mkdirSync(build, { recursive: true });
  const files = [...['index.html', 'app.js', 'engine.js', 'styles.css'].map(file => path.join(root, file)), ...walk(path.join(root, 'assets'))];
  const manifest = files.map(file => ({ path: path.relative(root, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }));
  // Validate every engine asset reference before invoking the packager.
  const E = require('../engine.js');
  for (const poolId of Object.keys(E.POOLS)) for (const id of E.POOLS[poolId].characters) for (const rarity of ['R', 'SR', 'SSR']) for (let index = 0; index < 5; index++) {
    if (!fs.existsSync(path.join(root, E.getCardImage(id, rarity, index, poolId)))) throw new Error('缺少角色素材。');
  }
  for (const bookmark of Object.values(E.BOOKMARKS)) if (!fs.existsSync(path.join(root, bookmark.image))) throw new Error('缺少书签素材。');
  fs.writeFileSync(path.join(build, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
  const sizes = [16, 32, 48, 64, 128, 256], pngs = [];
  for (const size of sizes) pngs.push(await sharp(path.join(root, 'assets/favicon.svg')).resize(size, size).png().toBuffer());
  fs.writeFileSync(path.join(build, 'icon.png'), pngs.at(-1));
  const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  pngs.forEach((png, index) => { const entry = 6 + index * 16; header[entry] = sizes[index] % 256; header[entry + 1] = sizes[index] % 256; header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6); header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += png.length; });
  fs.writeFileSync(path.join(build, 'icon.ico'), Buffer.concat([header, ...pngs]));
  const env = { ...process.env, NODE_USE_ENV_PROXY: '1', electron_config_cache: path.join(root, '.cache/electron'), ELECTRON_CACHE: path.join(root, '.cache/electron'), ELECTRON_BUILDER_CACHE: path.join(root, '.cache/electron-builder'), CSC_IDENTITY_AUTO_DISCOVERY: 'false', TEMP: path.join(root, '.cache/temp'), TMP: path.join(root, '.cache/temp') };
  delete env.ELECTRON_RUN_AS_NODE;
  fs.mkdirSync(env.TEMP, { recursive: true });
  if (process.platform === 'win32') await prepareWindowsTools(env.ELECTRON_BUILDER_CACHE);
  const cli = require.resolve('electron-builder/out/cli/cli.js');
  const args = mode === 'dir' ? ['--win', '--x64', '--dir', '--publish', 'never'] : ['--win', 'nsis', 'portable', '--x64', '--publish', 'never'];
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
