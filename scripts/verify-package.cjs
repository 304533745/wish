'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = path.resolve(__dirname, '..');
const archive = process.argv[2] || path.join(root, 'dist', 'win-unpacked', 'resources', 'app.asar');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build', 'asset-manifest.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const extract = file => asar.extractFile(archive, file.split('/').join(path.sep));
for (const entry of manifest) {
  const packed = extract(entry.path);
  assert.equal(packed.length, entry.bytes, entry.path + ' size');
  assert.equal(hash(packed), entry.sha256, entry.path + ' packed hash');
  assert.equal(hash(fs.readFileSync(path.join(root, entry.path))), entry.sha256, entry.path + ' source hash');
}
for (const file of ['desktop/main.cjs', 'desktop/preload.cjs', 'desktop/store.cjs']) {
  assert.equal(hash(extract(file)), hash(fs.readFileSync(path.join(root, file))), file);
}
const pkg = JSON.parse(extract('package.json').toString('utf8'));
const sourcePackage = require('../package.json');
// electron-builder removes development dependencies and build settings from
// runtime metadata. Compare every field it retains, rather than raw JSON bytes.
for (const [key, value] of Object.entries(pkg)) assert.deepEqual(value, sourcePackage[key], 'runtime metadata: ' + key);
assert.equal(pkg.version, sourcePackage.version); assert.equal(pkg.main, sourcePackage.main);
assert.equal(sourcePackage.build.nsis.allowToChangeInstallationDirectory, true);
assert.equal(sourcePackage.build.nsis.createDesktopShortcut, 'always');
assert.equal(sourcePackage.build.nsis.createStartMenuShortcut, true);
assert.equal(sourcePackage.build.nsis.deleteAppDataOnUninstall, false);
const report = {
  version: pkg.version, archive, success: true,
  filesVerified: manifest.length + 4,
  imagesVerified: manifest.filter(entry => /\.(png|jpe?g|svg)$/i.test(entry.path)).length,
  checks: ['页面、概率引擎、全部素材和桌面代码与当前源码逐项一致', '产品版本一致', '可选安装位置、桌面和开始菜单快捷方式、卸载保留存档配置正确']
};
const artifactDir = path.join(root, 'tests', 'artifacts'); fs.mkdirSync(artifactDir, { recursive: true });
fs.writeFileSync(path.join(artifactDir, 'package-integrity-report.json'), JSON.stringify(report, null, 2));
console.log('PASS ' + pkg.version + ' 包内 ' + report.filesVerified + ' 个文件及 ' + report.imagesVerified + ' 张图片与源码一致');
