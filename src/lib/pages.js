'use strict';
/*
 * Server-rendered HTML:
 *  - every storefront URL (/, /products, /category/x, /product/x, /about, /contact…) gets its own
 *    <title>, description, canonical link, Open Graph tags, JSON-LD and a plain-HTML copy of the
 *    page content, so search engines and link previews see real content before any JavaScript runs;
 *  - the order page shown as a WhatsApp link preview;
 *  - sitemap.xml and robots.txt.
 */

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function money(n) {
  return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
}

function absolute(url, base) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return base + url;
  return '';
}

function jsonScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const PAYMENT_LABEL = { COD: 'Cash on delivery', UPI: 'UPI', NEFT: 'Bank transfer (NEFT/RTGS)', CREDIT: 'Credit terms' };

/*
 * WhatsApp reads the og:image tag of the first link in a message and shows it
 * as a picture, so this page is what makes the order photo appear in the chat.
 */
function orderPage(order, base, brandName) {
  const first = order.items[0] || {};
  const more = order.items.length > 1 ? ' + ' + (order.items.length - 1) + ' more' : '';
  const kind = order.quote ? 'Quote request ' : 'Order ';
  const title = kind + order.ref + ' — ' + first.name + more;
  const desc = order.items.length + ' item' + (order.items.length > 1 ? 's' : '') + ' · ' +
    (order.quote ? 'Price to be confirmed' : 'Total ' + money(order.total)) + ' · ' + (PAYMENT_LABEL[order.payment] || order.payment);
  const pageUrl = base + '/o/' + order.token;
  const image = order.cardFileId ? pageUrl + '/card.jpg' : absolute(first.img, base);
  const c = order.customer || {};
  const rows = order.items.map((it) =>
    '<tr><td>' + escHtml(it.name) + '<br><small>' + escHtml(it.color) + ' · ' + escHtml(it.size) + ' · ' + it.qty + ' ' + escHtml(it.unit || 'pc') +
    (it.emb ? '<br>Embroidery: ' + escHtml(it.emb) : '') + '</small></td><td class="r">' + (it.price ? money(it.lineTotal) : 'On request') + '</td></tr>').join('');
  return '<!doctype html><html lang="en-IN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escHtml(title) + '</title>' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="' + escHtml(brandName) + '">' +
    '<meta property="og:title" content="' + escHtml(title) + '">' +
    '<meta property="og:description" content="' + escHtml(desc) + '">' +
    '<meta property="og:url" content="' + escHtml(pageUrl) + '">' +
    (image ? '<meta property="og:image" content="' + escHtml(image) + '">' +
      (order.cardFileId ? '<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1080">' : '') +
      '<meta name="twitter:card" content="summary_large_image">' : '') +
    '<style>' +
    'body{margin:0;background:#F3F6F5;color:#13263A;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    'main{max-width:560px;margin:0 auto;padding:28px 16px 48px}h1{font-size:1.4rem;margin:0 0 4px}p{margin:0 0 16px;color:#4A5D6E}' +
    'img{display:block;width:100%;border-radius:10px;margin:16px 0;border:1px solid #D3DEDB}table{width:100%;border-collapse:collapse;margin:8px 0 16px}' +
    'td{padding:10px 0;border-bottom:1px solid #D3DEDB;vertical-align:top}small{color:#5E7080}.r{text-align:right;white-space:nowrap}' +
    '.t td{border:0;font-weight:700;font-size:1.1rem}a{color:#1F5C52}' +
    '</style></head><body><main>' +
    '<h1>' + escHtml(kind + order.ref) + '</h1><p>' + escHtml(brandName) + ' · ' + escHtml(desc) + '</p>' +
    (c.org ? '<p>For ' + escHtml(c.org) + (c.city ? ', ' + escHtml(c.city) : '') + '</p>' : '') +
    (image ? '<img src="' + escHtml(image) + '" alt="Order summary for ' + escHtml(order.ref) + '">' : '') +
    '<table>' + rows +
    (order.discount ? '<tr><td>Coupon ' + escHtml(order.coupon) + '</td><td class="r">−' + money(order.discount) + '</td></tr>' : '') +
    (order.gst ? '<tr><td>GST ' + escHtml(order.gstPct) + '%</td><td class="r">' + money(order.gst) + '</td></tr>' : '') +
    '<tr><td>Freight</td><td class="r">' + (order.shipping ? money(order.shipping) : 'To be confirmed') + '</td></tr>' +
    '<tr class="t"><td>' + (order.quote ? 'Priced items' : 'Total') + '</td><td class="r">' + money(order.total) + '</td></tr></table>' +
    (order.quote ? '<p>Items marked “On request” are priced by the team on WhatsApp.</p>' : '') +
    '<p><a href="' + escHtml(base + '/') + '">Visit ' + escHtml(brandName) + '</a></p>' +
    '</main></body></html>';
}

function simplePage(title, text) {
  return '<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escHtml(title) + '</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;background:#F3F6F5;color:#13263A;font:16px system-ui,sans-serif;text-align:center;padding:16px}</style></head>' +
    '<body><main><h1>' + escHtml(title) + '</h1><p>' + escHtml(text) + '</p></main></body></html>';
}

const STORE_TAG = '<script type="application/json" id="store-data">null</script>';

/* Puts the live store into the page so it opens with real data and no loading flash. */
function injectStore(html, store) {
  if (!store) return html;
  let out = html.replace(STORE_TAG, () => '<script type="application/json" id="store-data">' + jsonScript(store) + '</script>');
  if (store.brand && store.brand.name) out = out.replace(/<title>[^<]*<\/title>/, () => '<title>' + escHtml(store.brand.name) + '</title>');
  return out;
}

/* ---------- storefront pages ---------- */

const NOINDEX = new Set(['cart', 'saved', 'admin', 'track', 'notfound']);

function clip(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
}

function firstImg(p) {
  for (const c of p.colors || []) if (c.imgs && c.imgs[0] && !String(c.imgs[0]).startsWith('data:')) return c.imgs[0];
  return '';
}

/* Works out which page a path is, and whether it exists. */
function resolveRoute(pathname, store) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  const products = (store && store.products) || [];
  const cats = (store && store.cats) || [];
  let m;
  if (path === '/' || path === '/index.html') return { name: 'home' };
  if (path === '/products') return { name: 'products' };
  if ((m = /^\/category\/([a-z0-9-]{1,40})$/.exec(path))) {
    const cat = cats.find((c) => c.id === m[1]);
    return cat ? { name: 'category', cat } : { name: 'notfound' };
  }
  if ((m = /^\/department\/([a-z0-9-]{1,40})$/.exec(path))) {
    const dept = ((store && store.depts) || []).find((d) => d.id === m[1]);
    return dept ? { name: 'department', dept } : { name: 'notfound' };
  }
  if (path === '/kits') return { name: 'kits' };
  if ((m = /^\/product\/([A-Za-z0-9_-]{2,60})$/.exec(path))) {
    const p = products.find((x) => x.id === m[1] && !x.hidden);
    return p ? { name: 'product', product: p, cat: cats.find((c) => c.id === p.cat) } : { name: 'notfound' };
  }
  const simple = { '/about': 'about', '/contact': 'contact', '/cart': 'cart', '/saved': 'saved', '/admin': 'admin', '/track': 'track', '/bulk-order': 'bulk', '/privacy': 'privacy', '/terms': 'terms' };
  if (simple[path]) return { name: simple[path] };
  return { name: 'notfound' };
}

function productLinks(list) {
  return '<ul>' + list.map((p) => '<li><a href="/product/' + escHtml(p.id) + '">' + escHtml(p.name) + '</a>' +
    (p.desc ? ' — ' + escHtml(p.desc) : '') + '</li>').join('') + '</ul>';
}

/* Builds the head tags and the plain-HTML content for one page. */
function seoFor(route, store, base, pathname) {
  const brand = (store && store.brand) || {};
  const s = (store && store.store) || {};
  const home = (store && store.home) || {};
  const about = (store && store.about) || {};
  const name = brand.name || 'Store';
  const products = ((store && store.products) || []).filter((p) => !p.hidden);
  const cats = (store && store.cats) || [];
  const logo = absolute(brand.logo, base) || base + '/icon-512.png';
  const url = base + (route.name === 'home' ? '/' : String(pathname || '/').replace(/\/+$/, ''));
  let title = name;
  let desc = clip(brand.tagline || home.sub, 160);
  let image = logo;
  let body = '';
  const ld = [];

  const org = {
    '@context': 'https://schema.org', '@type': 'Organization', name, url: base + '/',
    description: brand.tagline || undefined,
    logo: logo || undefined,
    email: s.email || undefined,
    telephone: s.phone || (s.whatsapp ? '+' + s.whatsapp : undefined),
    address: s.address ? { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'IN' } : undefined,
    sameAs: Object.values(s.social || {}).filter(Boolean),
  };
  if (!org.sameAs.length) delete org.sameAs;

  switch (route.name) {
    case 'home':
      title = name + (brand.tagline ? ' — ' + clip(brand.tagline, 70) : '');
      desc = clip(home.sub || brand.tagline, 160);
      ld.push(org, { '@context': 'https://schema.org', '@type': 'WebSite', name, url: base + '/',
        potentialAction: { '@type': 'SearchAction', target: base + '/products?q={query}', 'query-input': 'required name=query' } });
      body = '<h1>' + escHtml(home.headline || name) + '</h1><p>' + escHtml(home.sub || '') + '</p>' +
        '<h2>Product range</h2><ul>' + cats.map((c) => '<li><a href="/category/' + escHtml(c.id) + '">' + escHtml(c.name) + '</a>' +
          (c.blurb ? ' — ' + escHtml(c.blurb) : '') + '</li>').join('') + '</ul>';
      break;
    case 'products':
      title = 'All products — ' + name;
      desc = clip('Browse the full ' + name + ' catalogue: ' + cats.map((c) => c.name).join(', ') + '.', 160);
      body = '<h1>All products</h1>' + productLinks(products);
      break;
    case 'category': {
      const list = products.filter((p) => p.cat === route.cat.id);
      title = route.cat.name + ' — ' + name;
      desc = clip(route.cat.blurb || (route.cat.name + ' from ' + name + ': ' + list.slice(0, 6).map((p) => p.name).join(', ')), 160);
      const img = list.map(firstImg).find(Boolean);
      if (img) image = absolute(img, base);
      ld.push({ '@context': 'https://schema.org', '@type': 'ItemList', name: route.cat.name,
        itemListElement: list.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: base + '/product/' + p.id, name: p.name })) });
      body = '<h1>' + escHtml(route.cat.name) + '</h1><p>' + escHtml(route.cat.blurb || '') + '</p>' + productLinks(list);
      break;
    }
    case 'product': {
      const p = route.product;
      title = p.name + (route.cat ? ' — ' + route.cat.name : '') + ' | ' + name;
      desc = clip(p.desc || p.long || (p.name + ' by ' + name + '.'), 160);
      const imgs = [];
      for (const c of p.colors) for (const u of c.imgs) { const a = absolute(u, base); if (a) imgs.push(a); }
      if (imgs[0]) image = imgs[0];
      const avail = !p.track || Object.values(p.sizes || {}).some((n) => n > 0);
      const prod = {
        '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.long || p.desc || undefined,
        sku: p.code || p.id, brand: { '@type': 'Brand', name }, category: route.cat ? route.cat.name : undefined,
        image: imgs.length ? imgs.slice(0, 6) : undefined, url,
      };
      if (p.price) {
        prod.offers = { '@type': 'Offer', priceCurrency: 'INR', price: p.price, url,
          availability: avail ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', seller: { '@type': 'Organization', name } };
      }
      ld.push(prod, { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
        route.cat ? { '@type': 'ListItem', position: 2, name: route.cat.name, item: base + '/category/' + route.cat.id } : null,
        { '@type': 'ListItem', position: route.cat ? 3 : 2, name: p.name, item: url },
      ].filter(Boolean) });
      body = '<p><a href="/">Home</a> / ' + (route.cat ? '<a href="/category/' + escHtml(route.cat.id) + '">' + escHtml(route.cat.name) + '</a> / ' : '') + escHtml(p.name) + '</p>' +
        '<h1>' + escHtml(p.name) + '</h1><p>' + escHtml(p.long || p.desc || '') + '</p>' +
        (p.price ? '<p>' + money(p.price) + ' per ' + escHtml(p.unit) + '</p>' : '<p>Price on request</p>') +
        (p.specs && p.specs.length ? '<dl>' + p.specs.map((x) => '<dt>' + escHtml(x.k) + '</dt><dd>' + escHtml(x.v) + '</dd>').join('') + '</dl>' : '') +
        '<p>Colours: ' + p.colors.map((c) => escHtml(c.name)).join(', ') + '. Sizes: ' + Object.keys(p.sizes).map(escHtml).join(', ') + '.</p>';
      break;
    }
    case 'about':
      title = 'About us — ' + name;
      desc = clip(about.body || brand.tagline, 160);
      ld.push(org);
      body = '<h1>' + escHtml(about.title || 'About ' + name) + '</h1>' + String(about.body || '').split(/\n\s*\n/).map((x) => '<p>' + escHtml(x) + '</p>').join('') +
        (about.mission ? '<h2>Mission</h2><p>' + escHtml(about.mission) + '</p>' : '') + (about.vision ? '<h2>Vision</h2><p>' + escHtml(about.vision) + '</p>' : '');
      break;
    case 'contact':
      title = 'Contact us — ' + name;
      desc = clip('Call ' + (s.phone || '') + ', email ' + (s.email || '') + ' or visit ' + (s.address || '') + '.', 160);
      ld.push(org);
      if ((store.faq || []).length) {
        ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: store.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
      }
      body = '<h1>Contact ' + escHtml(name) + '</h1><address>' + escHtml(s.address || '') + '<br>' + escHtml(s.phone || '') + '<br>' + escHtml(s.email || '') + '</address>';
      break;
    case 'department': {
      const keys = String(route.dept.keys || '').toLowerCase().split(',').map((k) => k.trim()).filter(Boolean);
      const list = products.filter((p) => keys.some((k) => (p.name + ' ' + (p.sub || '') + ' ' + p.cat).toLowerCase().includes(k)));
      title = route.dept.name + ' supplies — ' + name;
      desc = clip(route.dept.blurb || (route.dept.name + ' products from ' + name), 160);
      body = '<h1>' + escHtml(route.dept.name) + '</h1><p>' + escHtml(route.dept.blurb || '') + '</p>' + productLinks(list);
      break;
    }
    case 'kits':
      title = 'Hospital starter kits — ' + name;
      desc = clip('Ready-made product kits for setting up wards, theatres and staff uniforms: ' + ((store && store.kits) || []).map((k) => k.name).join(', '), 160);
      body = '<h1>Hospital starter kits</h1><ul>' + ((store && store.kits) || []).map((k) => '<li><b>' + escHtml(k.name) + '</b> — ' + escHtml(k.blurb) + '</li>').join('') + '</ul>';
      break;
    case 'bulk':
      title = 'Bulk orders for hospitals — ' + name;
      desc = clip('Request a bulk quote from ' + name + ' for scrubs, linen, drapes, procedure packs and more. Custom colours, sizes and embroidery.', 160);
      body = '<h1>Bulk orders</h1><p>' + escHtml(desc) + '</p>';
      break;
    case 'privacy': case 'terms': {
      const legal = (store && store.legal) || {};
      const text = route.name === 'privacy' ? legal.privacy : legal.terms;
      title = (route.name === 'privacy' ? 'Privacy policy' : 'Terms of sale') + ' — ' + name;
      desc = clip(text || title, 160);
      body = '<h1>' + (route.name === 'privacy' ? 'Privacy policy' : 'Terms of sale') + '</h1>' + String(text || '').split(/\n\s*\n/).map((x) => '<p>' + escHtml(x) + '</p>').join('');
      break;
    }
    case 'track': title = 'Track your order — ' + name; body = '<h1>Track your order</h1>'; break;
    case 'cart': title = 'Quote basket — ' + name; body = '<h1>Quote basket</h1>'; break;
    case 'saved': title = 'Saved products — ' + name; body = '<h1>Saved products</h1>'; break;
    case 'admin': title = 'Admin — ' + name; body = '<h1>Admin</h1>'; break;
    default: title = 'Page not found — ' + name; desc = 'This page does not exist.'; body = '<h1>Page not found</h1><p><a href="/products">See all products</a></p>';
  }

  const robots = NOINDEX.has(route.name) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const head = '<title>' + escHtml(title) + '</title>' +
    '<meta name="description" content="' + escHtml(desc) + '">' +
    '<meta name="robots" content="' + robots + '">' +
    (NOINDEX.has(route.name) ? '' : '<link rel="canonical" href="' + escHtml(url) + '">') +
    '<meta property="og:type" content="' + (route.name === 'product' ? 'product' : 'website') + '">' +
    '<meta property="og:site_name" content="' + escHtml(name) + '">' +
    '<meta property="og:locale" content="en_IN">' +
    '<meta property="og:title" content="' + escHtml(title) + '">' +
    '<meta property="og:description" content="' + escHtml(desc) + '">' +
    '<meta property="og:url" content="' + escHtml(url) + '">' +
    (image ? '<meta property="og:image" content="' + escHtml(image) + '">' : '') +
    '<meta name="twitter:card" content="' + (image ? 'summary_large_image' : 'summary') + '">' +
    ld.map((x) => '<script type="application/ld+json">' + jsonScript(x) + '</script>').join('');

  const nav = '<nav><a href="/">Home</a> <a href="/products">Products</a> ' +
    cats.map((c) => '<a href="/category/' + escHtml(c.id) + '">' + escHtml(c.name) + '</a>').join(' ') +
    ' <a href="/about">About us</a> <a href="/contact">Contact</a></nav>';
  const ssr = '<div class="ssr"><header><a href="/"><b>' + escHtml(name) + '</b></a>' + nav + '</header><main>' + body + '</main>' +
    '<footer><p>' + escHtml(name) + ' · ' + escHtml(s.address || '') + ' · ' + escHtml(s.phone || '') + ' · ' + escHtml(s.email || '') + '</p></footer></div>';
  return { head, ssr, status: route.name === 'notfound' ? 404 : 200 };
}

function renderPage(template, ctx) {
  const store = ctx.store;
  const route = resolveRoute(ctx.pathname, store);
  const seo = seoFor(route, store || {}, ctx.base, ctx.pathname);
  let html = template
    .replace('<!--SEO-->', () => seo.head)
    .replace('<!--SSR-->', () => seo.ssr)
    .replace(/\{\{V\}\}/g, () => ctx.assetV || '1');
  if (store) html = html.replace(STORE_TAG, () => '<script type="application/json" id="store-data">' + jsonScript(store) + '</script>');
  return { html, status: seo.status, route: route.name };
}

function sitemap(store, base) {
  const now = (store && store.updated ? new Date(store.updated) : new Date()).toISOString().slice(0, 10);
  const urls = [['/', '1.0'], ['/products', '0.9'], ['/kits', '0.8'], ['/bulk-order', '0.8'], ['/about', '0.6'], ['/contact', '0.7'], ['/privacy', '0.2'], ['/terms', '0.2']];
  for (const c of (store && store.cats) || []) urls.push(['/category/' + c.id, '0.8']);
  for (const d of (store && store.depts) || []) urls.push(['/department/' + d.id, '0.7']);
  for (const p of (store && store.products) || []) if (!p.hidden) urls.push(['/product/' + p.id, '0.7']);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([u, pr]) => '  <url><loc>' + escHtml(base + u) + '</loc><lastmod>' + now + '</lastmod><priority>' + pr + '</priority></url>').join('\n') +
    '\n</urlset>\n';
}

function robots(base) {
  return 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /saved\nDisallow: /track\nDisallow: /o/\nDisallow: /api/\n\nSitemap: ' + base + '/sitemap.xml\n';
}

module.exports = { escHtml, money, orderPage, simplePage, injectStore, resolveRoute, renderPage, sitemap, robots };
