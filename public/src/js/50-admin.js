/* ---------- admin: login, draft & publish, content editors ---------- */
var adminTab = SS.get('rk:atab', 'overview'), ed = null, edIndex = -1;
var TABS = [['overview', 'grid', 'Overview'], ['orders', 'cart', 'Orders'], ['enquiries', 'inbox', 'Enquiries'], ['products', 'box', 'Products'], ['cats', 'layers', 'Categories'], ['depts', 'kit', 'Departments & kits'],
  ['home', 'home', 'Home page'], ['company', 'palette', 'Company & brand'], ['ordering', 'truck', 'Ordering & payments'], ['pages', 'file', 'About & FAQ'], ['settings', 'settings', 'Backup & security']];
var counts = { orders: null, enquiries: null };

pages.admin = function () { setTitle('Admin — ' + state.brand.name); return isAdmin ? adminDash() : adminLogin(); };
function adminLogin() {
  return '<section class="wrap adm-login"><form class="lock" id="login" novalidate><span class="ic">' + ic('lock') + '</span><div><h1 class="d2" style="font-size:2rem">Staff login</h1><p class="muted" style="margin-top:6px">Manage products, prices, orders and enquiries.</p></div>' +
    '<div class="fld"><label class="fld-l" for="apw">Password</label><div class="pw"><input id="apw" type="password" autocomplete="current-password" required><button type="button" class="icon-btn" data-act="pwshow" aria-label="Show password">' + ic('eye') + '</button></div></div>' +
    '<p class="err-msg" id="pwerr" role="alert"></p><button class="btn btn-primary btn-lg btn-block" type="submit">Log in</button><a class="link" href="/" style="text-align:center">Back to the website</a></form></section>';
}
A.pwshow = function (el) { var i = el.parentNode.querySelector('input'); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = ic(show ? 'eyeoff' : 'eye'); };
after.admin = function () {
  var f = $('#login');
  if (f) f.addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('#apw').value, err = $('#pwerr'), btn = f.querySelector('[type=submit]');
    if (!pw) { err.textContent = 'Enter the password.'; return; }
    btn.classList.add('busy'); err.textContent = '';
    apiFetch('/auth/login', { method: 'POST', body: { password: pw } }).then(function (r) {
      apiToken = r.token; SS.set('rk:token', r.token); isAdmin = true; return apiFetch('/admin/store');
    }).then(function (d) { applyRemote(d); toast('Logged in. Changes stay as a draft until you publish.'); }).catch(function (e2) {
      btn.classList.remove('busy'); err.textContent = e2.status === 401 ? 'Wrong password. Try again.' : e2.message;
      f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); $('#apw').select();
    });
  });
  if (isAdmin) { loadCounts(); if (adminTab === 'orders') loadOrders(); if (adminTab === 'enquiries') loadEnq(); }
};
function loadCounts() {
  apiFetch('/admin/orders/stats').then(function (s) { counts.orders = s.byStatus.new; tabBadges(); if (adminTab === 'overview') rerenderPanel(); }).catch(function () { /* ignore */ });
  apiFetch('/admin/enquiries?limit=1').then(function (s) { counts.enquiries = s.byStatus.new; tabBadges(); if (adminTab === 'overview') rerenderPanel(); }).catch(function () { /* ignore */ });
}
function tabBadges() { $$('.adm-tabs [data-badge]').forEach(function (b) { var n = counts[b.dataset.badge]; b.textContent = n ? n : ''; }); }
R.loggedOut = function () {
  apiToken = null; SS.del('rk:token'); var was = isAdmin; isAdmin = false;
  if (was) { state = clone(published); applyBrand(); shell(); route({ keep: true }); toast('Your login expired. Log in again.'); }
};
function applyRemote(d) {
  published = normalize(d);
  var dr = LS.get('rk:draft', null);
  if (isAdmin && dr && dr.data) { if (dr.base === published.rev) { state = normalize(dr.data); staleDraft = null; } else { state = clone(published); staleDraft = dr; } }
  else state = clone(published);
  applyBrand(); shell(); route({ keep: true });
}

function adminDash() {
  return '<div class="adm-bar"><div class="wrap adm-bar-in"><h1>Admin · ' + esc(state.brand.name) + '</h1><div class="acts" id="admacts">' + admActions() + '</div></div></div>' +
    '<section class="wrap admin">' +
    (staleDraft ? '<div class="note warn" style="margin-bottom:18px"><b>Unpublished draft found.</b> This browser has edits made on an older version of the store. <button class="link" data-act="draftRestore">Restore them</button> or <button class="link" data-act="draftDrop">discard them</button>.</div>' : '') +
    '<div class="adm"><nav class="adm-tabs" aria-label="Admin sections">' + TABS.map(function (t) {
      return '<button class="' + (adminTab === t[0] ? 'on' : '') + '" data-act="atab" data-v="' + t[0] + '">' + ic(t[1], 18) + t[2] + (counts[t[0]] !== undefined ? '<span class="badge" data-badge="' + t[0] + '">' + (counts[t[0]] || '') + '</span>' : '') + '</button>';
    }).join('') + '</nav><div class="apanel" id="apanel">' + adminPanel() + '</div></div></section>';
}
function admActions() {
  var d = dirty();
  return '<span class="status' + (d ? ' dirty' : '') + '"><i></i>' + (d ? 'Unpublished changes' : 'Everything is live') + '</span>' +
    (d ? '<button class="btn btn-sm" data-act="discard">Discard</button>' : '') +
    '<button class="btn btn-sm btn-primary" data-act="publish" id="pubbtn"' + (d ? '' : ' disabled') + '>' + ic('upload', 16) + 'Publish</button>' +
    '<a class="btn btn-sm" href="/" target="_blank" rel="noopener">' + ic('eye', 16) + 'View site</a>';
}
function refreshActions() { var a = $('#admacts'); if (a) a.innerHTML = admActions(); }
function rerenderPanel() { var p = $('#apanel'); if (p) p.innerHTML = adminPanel(); $$('.adm-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === adminTab); }); refreshActions(); tabBadges(); }
A.atab = function (el) {
  adminTab = el.dataset.v; SS.set('rk:atab', adminTab); rerenderPanel();
  if (adminTab === 'orders') loadOrders(); if (adminTab === 'enquiries') loadEnq();
  var p = $('#apanel'); if (p && p.getBoundingClientRect().top < 0) p.scrollIntoView({ block: 'start' });
};
function changed(o) {
  o = o || {};
  var ok = LS.set('rk:draft', { base: published.rev, data: state, at: Date.now() });
  if (!ok) toast('This draft is too big to keep in the browser. Publish soon so you don’t lose it.');
  if (o.brand) { applyBrand(); }
  if (o.shell) { var y = scrollY; shell(); route({ keep: true }); scrollTo(0, y); return; }
  refreshActions();
}
A.discard = function (el) {
  if (!el.classList.contains('confirming')) { el.classList.add('confirming'); el.textContent = 'Discard all edits?'; setTimeout(function () { if (el.isConnected) { el.classList.remove('confirming'); el.textContent = 'Discard'; } }, 3500); return; }
  state = clone(published); LS.del('rk:draft'); staleDraft = null; applyBrand(); shell(); route({ keep: true }); toast('Edits discarded.');
};
A.draftRestore = function () { if (staleDraft) { state = normalize(staleDraft.data); staleDraft = null; changed({ shell: true }); toast('Draft restored. Review it, then publish.'); } };
A.draftDrop = function () { staleDraft = null; LS.del('rk:draft'); route({ keep: true }); };
A.publish = function () {
  if (!dirty()) return;
  var btn = $('#pubbtn'); if (btn) btn.classList.add('busy');
  var data = clone(state); delete data.rev; delete data.updated;
  apiFetch('/admin/store', { method: 'PUT', body: { rev: published.rev, data: data } }).then(function (d) {
    published = normalize(d); state = clone(published); LS.del('rk:draft'); staleDraft = null; applyBrand(); shell(); route({ keep: true }); toast('Published. The website is updated for everyone.');
  }).catch(function (e) {
    if (btn) btn.classList.remove('busy');
    if (e.status === 409) {
      var mine = clone(state);
      apiFetch('/admin/store').then(function (d) {
        published = normalize(d); state = clone(published); staleDraft = { base: -1, data: mine }; LS.set('rk:draft', { base: -1, data: mine, at: Date.now() });
        applyBrand(); shell(); route({ keep: true }); toast('Someone else published first. Loaded their version — restore your draft to re-apply your edits.');
      }).catch(function () { toast(e.message); });
      return;
    }
    if (e.status !== 401) toast(e.status === 413 ? 'Too much data to publish. Use smaller photos.' : e.message);
  });
};

/* generic field bindings: data-bind="path" edits the draft */
function fld(label, path, o) {
  o = o || {}; var v = getPath(state, path), id = 'b-' + path.replace(/\W/g, '-');
  var at = ' id="' + id + '" data-bind="' + path + '"' + (o.num ? ' data-num="1" inputmode="numeric"' : '') + (o.list ? ' data-list="1"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '');
  var inp = o.rows ? '<textarea' + at + ' rows="' + o.rows + '">' + esc(o.list ? (v || []).join('\n') : v) + '</textarea>'
    : o.opts ? '<select' + at + '>' + o.opts.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(v) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>'
    : '<input type="' + (o.type || 'text') + '"' + at + ' value="' + esc(v == null ? '' : v) + '">';
  return '<div class="fld' + (o.full ? ' full' : '') + '"><label class="fld-l" for="' + id + '">' + label + '</label>' + inp + (o.hint ? '<span class="fld-h">' + o.hint + '</span>' : '') + '</div>';
}
function tog(label, path) { var id = 't-' + path.replace(/\W/g, '-'); return '<label class="check" for="' + id + '"><input type="checkbox" id="' + id + '" data-bind="' + path + '" data-bool="1"' + (getPath(state, path) ? ' checked' : '') + '> ' + label + '</label>'; }
function bindEvent(e) {
  var t = e.target; if (!t.dataset || !t.dataset.bind || !isAdmin) return;
  var path = t.dataset.bind, v;
  if (t.dataset.bool) v = t.checked;
  else if (t.dataset.num) v = Math.max(0, parseInt(t.value, 10) || 0);
  else if (t.dataset.list) v = t.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  else v = t.value;
  setPath(state, path, v);
  changed({ brand: /^brand\./.test(path) });
}
document.addEventListener('input', bindEvent);
document.addEventListener('change', function (e) { if (e.target.dataset && (e.target.dataset.bool || e.target.tagName === 'SELECT')) bindEvent(e); if (e.target.dataset && e.target.dataset.bind && /^(brand\.name|home\.announce|cats\.)/.test(e.target.dataset.bind)) changed({ shell: true }); });

function adminPanel() {
  var t = adminTab, s = state;
  if (t === 'orders') return ordersPanel();
  if (t === 'enquiries') return enqPanel();
  if (t === 'overview') {
    var P = s.products, priced = P.filter(function (p) { return p.price > 0; }).length, photos = P.filter(function (p) { return firstImg(p); }).length;
    var remote = P.filter(function (p) { return p.colors.some(function (c) { return c.imgs.some(function (u) { return /^https:/.test(u); }); }); }).length;
    var low = []; P.forEach(function (p) { if (p.track) Object.keys(p.sizes).forEach(function (z) { if (p.sizes[z] <= 5) low.push([p, z, p.sizes[z]]); }); });
    var chk = [[!!waNumber(), 'WhatsApp number for orders', 'company'], [!!s.store.email, 'Email address', 'company'], [!!s.brand.logo, 'Logo', 'company'],
      [photos === P.length, 'Photos on every product (' + photos + ' of ' + P.length + ')', 'products'], [remote === 0, 'Photos stored on this server (' + remote + ' products still load photos from another website)', 'settings'],
      [priced > 0, 'Prices (' + priced + ' of ' + P.length + ' products have a price; the rest show “Price on request”)', 'products'], [!!s.store.gstin, 'GSTIN in the footer and invoices', 'company']];
    return '<div class="stats">' + [['New orders', counts.orders == null ? '–' : counts.orders, 'orders'], ['New enquiries', counts.enquiries == null ? '–' : counts.enquiries, 'enquiries'], ['Products', P.length, 'products'], ['Categories', s.cats.length, 'cats']].map(function (x) {
      return '<button class="stat" data-act="atab" data-v="' + x[2] + '"><span>' + x[0] + '</span><b>' + x[1] + '</b></button>';
    }).join('') + '</div>' +
      '<div class="card"><h2>Setup checklist</h2><ul class="check-list">' + chk.map(function (c) { return '<li><span class="' + (c[0] ? 'ok' : 'no') + '">' + ic(c[0] ? 'check' : 'clock', 18) + '</span><span>' + c[1] + (c[0] ? '' : ' · <button class="link" data-act="atab" data-v="' + c[2] + '">Fix</button>') + '</span></li>'; }).join('') + '</ul></div>' +
      (low.length ? '<div class="card"><h2>Low stock</h2><p class="sub">Stock-tracked sizes with 5 or fewer left.</p><div class="alist">' + low.slice(0, 12).map(function (l) {
        return '<div class="arow"><div class="th" style="--c:' + l[0].colors[0].hex + '">' + media(l[0], 0, 0, { w: 112, h: 112 }) + '</div><div><b>' + esc(l[0].name) + '</b><div class="meta"><span>Size ' + esc(l[1]) + '</span><span style="color:' + (l[2] ? 'var(--warn)' : 'var(--bad)') + ';font-weight:700">' + (l[2] ? l[2] + ' left' : 'Out of stock') + '</span></div></div><div class="acts"><button class="btn btn-sm" data-act="pedit" data-id="' + esc(l[0].id) + '">Restock</button></div></div>';
      }).join('') + '</div></div>' : '') +
      '<div class="note"><b>How editing works:</b> changes to products, categories and text are a draft until you press <b>Publish</b>. Orders and enquiries update straight away.</div>';
  }
  if (t === 'products') {
    var q = SS.get('rk:aq', ''), fc = SS.get('rk:acat', '');
    var list = s.products.map(function (p, i) { return [p, i]; }).filter(function (x) {
      var p = x[0]; return (!fc || p.cat === fc) && (!q || (p.name + ' ' + p.code + ' ' + p.sub).toLowerCase().indexOf(q.toLowerCase()) > -1);
    });
    return '<div class="card"><div class="card-h"><h2>Products (' + s.products.length + ')</h2><button class="btn btn-sm btn-primary" data-act="pnew">' + ic('plus', 16) + 'Add product</button></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><label class="searchbox" style="flex:1 1 220px">' + ic('search') + '<span class="sr">Search products</span><input id="aq" placeholder="Search name, code or range" value="' + esc(q) + '"></label>' +
      '<select id="acat" class="inp" style="width:auto;flex:0 1 240px" aria-label="Category"><option value="">All categories</option>' + s.cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (fc === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="alist" id="plist">' + (list.length ? list.map(function (x) { return prow(x[0], x[1]); }).join('') : '<p class="muted">No products match.</p>') + '</div></div>';
  }
  if (t === 'cats') {
    return '<div class="card"><div class="card-h"><h2>Categories</h2><button class="btn btn-sm btn-primary" data-act="catadd">' + ic('plus', 16) + 'Add category</button></div><p class="sub">Shown in the menu, on the home page and as filters. The web address of a category can’t change once it has products.</p>' +
      '<div class="list-ed">' + s.cats.map(function (c, i) {
        var n = s.products.filter(function (p) { return p.cat === c.id; }).length;
        return '<div class="row"><div class="form">' + fld('Name', 'cats.' + i + '.name') + fld('Illustration', 'cats.' + i + '.art', { opts: ARTS.map(function (a) { return [a, a]; }) }) +
          fld('Short description', 'cats.' + i + '.blurb', { full: true }) + fld('Image link (optional)', 'cats.' + i + '.img', { full: true, hint: 'Leave empty to use the first product photo. Address: /category/' + esc(c.id) + ' · ' + plural(n, 'product') }) + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:2px"><button class="icon-btn" data-act="catmove" data-i="' + i + '" data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ic('up') + '</button><button class="icon-btn" data-act="catmove" data-i="' + i + '" data-d="1" aria-label="Move down"' + (i < s.cats.length - 1 ? '' : ' disabled') + '>' + ic('down') + '</button><button class="icon-btn danger" data-act="catdel" data-i="' + i + '" aria-label="Delete category">' + ic('trash') + '</button></div></div>';
      }).join('') + '</div></div>';
  }
  if (t === 'depts') {
    var popts = s.products.map(function (p) { return [p.id, p.name]; });
    return '<div class="card"><div class="card-h"><h2>Departments</h2><button class="btn btn-sm" data-act="ladd" data-l="depts">' + ic('plus', 16) + 'Add department</button></div><p class="sub">Shown in the Departments menu and on the home page. Products are picked automatically by the keywords: any product whose name, range or category contains one of them.</p>' +
        '<div class="list-ed">' + s.depts.map(function (d, i) {
          return '<div class="row"><div class="form">' + fld('Name', 'depts.' + i + '.name') + fld('Icon', 'depts.' + i + '.icon', { opts: ['scalpel', 'bed', 'baby', 'bone', 'heart', 'brain', 'flask', 'broom', 'shield', 'users', 'box', 'layers'].map(function (x) { return [x, x]; }) }) +
            fld('Short description', 'depts.' + i + '.blurb', { full: true }) + fld('Keywords (comma separated)', 'depts.' + i + '.keys', { rows: 2, full: true, hint: plural(deptMatches(d).length, 'product') + ' match · /department/' + esc(d.id) }) + '</div>' +
            '<div style="display:flex;flex-direction:column;gap:2px"><button class="icon-btn" data-act="lmove" data-l="depts" data-i="' + i + '" data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ic('up') + '</button><button class="icon-btn" data-act="lmove" data-l="depts" data-i="' + i + '" data-d="1" aria-label="Move down"' + (i < s.depts.length - 1 ? '' : ' disabled') + '>' + ic('down') + '</button><button class="icon-btn danger" data-act="ldel" data-l="depts" data-i="' + i + '" aria-label="Remove department">' + ic('trash') + '</button></div></div>';
        }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>Starter kits</h2><button class="btn btn-sm" data-act="ladd" data-l="kits">' + ic('plus', 16) + 'Add kit</button></div><p class="sub">Ready-made product lists customers can add to the basket in one tap. Quantities are suggestions; customers can change them.</p>' +
        '<div class="list-ed">' + s.kits.map(function (k, i) {
          return '<div class="row"><div class="form">' + fld('Kit name', 'kits.' + i + '.name') + fld('For', 'kits.' + i + '.for', { ph: 'Per ICU bed' }) + fld('Description', 'kits.' + i + '.blurb', { full: true }) +
            '<div class="full" style="display:grid;gap:8px"><span class="fld-l">Products</span>' + k.items.map(function (it, j) {
              return '<div class="kv"><select class="inp" data-bind="kits.' + i + '.items.' + j + '.id" aria-label="Product">' + popts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (o[0] === it.id ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + (find(it.id) ? '' : '<option selected value="' + esc(it.id) + '">(missing) ' + esc(it.id) + '</option>') + '</select>' +
                '<input class="inp" data-bind="kits.' + i + '.items.' + j + '.qty" data-num="1" inputmode="numeric" value="' + it.qty + '" aria-label="Quantity"><button class="icon-btn danger" data-act="kitemdel" data-k="' + i + '" data-j="' + j + '" aria-label="Remove product">' + ic('trash') + '</button></div>';
            }).join('') + '<div><button class="btn btn-sm" data-act="kitemadd" data-k="' + i + '">' + ic('plus', 14) + 'Add product</button></div></div></div>' +
            '<div style="display:flex;flex-direction:column;gap:2px"><button class="icon-btn" data-act="lmove" data-l="kits" data-i="' + i + '" data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ic('up') + '</button><button class="icon-btn" data-act="lmove" data-l="kits" data-i="' + i + '" data-d="1" aria-label="Move down"' + (i < s.kits.length - 1 ? '' : ' disabled') + '>' + ic('down') + '</button><button class="icon-btn danger" data-act="ldel" data-l="kits" data-i="' + i + '" aria-label="Remove kit">' + ic('trash') + '</button></div></div>';
        }).join('') + '</div></div>';
  }
  if (t === 'home') {
    return '<div class="card"><div class="card-h"><h2>Banner slides</h2><button class="btn btn-sm" data-act="ladd" data-l="home.slides">' + ic('plus', 16) + 'Add slide</button></div><p class="sub">The rotating banners at the top of the home page. Use wide photos (about 1200 × 900) for the best result.</p>' +
        '<div class="list-ed">' + s.home.slides.map(function (x, i) {
          return '<div class="row"><div class="form">' + fld('Title', 'home.slides.' + i + '.title', { full: true }) + fld('Text', 'home.slides.' + i + '.sub', { rows: 2, full: true }) + fld('Button text', 'home.slides.' + i + '.cta') + fld('Button link', 'home.slides.' + i + '.link', { ph: '/category/procedure-packs' }) +
            fld('Photo link', 'home.slides.' + i + '.img', { full: true }) +
            '<div class="full" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' + (x.img ? '<img src="' + esc(absUrl(x.img) || x.img) + '" alt="" style="height:56px;width:auto;border-radius:6px;border:1px solid var(--line)">' : '') +
            '<label class="btn btn-sm">' + ic('upload', 16) + 'Upload photo<input type="file" accept="image/*" data-slide-up="' + i + '" hidden></label><label class="check">Background <input type="color" data-bind="home.slides.' + i + '.bg" value="' + esc(x.bg || '#DCE8F0') + '" style="width:44px;height:34px;padding:2px;border:1px solid var(--line-2);border-radius:6px"></label></div></div>' +
            '<div style="display:flex;flex-direction:column;gap:2px"><button class="icon-btn" data-act="lmove" data-l="home.slides" data-i="' + i + '" data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ic('up') + '</button><button class="icon-btn" data-act="lmove" data-l="home.slides" data-i="' + i + '" data-d="1" aria-label="Move down"' + (i < s.home.slides.length - 1 ? '' : ' disabled') + '>' + ic('down') + '</button><button class="icon-btn danger" data-act="ldel" data-l="home.slides" data-i="' + i + '" aria-label="Remove slide">' + ic('trash') + '</button></div></div>';
        }).join('') + '</div></div>' +
      '<div class="card"><h2>Fallback hero text</h2><p class="sub">Used for search results and when there are no slides.</p><div class="form">' + fld('Headline', 'home.headline', { full: true }) + fld('Intro text', 'home.sub', { rows: 3, full: true }) + '</div></div>' +
      '<div class="card"><h2>Top bar message</h2>' + fld('Message', 'home.announce', { full: true, hint: 'Shown above the header on large screens. Leave empty to hide.' }) + '</div>' +
      '<div class="card"><div class="card-h"><h2>Institutions we supply</h2><button class="btn btn-sm" data-act="ladd" data-l="home.clients">' + ic('plus', 16) + 'Add client</button></div><p class="sub">Hospitals or distributors you supply, shown as a scrolling strip. Only list clients who have agreed to be named. Hidden while empty.</p>' +
        '<div class="list-ed">' + s.home.clients.map(function (x, i) { return '<div class="row"><div class="form">' + fld('Name', 'home.clients.' + i + '.name') + fld('Logo link (optional)', 'home.clients.' + i + '.logo') + '</div><button class="icon-btn danger" data-act="ldel" data-l="home.clients" data-i="' + i + '" aria-label="Remove">' + ic('trash') + '</button></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>About text on the home page</h2><p class="sub">Helps search engines understand the business. Start a line with ## for a sub-heading.</p><div class="form">' + fld('Heading', 'home.seoTitle', { full: true }) + fld('Text', 'home.seoBody', { rows: 10, full: true }) + '</div></div>' +
      '<div class="card"><h2>Bulk order banner</h2><div class="form">' + fld('Title', 'home.customTitle', { full: true }) + fld('Text', 'home.customSub', { rows: 3, full: true }) + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>Numbers</h2><button class="btn btn-sm" data-act="ladd" data-l="home.stats">' + ic('plus', 16) + 'Add number</button></div><p class="sub">Optional figures like years in business or hospitals served. Only add numbers you can stand behind.</p>' +
        '<div class="list-ed">' + s.home.stats.map(function (x, i) { return '<div class="row"><div class="form">' + fld('Number', 'home.stats.' + i + '.n', { ph: '25+' }) + fld('Label', 'home.stats.' + i + '.label', { ph: 'Years of experience' }) + '</div><button class="icon-btn danger" data-act="ldel" data-l="home.stats" data-i="' + i + '" aria-label="Remove">' + ic('trash') + '</button></div>'; }).join('') + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>Testimonials</h2><button class="btn btn-sm" data-act="ladd" data-l="home.testimonials">' + ic('plus', 16) + 'Add testimonial</button></div>' +
        '<div class="list-ed">' + s.home.testimonials.map(function (x, i) { return '<div class="row"><div class="form">' + fld('Name', 'home.testimonials.' + i + '.name') + fld('Role / organisation', 'home.testimonials.' + i + '.role') + fld('Quote', 'home.testimonials.' + i + '.text', { rows: 3, full: true }) + '</div><button class="icon-btn danger" data-act="ldel" data-l="home.testimonials" data-i="' + i + '" aria-label="Remove">' + ic('trash') + '</button></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>Sections</h2><div style="display:grid;gap:12px">' + tog('Banner slides', 'home.show.slides') + tog('Shop by category', 'home.show.categories') + tog('Shop scrubs by colour', 'home.show.colours') + tog('Featured products (tagged “featured”)', 'home.show.featured') + tog('Product rows by category', 'home.show.rows') + tog('Bulk order banner', 'home.show.custom') + tog('Institutions we supply', 'home.show.clients') + tog('How ordering works', 'home.show.process') + tog('Testimonials', 'home.show.testimonials') + tog('About text', 'home.show.seo') + tog('FAQ', 'home.show.faq') + '</div></div>';
  }
  if (t === 'company') {
    var pre = [['Theatre green', '#1F5C52', '#8FB3CC'], ['Navy & ceil', '#1F2F55', '#8FB3CC'], ['Hunter green', '#2F5E44', '#A9C9B5'], ['Teal', '#0F6C74', '#9CCFD3'], ['Clinical blue', '#1D4E89', '#A8C6E8'], ['Plum', '#5B2A55', '#D7A8C9']];
    return '<div class="card"><h2>Name &amp; logo</h2><div class="form">' + fld('Company name', 'brand.name') + fld('Tagline', 'brand.tagline') + fld('Logo link', 'brand.logo', { full: true, hint: 'Upload your logo below (PNG with a transparent background works best, about 400 × 120). Leave empty to use the built-in logo.' }) + '</div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' + (s.brand.logo ? '<img src="' + esc(absUrl(s.brand.logo) || s.brand.logo) + '" alt="Current logo" style="height:48px;width:auto;border:1px solid var(--line);border-radius:6px;padding:4px;background:#fff">' : '') + '<label class="btn btn-sm">' + ic('upload', 16) + 'Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" data-logo-up hidden></label>' +
        (s.brand.logo ? '<button class="btn btn-sm" data-act="logoreset">Use built-in logo</button>' : '<span class="small muted">Using the built-in logo:</span><span style="display:inline-flex;padding:6px 10px;border:1px solid var(--line);border-radius:8px">' + wordmark() + '</span>') + '</div></div>' +
      '<div class="card"><h2>Colours</h2><div class="presets">' + pre.map(function (x) { return '<button class="preset" data-act="preset" data-v="' + x[1] + ',' + x[2] + '"><span><i style="background:' + x[1] + '"></i><i style="background:' + x[2] + '"></i></span>' + x[0] + '</button>'; }).join('') + '</div>' +
      '<div class="colorset"><label>' + '<input type="color" data-bind="brand.primary" value="' + esc(s.brand.primary) + '">Main colour</label><label><input type="color" data-bind="brand.accent" value="' + esc(s.brand.accent) + '">Accent</label></div></div>' +
      '<div class="card"><h2>Contact details</h2><div class="form">' + fld('WhatsApp number (orders go here)', 'store.whatsapp', { ph: '919811641315', hint: 'Country code + number, no spaces.' }) + fld('Phone (shown on site)', 'store.phone') + fld('Second phone', 'store.phone2') + fld('Email', 'store.email', { type: 'email' }) +
        fld('Address', 'store.address', { full: true }) + fld('Working hours', 'store.hours', { ph: 'Mon–Sat, 9:30 am – 6:30 pm' }) + fld('Google Maps link', 'store.mapUrl') + fld('GSTIN', 'store.gstin') + '</div></div>' +
      '<div class="card"><h2>Social links</h2><div class="form">' + ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube'].map(function (k) { return fld(k.charAt(0).toUpperCase() + k.slice(1), 'store.social.' + k, { ph: 'https://…' }); }).join('') + '</div></div>';
  }
  if (t === 'ordering') {
    return '<div class="card"><h2>Taxes, freight &amp; coupons</h2><div class="form">' + fld('GST % added to prices', 'store.gstPct', { num: true, hint: '0 shows “GST as applicable”.' }) + fld('Usual dispatch time', 'store.dispatch', { ph: '7–10 working days' }) +
      fld('Freight charge (₹)', 'store.shipFee', { num: true, hint: '0 means freight is confirmed with the quote.' }) + fld('Free freight above (₹)', 'store.freeShipAbove', { num: true, hint: '0 turns this off.' }) +
      fld('Freight note', 'store.freightNote', { ph: 'Confirmed with your quote' }) + fld('Coupon code', 'store.coupon', { hint: 'Leave empty to hide the coupon box.' }) + fld('Coupon discount %', 'store.couponPct', { num: true }) + '</div></div>' +
      '<div class="card"><h2>Payment options at checkout</h2><div style="display:grid;gap:12px">' + Object.keys(PAYMENTS).map(function (k) { return '<label class="check"><input type="checkbox" data-act="paytog" data-v="' + k + '"' + (s.store.payments.indexOf(k) > -1 ? ' checked' : '') + '> ' + PAYMENTS[k][0] + ' <span class="muted small">— ' + PAYMENTS[k][1] + '</span></label>'; }).join('') + '</div></div>';
  }
  if (t === 'pages') {
    return '<div class="card"><h2>About page</h2><div class="form">' + fld('Title', 'about.title', { full: true }) + fld('Story', 'about.body', { rows: 10, full: true, hint: 'Leave an empty line between paragraphs.' }) + fld('Mission', 'about.mission', { rows: 2, full: true }) + fld('Vision', 'about.vision', { rows: 2, full: true }) + '</div></div>' +
      '<div class="card"><h2>Privacy policy &amp; terms of sale</h2><p class="sub">Shown at /privacy and /terms. Start a paragraph with a short heading followed by a full stop to make it a sub-heading. Have these checked before relying on them.</p><div class="form">' + fld('Privacy policy', 'legal.privacy', { rows: 10, full: true }) + fld('Terms of sale', 'legal.terms', { rows: 10, full: true }) + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>FAQ</h2><button class="btn btn-sm" data-act="ladd" data-l="faq">' + ic('plus', 16) + 'Add question</button></div><div class="list-ed">' + s.faq.map(function (f, i) {
        return '<div class="row"><div class="form">' + fld('Question', 'faq.' + i + '.q', { full: true }) + fld('Answer', 'faq.' + i + '.a', { rows: 3, full: true }) + '</div><button class="icon-btn danger" data-act="ldel" data-l="faq" data-i="' + i + '" aria-label="Remove question">' + ic('trash') + '</button></div>';
      }).join('') + '</div></div>';
  }
  if (t === 'settings') {
    return '<div class="card"><h2>Copy photos to this server</h2><p class="sub">Products imported from the old website still load their photos from rankinc.in. Copy them here so the store keeps working if the old site is switched off. This publishes any unpublished edits first.</p><div><button class="btn btn-sm btn-primary" data-act="importimg">' + ic('download', 16) + 'Copy photos now</button></div><p class="small muted" id="impmsg"></p></div>' +
      '<div class="card"><h2>Reset to the Rank INC catalogue</h2><p class="sub">Replaces all products, categories, departments, kits and website text with the original Rank INC catalogue. Orders, enquiries, uploaded photos and the admin password are kept, and the current version is saved as a server backup first.</p><div><button class="btn btn-sm" data-act="resetcat">' + ic('refresh', 16) + 'Reset catalogue</button></div></div>' +
      '<div class="card"><div class="card-h"><h2>Server backups</h2><button class="btn btn-sm" data-act="bklist">' + ic('refresh', 16) + 'Show backups</button></div><p class="sub">Saved automatically before a reset or an upgrade.</p><div id="bkout"></div></div>' +
      '<div class="card"><h2>Backup</h2><p class="sub">Download everything (products, categories, text, settings) as a file. Orders and enquiries stay in the database.</p><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-sm" data-act="bdown">' + ic('download', 16) + 'Download backup</button><label class="btn btn-sm">' + ic('upload', 16) + 'Restore from file<input type="file" accept="application/json,.json" data-restore hidden></label></div><p class="small muted">Restoring replaces the current draft. Publish to make it live.</p></div>' +
      '<div class="card"><h2>Admin password</h2><p class="sub">Changing it logs out every other admin session.</p><div class="form"><div class="fld"><label class="fld-l" for="pwcur">Current password</label><input id="pwcur" type="password" autocomplete="current-password"></div><div class="fld"><label class="fld-l" for="pwnew">New password</label><input id="pwnew" type="password" autocomplete="new-password"><span class="fld-h">At least 8 characters.</span></div></div><p class="err-msg" id="pwmsg" role="alert"></p><div><button class="btn btn-sm" data-act="pwchange">Change password</button></div></div>' +
      '<div class="card"><h2>Session</h2><div><button class="btn btn-sm" data-act="logout">' + ic('out', 16) + 'Log out</button></div></div>';
  }
  return '';
}
function prow(p, i) {
  var st = stockOf(p), n = state.products.length;
  return '<div class="arow' + (p.hidden ? ' off' : '') + '"><div class="th" style="--c:' + p.colors[0].hex + '">' + media(p, 0, 0, { w: 112, h: 112 }) + '</div><div style="min-width:0"><b>' + esc(p.name) + '</b><div class="meta"><span>' + esc(catName(p.cat)) + (p.sub ? ' · ' + esc(p.sub) : '') + '</span><span>' + (p.price ? money(p.price) + ' / ' + esc(p.unit) : 'On request') + '</span>' +
    (p.track ? '<span style="color:' + (st ? 'var(--ok)' : 'var(--bad)') + ';font-weight:650">' + (st ? st + ' in stock' : 'Out of stock') + '</span>' : '<span>Made to order</span>') + (p.hidden ? '<span class="pill">Hidden</span>' : '') + p.tags.map(function (t) { return '<span class="pill pr">' + t + '</span>'; }).join('') + '</div></div>' +
    '<div class="acts"><button class="icon-btn" data-act="pmove" data-i="' + i + '" data-d="-1" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ic('up') + '</button><button class="icon-btn" data-act="pmove" data-i="' + i + '" data-d="1" aria-label="Move down"' + (i < n - 1 ? '' : ' disabled') + '>' + ic('down') + '</button>' +
    '<button class="icon-btn" data-act="phide" data-id="' + esc(p.id) + '" title="' + (p.hidden ? 'Show on website' : 'Hide from website') + '" aria-label="' + (p.hidden ? 'Show on website' : 'Hide from website') + '">' + ic(p.hidden ? 'eyeoff' : 'eye') + '</button><button class="icon-btn" data-act="pdup" data-id="' + esc(p.id) + '" title="Duplicate" aria-label="Duplicate">' + ic('dup') + '</button>' +
    '<button class="icon-btn" data-act="pedit" data-id="' + esc(p.id) + '" title="Edit" aria-label="Edit">' + ic('edit') + '</button><button class="icon-btn danger" data-act="pdel" data-id="' + esc(p.id) + '" title="Delete" aria-label="Delete">' + ic('trash') + '</button></div></div>';
}
document.addEventListener('input', function (e) {
  if (e.target.id === 'aq') { SS.set('rk:aq', e.target.value); refreshPlist(); }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.id === 'acat') { SS.set('rk:acat', t.value); refreshPlist(); }
  if (t.dataset && t.dataset.restore != null && t.files && t.files[0]) restoreFile(t.files[0]);
  if (t.dataset && t.dataset.slideUp != null && t.files && t.files[0]) { var si = +t.dataset.slideUp; uploadOne(t.files[0], 1800).then(function (url) { if (url && state.home.slides[si]) { state.home.slides[si].img = url; changed(); rerenderPanel(); } }); }
  if (t.dataset && t.dataset.logoUp != null && t.files && t.files[0]) uploadOne(t.files[0], 600).then(function (url) { if (url) { state.brand.logo = url; changed({ shell: true }); } });
});
function refreshPlist() {
  var y = scrollY, a = $('#aq'), focus = a && document.activeElement === a, pos = focus ? a.selectionStart : 0;
  rerenderPanel(); scrollTo(0, y);
  if (focus) { var n = $('#aq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
}
A.pmove = function (el) { var i = +el.dataset.i, j = i + (+el.dataset.d), P = state.products; if (j < 0 || j >= P.length) return; var tmp = P[i]; P[i] = P[j]; P[j] = tmp; changed(); refreshPlist(); };
A.phide = function (el) { var p = find(el.dataset.id); p.hidden = !p.hidden; changed(); refreshPlist(); toast(p.hidden ? 'Hidden from the website (after you publish).' : 'Shown on the website (after you publish).'); };
A.pdup = function (el) { var p = clone(find(el.dataset.id)); p.id = uniqueId(p.id); p.name += ' (copy)'; p.hidden = true; state.products.splice(state.products.indexOf(find(el.dataset.id)) + 1, 0, p); changed(); refreshPlist(); toast('Duplicated as a hidden copy.'); };
A.pdel = function (el) {
  if (!el.classList.contains('confirming')) { el.classList.add('confirming'); el.textContent = 'Delete?'; setTimeout(function () { if (el.isConnected) { el.classList.remove('confirming'); el.innerHTML = ic('trash'); } }, 3000); return; }
  var p = find(el.dataset.id); state.products.splice(state.products.indexOf(p), 1); changed(); refreshPlist(); toast('Deleted ' + p.name + '. Publish to remove it from the website.');
};
function uniqueId(base) { base = slugify(base) || 'product'; var id = base, n = 2; while (find(id)) id = base.slice(0, 54) + '-' + n++; return id; }
A.catadd = function () { var name = 'New category', id = 'new-category', n = 2; while (catOf(id)) id = 'new-category-' + n++; state.cats.push({ id: id, name: name, blurb: '', art: 'sheet', img: '' }); changed({ shell: true }); };
A.catmove = function (el) { var i = +el.dataset.i, j = i + (+el.dataset.d), C = state.cats; if (j < 0 || j >= C.length) return; var t = C[i]; C[i] = C[j]; C[j] = t; changed({ shell: true }); };
A.catdel = function (el) {
  var c = state.cats[+el.dataset.i], n = state.products.filter(function (p) { return p.cat === c.id; }).length;
  if (n) { toast('Move or delete the ' + plural(n, 'product') + ' in ' + c.name + ' first.'); return; }
  state.cats.splice(+el.dataset.i, 1); changed({ shell: true });
};
A.ladd = function (el) {
  var path = el.dataset.l, list = getPath(state, path);
  list.push(path === 'faq' ? { q: '', a: '' } : path === 'home.stats' ? { n: '', label: '' } : path === 'home.slides' ? { title: 'New slide', sub: '', cta: 'Shop now', link: '/products', img: '', bg: '#DCE8F0' } : path === 'home.clients' ? { name: '', logo: '' } : path === 'depts' ? { id: 'department-' + (list.length + 1), name: 'New department', blurb: '', icon: 'layers', keys: '' } : path === 'kits' ? { id: 'kit-' + Date.now().toString(36), name: 'New kit', for: '', blurb: '', items: [] } : { name: '', role: '', text: '' });
  changed(); rerenderPanel();
};
A.kitemadd = function (el) { var k = state.kits[+el.dataset.k]; if (!k || !state.products.length) return; k.items.push({ id: state.products[0].id, qty: 1 }); changed(); rerenderPanel(); };
A.kitemdel = function (el) { var k = state.kits[+el.dataset.k]; if (!k) return; k.items.splice(+el.dataset.j, 1); changed(); rerenderPanel(); };
A.lmove = function (el) { var L = getPath(state, el.dataset.l), i = +el.dataset.i, j = i + (+el.dataset.d); if (j < 0 || j >= L.length) return; var t = L[i]; L[i] = L[j]; L[j] = t; changed(); rerenderPanel(); };
A.ldel = function (el) { getPath(state, el.dataset.l).splice(+el.dataset.i, 1); changed(); rerenderPanel(); };
A.logoreset = function () { state.brand.logo = ''; changed({ shell: true }); };
A.preset = function (el) { var v = el.dataset.v.split(','); state.brand.primary = v[0]; state.brand.accent = v[1]; changed({ brand: true }); rerenderPanel(); };
A.paytog = function (el) {
  var k = el.dataset.v, list = state.store.payments, i = list.indexOf(k);
  setTimeout(function () {
    if (el.checked && i < 0) list.push(k); if (!el.checked && i > -1) { if (list.length === 1) { el.checked = true; toast('Keep at least one payment option.'); return; } list.splice(i, 1); }
    changed();
  });
};
A.logout = function () { apiToken = null; SS.del('rk:token'); isAdmin = false; state = clone(published); applyBrand(); shell(); go('/'); toast('Logged out.'); };
A.pwchange = function () {
  var cur = $('#pwcur').value, nx = $('#pwnew').value, m = $('#pwmsg'); m.textContent = '';
  if (nx.length < 8) { m.textContent = 'Use at least 8 characters for the new password.'; return; }
  apiFetch('/auth/password', { method: 'POST', body: { current: cur, next: nx } }).then(function (r) { apiToken = r.token; SS.set('rk:token', r.token); $('#pwcur').value = ''; $('#pwnew').value = ''; toast('Password changed. Other sessions are logged out.'); }).catch(function (e) { m.textContent = e.message; });
};
A.bdown = function () {
  var data = clone(state); delete data.rev; delete data.updated;
  var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = slugify(state.brand.name) + '-backup-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
};
function restoreFile(file) {
  var fr = new FileReader();
  fr.onload = function () {
    try { var d = JSON.parse(fr.result); if (!d || !Array.isArray(d.products)) throw new Error('x'); var keep = state.rev; state = normalize(d); state.rev = keep; changed({ shell: true }); toast('Backup loaded into the draft. Publish to make it live.'); }
    catch (e) { toast('That file isn’t a backup from this store.'); }
  };
  fr.readAsText(file);
}
A.resetcat = function (el) {
  if (!el.classList.contains('confirming')) { el.classList.add('confirming'); el.textContent = 'Yes, replace everything'; setTimeout(function () { if (el.isConnected) { el.classList.remove('confirming'); el.innerHTML = ic('refresh', 16) + 'Reset catalogue'; } }, 4000); return; }
  el.classList.add('busy');
  apiFetch('/admin/reset-catalogue', { method: 'POST' }).then(function (d) {
    LS.del('rk:draft'); staleDraft = null; applyRemote(d); toast('Catalogue reset. A backup of the previous version was saved on the server.');
  }).catch(function (e) { el.classList.remove('busy'); toast(e.message); });
};
A.bklist = function () {
  var out = $('#bkout'); out.innerHTML = '<p class="muted small">Loading…</p>';
  apiFetch('/admin/backups').then(function (list) {
    out.innerHTML = list.length ? '<div class="alist">' + list.map(function (b) { var d = new Date(b.date); return '<div class="arow" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><b>' + esc(b.name) + '</b><div class="meta"><span>' + (isNaN(d) ? '' : d.toLocaleString('en-IN')) + '</span><span>' + Math.max(1, Math.round(b.size / 1024)) + ' KB</span></div></div><div class="acts"><button class="btn btn-sm" data-act="bkget" data-id="' + esc(b.id) + '" data-name="' + esc(b.name) + '">' + ic('download', 16) + 'Download</button></div></div>'; }).join('') + '</div>' : '<p class="muted small">No server backups yet.</p>';
  }).catch(function (e) { out.innerHTML = '<p class="err-msg">' + esc(e.message) + '</p>'; });
};
A.bkget = function (el) {
  fetch(API + '/admin/backups/' + encodeURIComponent(el.dataset.id), { headers: { Authorization: 'Bearer ' + apiToken } }).then(function (r) { if (!r.ok) throw new Error('Download failed.'); return r.blob(); }).then(function (blob) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = el.dataset.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }).catch(function (e) { toast(e.message); });
};
A.importimg = function (el) {
  var msg = $('#impmsg'); el.classList.add('busy'); msg.textContent = 'Copying photos… this can take a minute.';
  var pre = dirty() ? new Promise(function (res, rej) {
    var data = clone(state); delete data.rev; delete data.updated;
    apiFetch('/admin/store', { method: 'PUT', body: { rev: published.rev, data: data } }).then(res, rej);
  }) : Promise.resolve(null);
  pre.then(function () { return apiFetch('/admin/import-images', { method: 'POST' }); }).then(function (r) {
    return apiFetch('/admin/store').then(function (d) {
      published = normalize(d); state = clone(published); LS.del('rk:draft'); rerenderPanel(); refreshActions();
      var m = $('#impmsg'); if (m) m.textContent = 'Copied ' + plural(r.copied, 'photo') + '.' + (r.failed.length ? ' ' + plural(r.failed.length, 'link') + ' couldn’t be copied (the file is missing or not a photo); those products keep their current link.' : '') + (r.remaining ? ' Run it again for the remaining ' + r.remaining + '.' : '');
    });
  }).catch(function (e) { el.classList.remove('busy'); msg.textContent = e.message; });
};

/* ---------- product editor ---------- */
A.pnew = function () { openEditor(normP({ id: uniqueId('new-product'), cat: SS.get('rk:acat', '') || (state.cats[0] && state.cats[0].id) || 'other', name: '', sizes: { Standard: 0 }, colors: [{ name: 'Standard', hex: '#E8EEF0' }], art: 'sheet' }), true); };
A.pedit = function (el) { var p = find(el.dataset.id); if (p) openEditor(p, false); };
function openEditor(p, isNew) {
  ed = clone(p); ed._new = !!isNew; edIndex = isNew ? -1 : state.products.indexOf(p);
  modal('<div class="mbox wide" role="dialog" aria-modal="true" aria-labelledby="edT"><div class="mhead"><h3 id="edT">' + (isNew ? 'New product' : 'Edit product') + '</h3><button class="icon-btn" data-act="mclose" aria-label="Close">' + ic('x') + '</button></div><div id="edbody">' + editorBody() + '</div></div>');
}
function efld(label, path, o) {
  o = o || {}; var v = getPath(ed, path), id = 'e-' + path.replace(/\W/g, '-');
  var at = ' id="' + id + '" data-ed="' + path + '"' + (o.num ? ' data-num="1" inputmode="numeric"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + (o.dl ? ' list="' + o.dl + '"' : '');
  var inp = o.rows ? '<textarea' + at + ' rows="' + o.rows + '">' + esc(v) + '</textarea>'
    : o.opts ? '<select' + at + '>' + o.opts.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(v) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>'
    : '<input' + at + ' value="' + esc(v == null ? '' : v) + '">';
  return '<div class="fld' + (o.full ? ' full' : '') + '"><label class="fld-l" for="' + id + '">' + label + '</label>' + inp + (o.hint ? '<span class="fld-h">' + o.hint + '</span>' : '') + '</div>';
}
function editorBody() {
  var e = ed, subs = []; state.products.forEach(function (p) { if (p.sub && subs.indexOf(p.sub) < 0) subs.push(p.sub); });
  return '<div class="ed"><div style="display:flex;flex-direction:column;gap:20px;min-width:0">' +
    '<div class="ed-sec"><h4>Basics</h4><div class="form">' + efld('Product name', 'name', { full: true }) +
      efld('Category', 'cat', { opts: state.cats.map(function (c) { return [c.id, c.name]; }).concat(catOf(e.cat) ? [] : [[e.cat, 'Other']]) }) +
      efld('Range (sub-group)', 'sub', { dl: 'dlsub', ph: 'e.g. Orthopaedic drapes' }) + '<datalist id="dlsub">' + subs.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>' +
      efld('Product code / SKU', 'code') + (e._new ? efld('Web address', 'id', { hint: 'Becomes /product/' + esc(e.id) + ' — fixed once published.' }) : '<div class="fld"><span class="fld-l">Web address</span><span style="padding:12px 0;word-break:break-all">/product/' + esc(e.id) + '</span></div>') +
      efld('Short description', 'desc', { full: true, hint: 'One sentence. Shown in search results and link previews.' }) + efld('Full description', 'long', { rows: 5, full: true }) + '</div></div>' +
    '<div class="ed-sec"><h4>Price &amp; ordering</h4><div class="form">' + efld('Price (₹, before GST)', 'price', { num: true, hint: '0 shows “Price on request”.' }) + efld('MRP (₹)', 'mrp', { num: true, hint: 'Optional. Shown struck through if higher.' }) +
      efld('Sold per (unit)', 'unit', { dl: 'dlunit', ph: 'pc, set, pack, box of 50' }) + '<datalist id="dlunit"><option value="pc"><option value="set"><option value="pack"><option value="pair"><option value="box"><option value="roll"></datalist>' + efld('Minimum order quantity', 'moq', { num: true }) + '</div>' +
      '<div style="display:flex;gap:18px;flex-wrap:wrap">' + [['new', 'New'], ['featured', 'Featured on home page'], ['bestseller', 'Bestseller']].map(function (t) { return '<label class="check"><input type="checkbox" data-etag="' + t[0] + '"' + (e.tags.indexOf(t[0]) > -1 ? ' checked' : '') + '> ' + t[1] + '</label>'; }).join('') +
      '<label class="check"><input type="checkbox" data-eflag="emb"' + (e.emb ? ' checked' : '') + '> Offer embroidery</label>' +
      '<label class="check"><input type="checkbox" data-eflag="hidden"' + (e.hidden ? ' checked' : '') + '> Hidden from website</label></div></div>' +
    '<div class="ed-sec"><div class="card-h"><h4>Colours &amp; photos</h4><button class="btn btn-sm" data-act="ecadd">' + ic('plus', 14) + 'Add colour</button></div>' + e.colors.map(function (c, ci) {
      return '<div class="colrow"><div class="colrow-h"><input type="color" data-ed="colors.' + ci + '.hex" value="' + esc(c.hex) + '" aria-label="Colour swatch">' + efld('Colour name', 'colors.' + ci + '.name') + (e.colors.length > 1 ? '<button class="icon-btn danger" data-act="ecdel" data-i="' + ci + '" aria-label="Remove colour">' + ic('trash') + '</button>' : '<span></span>') + '</div>' +
        '<div class="photos">' + c.imgs.map(function (r, ii) { return '<div class="photo"><img src="' + esc(absUrl(r) || r) + '" alt="Photo ' + (ii + 1) + '" data-art="' + e.art + '" data-hex="' + c.hex + '"><div class="pa"><button data-act="eimgl" data-c="' + ci + '" data-i="' + ii + '" aria-label="Move photo left">' + ic('left') + '</button><button data-act="eimgdel" data-c="' + ci + '" data-i="' + ii + '" aria-label="Remove photo">' + ic('x') + '</button></div></div>'; }).join('') +
        '<label class="upl">' + ic('upload') + 'Add photos<input type="file" accept="image/*" multiple data-upload="' + ci + '"></label></div>' +
        '<div class="sz-add"><input placeholder="…or paste a photo link" data-imgurl="' + ci + '" aria-label="Photo link"><button class="btn btn-sm" data-act="eimgurl" data-c="' + ci + '">Add link</button></div></div>';
    }).join('') + '</div>' +
    '<div class="ed-sec"><h4>Sizes &amp; stock</h4><label class="check"><input type="checkbox" data-eflag="track"' + (e.track ? ' checked' : '') + '> Track stock for this product <span class="muted small">(otherwise it’s made to order and always available)</span></label>' +
      '<div class="sizes-ed">' + Object.keys(e.sizes).map(function (z) { return '<span class="sz"><b>' + esc(z) + '</b>' + (e.track ? '<input data-esize="' + esc(z) + '" inputmode="numeric" value="' + e.sizes[z] + '" aria-label="Stock for ' + esc(z) + '">' : '') + '<button data-act="eszdel" data-v="' + esc(z) + '" aria-label="Remove size ' + esc(z) + '">' + ic('x', 14) + '</button></span>'; }).join('') + '</div>' +
      '<div class="sz-add"><input id="newsz" list="dlsz" placeholder="Add a size" maxlength="24"><datalist id="dlsz">' + SIZE_PRESETS.map(function (s) { return '<option value="' + s + '">'; }).join('') + '</datalist><button class="btn btn-sm" data-act="eszadd">Add</button><button class="btn btn-sm btn-ghost" data-act="eszapp">Add XS–3XL</button></div>' +
      '<p class="fld-h">A product with only “Standard” shows no size choice on the website.</p></div>' +
    '<div class="ed-sec"><h4>Size chart</h4><p class="fld-h" style="margin-top:-6px">Photos of the size chart or measurements. Customers see them under “Size guide” on the product page.</p>' +
      '<div class="photos">' + e.sizeImgs.map(function (r, ii) { return '<div class="photo"><img src="' + esc(absUrl(r) || r) + '" alt="Size chart ' + (ii + 1) + '"><div class="pa"><button data-act="eszimgl" data-i="' + ii + '" aria-label="Move left">' + ic('left') + '</button><button data-act="eszimgdel" data-i="' + ii + '" aria-label="Remove size photo">' + ic('x') + '</button></div></div>'; }).join('') +
        (e.sizeImgs.length < 6 ? '<label class="upl">' + ic('upload') + 'Add size photos<input type="file" accept="image/*" multiple data-szupload="1"></label>' : '') + '</div>' +
      '<div class="sz-add"><input placeholder="…or paste a photo link" id="szimgurl" aria-label="Size photo link"><button class="btn btn-sm" data-act="eszimgurl">Add link</button></div>' +
      '<div class="form">' + efld('Size notes (optional)', 'sizeNote', { rows: 3, full: true, ph: 'e.g. Chest and length in inches. Scrubs run true to size; choose one size up for a relaxed fit.' }) + '</div></div>' +
    '<div class="ed-sec"><div class="card-h"><h4>Specifications</h4><button class="btn btn-sm" data-act="espadd">' + ic('plus', 14) + 'Add row</button></div>' +
      e.specs.map(function (s, i) { return '<div class="kv"><input class="inp" data-ed="specs.' + i + '.k" value="' + esc(s.k) + '" placeholder="Fabric" aria-label="Specification name"><input class="inp" data-ed="specs.' + i + '.v" value="' + esc(s.v) + '" placeholder="Polyester viscose blend" aria-label="Specification value"><button class="icon-btn danger" data-act="espdel" data-i="' + i + '" aria-label="Remove row">' + ic('trash') + '</button></div>'; }).join('') +
      '<div class="form">' + efld('Illustration when there’s no photo', 'art', { opts: ARTS.map(function (a) { return [a, a]; }) }) + '</div></div>' +
  '</div><div class="ed-side"><span class="fld-l">Preview</span><div id="edprev">' + editorPreview() + '</div><p class="err-msg" id="ederr" role="alert"></p><button class="btn btn-primary btn-block" data-act="esave">' + ic('check', 18) + 'Save to draft</button><button class="btn btn-block" data-act="mclose">Cancel</button></div></div>';
}
function editorPreview() { return '<div class="grid" style="grid-template-columns:1fr">' + tile(normP(ed)).replace(/<button class="save[^>]*>.*?<\/button>/, '') + '</div>'; }
function edRerender() { var b = $('#edbody'); if (!b) return; var box = b.closest('.mbox'), sc = box.scrollTop; b.innerHTML = editorBody(); box.scrollTop = sc; }
function edPrev() { var p = $('#edprev'); if (p) p.innerHTML = editorPreview(); }
document.addEventListener('input', function (e) {
  var t = e.target; if (!ed || !t.dataset) return;
  if (t.dataset.ed) { var v = t.dataset.num ? Math.max(0, parseInt(t.value, 10) || 0) : t.value; if (t.dataset.ed === 'id') v = slugify(v); setPath(ed, t.dataset.ed, v); edPrev(); }
  if (t.dataset.esize != null) { ed.sizes[t.dataset.esize] = Math.max(0, parseInt(t.value, 10) || 0); }
});
document.addEventListener('change', function (e) {
  var t = e.target; if (!ed || !t.dataset) return;
  if (t.dataset.etag) { var i = ed.tags.indexOf(t.dataset.etag); if (t.checked && i < 0) ed.tags.push(t.dataset.etag); if (!t.checked && i > -1) ed.tags.splice(i, 1); edPrev(); }
  if (t.dataset.eflag) { ed[t.dataset.eflag] = t.checked; if (t.dataset.eflag === 'track') edRerender(); else edPrev(); }
  if (t.dataset.ed === 'art' || t.dataset.ed === 'cat' || (t.dataset.ed && /hex$/.test(t.dataset.ed))) edRerender();
  if (t.dataset.upload != null && t.files) uploadImages(t.files, +t.dataset.upload);
  if (t.dataset.szupload != null && t.files) uploadSizeImgs(t.files);
});
A.ecadd = function () { ed.colors.push({ name: 'Colour ' + (ed.colors.length + 1), hex: '#8FB3CC', imgs: [] }); edRerender(); };
A.ecdel = function (el) { ed.colors.splice(+el.dataset.i, 1); edRerender(); };
A.eimgdel = function (el) { ed.colors[+el.dataset.c].imgs.splice(+el.dataset.i, 1); edRerender(); };
A.eimgl = function (el) { var a = ed.colors[+el.dataset.c].imgs, i = +el.dataset.i; if (i > 0) { var t = a[i - 1]; a[i - 1] = a[i]; a[i] = t; edRerender(); } };
A.eimgurl = function (el) { var inp = $('[data-imgurl="' + el.dataset.c + '"]'), v = (inp.value || '').trim(); if (!/^https?:\/\/\S+$/i.test(v)) { toast('Paste a full link starting with https://'); return; } ed.colors[+el.dataset.c].imgs.push(v); edRerender(); };
A.eszadd = function () { var v = ($('#newsz').value || '').trim().replace(/\s+/g, ' '); if (!/^[A-Za-z0-9][A-Za-z0-9 +\-/×()']{0,23}$/.test(v)) { toast('Use letters, numbers, spaces and - / + ( ) only.'); return; } if (ed.sizes.hasOwnProperty(v)) return; if (Object.keys(ed.sizes).length === 1 && ed.sizes.Standard != null) delete ed.sizes.Standard; ed.sizes[v] = 0; edRerender(); var n = $('#newsz'); if (n) n.focus(); };
A.eszapp = function () { if (ed.sizes.Standard != null && Object.keys(ed.sizes).length === 1) delete ed.sizes.Standard; ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].forEach(function (z) { if (!ed.sizes.hasOwnProperty(z)) ed.sizes[z] = 0; }); edRerender(); };
A.eszdel = function (el) { delete ed.sizes[el.dataset.v]; if (!Object.keys(ed.sizes).length) ed.sizes.Standard = 0; edRerender(); };
A.eszimgdel = function (el) { ed.sizeImgs.splice(+el.dataset.i, 1); edRerender(); };
A.eszimgl = function (el) { var a = ed.sizeImgs, i = +el.dataset.i; if (i > 0) { var t = a[i - 1]; a[i - 1] = a[i]; a[i] = t; edRerender(); } };
A.eszimgurl = function () { var inp = $('#szimgurl'), v = (inp.value || '').trim(); if (!/^https?:\/\/\S+$/i.test(v)) { toast('Paste a full link starting with https://'); return; } ed.sizeImgs.push(v); edRerender(); };
function uploadSizeImgs(files) {
  var arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); }).slice(0, 6 - ed.sizeImgs.length); if (!arr.length) return;
  toast('Uploading ' + plural(arr.length, 'size photo') + '…');
  var chain = Promise.resolve();
  arr.forEach(function (f) { chain = chain.then(function () { return uploadOne(f, 2000).then(function (u) { if (u && ed) ed.sizeImgs.push(u); }); }); });
  chain.then(function () { edRerender(); });
}
A.espadd = function () { ed.specs.push({ k: '', v: '' }); edRerender(); };
A.espdel = function (el) { ed.specs.splice(+el.dataset.i, 1); edRerender(); };
function downscale(file, maxW) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('bad image')); };
    im.onload = function () { URL.revokeObjectURL(url); var sc = Math.min(1, maxW / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc); var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height); res(cv); };
    im.src = url;
  });
}
function uploadOne(file, maxW) {
  return downscale(file, maxW || 1600).then(function (cv) { return new Promise(function (r) { cv.toBlob(r, file.type === 'image/png' && maxW <= 600 ? 'image/png' : 'image/jpeg', 0.86); }); })
    .then(function (blob) { var fd = new FormData(); fd.append('file', blob, (file.name || 'photo').replace(/\.\w+$/, '') + (blob.type === 'image/png' ? '.png' : '.jpg')); return apiFetch('/admin/uploads', { method: 'POST', body: fd }); })
    .then(function (r) { return apiOrigin() + r.url; })
    .catch(function (e) { toast((e && e.message && e.status != null) ? e.message : 'That file couldn’t be read. Use a JPG, PNG or WEBP photo.'); return null; });
}
function uploadImages(files, ci) {
  var arr = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); }); if (!arr.length) return;
  toast('Uploading ' + plural(arr.length, 'photo') + '…');
  var chain = Promise.resolve();
  arr.forEach(function (f) { chain = chain.then(function () { return uploadOne(f, 1600).then(function (u) { if (u && ed && ed.colors[ci]) ed.colors[ci].imgs.push(u); }); }); });
  chain.then(function () { edRerender(); });
}
A.esave = function () {
  var err = $('#ederr'); ed.name = String(ed.name || '').trim();
  if (!ed.name) { err.textContent = 'Give the product a name.'; return; }
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(ed.id)) { err.textContent = 'The web address needs 2–60 letters, numbers or dashes.'; return; }
  var clash = find(ed.id); if (clash && state.products.indexOf(clash) !== edIndex) { err.textContent = 'Another product already uses this web address.'; return; }
  var p = normP(ed);
  if (edIndex > -1) state.products[edIndex] = p; else state.products.unshift(p);
  ed = null; R.onModalClose = null; closeModal(); changed(); rerenderPanel(); toast('Saved to draft. Publish to put it on the website.');
};
