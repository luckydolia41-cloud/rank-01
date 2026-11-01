'use strict';
/*
 * Joins the website's stylesheets (public/src/css/*.css) and scripts (public/src/js/*.js)
 * into one app.css and one app.js, in file-name order. Each bundle gets a content hash,
 * so pages can link /assets/app.js?v=<hash> and browsers cache it for a year.
 * In production the bundles are built once; otherwise they are rebuilt on every request.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const TYPES = { css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8' };

function createAssets(publicDir, cache) {
  let built = null;

  function readDir(kind) {
    const dir = path.join(publicDir, 'src', kind);
    let names = [];
    try {
      names = fs.readdirSync(dir).filter((n) => n.endsWith('.' + kind)).sort();
    } catch (e) {
      names = [];
    }
    const parts = names.map((n) => '/* ' + n + ' */\n' + fs.readFileSync(path.join(dir, n), 'utf8'));
    return kind === 'js' ? '(function(){\n\'use strict\';\n' + parts.join('\n') + '\n})();\n' : parts.join('\n');
  }

  function build() {
    const css = readDir('css');
    const js = readDir('js');
    const v = crypto.createHash('sha1').update(css).update(js).digest('hex').slice(0, 10);
    return { v, files: { 'app.css': { body: Buffer.from(css), type: TYPES.css }, 'app.js': { body: Buffer.from(js), type: TYPES.js } } };
  }

  return {
    get() {
      if (!built || !cache) built = build();
      return built;
    },
  };
}

module.exports = { createAssets };
