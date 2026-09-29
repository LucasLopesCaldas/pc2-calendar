// Atualiza o parâmetro ?v=<hash> dos CSS/JS locais no index.html, para que o
// navegador baixe a versão nova após cada deploy (o GitHub Pages usa cache de 10 min).
// Uso: npm run version-assets
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
// src="js/app.js" ou href="css/styles.css", com ou sem ?v= já existente
const ASSET_REF = /((?:src|href)=")((?:js|css)\/[\w.-]+\.(?:js|css))(?:\?v=[0-9a-f]*)?(")/g;

function assetHash(relPath) {
  const content = fs.readFileSync(path.join(ROOT, relPath));
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function versionAssets(html) {
  return html.replace(ASSET_REF, (_, attr, relPath, quote) => `${attr}${relPath}?v=${assetHash(relPath)}${quote}`);
}

if (require.main === module) {
  const html = fs.readFileSync(INDEX, 'utf8');
  const updated = versionAssets(html);
  fs.writeFileSync(INDEX, updated);
  console.log(updated === html ? 'index.html já estava atualizado.' : 'index.html atualizado.');
}

module.exports = { versionAssets, ASSET_REF, INDEX };
