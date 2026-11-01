/* ---------- shell: header, mega menu, footer, router, basket & saved lists ---------- */
var root = document.getElementById('root');
var pages = {}, after = {}, A = {};
var current = { name: '', params: {} };

/* basket (quote cart) and saved products live in this browser */
var cart = LS.get('rk:cart', []); if (!Array.isArray(cart)) cart = [];
var saved = LS.get('rk:saved', []); if (!Array.isArray(saved)) saved = [];
function cartLines() {
  return cart.map(function (l) { var p = find(l.id); return p && !p.hidden && p.sizes.hasOwnProperty(l.size) ? { l: l, p: p, col: p.colors[l.ci] || p.colors[0], emb: p.emb ? String(l.emb || '') : '' } : null; }).filter(Boolean);
}
function cartCount() { return cartLines().length; }
function saveCart() { LS.set('rk:cart', cart); badges(); }
function saveSaved() { LS.set('rk:saved', saved); badges(); }
function addToCart(id, ci, size, qty, emb) {
  var p = find(id); if (!p) return false;
  if (!p.sizes.hasOwnProperty(size)) { toast('Pick a size first.'); return false; }
  if (!available(p, size)) { toast(p.name + ' is out of stock in ' + size + '.'); return false; }
  qty = Math.max(p.moq, qty || p.moq);
  var max = maxQty(p, size);
  emb = p.emb ? String(emb || '').trim().slice(0, 60) : '';
  var ex = cart.filter(function (l) { return l.id === id && l.ci === ci && l.size === size && String(l.emb || '').toLowerCase() === emb.toLowerCase(); })[0];
  if (ex) ex.qty = Math.min(max, ex.qty + qty); else cart.push({ id: id, ci: ci, size: size, qty: Math.min(max, qty), emb: emb });
  saveCart(); return true;
}
function isSaved(id) { return saved.indexOf(id) > -1; }
function badges() {
  var c = cartCount(), w = saved.filter(function (id) { var p = find(id); return p && !p.hidden; }).length;
  $$('[data-badge="cart"]').forEach(function (b) { b.textContent = c || ''; });
  $$('[data-badge="saved"]').forEach(function (b) { b.textContent = w || ''; });
}

function applyBrand() {
  var b = state.brand, el = document.documentElement;
  el.style.setProperty('--bp', /^#[0-9a-f]{6}$/i.test(b.primary) ? b.primary : '#1F5C52');
  el.style.setProperty('--ba', /^#[0-9a-f]{6}$/i.test(b.accent) ? b.accent : '#8FB3CC');
  var t = $('meta[name="theme-color"]'); if (t) t.setAttribute('content', b.primary || '#1F5C52');
  var th = LS.get('rk:theme', ''); if (th) el.setAttribute('data-theme', th); else el.removeAttribute('data-theme');
}
/* Built-in logo: a medical cross made of folded fabric panels, with the company name beside it.
   Used whenever no logo image is uploaded in Admin → Company & brand. */
function logoMark() {
  return '<svg class="lmk" viewBox="0 0 44 44" aria-hidden="true"><rect width="44" height="44" rx="12" fill="var(--primary)"/>' +
    '<path d="M17 8h10v9h9v10h-9v9H17v-9H8V17h9z" fill="#fff"/>' +
    '<path d="M27 17h9v10h-9z" fill="var(--accent)"/><path d="M27 17l9 10" stroke="var(--primary)" stroke-width="1.4" opacity=".55"/>' +
    '<path d="M17 11.5h10M17 32.5h10" stroke="var(--primary)" stroke-width="1.2" stroke-dasharray="2 2" opacity=".5"/></svg>';
}
function wordmark() {
  var n = String(state.brand.name || 'Rank INC'), parts = n.split(/\s+/), first = parts.shift(), rest = parts.join(' ');
  return '<span class="wordmark">' + logoMark() + '<span class="wm-t"><b>' + esc(first) + (rest ? ' <em>' + esc(rest) + '</em>' : '') + '</b><small>Medical Textiles</small></span></span>';
}
function logoHtml() {
  var b = state.brand;
  return b.logo ? '<img src="' + esc(absUrl(b.logo) || b.logo) + '" alt="' + esc(b.name) + '" width="160" height="46" data-logo="1">' : wordmark();
}
document.addEventListener('error', function (e) {
  var img = e.target; if (img && img.tagName === 'IMG' && img.dataset.logo) { var s = document.createElement('span'); s.innerHTML = wordmark(); img.replaceWith(s.firstChild); }
}, true);

/* small round picture for a category: its own image, else the first product photo, else the drawing */
function catPic(c, size) {
  var list = vis().filter(function (p) { return p.cat === c.id; });
  var pic = c.img || (list.map(function (p) { return firstImg(p); }).filter(Boolean)[0] || '');
  return pic ? imgTag(pic, '', c.art, '#DCE6E8', { w: size || 120, h: size || 120 }) : R.art(c.art, '#DCE6E8');
}
function subsOf(catId) { var out = []; vis().forEach(function (p) { if (p.cat === catId && p.sub && out.indexOf(p.sub) < 0) out.push(p.sub); }); return out; }
var NAV_SHORT = { 'hospital-apparels': 'Scrubs & Apparel', 'procedure-packs': 'Procedure Packs', 'surgical-drapes': 'Drapes', 'ot-ward-linen': 'Linen' };
function navCats() {
  /* the main ranges get their own menu item; others stay in the "All products" menu */
  var pref = Object.keys(NAV_SHORT).map(catOf).filter(function (c) { return c && vis().some(function (p) { return p.cat === c.id; }); });
  if (pref.length >= 3) return pref.slice(0, 4);
  return state.cats.filter(function (c) { return vis().some(function (p) { return p.cat === c.id; }); }).slice(0, 4);
}
function shortName(c) { return NAV_SHORT[c.id] || c.name.replace(/^Hospital /, ''); }

/* "Products" menu: one column per category with its ranges, plus a bulk-order card */
function megaHtml() {
  var cats = state.cats.filter(function (c) { return vis().some(function (p) { return p.cat === c.id; }); });
  if (!cats.length) return '<a href="/products" data-nav="products">Products</a>';
  var cols = Math.min(4, cats.length);
  return '<div class="nav-dd" id="navdd"><button data-act="megatoggle" aria-expanded="false" aria-controls="mega">Products ' + ic('down') + '</button>' +
    '<div class="mega" id="mega"><div class="wrap"><div class="mega-top"><a href="/products">Browse all ' + plural(vis().length, 'product') + ' ' + ic('arrow', 16) + '</a></div>' +
    '<div class="mega-in" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr)) 260px">' + cats.map(function (c) {
      var subs = subsOf(c.id);
      return '<div class="mcol"><h4><span class="mth">' + catPic(c, 84) + '</span><a href="/category/' + esc(c.id) + '">' + esc(c.name) + '</a></h4><ul>' +
        subs.slice(0, 5).map(function (x) { return '<li><a href="/category/' + esc(c.id) + '?sub=' + encodeURIComponent(x) + '">' + esc(x) + '</a></li>'; }).join('') +
        '<li><a class="all" href="/category/' + esc(c.id) + '">Shop all</a></li></ul></div>';
    }).join('') +
    '<a class="mpromo" href="/bulk-order" style="grid-column:' + (cols + 1) + ';grid-row:1 / span ' + Math.ceil(cats.length / cols) + '"><b>Buying for a hospital?</b><span>One quote for apparel, linen, drapes and packs, with custom colours and embroidery.</span><em>Request a bulk quote ' + ic('arrow', 16) + '</em></a></div></div></div></div>';
}
function shell() {
  var s = state.store, b = state.brand;
  var ann = String(state.home.announce || '').split(/\s+·\s+|\s*✦\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
  root.innerHTML =
    '<a class="skip" href="#main">Skip to content</a>' +
    '<div class="topbar"><div class="wrap topbar-in"><div class="ann" aria-live="off">' + ann.map(function (t, i) { return '<span class="' + (i ? '' : 'on') + '">' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<nav class="util" aria-label="Help"><a href="/track">' + ic('truck') + 'Track order</a>' +
      (s.email ? '<a href="mailto:' + esc(s.email) + '">' + ic('mail') + esc(s.email) + '</a>' : '') +
      (s.phone ? '<a class="keep" href="' + telHref(s.phone) + '">' + ic('phone') + esc(s.phone) + '</a>' : '') + '</nav></div></div>' +
    '<header class="hdr" id="hdr"><div class="wrap hdr-in">' +
      '<button class="icon-btn only-m" data-act="menu" aria-label="Open menu">' + ic('menu') + '</button>' +
      '<a href="/" class="logo" aria-label="' + esc(b.name) + ' home">' + logoHtml() + '</a>' +
      '<nav class="nav" aria-label="Main"><a href="/" data-nav="home">Home</a>' + megaHtml() +
        (state.depts.length ? '<div class="nav-dd" id="navdep"><button data-act="megatoggle" aria-expanded="false" aria-controls="depmenu">Departments ' + ic('down') + '</button>' +
          '<div class="mega" id="depmenu"><div class="wrap dep-in">' + state.depts.map(function (d) { return '<a href="/department/' + esc(d.id) + '"><span class="di">' + dic(d.icon) + '</span><span><b>' + esc(d.name) + '</b><span>' + esc(d.blurb) + '</span></span></a>'; }).join('') + '</div></div></div>' : '') +
        (state.kits.length ? '<a href="/kits" data-nav="kits">Starter kits</a>' : '') +
        '<a href="/bulk-order" data-nav="bulk">Bulk order</a><a href="/about" data-nav="about">About us</a><a href="/contact" data-nav="contact">Contact us</a></nav>' +
      '<div class="hdr-act"><button class="sbar" data-act="search" aria-label="Search products">' + ic('search', 18) + '<span>Search scrubs, drapes, packs…</span></button>' +
        '<button class="icon-btn only-s" data-act="search" aria-label="Search products">' + ic('search') + '</button>' +
        '<a class="icon-btn" href="/saved" aria-label="Saved products">' + ic('heart') + '<span class="count" data-badge="saved"></span></a>' +
        '<button class="icon-btn cart-btn" data-act="cartopen" aria-label="Open quote basket">' + ic('basket') + '<span class="count" data-badge="cart"></span></button></div>' +
    '</div></header>' +
    '<main id="main" tabindex="-1"></main><footer class="ftr" id="footer"></footer>' +
    (waNumber() ? '<a class="wa-fab" href="' + esc(waLink('Hello ' + b.name + ', I have an enquiry.')) + '" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">' + ic('wa') + '<span>WhatsApp</span></a>' : '') +
    '<div id="sticky"></div><div id="modal"></div><div class="toasts" id="toasts" aria-live="polite"></div>';
  footer(); badges(); rotateAnn();
}
var annTimer = null;
function rotateAnn() {
  clearInterval(annTimer); if (reduced) return;
  annTimer = setInterval(function () {
    var items = $$('.ann span'); if (items.length < 2) return;
    var i = items.findIndex(function (x) { return x.classList.contains('on'); });
    items[i].classList.remove('on'); items[(i + 1) % items.length].classList.add('on');
  }, 4500);
}
window.addEventListener('scroll', function () { var h = $('#hdr'); if (h) h.classList.toggle('scrolled', scrollY > 40); }, { passive: true });

document.addEventListener('submit', function (e) {
  if (e.target.id !== 'newsl') return;
  e.preventDefault();
  var f = e.target, name = f.name.value.trim(), phone = f.phone.value, err = $('#nlerr'), btn = f.querySelector('button');
  err.textContent = '';
  if (name.length < 2) { err.textContent = 'Add your name.'; f.name.focus(); return; }
  if (!/^[6-9]\d{9}$/.test(digits(phone).replace(/^(91|0)(?=\d{10}$)/, ''))) { err.textContent = 'Enter a valid 10-digit mobile number.'; f.phone.focus(); return; }
  btn.classList.add('busy');
  apiFetch('/enquiries', { method: 'POST', body: { name: name, phone: phone, topic: 'Catalogue request', message: 'Please send the latest catalogue and price list.' } }).then(function () {
    f.innerHTML = '<p class="newsl-ok">' + ic('check', 20) + ' Thank you. We’ll send the catalogue to ' + esc(phone) + '.</p>';
  }).catch(function (e2) { btn.classList.remove('busy'); err.textContent = e2.message; });
});
function footer() {
  var s = state.store, b = state.brand, soc = s.social || {};
  var socials = [['facebook', 'fb', 'Facebook'], ['instagram', 'ig', 'Instagram'], ['linkedin', 'li', 'LinkedIn'], ['twitter', 'tw', 'X (Twitter)'], ['youtube', 'yt', 'YouTube']].filter(function (x) { return soc[x[0]]; });
  var th = document.documentElement.getAttribute('data-theme');
  var pays = (s.payments || []).filter(function (k) { return PAYMENTS[k]; });
  $('#footer').innerHTML = '<div class="newsl"><div class="wrap newsl-in"><div><h2 class="d3">Get our catalogue and price updates</h2><p class="muted">Leave your number and we’ll send the latest catalogue and rates on WhatsApp. No spam.</p></div>' +
      '<form class="newsl-f" id="newsl" novalidate><label class="sr" for="nl-name">Your name</label><input class="inp" id="nl-name" name="name" placeholder="Your name" autocomplete="name"><label class="sr" for="nl-phone">Mobile number</label><input class="inp" id="nl-phone" name="phone" type="tel" inputmode="tel" placeholder="Mobile number" autocomplete="tel"><button class="btn btn-primary" type="submit">Send me the catalogue</button><p class="err-msg" id="nlerr" role="alert"></p></form></div></div>' +
    '<div class="wrap"><div class="ftr-top">' +
    '<div><a href="/" class="logo" aria-label="' + esc(b.name) + ' home">' + logoHtml() + '</a><p class="brand-p">' + esc(b.tagline) + '</p>' +
      (s.address ? '<address>' + esc(s.address) + '</address>' : '') +
      (socials.length ? '<div class="social">' + socials.map(function (x) { return '<a href="' + esc(soc[x[0]]) + '" target="_blank" rel="noopener" aria-label="' + x[2] + '">' + ic(x[1], 17) + '</a>'; }).join('') + '</div>' : '') + '</div>' +
    '<div><h3>Products</h3><ul>' + state.cats.map(function (c) { return '<li><a href="/category/' + esc(c.id) + '">' + esc(c.name) + '</a></li>'; }).join('') + '</ul></div>' +
    '<div><h3>Company</h3><ul><li><a href="/about">About us</a></li><li><a href="/products">All products</a></li><li><a href="/contact">Contact us</a></li><li><a href="/track">Track your order</a></li><li><a href="/saved">Saved products</a></li></ul></div>' +
    '<div><h3>For business</h3><ul><li><a href="/bulk-order">Bulk orders</a></li><li><a href="/contact?topic=Custom%20product">Custom manufacturing</a></li><li><a href="/contact?topic=Export%20enquiry">Export enquiries</a></li><li><a href="/contact?topic=Distributor%20%2F%20dealer">Become a distributor</a></li></ul></div>' +
    '<div class="help"><h3>Need help?</h3><p>' + (s.hours ? esc(s.hours) : 'Talk to our sales team about sizes, quantities and delivery.') + '</p>' +
      (s.phone ? '<a class="btn btn-outline btn-sm" href="' + telHref(s.phone) + '">' + ic('phone', 16) + esc(s.phone) + '</a>' : '') +
      (waNumber() ? '<a class="btn btn-sm" href="' + esc(waLink()) + '" target="_blank" rel="noopener">' + ic('wa', 16) + 'WhatsApp us</a>' : '') +
      (s.email ? '<a class="btn btn-sm" href="mailto:' + esc(s.email) + '">' + ic('mail', 16) + 'Email us</a>' : '') + '</div></div>' +
    (pays.length ? '<div class="paychips"><span>We accept</span>' + pays.map(function (k) { return '<span class="pc">' + esc(PAYMENTS[k][0]) + '</span>'; }).join('') + '<span class="pc">GST invoice</span></div>' : '') +
    '<div class="ftr-bot"><span>© ' + new Date().getFullYear() + ' ' + esc(b.name) + '. All rights reserved.' + (s.gstin ? ' GSTIN ' + esc(s.gstin) + '.' : '') + '</span>' +
      '<nav aria-label="Legal"><a href="/privacy">Privacy policy</a><a href="/terms">Terms of sale</a><a href="/sitemap.xml" data-ext="1">Sitemap</a><button data-act="theme">' + (th === 'dark' ? 'Light mode' : 'Dark mode') + '</button><a href="/admin" rel="nofollow">Staff login</a></nav></div></div>';
}

/* ---------- router (real URLs, so every page can be shared and indexed) ---------- */
function parse(pathname) {
  var p = (pathname || '/').replace(/\/+$/, '') || '/', m;
  if (p === '/' || p === '/index.html') return { name: 'home', params: {} };
  if (p === '/products') return { name: 'products', params: {} };
  if ((m = /^\/category\/([a-z0-9-]+)$/.exec(p))) return { name: 'category', params: { id: m[1] } };
  if ((m = /^\/product\/([A-Za-z0-9_-]+)$/.exec(p))) return { name: 'product', params: { id: m[1] } };
  if ((m = /^\/department\/([a-z0-9-]+)$/.exec(p))) return { name: 'department', params: { id: m[1] } };
  if (p === '/kits') return { name: 'kits', params: {} };
  var simple = { '/about': 'about', '/contact': 'contact', '/cart': 'cart', '/saved': 'saved', '/admin': 'admin', '/track': 'track', '/bulk-order': 'bulk', '/privacy': 'privacy', '/terms': 'terms' };
  if (simple[p]) return { name: simple[p], params: {} };
  return { name: 'notfound', params: {} };
}
function qs() { var o = {}; new URLSearchParams(location.search).forEach(function (v, k) { o[k] = v; }); return o; }
var scrollKey = 0, scrolls = {};
function go(url, opts) {
  opts = opts || {};
  if (history.state && history.state.k != null) scrolls[history.state.k] = scrollY;
  scrollKey = Date.now();
  if (opts.replace) history.replaceState({ k: scrollKey }, '', url); else history.pushState({ k: scrollKey }, '', url);
  route({ top: !opts.keep });
}
function route(o) {
  o = o || {};
  var r = parse(location.pathname); current = r; r.query = qs();
  var main = $('#main'); if (!main) return;
  closeModal(); closeMega();
  var st = $('#sticky'); if (st) st.innerHTML = '';
  var fn = pages[r.name] || pages.notfound;
  main.innerHTML = fn(r.params, r.query);
  var navKey = r.name === 'kits' ? 'kits' : r.name === 'products' ? 'products' : r.name === 'category' ? 'cat-' + r.params.id : r.name === 'product' && find(r.params.id) ? 'cat-' + find(r.params.id).cat : r.name;
  $$('.nav [data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === navKey); });
  var dd = $('#navdd'); if (dd) dd.classList.toggle('on', r.name === 'products');
  var dp = $('#navdep'); if (dp) dp.classList.toggle('on', r.name === 'department');
  document.body.classList.toggle('has-sticky', !!(st && st.innerHTML.trim()));
  if (after[r.name]) after[r.name](r.params, r.query);
  if (o.top) window.scrollTo(0, 0);
  else if (o.restore != null) window.scrollTo(0, o.restore);
  if (o.focus !== false && o.top) main.focus({ preventScroll: true });
  badges();
}
function setTitle(t, desc) {
  document.title = t;
  if (desc != null) { var m = $('meta[name="description"]'); if (m) m.setAttribute('content', desc); }
}
window.addEventListener('popstate', function (e) {
  var k = e.state && e.state.k; route({ restore: k != null && scrolls[k] != null ? scrolls[k] : 0, focus: false });
});
document.addEventListener('click', function (e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var a = e.target.closest('a[href]'); if (!a || a.target || a.hasAttribute('download') || a.dataset.ext) return;
  var href = a.getAttribute('href'); if (!href || href.charAt(0) !== '/' || href.indexOf('//') === 0) return;
  if (/^\/(api|o|assets)\//.test(href) || /\.[a-z0-9]{2,5}($|\?)/i.test(href)) return;
  e.preventDefault();
  if (href === location.pathname + location.search) { closeModal(); closeMega(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
  go(href);
});
/* old links from the previous site (#p-xyz, #shop) still land on the right page */
(function () {
  var h = location.hash.slice(1);
  if (!h) return;
  var map = { home: '/', shop: '/products', about: '/about', contact: '/contact', admin: '/admin', wishlist: '/saved', cart: '/cart' };
  if (map[h]) history.replaceState({ k: 0 }, '', map[h]);
  else if (/^p-[A-Za-z0-9_-]+$/.test(h)) history.replaceState({ k: 0 }, '', '/product/' + h.slice(2));
})();

/* ---------- action dispatch ---------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]'); if (!el) {
    if (!e.target.closest('.nav-dd')) closeMega();
    return;
  }
  var act = el.dataset.act;
  if (act === 'mback') { if (e.target === el) closeModal(); return; }
  if (A[act]) { e.preventDefault(); A[act](el, e); }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if ($('#modal') && $('#modal').innerHTML) closeModal(); closeMega(); }
  if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); A.search(); }
});
A.mclose = closeModal;
A.theme = function () {
  var el = document.documentElement, cur = el.getAttribute('data-theme');
  var dark = cur === 'dark';
  var next = dark ? 'light' : 'dark'; LS.set('rk:theme', next); el.setAttribute('data-theme', next); footer();
};
function closeMega(except) { $$('.nav-dd.open').forEach(function (d) { if (d === except) return; d.classList.remove('open'); d.querySelector('button').setAttribute('aria-expanded', 'false'); }); }
A.megatoggle = function (el) {
  var d = el.closest('.nav-dd'), open = !d.classList.contains('open');
  closeMega(d); d.classList.toggle('open', open); el.setAttribute('aria-expanded', String(open));
};
(function () {
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  var t = null;
  document.addEventListener('mouseover', function (e) { var d = e.target.closest && e.target.closest('.nav-dd'); if (d) { clearTimeout(t); t = setTimeout(function () { closeMega(d); d.classList.add('open'); }, 90); } });
  document.addEventListener('mouseout', function (e) {
    var d = e.target.closest && e.target.closest('.nav-dd'); if (!d) return;
    if (e.relatedTarget && d.contains(e.relatedTarget)) return;
    clearTimeout(t); t = setTimeout(closeMega, 160);
  });
})();
A.menu = function () {
  var s = state.store;
  modal('<nav class="drawer-in mnav" aria-label="Menu"><div class="mnav-h">' + wordmark() + '<button class="icon-btn" data-act="mclose" aria-label="Close menu">' + ic('x') + '</button></div><div class="mnav-b">' +
    '<a href="/">' + ic('home') + 'Home</a><a href="/products">' + ic('grid') + 'All products</a>' + (state.kits.length ? '<a href="/kits">' + ic('kit') + 'Starter kits</a>' : '') + '<a href="/bulk-order">' + ic('box') + 'Bulk order</a>' +
    (state.depts.length ? '<h4>SHOP BY DEPARTMENT</h4>' + state.depts.map(function (d) { return '<a href="/department/' + esc(d.id) + '"><span class="mth">' + dic(d.icon) + '</span>' + esc(d.name) + '</a>'; }).join('') : '') + '<h4>SHOP BY CATEGORY</h4>' +
    state.cats.map(function (c) { return '<a href="/category/' + esc(c.id) + '"><span class="mth">' + catPic(c, 76) + '</span>' + esc(c.name) + '</a>'; }).join('') +
    '<h4>HELP</h4><a href="/track">' + ic('truck') + 'Track your order</a><a href="/about">' + ic('file') + 'About us</a><a href="/contact">' + ic('mail') + 'Contact us</a><a href="/saved">' + ic('heart') + 'Saved products</a>' +
    (s.phone ? '<a href="' + telHref(s.phone) + '">' + ic('phone') + esc(s.phone) + '</a>' : '') + (waNumber() ? '<a href="' + esc(waLink()) + '" target="_blank" rel="noopener">' + ic('wa') + 'WhatsApp</a>' : '') + '</div></nav>', 'drawer');
};

/* ---------- search ---------- */
function searchHits(q, limit) {
  q = String(q || '').trim().toLowerCase(); if (!q) return [];
  var words = q.split(/\s+/);
  return vis().map(function (p) {
    var hay = (p.name + ' ' + p.code + ' ' + p.sub + ' ' + catName(p.cat) + ' ' + p.desc + ' ' + p.colors.map(function (c) { return c.name; }).join(' ')).toLowerCase();
    if (!words.every(function (w) { return hay.indexOf(w) > -1; })) return null;
    var score = (p.name.toLowerCase().indexOf(q) === 0 ? 3 : 0) + (p.name.toLowerCase().indexOf(q) > -1 ? 2 : 0) + (p.code.toLowerCase() === q ? 5 : 0);
    return { p: p, s: score };
  }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, limit || 999).map(function (x) { return x.p; });
}
A.search = function () {
  modal('<div class="search-box" role="dialog" aria-modal="true" aria-label="Search products"><label class="searchbox">' + ic('search') + '<span class="sr">Search products</span><input id="sq" type="search" placeholder="Search scrubs, drapes, packs, product codes…" autocomplete="off" autofocus><button class="icon-btn" data-act="mclose" aria-label="Close search">' + ic('x') + '</button></label><div class="sres" id="sres">' + searchBody('') + '</div></div>');
  var inp = $('#sq'), sel = -1;
  inp.addEventListener('input', function () { sel = -1; $('#sres').innerHTML = searchBody(inp.value); });
  inp.addEventListener('keydown', function (e) {
    var links = $$('#sres a');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(links.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); links.forEach(function (a, i) { a.classList.toggle('on', i === sel); }); if (links[sel]) links[sel].scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); if (links[sel]) links[sel].click(); else if (inp.value.trim()) go('/products?q=' + encodeURIComponent(inp.value.trim())); }
  });
};
A.sqset = function (el) { var i = $('#sq'); i.value = el.dataset.v; i.dispatchEvent(new Event('input')); i.focus(); };
function searchBody(q) {
  if (!q.trim()) {
    return '<h4>POPULAR SEARCHES</h4><div class="sq-chips">' + ['Scrub suit', 'Lab coat', 'Cesarean', 'Drape', 'Mattress', 'Isolation gown', 'Bed sheet', 'Warming blanket'].map(function (t) { return '<button class="fchip" data-act="sqset" data-v="' + esc(t) + '">' + ic('search', 14) + esc(t) + '</button>'; }).join('') + '</div>' +
      '<h4>CATEGORIES</h4>' + state.cats.map(function (c) { return '<a href="/category/' + esc(c.id) + '"><span class="th">' + catPic(c, 104) + '</span><span><b>' + esc(c.name) + '</b><span>' + esc(c.blurb) + '</span></span></a>'; }).join('');
  }
  var hits = searchHits(q, 8);
  if (!hits.length) return '<p class="muted" style="padding:20px;text-align:center">No products match “' + esc(q) + '”. Try another word, or <a href="/contact?topic=Custom%20product&product=' + encodeURIComponent(q) + '">ask us</a> — we make custom items too.</p>';
  return '<h4>PRODUCTS</h4>' + hits.map(function (p) { return '<a href="/product/' + esc(p.id) + '"><span class="th">' + media(p, 0, 0, { w: 104, h: 104 }) + '</span><span><b>' + esc(p.name) + '</b><span>' + esc(catName(p.cat)) + (p.sub ? ' · ' + esc(p.sub) : '') + (p.code ? ' · ' + esc(p.code) : '') + '</span></span></a>'; }).join('') +
    '<a class="all" href="/products?q=' + encodeURIComponent(q.trim()) + '">See all results</a>';
}

/* ---------- cart drawer ---------- */
A.cartopen = function () { openDrawer(); };
function openDrawer(added) {
  modal('<aside class="cdrawer-in" role="dialog" aria-modal="true" aria-labelledby="cdT"><div class="cd-h"><h3 id="cdT">' + (added ? 'Added to your quote basket' : 'Quote basket') + '</h3><button class="icon-btn" data-act="mclose" aria-label="Close">' + ic('x') + '</button></div><div class="cd-b" id="cdb">' + drawerBody() + '</div>' + drawerFoot() + '</aside>', 'cdrawer');
}
function drawerBody() {
  var lines = cartLines();
  if (!lines.length) return '<div class="empty" style="padding:48px 0">' + R.art('pack', '#8FB3CC') + '<h3>Your basket is empty</h3><p class="muted">Add products with sizes and quantities, then send them in one request.</p><a class="btn btn-primary" href="/products">Browse products</a></div>';
  return lines.map(function (x, i) {
    var p = x.p, l = x.l;
    return '<div class="cd-line"><a class="th" href="/product/' + esc(p.id) + '?c=' + l.ci + '" tabindex="-1">' + media(p, l.ci, 0, { w: 144, h: 144 }) + '</a><div style="min-width:0"><b>' + esc(p.name) + '</b><div class="meta">' + [x.col.name !== 'Standard' ? x.col.name : '', l.size !== 'Standard' ? 'Size ' + l.size : '', p.unit].filter(Boolean).map(esc).join(' · ') + (x.emb ? '<br>Embroidery: ' + esc(x.emb) : '') + '</div>' +
      '<div class="qty sm"><button data-act="dqty" data-i="' + i + '" data-d="-1" aria-label="Fewer">' + ic('minus') + '</button><input data-dqty="' + i + '" inputmode="numeric" value="' + l.qty + '" aria-label="Quantity"><button data-act="dqty" data-i="' + i + '" data-d="1" aria-label="More">' + ic('plus') + '</button></div></div>' +
      '<div style="text-align:right"><div class="price' + (p.price ? '' : ' req') + '">' + (p.price ? money(p.price * l.qty) : 'On request') + '</div><button class="icon-btn danger" data-act="drm" data-i="' + i + '" aria-label="Remove ' + esc(p.name) + '">' + ic('trash') + '</button></div></div>';
  }).join('');
}
function drawerFoot() {
  var lines = cartLines(); if (!lines.length) return '';
  var sub = lines.reduce(function (a, x) { return a + x.p.price * x.l.qty; }, 0), quote = lines.some(function (x) { return !x.p.price; });
  return '<div class="cd-f" id="cdf"><div class="row"><span>' + (quote ? (sub ? 'Priced items' : 'Prices') : 'Subtotal') + '</span><span>' + (sub ? money(sub) : 'Quoted by our team') + '</span></div>' +
    '<p>' + (quote ? 'Items marked “on request” are priced by our team. ' : '') + 'GST and freight are confirmed with your quote.</p>' +
    '<a class="btn btn-primary btn-lg btn-block" href="/cart?checkout=1">Continue to send request</a><a class="btn btn-block" href="/cart">View basket</a></div>';
}
function refreshDrawer() {
  var b = $('#cdb'); if (!b) return;
  b.innerHTML = drawerBody();
  var f = $('#cdf'), html = drawerFoot();
  if (f) { if (html) f.outerHTML = html; else f.remove(); } else if (html) b.insertAdjacentHTML('afterend', html);
}
A.dqty = function (el) {
  var x = cartLines()[+el.dataset.i]; if (!x) return;
  var step = x.p.moq >= 10 ? Math.max(1, Math.round(x.p.moq / 2)) : 1;
  x.l.qty = Math.max(x.p.moq, Math.min(maxQty(x.p, x.l.size), x.l.qty + (+el.dataset.d) * step)); saveCart(); refreshDrawer();
};
A.drm = function (el) { var x = cartLines()[+el.dataset.i]; if (!x) return; cart.splice(cart.indexOf(x.l), 1); saveCart(); refreshDrawer(); };
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.dataset || t.dataset.dqty == null) return;
  var x = cartLines()[+t.dataset.dqty]; if (!x) return;
  var v = parseInt(t.value, 10); x.l.qty = Math.max(x.p.moq, Math.min(maxQty(x.p, x.l.size), isFinite(v) ? v : x.p.moq)); saveCart(); refreshDrawer();
});
