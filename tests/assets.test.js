const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { versionAssets, INDEX } = require('../scripts/version-assets.js');

test('index.html referencia CSS/JS com o hash da versão atual (rode "npm run version-assets")', () => {
  const html = fs.readFileSync(INDEX, 'utf8');
  assert.strictEqual(html, versionAssets(html));
});
