/* ---------- storefront pages ---------- */
function altImg(p) {
  /* second photo for the hover swap: next photo of the same colour, else the next colour's photo */
  var c = p.colors[0];
  if (c.imgs[1]) return { src: c.imgs[1], hex: c.hex };
  for (var i = 1; i < p.colors.length; i++) if (p.colors[i].imgs[0]) return { src: p.colors[i].imgs[0], hex: p.colors[i].hex };
  return null;
}
function badgeHtml(p) {
  var b = [];
  if (p.track && !available(p)) b.push('<span class="badge-p out">Out of stock</span>');
  else if (p.tags.indexOf('bestseller') > -1) b.push('<span class="badge-p">Bestseller</span>');
  if (p.tags.indexOf('new') > -1) b.push('<span class="badge-p new">New</span>');
  return b.length ? '<div class="badges">' + b.join('') + '</div>' : '';
}
function quickable(p) { var s = sizeList(p); return s.length === 1 && p.colors.length === 1 && available(p); }
function tile(p) {
  var c = p.colors[0], alt = altImg(p);
  var off = p.mrp > p.price && p.price ? Math.round((p.mrp - p.price) / p.mrp * 100) : 0;
  return '<article class="tile">' +
    '<button class="save' + (isSaved(p.id) ? ' on' : '') + '" data-act="save" data-id="' + esc(p.id) + '" aria-pressed="' + isSaved(p.id) + '" aria-label="Save ' + esc(p.name) + '">' + ic('heart') + '</button>' +
    '<a href="/product/' + esc(p.id) + '"><div class="tile-img">' + media(p, 0, 0) + (alt ? imgTag(alt.src, '', p.art, alt.hex).replace('<img ', '<img class="alt-img" aria-hidden="true" ') : '') + badgeHtml(p) + '</div>' +
    '<div class="tile-body"><h3 class="tile-name">' + esc(p.name) + '</h3><span class="tile-sub">' + esc(p.sub || catName(p.cat)) + (p.code ? ' · ' + esc(p.code) : '') + '</span>' +
    '<div class="tile-foot">' + (p.price ? '<span class="price">' + money(p.price) + ' <small>/ ' + esc(p.unit) + '</small>' + (off ? '<s>' + money(p.mrp) + '</s><span class="off">' + off + '% off</span>' : '') + '</span>' : '<span class="price req">Price on request</span>') +
      (p.colors.length > 1 ? '<span class="dots" aria-label="' + p.colors.length + ' colours">' + p.colors.slice(0, 4).map(function (x) { return '<i style="--c:' + x.hex + '"></i>'; }).join('') + (p.colors.length > 4 ? '<span>+' + (p.colors.length - 4) + '</span>' : '') + '</span>' : '') + '</div></div></a>' +
    '<div class="qadd">' + (quickable(p) ? '<button class="btn btn-sm" data-act="qadd" data-id="' + esc(p.id) + '">' + ic('basket', 16) + 'Add to basket</button>' : '<a class="btn btn-sm" href="/product/' + esc(p.id) + '">Choose options</a>') + '</div></article>';
}
A.qadd = function (el) {
  var p = find(el.dataset.id); if (!p) return;
  if (addToCart(p.id, 0, sizeList(p)[0], p.moq)) openDrawer(true);
};
A.save = function (el) {
  var id = el.dataset.id, i = saved.indexOf(id);
  if (i > -1) saved.splice(i, 1); else saved.push(id);
  saveSaved();
  var on = i < 0;
  $$('[data-act="save"][data-id="' + id + '"]').forEach(function (b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  toast(on ? 'Saved for later.' : 'Removed from saved.', on ? { href: '/saved', label: 'View saved' } : null);
  if (current.name === 'saved' && !on) route({ keep: true });
};
function rowHtml(title, sub, list, href, id) {
  if (!list.length) return '';
  return '<section class="sec tight"><div class="wrap"><div class="sec-h"><div><h2 class="d2">' + esc(title) + '</h2>' + (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') + '</div>' +
    '<div class="sec-h ctl" style="margin:0"><a class="more" href="' + esc(href) + '">Shop all</a><button class="arrow-btn hide-m" data-act="rowscroll" data-row="' + id + '" data-d="-1" aria-label="Scroll left">' + ic('left') + '</button><button class="arrow-btn hide-m" data-act="rowscroll" data-row="' + id + '" data-d="1" aria-label="Scroll right">' + ic('right') + '</button></div></div>' +
    '<div class="row-track" id="' + id + '">' + list.map(tile).join('') + '</div></div></section>';
}
A.rowscroll = function (el) { var t = document.getElementById(el.dataset.row); if (t) t.scrollBy({ left: (+el.dataset.d) * t.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' }); };

/* ---------- home ---------- */
var FEATS = [['shield', 'Inspected before dispatch'], ['layers', 'Manufacturer direct'], ['needle', 'Custom colours & embroidery'], ['box', 'Bulk quotes for institutions'], ['globe', 'Supplying India & export']];
var TRUST = [['layers', 'Wide product range', 'Apparel, linen, mattresses, drapes and procedure packs from one manufacturer.'],
  ['shield', 'Inspected before dispatch', 'Every batch is checked by our inspection department before it leaves the unit.'],
  ['needle', 'Made to your specification', 'Custom colours, sizes, embroidery and pack contents.'],
  ['globe', 'India and export', 'Supplying hospitals and distributors at home and abroad.']];
function rackProduct() {
  var p = find('classic-scrub-suit');
  if (p && !p.hidden && p.colors.length >= 3) return p;
  return vis().filter(function (x) { return x.colors.length >= 4; }).sort(function (a, b) { return b.colors.length - a.colors.length; })[0] || null;
}
var slideIdx = 0, slideTimer = null;
function sliderHtml(slides) {
  if (!slides.length) return '';
  return '<section class="hero wrap" aria-roledescription="carousel" aria-label="Highlights"><div class="slider" id="slider"><div class="slides" id="slides">' + slides.map(function (s, i) {
    return '<div class="slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + slides.length + '" style="--sbg:' + esc(s.bg || '#DCE8F0') + '"' + (i ? ' aria-hidden="true"' : '') + '>' +
      '<div class="slide-t">' + (i === 0 ? '<h1>' : '<h2>') + esc(s.title) + (i === 0 ? '</h1>' : '</h2>') + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') +
      (s.cta && s.link ? '<a class="btn btn-primary btn-lg" href="' + esc(s.link) + '"' + (i ? ' tabindex="-1"' : '') + '>' + esc(s.cta) + ic('arrow', 18) + '</a>' : '') + '</div>' +
      '<div class="slide-i">' + (s.img ? imgTag(s.img, '', 'scrub', '#8FB3CC', { eager: i === 0, w: 900, h: 700 }) : R.art('scrub', '#8FB3CC')) + '</div></div>';
  }).join('') + '</div>' +
    (slides.length > 1 ? '<div class="sl-dots" role="tablist">' + slides.map(function (s, i) { return '<button class="' + (i ? '' : 'on') + '" data-act="slgo" data-i="' + i + '" aria-label="Show slide ' + (i + 1) + '"></button>'; }).join('') + '</div>' +
      '<div class="sl-nav"><button data-act="slstep" data-d="-1" aria-label="Previous slide">' + ic('left') + '</button><button data-act="slstep" data-d="1" aria-label="Next slide">' + ic('right') + '</button></div>' : '') + '</div>' +
    '<div class="feats">' + FEATS.map(function (f) { return '<div><span class="fi">' + ic(f[0]) + '</span>' + f[1] + '</div>'; }).join('') + '</div></section>';
}
function showSlide(i) {
  var s = $('#slides'); if (!s) return;
  var n = s.children.length; slideIdx = (i + n) % n;
  s.style.transform = 'translateX(' + (-100 * slideIdx) + '%)';
  $$('.slide', s).forEach(function (el, j) { el.setAttribute('aria-hidden', String(j !== slideIdx)); $$('a', el).forEach(function (a) { a.tabIndex = j === slideIdx ? 0 : -1; }); });
  $$('.sl-dots button').forEach(function (b, j) { b.classList.toggle('on', j === slideIdx); });
}
function startSlides() {
  clearInterval(slideTimer); var s = $('#slider'); if (!s || reduced || $$('.slide', s).length < 2) return;
  slideTimer = setInterval(function () { if (!document.hidden && current.name === 'home') showSlide(slideIdx + 1); }, 6500);
  s.addEventListener('pointerenter', function () { clearInterval(slideTimer); });
  s.addEventListener('pointerleave', startSlides);
  s.addEventListener('focusin', function () { clearInterval(slideTimer); });
  var x0 = null;
  s.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  s.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) showSlide(slideIdx + (dx < 0 ? 1 : -1)); x0 = null; });
}
A.slgo = function (el) { showSlide(+el.dataset.i); };
A.slstep = function (el) { showSlide(slideIdx + (+el.dataset.d)); };
function seoHtml(title, body) {
  var html = String(body || '').split(/\n\s*\n/).map(function (blk) {
    var m = /^##\s+(.+?)\n([\s\S]*)$/.exec(blk.trim());
    return m ? '<h3>' + esc(m[1]) + '</h3><p>' + esc(m[2]) + '</p>' : '<p>' + esc(blk) + '</p>';
  }).join('');
  return '<section class="sec alt"><div class="wrap"><h2 class="d2" style="margin-bottom:14px">' + esc(title) + '</h2><div class="seo clamp" id="seo">' + html + '</div><button class="btn btn-sm seo-more" data-act="seomore" aria-expanded="false" aria-controls="seo">Read more</button></div></section>';
}
A.seomore = function (el) { var s = $('#seo'), open = s.classList.toggle('clamp'); el.textContent = open ? 'Read more' : 'Read less'; el.setAttribute('aria-expanded', String(!open)); };
pages.home = function () {
  var h = state.home, show = h.show, b = state.brand, s = state.store;
  setTitle(b.name + (b.tagline ? ' — ' + b.tagline : ''), h.sub);
  var slides = (h.slides || []).filter(function (x) { return x.title; });
  if (!slides.length) slides = [{ title: h.headline, sub: h.sub, cta: h.cta, link: '/products', img: '', bg: '#DCE8F0' }];
  var cats = state.cats.filter(function (c) { return vis().some(function (p) { return p.cat === c.id; }); });
  var rp = rackProduct();
  var byCat = function (id, n) { return vis().filter(function (p) { return p.cat === id; }).sort(function (a, c) { return (c.tags.length) - (a.tags.length); }).slice(0, n || 10); };
  var feat = vis().filter(function (p) { return p.tags.indexOf('featured') > -1; }).slice(0, 10);
  var rows = '';
  if (show.rows) {
    var picks = [['hospital-apparels', 'Scrubs, lab coats & gowns', 'Reusable hospital apparel in standard and custom colours, with embroidery.'], ['procedure-packs', 'Procedure packs', 'Ready-to-use packs built for each speciality.']];
    rows = picks.map(function (x, i) { var c = catOf(x[0]); return c ? rowHtml(x[1], x[2], byCat(x[0]), '/category/' + c.id, 'row' + i) : ''; }).join('');
  }
  var newin = vis().filter(function (p) { return p.tags.indexOf('new') > -1; }).slice(0, 8);
  var quick = [['Scrub suits', '/category/hospital-apparels?sub=Scrub%20suits'], ['Lab coats', '/category/hospital-apparels?sub=Lab%20coats'], ['Procedure packs', '/category/procedure-packs'], ['Surgical drapes', '/category/surgical-drapes'],
    ['Mattresses', '/category/hospital-bed-mattress'], ['Ward linen', '/category/ot-ward-linen'], ['Starter kits', '/kits'], ['New arrivals', '/products?sort=new']]
    .filter(function (x) { var m = /^\/category\/([a-z0-9-]+)/.exec(x[1]); return !m || catOf(m[1]); });
  return (show.slides !== false ? sliderHtml(slides) : '') +
    (show.quick ? '<nav class="wrap quick" aria-label="Quick links">' + quick.map(function (x) { return '<a href="' + x[1] + '">' + esc(x[0]) + '</a>'; }).join('') + '</nav>' : '') +
    (show.categories && cats.length ? '<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="d2">Shop by category</h2><a class="more" href="/products">All ' + vis().length + ' products</a></div><div class="cats">' + cats.map(function (c) {
      return '<a class="ctile" href="/category/' + esc(c.id) + '"><span class="ci">' + catPic(c, 280) + '</span><b>' + esc(c.name) + '</b><span>' + plural(vis().filter(function (p) { return p.cat === c.id; }).length, 'product') + '</span></a>';
    }).join('') + '</div></div></section>' : '') +
    (show.depts && state.depts.length ? '<section class="sec tight"><div class="wrap"><div class="sec-h"><div><h2 class="d2">Shop by department</h2><p class="muted">Everything one department needs, gathered in one place.</p></div></div><div class="depts">' +
      state.depts.map(function (d) { var n = deptMatches(d).length; return n ? '<a class="dept" href="/department/' + esc(d.id) + '"><span class="di">' + dic(d.icon) + '</span><span><b>' + esc(d.name) + '</b><span>' + plural(n, 'product') + '</span></span>' + ic('arrow') + '</a>' : ''; }).join('') + '</div></div></section>' : '') +
    (show.colours && rp ? '<section class="sec tight"><div class="wrap"><div class="sec-h"><div><h2 class="d2">Shop scrubs by colour</h2><p class="muted">' + esc(rp.name) + ' comes in ' + rp.colors.length + ' hospital colours. Colour-code each department.</p></div></div><div class="colours">' +
      rp.colors.map(function (c, i) { return '<a href="/product/' + esc(rp.id) + '?c=' + i + '"><i style="--c:' + c.hex + '"></i>' + esc(c.name) + '</a>'; }).join('') + '</div></div></section>' : '') +
    (show.kits && state.kits.length ? '<section class="sec tight"><div class="wrap"><div class="sec-h"><div><h2 class="d2">Hospital starter kits</h2><p class="muted">Ready-made lists for a new ward, theatre or team. Add a whole kit, then adjust quantities.</p></div><a class="more" href="/kits">All kits</a></div><div class="kits">' + state.kits.slice(0, 3).map(kitCard).join('') + '</div></div></section>' : '') +
    (show.featured && feat.length ? rowHtml('Featured products', 'Popular with hospital purchase teams.', feat, '/products', 'rowf') : '') +
    (show.newin && newin.length ? rowHtml('New arrivals', 'Recently added to the range.', newin, '/products?sort=new', 'rown') : '') +
    rows +
    (show.custom ? '<section class="sec tight"><div class="wrap"><div class="bulk"><div class="bulk-t"><h2 class="d2">' + esc(h.customTitle || 'Bulk orders for hospitals') + '</h2><p class="lede">' + esc(h.customSub || '') + '</p>' +
      '<div class="acts"><a class="btn btn-lg btn-on" href="/bulk-order">Request a bulk quote</a>' + (waNumber() ? '<a class="btn btn-lg btn-line" href="' + esc(waLink('Hello ' + b.name + ', I would like a bulk quote.')) + '" target="_blank" rel="noopener">' + ic('wa', 18) + 'WhatsApp us</a>' : '') + '</div></div>' +
      '<ul class="bulk-l"><li>' + ic('palette') + 'Department colour coding</li><li>' + ic('needle') + 'Hospital name and logo embroidery</li><li>' + ic('ruler') + 'Sizes cut to your beds and staff</li><li>' + ic('box') + 'Procedure packs built to your protocol</li></ul></div></div></section>' : '') +
    (show.clients && h.clients.length ? '<section class="sec tight"><div class="wrap"><div class="sec-h"><h2 class="d2">Institutions we supply</h2></div><div class="clients"><div class="clients-track">' +
      h.clients.concat(h.clients).map(function (c, i) { return '<div class="client"' + (i >= h.clients.length ? ' aria-hidden="true"' : '') + '>' + (c.logo ? '<img src="' + esc(absUrl(c.logo) || c.logo) + '" alt="' + esc(c.name) + '" loading="lazy">' : esc(c.name)) + '</div>'; }).join('') + '</div></div></div></section>' : '') +
    (show.process ? '<section class="sec tight"><div class="wrap"><div class="sec-h"><div><h2 class="d2">How ordering works</h2><p class="muted">One basket for everything you need, priced and confirmed by our team.</p></div></div>' +
      '<div class="steps"><div class="step"><h3>Build your basket</h3><p>Add products with colour, size and quantity. Mix apparel, linen and packs in one request.</p></div>' +
      '<div class="step"><h3>Send your details</h3><p>Add your hospital or company, delivery address and GSTIN. The request is saved with us instantly.</p></div>' +
      '<div class="step"><h3>Get your quote</h3><p>Our team confirms prices, freight and dispatch date on WhatsApp, phone or email.</p></div>' +
      '<div class="step"><h3>Track and receive</h3><p>Follow the order with its reference on the Track order page until it reaches your store room.</p></div></div></div></section>' : '') +
    (show.testimonials && h.testimonials.length ? '<section class="sec tight"><div class="wrap"><div class="sec-h"><h2 class="d2">What our clients say</h2></div><div class="quotes">' + h.testimonials.map(function (t) {
      var ini = t.name.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
      return '<blockquote class="quote"><p>“' + esc(t.text) + '”</p><footer><span class="av" aria-hidden="true">' + esc(ini) + '</span><span><b>' + esc(t.name) + '</b>' + esc(t.role || '') + '</span></footer></blockquote>';
    }).join('') + '</div></div></section>' : '') +
    (show.brand ? '<section class="sec tight"><div class="wrap brandline"><p>' + esc(b.name) + ' makes hospital textiles the way wards and theatres use them — washed hundreds of times, changed every shift, trusted next to the patient. Every batch leaves our unit only after it passes inspection.</p></div></section>' : '') +
    (show.seo && h.seoBody ? seoHtml(h.seoTitle || ('About ' + b.name), h.seoBody) : '') +
    (show.faq && state.faq.length ? '<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="d2">Frequently asked questions</h2><a class="more" href="/contact">Ask a question</a></div><div class="acc" style="max-width:900px">' + faqHtml(state.faq.slice(0, 6)) + '</div></div></section>' : '');
};
after.home = function () { slideIdx = 0; startSlides(); };
function faqHtml(list) {
  return list.map(function (f, i) { return '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + ic('plus') + '</summary><div class="acc-b"><p>' + esc(f.a) + '</p></div></details>'; }).join('');
}

/* ---------- catalogue (all products, one category, search) ---------- */
var SORTS = [['', 'Recommended'], ['az', 'Name A–Z'], ['price', 'Price: low to high'], ['new', 'New first']];
function colourKey(n) { return String(n || '').toLowerCase(); }
function catalogue(catId, q) {
  var cat = catId ? catOf(catId) : null;
  var base = vis().filter(function (p) { return !cat || p.cat === cat.id; });
  var list = q.q ? searchHits(q.q).filter(function (p) { return !cat || p.cat === cat.id; }) : base.slice();
  if (q.sub) list = list.filter(function (p) { return p.sub === q.sub; });
  if (q.color) list = list.filter(function (p) { return p.colors.some(function (c) { return colourKey(c.name) === colourKey(q.color); }); });
  if (q.stock === '1') list = list.filter(function (p) { return available(p); });
  if (q.sort === 'az') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
  if (q.sort === 'price') list.sort(function (a, b) { return (a.price || 1e12) - (b.price || 1e12); });
  if (q.sort === 'new') list.sort(function (a, b) { return (b.tags.indexOf('new') > -1) - (a.tags.indexOf('new') > -1); });
  var subs = []; base.forEach(function (p) { if (p.sub && subs.indexOf(p.sub) < 0) subs.push(p.sub); });
  var cols = {}; base.forEach(function (p) { p.colors.forEach(function (c) { if (c.name !== 'Standard' && !cols[colourKey(c.name)]) cols[colourKey(c.name)] = c; }); });
  var colList = Object.keys(cols).map(function (k) { return cols[k]; });
  var title = cat ? cat.name : q.q ? 'Results for “' + q.q + '”' : 'All products';
  setTitle(title + ' — ' + state.brand.name, cat ? cat.blurb : null);
  var link = function (extra) { var o = Object.assign({}, q, extra); Object.keys(o).forEach(function (k) { if (!o[k]) delete o[k]; }); var s = new URLSearchParams(o).toString(); return location.pathname + (s ? '?' + s : ''); };
  var active = [];
  if (q.color) active.push(['Colour: ' + q.color, link({ color: '' })]);
  if (q.sub) active.push([q.sub, link({ sub: '' })]);
  if (q.stock === '1') active.push(['In stock', link({ stock: '' })]);
  return '<section class="phead band"><div class="wrap"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span>/</span>' + (cat ? '<a href="/products">Products</a><span>/</span><span>' + esc(cat.name) + '</span>' : '<span>Products</span>') + '</nav>' +
    '<h1 class="d2">' + esc(title) + '</h1>' + (cat && cat.blurb ? '<p class="lede">' + esc(cat.blurb) + '</p>' : '') + '</div></section>' +
    '<div class="wrap cat-layout"><aside class="filters" id="filters" aria-label="Filters"><div><h3>Category</h3><ul class="flist"><li><a href="/products' + (q.q ? '?q=' + encodeURIComponent(q.q) : '') + '" class="' + (!cat ? 'on' : '') + '">All products <span>' + vis().length + '</span></a></li>' +
      state.cats.map(function (c) { var n = vis().filter(function (p) { return p.cat === c.id; }).length; return n ? '<li><a href="/category/' + esc(c.id) + '" class="' + (cat && cat.id === c.id ? 'on' : '') + '">' + esc(c.name) + ' <span>' + n + '</span></a></li>' : ''; }).join('') + '</ul></div>' +
      (subs.length > 1 ? '<div><h3>Range</h3><ul class="flist">' + subs.map(function (s) { var n = base.filter(function (p) { return p.sub === s; }).length; return '<li><a href="' + esc(link({ sub: q.sub === s ? '' : s })) + '" class="' + (q.sub === s ? 'on' : '') + '" data-keep="1">' + esc(s) + ' <span>' + n + '</span></a></li>'; }).join('') + '</ul></div>' : '') +
      (colList.length > 1 ? '<div><h3>Colour</h3><div class="fsw">' + colList.map(function (c) { var on = colourKey(q.color) === colourKey(c.name); return '<a href="' + esc(link({ color: on ? '' : c.name })) + '" class="' + (on ? 'on' : '') + '" style="--c:' + c.hex + '" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" data-keep="1"></a>'; }).join('') + '</div></div>' : '') +
      (vis().some(function (p) { return p.track; }) ? '<div><h3>Availability</h3><label class="check"><input type="checkbox" data-filter="stock"' + (q.stock === '1' ? ' checked' : '') + '> In stock only</label></div>' : '') +
      '<div class="note small" style="border-bottom:1px solid var(--primary-line)">Can’t find it? We manufacture to order. <a href="/contact?topic=Custom%20product">Send us your specification</a>.</div></aside>' +
    '<div><div class="toolbar"><label class="searchbox">' + ic('search') + '<span class="sr">Search in ' + esc(title) + '</span><input id="catq" type="search" value="' + esc(q.q || '') + '" placeholder="Search ' + esc(cat ? cat.name.toLowerCase() : 'products') + '"></label>' +
      '<button class="btn filter-btn" data-act="filters">' + ic('filter') + 'Filters</button>' +
      '<span class="result-n">' + plural(list.length, 'product') + '</span><label><span class="sr">Sort</span><select id="catsort">' + SORTS.map(function (s) { return '<option value="' + s[0] + '"' + ((q.sort || '') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></label></div>' +
      (active.length ? '<div class="subchips">' + active.map(function (a) { return '<a class="fchip" href="' + esc(a[1]) + '" data-keep="1">' + esc(a[0]) + ic('x') + '</a>'; }).join('') + '</div>' : '') +
      (list.length ? '<div class="grid">' + list.map(tile).join('') + '</div>' : '<div class="empty">' + R.art(cat ? cat.art : 'pack', '#DCE6E8') + '<h2>No products match</h2><p class="muted">Try fewer filters, or tell us what you need and we’ll quote for it.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn" href="' + (cat ? '/category/' + esc(cat.id) : '/products') + '">Clear filters</a><a class="btn btn-primary" href="/contact?topic=Custom%20product' + (q.q ? '&product=' + encodeURIComponent(q.q) : '') + '">Ask for it</a></div></div>') +
    '</div></div>';
}
pages.products = function (params, q) { return catalogue('', q); };
pages.category = function (params, q) { return catOf(params.id) ? catalogue(params.id, q) : pages.notfound(); };
function catalogueAfter() {
  var inp = $('#catq'), sel = $('#catsort');
  var upd = function (k, v) { var o = qs(); if (v) o[k] = v; else delete o[k]; var s = new URLSearchParams(o).toString(); go(location.pathname + (s ? '?' + s : ''), { replace: true, keep: true }); };
  if (inp) inp.addEventListener('input', debounce(function () { var pos = inp.selectionStart; upd('q', inp.value.trim()); var n = $('#catq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }, 300));
  if (sel) sel.addEventListener('change', function () { upd('sort', sel.value); });
  $$('[data-filter="stock"]').forEach(function (c) { c.addEventListener('change', function () { upd('stock', c.checked ? '1' : ''); }); });
  $$('[data-keep]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(a.getAttribute('href'), { replace: true, keep: true }); }); });
}
after.products = catalogueAfter; after.category = catalogueAfter;
A.filters = function () { var f = $('#filters'); if (f) { f.classList.toggle('open'); if (f.classList.contains('open')) f.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }); } };

/* ---------- product page ---------- */
var pdp = { id: null, ci: 0, size: null, qty: 1, img: 0 };
pages.product = function (params, q) {
  var p = find(params.id); if (!p || p.hidden) return pages.notfound();
  if (pdp.id !== p.id) {
    var sizes = sizeList(p), avail = sizes.filter(function (z) { return available(p, z); });
    pdp = { id: p.id, ci: Math.min(p.colors.length - 1, Math.max(0, parseInt(q.c, 10) || 0)), size: sizes.length === 1 ? sizes[0] : (avail.length === 1 ? avail[0] : null), qty: p.moq, img: 0, embOn: false, emb: '' };
  } else if (q.c != null) { pdp.ci = Math.min(p.colors.length - 1, Math.max(0, parseInt(q.c, 10) || 0)); }
  var cat = catOf(p.cat), s = state.store;
  setTitle(p.name + (cat ? ' — ' + cat.name : '') + ' | ' + state.brand.name, p.desc);
  stickyBuy(p);
  var related = vis().filter(function (x) { return x.id !== p.id && x.cat === p.cat && (!p.sub || x.sub === p.sub); }).slice(0, 10);
  if (related.length < 6) related = related.concat(vis().filter(function (x) { return x.id !== p.id && x.cat === p.cat && related.indexOf(x) < 0; }).slice(0, 10 - related.length));
  var accs = '<div class="pacc">' +
    (p.long ? '<details open><summary>Description' + ic('plus') + '</summary><div class="acc-b prose">' + p.long.split(/\n\s*\n/).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div></details>' : '') +
    '<details' + (p.long ? '' : ' open') + '><summary>Specifications' + ic('plus') + '</summary><div class="acc-b"><dl class="specs">' + (p.code ? '<dt>Product code</dt><dd>' + esc(p.code) + '</dd>' : '') + '<dt>Category</dt><dd>' + esc(catName(p.cat)) + (p.sub ? ' · ' + esc(p.sub) : '') + '</dd>' +
      p.specs.map(function (x) { return '<dt>' + esc(x.k) + '</dt><dd>' + esc(x.v) + '</dd>'; }).join('') +
      (p.colors.length > 1 || p.colors[0].name !== 'Standard' ? '<dt>Colours</dt><dd>' + p.colors.map(function (c) { return esc(c.name); }).join(', ') + '</dd>' : '') +
      (sizeList(p).join('') !== 'Standard' ? '<dt>Sizes</dt><dd>' + sizeList(p).map(esc).join(', ') + '</dd>' : '') + '</dl></div></details>' +
    (hasSizeGuide(p) ? '<details><summary>Size chart' + ic('plus') + '</summary><div class="acc-b">' + sizeGuideHtml(p) + '</div></details>' : '') +
    '<details><summary>Ordering &amp; delivery' + ic('plus') + '</summary><div class="acc-b"><p>Sold per ' + esc(p.unit) + (p.moq > 1 ? ', minimum order ' + p.moq + ' ' + esc(p.unit) : '') + '. ' + (p.price ? 'Prices exclude GST' + (s.gstPct ? ' (' + s.gstPct + '% added at checkout)' : '') + '.' : 'Price is confirmed with your quote.') + '</p>' +
      '<p>Freight: ' + esc(+s.shipFee ? money(s.shipFee) + (+s.freeShipAbove ? ', free above ' + money(s.freeShipAbove) : '') : (s.freightNote || 'confirmed with your quote')) + '.' + (s.dispatch ? ' Usual dispatch: ' + esc(s.dispatch) + '.' : '') + '</p>' +
      '<p>Payment options: ' + s.payments.filter(function (k) { return PAYMENTS[k]; }).map(function (k) { return PAYMENTS[k][0]; }).join(', ') + '.</p></div></details></div>';
  return '<div class="wrap" id="pdp-wrap">' + pdpHtml(p, cat, accs) + '</div>' +
    (related.length ? rowHtml('You may also need', null, related, cat ? '/category/' + cat.id : '/products', 'rowr') : '');
};
function pdpHtml(p, cat, accs) {
  var col = p.colors[pdp.ci] || p.colors[0], gal = col.imgs.length ? col.imgs : [''];
  var sizes = sizeList(p), showSizes = !(sizes.length === 1 && sizes[0] === 'Standard');
  var max = pdp.size ? maxQty(p, pdp.size) : 100000;
  var off = p.mrp > p.price && p.price ? Math.round((p.mrp - p.price) / p.mrp * 100) : 0;
  return '<nav class="crumbs" aria-label="Breadcrumb" style="padding-top:18px"><a href="/">Home</a><span>/</span>' + (cat ? '<a href="/category/' + esc(cat.id) + '">' + esc(cat.name) + '</a><span>/</span>' : '') + '<span>' + esc(p.name) + '</span></nav>' +
    '<div class="pdp" id="pdp"><div class="gal' + (gal.length > 1 ? '' : ' one') + '">' +
      (gal.length > 1 ? '<div class="thumbs">' + gal.map(function (src, i) { return '<button class="' + (i === pdp.img ? 'on' : '') + '" data-act="pimg" data-i="' + i + '" aria-label="Photo ' + (i + 1) + '">' + imgTag(src, '', p.art, col.hex, { w: 152, h: 152 }) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="gal-main" id="galmain">' + (gal[pdp.img] ? imgTag(gal[pdp.img], p.name + ' — ' + col.name, p.art, col.hex, { eager: true, w: 1000, h: 1000 }) : R.art(p.art, col.hex)) +
      '<button class="save' + (isSaved(p.id) ? ' on' : '') + '" data-act="save" data-id="' + esc(p.id) + '" aria-pressed="' + isSaved(p.id) + '" aria-label="Save product" style="top:14px;right:14px">' + ic('heart') + '</button></div></div>' +
    '<div class="buy"><div>' + badgeHtml(p) + '<h1 style="margin-top:' + (badgeHtml(p) ? '10px' : '0') + '">' + esc(p.name) + '</h1><div class="sub">' + (p.sub ? '<span>' + esc(p.sub) + '</span>' : '') + (p.code ? '<span>Code: ' + esc(p.code) + '</span>' : '') + '<span>Sold per ' + esc(p.unit) + '</span></div>' +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : '') + '</div>' +
      '<div class="pblock">' + (p.price ? '<span class="price">' + money(p.price) + ' <small>/ ' + esc(p.unit) + '</small>' + (off ? '<s>' + money(p.mrp) + '</s><span class="off">' + off + '% off</span>' : '') + '</span><span class="note-t">' + (state.store.gstPct ? 'Plus ' + state.store.gstPct + '% GST.' : 'GST as applicable.') + ' Bulk rates on request.</span>'
        : '<span class="price req">Price on request</span><span class="note-t">Add it to your basket and our team sends the price with your quote.</span>') + '</div>' +
      (p.colors.length > 1 || p.colors[0].name !== 'Standard' ? '<div><div class="opt-h"><b>Colour: <span style="font-weight:600">' + esc(col.name) + '</span></b><span>' + plural(p.colors.length, 'colour') + '</span></div><div class="swatches">' + p.colors.map(function (c, i) {
        return '<button class="sw' + (i === pdp.ci ? ' on' : '') + '" style="--c:' + c.hex + '" data-act="pcol" data-i="' + i + '" aria-label="' + esc(c.name) + '" aria-pressed="' + (i === pdp.ci) + '" title="' + esc(c.name) + '"></button>';
      }).join('') + '</div></div>' : '') +
      (showSizes ? '<div><div class="opt-h"><b>Size' + (pdp.size ? ': <span style="font-weight:600">' + esc(pdp.size) + '</span>' : '') + '</b>' + (hasSizeGuide(p) ? '<button class="link" data-act="sizeguide" type="button">' + ic('ruler', 16) + 'Size guide</button>' : '<a href="/contact?topic=Custom%20product&product=' + encodeURIComponent(p.name + ' — custom size') + '">Need a custom size?</a>') + '</div><div class="chips" role="group" aria-label="Size">' + sizes.map(function (z) {
        var ok = available(p, z), left = p.track ? p.sizes[z] : null;
        return '<button class="chip' + (pdp.size === z ? ' on' : '') + (ok ? '' : ' out') + '" data-act="psize" data-v="' + esc(z) + '" aria-pressed="' + (pdp.size === z) + '"' + (ok ? '' : ' disabled') + '>' + esc(z) + (p.track && ok && left <= 10 ? '<small>' + left + ' left</small>' : '') + '</button>';
      }).join('') + '</div></div>' : '') +
      (p.emb ? '<div class="embbox"><label class="check"><input type="checkbox" id="embon"' + (pdp.embOn ? ' checked' : '') + '> <b>Add embroidery</b> <span class="muted small">— hospital or staff name, charged with your quote</span></label>' +
        '<div class="embfld"' + (pdp.embOn ? '' : ' hidden') + '><input class="inp" id="embtxt" maxlength="40" placeholder="e.g. CITY CARE HOSPITAL" value="' + esc(pdp.emb || '') + '" aria-label="Embroidery text"><span class="small muted">Up to 40 characters. For a logo, send the artwork on WhatsApp after ordering.</span></div></div>' : '') +
      '<div><div class="opt-h"><b>Quantity</b><span>' + (p.moq > 1 ? 'Minimum order ' + p.moq + ' ' + esc(p.unit) : esc(p.unit)) + '</span></div>' +
        '<div class="buy-row"><div class="qty"><button data-act="pqty" data-d="-1" aria-label="Fewer">' + ic('minus') + '</button><input id="pqty" inputmode="numeric" value="' + pdp.qty + '" aria-label="Quantity" data-min="' + p.moq + '" data-max="' + max + '"><button data-act="pqty" data-d="1" aria-label="More">' + ic('plus') + '</button></div>' +
        '<button class="btn btn-primary btn-lg" data-act="padd"' + (available(p) ? '' : ' disabled') + '>' + ic('basket') + (available(p) ? 'Add to quote basket' : 'Out of stock') + '</button></div></div>' +
      '<div class="buy-row2"><button class="btn btn-outline btn-lg" data-act="pnow"' + (available(p) ? '' : ' disabled') + '>Request quote now</button>' +
        (waNumber() ? '<a class="btn btn-lg" href="' + esc(waLink('Hello ' + state.brand.name + ', I’d like details for ' + p.name + (p.code ? ' (' + p.code + ')' : '') + ': ' + location.origin + '/product/' + p.id)) + '" target="_blank" rel="noopener">' + ic('wa') + 'Ask on WhatsApp</a>' : '<a class="btn btn-lg" href="/contact?product=' + encodeURIComponent(p.name) + '">Ask a question</a>') + '</div>' +
      '<div class="ptrust"><div>' + ic('shield') + 'Inspected before dispatch</div><div>' + ic('needle') + 'Custom colours &amp; logo</div><div>' + ic('truck') + 'Supply across India</div></div>' +
      (accs || '') +
    '</div></div>';
}
function hasSizeGuide(p) { return !!(p.sizeImgs.length || p.sizeNote.trim()); }
function sizeGuideHtml(p) {
  return (p.sizeNote ? '<div class="prose">' + p.sizeNote.split(/\n\s*\n/).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' : '') +
    (p.sizeImgs.length ? '<div class="sg-imgs">' + p.sizeImgs.map(function (u, i) { var src = absUrl(u) || u; return '<a href="' + esc(src) + '" target="_blank" rel="noopener" data-ext="1" aria-label="Open size chart ' + (i + 1) + ' full size"><img src="' + esc(src) + '" alt="Size chart ' + (i + 1) + ' for ' + esc(p.name) + '" loading="lazy" decoding="async"></a>'; }).join('') + '</div>' : '') +
    '<p class="small muted" style="margin-top:12px">Between sizes or need something different? <a href="/contact?topic=Custom%20product&product=' + encodeURIComponent(p.name + ' — custom size') + '">Ask for a custom size</a>.</p>';
}
A.sizeguide = function () {
  var p = find(pdp.id); if (!p) return;
  modal('<div class="mbox wide" role="dialog" aria-modal="true" aria-labelledby="sgT"><div class="mhead"><h3 id="sgT">Size guide — ' + esc(p.name) + '</h3><button class="icon-btn" data-act="mclose" aria-label="Close">' + ic('x') + '</button></div><div class="mbody">' + sizeGuideHtml(p) + '</div></div>');
};
function stickyBuy(p) {
  var el = $('#sticky'); if (!el) return;
  el.innerHTML = p ? '<div class="sticky-buy"><div style="min-width:0"><b class="small" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</b>' + priceHtml(p) + '</div><button class="btn btn-primary" data-act="padd"' + (available(p) ? '' : ' disabled') + '>' + ic('basket') + 'Add</button></div>' : '';
}
var lastAccs = '';
function rerenderPDP() {
  var p = find(pdp.id), w = $('#pdp-wrap'); if (!p || !w) return;
  var open = $$('.pacc details').map(function (d) { return d.open; });
  var accs = $('.pacc') ? $('.pacc').outerHTML : lastAccs; lastAccs = accs;
  var y = scrollY; w.innerHTML = pdpHtml(p, catOf(p.cat), accs); scrollTo(0, y);
  $$('.pacc details').forEach(function (d, i) { if (open[i] != null) d.open = open[i]; });
  stickyBuy(p); bindPdp();
}
function bindPdp() {
  var g = $('#galmain');
  if (g && matchMedia('(hover:hover)').matches && !reduced) {
    g.addEventListener('pointermove', function (e) { var r = g.getBoundingClientRect(); g.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); g.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); });
    g.addEventListener('pointerenter', function () { if (g.querySelector('img')) g.classList.add('zoom'); });
    g.addEventListener('pointerleave', function () { g.classList.remove('zoom'); });
  }
  var q = $('#pqty'); if (q) q.addEventListener('change', function () { pdp.qty = clampQty(q.value, +q.dataset.min, +q.dataset.max); q.value = pdp.qty; });
}
function clampQty(v, min, max) { v = parseInt(v, 10); if (!isFinite(v)) v = min; return Math.max(min, Math.min(max || 100000, v)); }
after.product = function () { bindPdp(); };
A.pcol = function (el) { pdp.ci = +el.dataset.i; pdp.img = 0; rerenderPDP(); var u = new URL(location.href); u.searchParams.set('c', pdp.ci); history.replaceState(history.state, '', u.pathname + u.search); };
A.psize = function (el) { pdp.size = el.dataset.v; var p = find(pdp.id); pdp.qty = clampQty(pdp.qty, p.moq, maxQty(p, pdp.size)); rerenderPDP(); };
A.pimg = function (el) { pdp.img = +el.dataset.i; rerenderPDP(); };
A.pqty = function (el) { var q = $('#pqty'); var p = find(pdp.id); var step = p.moq >= 10 ? Math.max(1, Math.round(p.moq / 2)) : 1; pdp.qty = clampQty((parseInt(q.value, 10) || p.moq) + (+el.dataset.d) * step, p.moq, pdp.size ? maxQty(p, pdp.size) : 100000); q.value = pdp.qty; };
function needSize() {
  var p = find(pdp.id); if (pdp.size) return false;
  toast('Choose a size first.'); var c = $('.chips'); if (c) { c.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); if (c.animate) c.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 }); }
  return !!p;
}
function embText() {
  if (!pdp.embOn) return '';
  var t = ($('#embtxt') && $('#embtxt').value || '').trim();
  if (!t) { toast('Type the embroidery text, or untick embroidery.'); var i = $('#embtxt'); if (i) i.focus(); return null; }
  return t;
}
A.padd = function () {
  var q = $('#pqty'); if (q) pdp.qty = clampQty(q.value, +q.dataset.min, +q.dataset.max);
  if (needSize()) return;
  var emb = embText(); if (emb === null) return;
  if (addToCart(pdp.id, pdp.ci, pdp.size, pdp.qty, emb)) openDrawer(true);
};
A.pnow = function () {
  var q = $('#pqty'); if (q) pdp.qty = clampQty(q.value, +q.dataset.min, +q.dataset.max);
  if (needSize()) return;
  var emb = embText(); if (emb === null) return;
  if (addToCart(pdp.id, pdp.ci, pdp.size, pdp.qty, emb)) go('/cart?checkout=1');
};
document.addEventListener('change', function (e) {
  if (e.target.id === 'embon') { pdp.embOn = e.target.checked; var f = $('.embfld'); if (f) f.hidden = !pdp.embOn; if (pdp.embOn) { var i = $('#embtxt'); if (i) i.focus(); } }
});
document.addEventListener('input', function (e) { if (e.target.id === 'embtxt') pdp.emb = e.target.value; });

/* ---------- saved ---------- */
pages.saved = function () {
  setTitle('Saved products — ' + state.brand.name);
  var items = saved.map(find).filter(function (p) { return p && !p.hidden; });
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Saved</span></nav><h1 class="d2">Saved products</h1><p class="lede">' + (items.length ? plural(items.length, 'product') + ' saved in this browser.' : 'Tap the heart on any product to keep it here while you compare.') + '</p></div></section>' +
    '<section class="wrap" style="padding-block:32px 80px">' + (items.length ? '<div class="grid">' + items.map(tile).join('') + '</div>' : '<div class="empty">' + R.art('scrub', '#8FB3CC') + '<h2>Nothing saved yet</h2><a class="btn btn-primary" href="/products">Browse products</a></div>') + '</section>';
};

/* ---------- about ---------- */
pages.about = function () {
  var a = state.about, b = state.brand;
  setTitle('About us — ' + b.name, a.body.slice(0, 160));
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>About us</span></nav><h1 class="d1" style="max-width:18ch">' + esc(a.title) + '</h1></div></section>' +
    '<section class="sec"><div class="wrap about-grid"><div class="prose" style="font-size:1.05rem">' + a.body.split(/\n\s*\n/).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '</div>' +
    '<div class="mv">' + (a.mission ? '<div><h3>Our mission</h3><p>' + esc(a.mission) + '</p></div>' : '') + (a.vision ? '<div><h3>Our vision</h3><p>' + esc(a.vision) + '</p></div>' : '') + '</div></div></section>' +
    '<section class="sec tight"><div class="wrap"><div class="sec-h"><h2 class="d2">Why hospitals work with us</h2></div><div class="vals">' + TRUST.map(function (t) { return '<div><span class="vi">' + ic(t[0]) + '</span><b>' + t[1] + '</b><p>' + t[2] + '</p></div>'; }).join('') + '</div></div></section>' +
    '<section class="sec tight"><div class="wrap"><div class="bulk"><div class="bulk-t"><h2 class="d2">Visit or call the factory</h2><p class="lede">' + esc(state.store.address) + '</p><div class="acts"><a class="btn btn-lg btn-on" href="/contact">Contact us</a>' + (state.store.mapUrl ? '<a class="btn btn-lg btn-line" href="' + esc(state.store.mapUrl) + '" target="_blank" rel="noopener">' + ic('pin', 18) + 'Get directions</a>' : '') + '</div></div>' +
    '<ul class="bulk-l">' + (state.store.phone ? '<li>' + ic('phone') + '<a href="' + telHref(state.store.phone) + '" style="color:inherit">' + esc(state.store.phone) + '</a></li>' : '') + (state.store.email ? '<li>' + ic('mail') + '<a href="mailto:' + esc(state.store.email) + '" style="color:inherit">' + esc(state.store.email) + '</a></li>' : '') + '<li>' + ic('globe') + 'Domestic supply and export</li></ul></div></div></section>';
};

/* ---------- contact, bulk order & enquiries ---------- */
var TOPICS = ['Bulk quote', 'Custom product', 'Export enquiry', 'Distributor / dealer', 'Order status', 'Something else'];
function contactWays() {
  var s = state.store, ways = [];
  if (s.phone) ways.push(['phone', s.phone, 'Call our sales team', telHref(s.phone)]);
  if (waNumber()) ways.push(['wa', '+' + waNumber(), 'WhatsApp — quickest reply', waLink('Hello ' + state.brand.name + ', I have an enquiry.')]);
  if (s.email) ways.push(['mail', s.email, 'Email', 'mailto:' + s.email]);
  if (s.address) ways.push(['pin', s.address, 'Factory & office', s.mapUrl || '']);
  if (s.hours) ways.push(['clock', s.hours, 'Working hours', '']);
  return '<div class="cways">' + ways.map(function (w) {
    return '<div class="cway"><span class="ci">' + ic(w[0]) + '</span><div style="min-width:0"><b>' + esc(w[1]) + '</b><span>' + esc(w[2]) + '</span></div>' +
      '<div style="display:flex">' + (w[3] ? '<a class="icon-btn" href="' + esc(w[3]) + '"' + (/^https/.test(w[3]) ? ' target="_blank" rel="noopener"' : '') + ' aria-label="Open">' + ic('arrow') + '</a>' : '') + '<button class="icon-btn" data-act="copy" data-copy="' + esc(w[1]) + '" aria-label="Copy">' + ic('copy') + '</button></div></div>';
  }).join('') + '</div>';
}
pages.contact = function (params, q) {
  var s = state.store; setTitle('Contact us — ' + state.brand.name, 'Call ' + s.phone + ' or send an enquiry.');
  var topic = TOPICS.indexOf(q.topic) > -1 ? q.topic : TOPICS[0];
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Contact</span></nav><h1 class="d1">Contact us</h1><p class="lede">Bulk quotes, custom products, export and distributor enquiries. Send the form and it reaches our team straight away.</p></div></section>' +
    '<div class="wrap contact-grid"><div>' + contactWays() +
      (state.faq.length ? '<h2 class="d3" style="margin:36px 0 8px">Common questions</h2><div class="acc">' + faqHtml(state.faq) + '</div>' : '') + '</div>' +
    '<div class="panel" id="enq"><h2>Send an enquiry</h2><p class="muted">We reply on the phone number or email you give.</p>' + enquiryForm(topic, q.product || '') + '</div></div>';
};
pages.bulk = function (params, q) {
  setTitle('Bulk orders for hospitals — ' + state.brand.name, 'Request a bulk quote for scrubs, linen, drapes, procedure packs and more.');
  var cats = state.cats.filter(function (c) { return vis().some(function (p) { return p.cat === c.id; }); });
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Bulk order</span></nav><h1 class="d1" style="max-width:20ch">Bulk orders for hospitals, clinics and distributors</h1><p class="lede">Tell us what you need — products, quantities, sizes and colours — and our team sends a quote with prices, freight and dispatch date.</p></div></section>' +
    '<div class="wrap contact-grid"><div><div class="vals" style="grid-template-columns:1fr 1fr">' +
      [['palette', 'Department colours', 'Colour-code wards, OT and ICU staff.'], ['needle', 'Logo embroidery', 'Your hospital’s name on every garment.'], ['ruler', 'Custom sizes', 'Linen and mattresses cut to your beds.'], ['box', 'Custom packs', 'Procedure packs built to your protocol.']]
        .map(function (t) { return '<div><span class="vi">' + ic(t[0]) + '</span><b>' + t[1] + '</b><p>' + t[2] + '</p></div>'; }).join('') + '</div>' +
      '<h2 class="d3" style="margin:32px 0 12px">Or build your list from the catalogue</h2><div class="cways">' + cats.map(function (c) { return '<a class="cway" style="text-decoration:none" href="/category/' + esc(c.id) + '"><span class="ci" style="overflow:hidden">' + catPic(c, 88) + '</span><div><b>' + esc(c.name) + '</b><span>' + plural(vis().filter(function (p) { return p.cat === c.id; }).length, 'product') + '</span></div>' + ic('arrow') + '</a>'; }).join('') + '</div></div>' +
    '<div class="panel" id="enq"><h2>Request a bulk quote</h2><p class="muted">Usually the fastest way to price a large or mixed order.</p>' + enquiryForm('Bulk quote', q.product || '') + '</div></div>';
};
function enquiryForm(topic, product) {
  var c = LS.get('rk:me', {});
  return '<form class="form" id="enqform" novalidate>' +
    field('Your name', 'name', { req: true, ac: 'name', v: c.name }) + field('Hospital / company', 'org', { ac: 'organization', v: c.org, opt: true }) +
    field('Mobile number', 'phone', { req: true, type: 'tel', ac: 'tel', im: 'tel', v: c.phone }) + field('Email', 'email', { type: 'email', ac: 'email', v: c.email, opt: true }) +
    field('Topic', 'topic', { opts: TOPICS, v: topic }) + field('City', 'city', { ac: 'address-level2', v: c.city, opt: true }) +
    field('Products', 'product', { v: product, full: true, opt: true, ph: 'e.g. Scrub Suit — Classic, Cesarean Pack' }) +
    field('Message', 'message', { rows: 5, req: true, full: true, ph: 'Quantities, sizes, colours, delivery city, timeline…' }) +
    '<p class="err-msg full" id="enqerr" role="alert"></p><div class="full"><button class="btn btn-primary btn-lg btn-block" type="submit">Send enquiry</button></div></form>';
}
function bindEnquiry() {
  var f = $('#enqform'); if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = formData(f), btn = f.querySelector('[type=submit]'), err = $('#enqerr'); err.textContent = '';
    var miss = {}; if ((d.name || '').trim().length < 2) miss.name = 'Add your name'; if (!/^[6-9]\d{9}$/.test(digits(d.phone).replace(/^(91|0)(?=\d{10}$)/, ''))) miss.phone = 'Enter a valid 10-digit mobile number'; if ((d.message || '').trim().length < 5) miss.message = 'Tell us what you need';
    if (Object.keys(miss).length) { fldErr(f, miss); return; }
    LS.set('rk:me', Object.assign(LS.get('rk:me', {}), { name: d.name, org: d.org, phone: d.phone, email: d.email, city: d.city }));
    btn.classList.add('busy');
    var waText = 'Hello ' + state.brand.name + ',\n\n*' + d.topic + '*' + (d.product ? ' — ' + d.product : '') + '\n' + d.message + '\n\n' + d.name + (d.org ? ', ' + d.org : '') + (d.city ? ', ' + d.city : '') + '\n' + d.phone + (d.email ? '\n' + d.email : '');
    apiFetch('/enquiries', { method: 'POST', body: d }).then(function (r) {
      $('#enq').innerHTML = '<div class="done" style="padding:20px 0"><span class="tick">' + ic('check') + '</span><h2 class="d3">Enquiry sent</h2><p class="muted">Reference <b>' + esc(r.ref) + '</b>. Our team will contact you on ' + esc(d.phone) + '.</p>' +
        (waNumber() ? '<a class="btn btn-wa" href="' + esc(waLink(waText + '\nRef: ' + r.ref)) + '" target="_blank" rel="noopener">' + ic('wa') + 'Also send on WhatsApp</a>' : '') + '<a class="btn" href="/products">Keep browsing</a></div>';
    }).catch(function (e2) {
      btn.classList.remove('busy');
      if (e2.status === 400 && e2.data.fields) { fldErr(f, e2.data.fields); err.textContent = e2.message; return; }
      if (e2.status === 0 && waNumber()) { err.innerHTML = esc(e2.message) + ' <a href="' + esc(waLink(waText)) + '" target="_blank" rel="noopener">Send it on WhatsApp instead</a>.'; return; }
      err.textContent = e2.message;
    });
  });
}
after.contact = bindEnquiry; after.bulk = bindEnquiry;
A.copy = function (el) { copyText(el.dataset.copy).then(function (ok) { toast(ok ? 'Copied.' : 'Couldn’t copy. Select the text instead.'); }); };

/* ---------- track order ---------- */
var T_STEPS = [['new', 'Request received'], ['confirmed', 'Confirmed'], ['shipped', 'Dispatched'], ['delivered', 'Delivered']];
pages.track = function (params, q) {
  setTitle('Track your order — ' + state.brand.name);
  var me = LS.get('rk:me', {});
  var ref = q.ref || (lastOrder && lastOrder.saved ? lastOrder.ref : '');
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Track order</span></nav><h1 class="d1">Track your order</h1><p class="lede">Enter the reference from your WhatsApp message and the mobile number you used.</p></div></section>' +
    '<div class="wrap contact-grid"><div class="panel"><form class="form" id="trackform" novalidate>' + field('Order reference', 'ref', { req: true, v: ref, ph: 'RA-XXXXXX' }) + field('Mobile number', 'phone', { req: true, type: 'tel', im: 'tel', v: me.phone || '' }) +
      '<p class="err-msg full" id="trerr" role="alert"></p><div class="full"><button class="btn btn-primary btn-lg btn-block" type="submit">Track order</button></div></form><div id="trout"></div></div>' +
    '<div><h2 class="d3" style="margin-bottom:12px">Need help with an order?</h2>' + contactWays() + '</div></div>';
};
after.track = function (params, q) {
  var f = $('#trackform'); if (!f) return;
  var run = function () {
    var d = formData(f), err = $('#trerr'), btn = f.querySelector('[type=submit]'); err.textContent = '';
    if (!/^[A-Za-z]{2}-[A-Za-z0-9]{4,8}$/.test((d.ref || '').trim())) { fldErr(f, { ref: 'References look like RA-XXXXXX' }); return; }
    btn.classList.add('busy');
    apiFetch('/track?ref=' + encodeURIComponent(d.ref.trim()) + '&phone=' + encodeURIComponent(d.phone)).then(function (o) {
      btn.classList.remove('busy');
      var at = {}; (o.history || []).forEach(function (h) { at[h.status] = h.at; });
      var cancelled = o.status === 'cancelled', idx = T_STEPS.map(function (x) { return x[0]; }).indexOf(o.status);
      var fmt = function (t) { var dt = new Date(t); return isNaN(dt) ? '' : dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
      $('#trout').innerHTML = '<div style="margin-top:24px;border-top:1px solid var(--line);padding-top:20px"><h3>' + (o.quote ? 'Quote request ' : 'Order ') + esc(o.ref) + '</h3><p class="small muted">' + plural(o.items.length, 'item') + (o.city ? ' · delivery to ' + esc(o.city) : '') + (o.subtotal ? ' · ' + money(o.total) : '') + '</p>' +
        (cancelled ? '<p class="note warn" style="margin-top:14px">This order was cancelled. Contact us if you think this is a mistake.</p>' :
        '<ol class="timeline">' + T_STEPS.map(function (s, i) { return '<li class="' + (i <= idx ? 'done' : '') + '"><span class="dot">' + ic(i <= idx ? 'check' : 'clock') + '</span><span><b>' + s[1] + '</b><span>' + (at[s[0]] ? fmt(at[s[0]]) : i <= idx ? '' : 'Pending') + '</span></span></li>'; }).join('') + '</ol>') +
        '<ul class="small muted" style="padding-left:18px;margin:10px 0 0">' + o.items.map(function (it) { return '<li>' + esc(it.name) + ' · ' + esc([it.color !== 'Standard' ? it.color : '', it.size !== 'Standard' ? it.size : ''].filter(Boolean).join(' · ')) + ' × ' + it.qty + ' ' + esc(it.unit || '') + '</li>'; }).join('') + '</ul></div>';
    }).catch(function (e2) { btn.classList.remove('busy'); err.textContent = e2.message; });
  };
  f.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  if (q.ref && $('#f-phone').value) run();
};

/* ---------- legal ---------- */
function legalPage(kind) {
  var title = kind === 'privacy' ? 'Privacy policy' : 'Terms of sale', text = (state.legal && state.legal[kind]) || '';
  setTitle(title + ' — ' + state.brand.name);
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>' + title + '</span></nav><h1 class="d1">' + title + '</h1></div></section>' +
    '<section class="sec"><div class="wrap"><div class="prose" style="font-size:1.02rem">' + (text ? text.split(/\n\s*\n/).map(function (x) { var m = /^([^.]{3,60}\.)\s+([\s\S]+)$/.exec(x); return m ? '<h2>' + esc(m[1].replace(/\.$/, '')) + '</h2><p>' + esc(m[2]) + '</p>' : '<p>' + esc(x) + '</p>'; }).join('') : '<p>This page hasn’t been written yet.</p>') + '</div></div></section>';
}
pages.privacy = function () { return legalPage('privacy'); };
pages.terms = function () { return legalPage('terms'); };

/* ---------- departments ---------- */
pages.department = function (params, q) {
  var d = deptOf(params.id); if (!d) return pages.notfound();
  setTitle(d.name + ' supplies — ' + state.brand.name, d.blurb);
  var all = deptMatches(d), cats = [];
  all.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
  var list = q.cat ? all.filter(function (p) { return p.cat === q.cat; }) : all;
  var kits = state.kits.filter(function (k) { return k.items.some(function (it) { return all.some(function (p) { return p.id === it.id; }); }); }).slice(0, 2);
  return '<section class="phead band"><div class="wrap dhead"><span class="di big">' + dic(d.icon, 30) + '</span><div><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Departments</span><span>/</span><span>' + esc(d.name) + '</span></nav><h1 class="d1">' + esc(d.name) + '</h1><p class="lede">' + esc(d.blurb) + '</p></div></div></section>' +
    '<section class="wrap" style="padding-block:24px 0"><div class="subchips"><a class="fchip' + (!q.cat ? ' on' : '') + '" href="/department/' + esc(d.id) + '" data-keep="1">All ' + all.length + '</a>' +
      cats.map(function (c) { return '<a class="fchip' + (q.cat === c ? ' on' : '') + '" href="/department/' + esc(d.id) + '?cat=' + esc(c) + '" data-keep="1">' + esc(catName(c)) + ' ' + all.filter(function (p) { return p.cat === c; }).length + '</a>'; }).join('') + '</div>' +
      (list.length ? '<div class="grid">' + list.map(tile).join('') + '</div>' : '<p class="muted">No products here yet.</p>') + '</section>' +
    (kits.length ? '<section class="sec"><div class="wrap"><div class="sec-h"><h2 class="d2">Kits for this department</h2><a class="more" href="/kits">All kits</a></div><div class="kits">' + kits.map(kitCard).join('') + '</div></div></section>' : '') +
    '<section class="sec tight"><div class="wrap"><div class="note">Setting up ' + esc(d.name.toLowerCase()) + ' for a new hospital? <a href="/bulk-order">Ask for a full department quote</a> — we’ll list everything with quantities.</div></div></section>';
};
after.department = function () { $$('[data-keep]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); go(a.getAttribute('href'), { replace: true, keep: true }); }); }); };

/* ---------- starter kits ---------- */
function kitItems(k) { return k.items.map(function (it) { var p = find(it.id); return p && !p.hidden ? { p: p, qty: Math.max(p.moq, it.qty) } : null; }).filter(Boolean); }
function kitNeedsSize(k) { return kitItems(k).some(function (x) { return sizeList(x.p).length > 1; }); }
function kitCard(k) {
  var items = kitItems(k); if (!items.length) return '';
  var sizes = []; items.forEach(function (x) { if (sizeList(x.p).length > 1) sizeList(x.p).forEach(function (z) { if (sizes.indexOf(z) < 0) sizes.push(z); }); });
  return '<article class="kit"><div class="kit-pics" style="grid-template-columns:repeat(' + Math.min(4, items.length) + ',1fr)">' + items.slice(0, 4).map(function (x) { return '<span>' + media(x.p, 0, 0, { w: 160, h: 160 }) + '</span>'; }).join('') + '</div>' +
    '<div class="kit-b"><span class="kit-for">' + ic('kit', 16) + esc(k.for || 'Starter kit') + '</span><h3>' + esc(k.name) + '</h3><p class="muted">' + esc(k.blurb) + '</p>' +
    '<ul>' + items.map(function (x) { return '<li><a href="/product/' + esc(x.p.id) + '">' + esc(x.p.name) + '</a><span>' + x.qty + ' ' + esc(x.p.unit) + '</span></li>'; }).join('') + '</ul>' +
    '<div class="kit-act">' + (sizes.length ? '<label class="small"><span class="sr">Size for apparel</span><select class="inp" data-kitsize="' + esc(k.id) + '" style="min-height:44px;width:auto">' + sizes.map(function (z) { return '<option' + (z === 'M' ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select></label>' : '') +
    '<label class="small kit-n">× <input class="inp" data-kitn="' + esc(k.id) + '" inputmode="numeric" value="1" aria-label="How many kits" style="min-height:44px;width:64px;text-align:center"></label>' +
    '<button class="btn btn-primary" data-act="kitadd" data-id="' + esc(k.id) + '">' + ic('basket', 18) + 'Add kit to basket</button></div></div></article>';
}
A.kitadd = function (el) {
  var k = state.kits.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!k) return;
  var card = el.closest('.kit'), sz = card && card.querySelector('[data-kitsize]'), nIn = card && card.querySelector('[data-kitn]');
  var n = Math.max(1, Math.min(1000, parseInt(nIn && nIn.value, 10) || 1)), added = 0;
  kitItems(k).forEach(function (x) {
    var sizes = sizeList(x.p), size = sizes.length === 1 ? sizes[0] : (sz && sizes.indexOf(sz.value) > -1 ? sz.value : (sizes.indexOf('M') > -1 ? 'M' : sizes[0]));
    if (available(x.p, size) && addToCart(x.p.id, 0, size, x.qty * n)) added++;
  });
  if (added) openDrawer(true); else toast('This kit’s products are not available right now.');
};
pages.kits = function () {
  setTitle('Hospital starter kits — ' + state.brand.name, 'Ready-made product kits for wards, theatres and staff uniforms.');
  return '<section class="phead band"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Starter kits</span></nav><h1 class="d1">Hospital starter kits</h1><p class="lede">Opening a new ward, theatre or labour room, or kitting out new staff? Start from one of these lists — every quantity can be changed in the basket, and our team checks the full list with you before quoting.</p></div></section>' +
    '<section class="sec"><div class="wrap kits">' + state.kits.map(kitCard).join('') + '</div></section>' +
    '<section class="sec tight"><div class="wrap"><div class="note">Need a kit built around your own protocol? <a href="/contact?topic=Custom%20product&product=Custom%20kit">Tell us what goes in it</a>.</div></div></section>';
};

pages.notfound = function () {
  setTitle('Page not found — ' + state.brand.name);
  return '<section class="wrap"><div class="empty" style="padding-block:90px">' + R.art('drape', '#8FB3CC') + '<h1 class="d2">This page isn’t here</h1><p class="muted">The link may be old, or the product may have been taken down.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-primary" href="/products">See all products</a><button class="btn" data-act="search">Search</button></div></div></section>';
};
