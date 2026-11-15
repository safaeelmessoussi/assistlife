/**
 * Static hosts such as Cloudflare Pages refuse to publish any folder named
 * `node_modules`, and the web export puts library fonts and icons under
 * `dist/assets/node_modules`. Move them to `dist/assets/vendor` and point the
 * bundles at the new place.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const from = path.join(dist, 'assets', 'node_modules');
const to = path.join(dist, 'assets', 'vendor');

if (fs.existsSync(from)) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

let rewritten = 0;
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|html|json|css|map)$/.test(entry.name)) {
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes('assets/node_modules')) continue;
      fs.writeFileSync(file, text.split('assets/node_modules').join('assets/vendor'));
      rewritten += 1;
    }
  }
})(dist);

console.log(`fix-web-assets: moved library assets to assets/vendor, updated ${rewritten} file(s)`);
