/* ---------- quote basket, checkout, order photo, WhatsApp ---------- */
function totals() {
  var lines = cartLines(), st = state.store;
  var sub = lines.reduce(function (a, x) { return a + x.p.price * x.l.qty; }, 0);
  var quote = lines.some(function (x) { return !x.p.price; });
  var code = String(SS.get('rk:coupon', '') || '').toUpperCase();
  var off = code && st.coupon && code === String(st.coupon).toUpperCase() && sub > 0 ? Math.round(sub * (+st.couponPct || 0) / 100) : 0;
  var after = sub - off, gst = Math.round(after * (+st.gstPct || 0) / 100), fee = +st.shipFee || 0;
  var ship = !fee || sub === 0 || (+st.freeShipAbove > 0 && after >= +st.freeShipAbove) ? 0 : fee;
  return { lines: lines, sub: sub, off: off, code: off ? code : '', gst: gst, ship: ship, total: after + gst + ship, quote: quote, freeShip: fee > 0 && ship === 0 && sub > 0 };
}
function freightLabel(t, o) {
  var st = state.store;
  if (o ? o.shipping : t.ship) return money(o ? o.shipping : t.ship);
  if (+st.shipFee > 0 && (o ? o.subtotal : t.sub) > 0) return 'Free';
  return st.freightNote || 'Confirmed with your quote';
}
function sumRows(t) {
  var st = state.store;
  return '<div class="sumrows">' +
    '<div><span>Items</span><span>' + plural(t.lines.length, 'line') + '</span></div>' +
    (t.sub ? '<div><span>' + (t.quote ? 'Priced items' : 'Subtotal') + '</span><span>' + money(t.sub) + '</span></div>' : '') +
    (t.off ? '<div><span>Coupon ' + esc(t.code) + '</span><span>−' + money(t.off) + '</span></div>' : '') +
    (t.sub && st.gstPct ? '<div><span>GST ' + st.gstPct + '%</span><span>' + money(t.gst) + '</span></div>' : (t.sub ? '<div><span>GST</span><span>As applicable</span></div>' : '')) +
    '<div><span>Freight</span><span>' + esc(freightLabel(t)) + '</span></div>' +
    (t.quote ? '<div><span>Items priced on request</span><span>' + t.lines.filter(function (x) { return !x.p.price; }).length + '</span></div>' : '') +
    '<div class="tot"><span>' + (t.quote ? (t.sub ? 'Total for priced items' : 'Total') : 'Total') + '</span><span>' + (t.sub ? money(t.total) : 'Quoted by our team') + '</span></div></div>';
}
var lastOrder = SS.get('rk:last', null);
var checkout = Object.assign({ name: '', org: '', phone: '', email: '', gstin: '', addr: '', city: '', state: '', pin: '', pay: '', note: '' }, LS.get('rk:me', {}));

pages.cart = function (params, q) {
  setTitle('Quote basket — ' + state.brand.name);
  if (q.done && lastOrder && lastOrder.ref === q.done) return doneHtml(lastOrder);
  var t = totals();
  if (!t.lines.length) return '<section class="phead"><div class="wrap"><h1 class="d2">Quote basket</h1></div></section><section class="wrap"><div class="empty">' + R.art('pack', '#8FB3CC') + '<h2>Your basket is empty</h2><p class="muted">Add products with sizes and quantities, then send them to us in one request.</p><a class="btn btn-primary" href="/products">Browse products</a></div></section>';
  var st = state.store, pays = st.payments.filter(function (k) { return PAYMENTS[k]; });
  if (pays.indexOf(checkout.pay) < 0) checkout.pay = pays[0];
  return '<section class="phead"><div class="wrap"><nav class="crumbs"><a href="/">Home</a><span>/</span><span>Quote basket</span></nav><h1 class="d2">Quote basket</h1><p class="lede">Check quantities, add your details and send. Your request is saved with us and opens in WhatsApp with an order summary.</p></div></section>' +
    '<div class="wrap basket"><div><div class="lines" id="lines">' + linesHtml(t) + '</div>' +
      '<form class="checkout" id="cofrm" novalidate><h2>Delivery &amp; billing details</h2><p class="muted">We use these to prepare your quote and invoice.</p><div class="form">' +
        field('Contact person', 'name', { req: true, ac: 'name', v: checkout.name }) +
        field('Hospital / company', 'org', { ac: 'organization', v: checkout.org, opt: true }) +
        field('Mobile number', 'phone', { req: true, type: 'tel', ac: 'tel', im: 'tel', v: checkout.phone, hint: 'We confirm the order on this number.' }) +
        field('Email', 'email', { type: 'email', ac: 'email', v: checkout.email, opt: true }) +
        field('GSTIN', 'gstin', { v: checkout.gstin, opt: true, ph: '07ABCDE1234F1Z5', max: 15, hint: 'For a GST invoice.' }) +
        field('Pincode', 'pin', { req: true, im: 'numeric', ac: 'postal-code', v: checkout.pin, max: 6 }) +
        field('Delivery address', 'addr', { req: true, rows: 2, ac: 'street-address', v: checkout.addr, full: true }) +
        field('City', 'city', { req: true, ac: 'address-level2', v: checkout.city }) +
        field('State', 'state', { ac: 'address-level1', v: checkout.state, opt: true }) +
        '<div class="fld full"><span class="fld-l">Preferred payment</span><div class="pay">' + pays.map(function (k) {
          return '<label><input type="radio" name="pay" value="' + k + '"' + (checkout.pay === k ? ' checked' : '') + '><span><b>' + PAYMENTS[k][0] + '</b><small>' + PAYMENTS[k][1] + '</small></span></label>';
        }).join('') + '</div></div>' +
        field('Notes for our team', 'note', { rows: 2, full: true, v: checkout.note, opt: true, ph: 'Delivery timing, department, custom embroidery…' }) +
      '</div></form></div>' +
    '<aside class="summary" aria-label="Summary"><h2>Summary</h2><div id="sumrows">' + sumRows(t) + '</div>' +
      (st.coupon ? '<div class="coupon"><label class="sr" for="coupon">Coupon code</label><input id="coupon" placeholder="Coupon code" value="' + esc(t.code || SS.get('rk:coupon', '')) + '"><button class="btn btn-sm" data-act="coupon">Apply</button></div>' : '') +
      (t.quote ? '<p class="note small">Items marked “on request” are priced by our team. You’ll get the full quote before anything is final.</p>' : '') +
      '<p class="err-msg" id="coerr" role="alert"></p>' +
      '<button class="btn btn-primary btn-lg btn-block" data-act="place">' + ic('wa') + (t.quote ? 'Send quote request' : 'Send order request') + '</button>' +
      '<p class="small muted">Nothing is charged online. ' + (st.dispatch ? 'Usual dispatch: ' + esc(st.dispatch) + '.' : 'We confirm price, freight and dispatch date before you pay.') + '</p></aside></div>';
};
function linesHtml(t) {
  return t.lines.map(function (x, i) {
    var p = x.p, l = x.l, max = maxQty(p, l.size);
    return '<div class="line"><a class="th" href="/product/' + esc(p.id) + '?c=' + l.ci + '" style="--c:' + x.col.hex + '" tabindex="-1">' + media(p, l.ci, 0, { w: 184, h: 184 }) + '</a>' +
      '<div style="min-width:0"><h3><a href="/product/' + esc(p.id) + '?c=' + l.ci + '">' + esc(p.name) + '</a></h3>' +
      '<div class="meta">' + [p.code, x.col.name !== 'Standard' ? x.col.name : '', l.size !== 'Standard' ? 'Size ' + l.size : ''].filter(Boolean).map(esc).join(' · ') + (x.emb ? '<br><b>Embroidery:</b> ' + esc(x.emb) : '') + '</div>' +
      '<div class="ctl"><div class="qty sm"><button data-act="lqty" data-i="' + i + '" data-d="-1" aria-label="Fewer">' + ic('minus') + '</button><input data-lqty="' + i + '" inputmode="numeric" value="' + l.qty + '" aria-label="Quantity of ' + esc(p.name) + '"><button data-act="lqty" data-i="' + i + '" data-d="1" aria-label="More">' + ic('plus') + '</button></div>' +
        '<span class="small muted">' + esc(p.unit) + (p.moq > 1 ? ' · min ' + p.moq : '') + (p.track ? ' · ' + max + ' in stock' : '') + '</span>' +
        '<button class="icon-btn danger" data-act="lrm" data-i="' + i + '" aria-label="Remove ' + esc(p.name) + '">' + ic('trash') + '</button></div></div>' +
      '<div class="lt">' + (p.price ? money(p.price * l.qty) + '<small>' + money(p.price) + ' / ' + esc(p.unit) + '</small>' : '<span class="price req">On request</span>') + '</div></div>';
  }).join('');
}
function refreshCart() {
  var t = totals(), l = $('#lines'), s = $('#sumrows');
  if (!t.lines.length) { route({ keep: true }); return; }
  if (l) l.innerHTML = linesHtml(t); if (s) s.innerHTML = sumRows(t);
}
function lineAt(i) { var x = cartLines()[i]; return x; }
A.lqty = function (el) {
  var x = lineAt(+el.dataset.i); if (!x) return;
  var step = x.p.moq >= 10 ? Math.max(1, Math.round(x.p.moq / 2)) : 1;
  x.l.qty = clampQty(x.l.qty + (+el.dataset.d) * step, x.p.moq, maxQty(x.p, x.l.size)); saveCart(); refreshCart();
  var inp = $('[data-lqty="' + el.dataset.i + '"]'); if (inp) inp.focus();
};
A.lrm = function (el) {
  var x = lineAt(+el.dataset.i); if (!x) return;
  var removed = x.l; cart.splice(cart.indexOf(removed), 1); saveCart(); refreshCart();
  toast('Removed ' + x.p.name + '.');
};
A.coupon = function () { var v = ($('#coupon').value || '').trim().toUpperCase(); SS.set('rk:coupon', v); var t = totals(); refreshCart(); toast(t.off ? 'Coupon applied.' : v ? 'That coupon code isn’t valid.' : 'Coupon removed.'); };
after.cart = function (params, q) {
  document.addEventListener('change', lqtyChange);
  var f = $('#cofrm');
  if (f) {
    f.addEventListener('input', function () { Object.assign(checkout, pickCo(formData(f))); LS.set('rk:me', checkout); });
    if (q.checkout) setTimeout(function () { f.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }); }, 60);
  }
};
function lqtyChange(e) {
  var t = e.target; if (!t.dataset || t.dataset.lqty == null) return;
  if (current.name !== 'cart') { document.removeEventListener('change', lqtyChange); return; }
  var x = lineAt(+t.dataset.lqty); if (!x) return;
  x.l.qty = clampQty(t.value, x.p.moq, maxQty(x.p, x.l.size)); saveCart(); refreshCart();
}
function pickCo(d) { return { name: d.name || '', org: d.org || '', phone: d.phone || '', email: d.email || '', gstin: (d.gstin || '').toUpperCase(), addr: d.addr || '', city: d.city || '', state: d.state || '', pin: d.pin || '', pay: d.pay || checkout.pay, note: d.note || '' }; }
function validateCo(c) {
  var f = {}, ph = digits(c.phone).replace(/^(91|0)(?=\d{10}$)/, '');
  if (c.name.trim().length < 2) f.name = 'Add the contact person’s name';
  if (!/^[6-9]\d{9}$/.test(ph)) f.phone = 'Enter a valid 10-digit mobile number';
  if (c.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.email.trim())) f.email = 'Check the email address';
  if (c.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(c.gstin.replace(/\s/g, ''))) f.gstin = 'GSTIN has 15 characters, like 07ABCDE1234F1Z5';
  if (c.addr.trim().length < 8) f.addr = 'Add the full delivery address';
  if (!c.city.trim()) f.city = 'Add the city';
  if (!/^\d{6}$/.test(digits(c.pin))) f.pin = 'Pincode has 6 digits';
  return f;
}
function newRef() { var n = (state.brand.name || 'RK').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'RK'; return n + '-' + Date.now().toString(36).slice(-6).toUpperCase(); }

A.place = function (el) {
  var f = $('#cofrm'), err = $('#coerr'); err.textContent = '';
  Object.assign(checkout, pickCo(formData(f))); LS.set('rk:me', checkout);
  var bad = validateCo(checkout);
  if (Object.keys(bad).length) { fldErr(f, bad); err.textContent = 'Fill in the highlighted details.'; return; }
  var t = totals();
  var order = { ref: newRef(), coupon: t.code, payment: checkout.pay, note: checkout.note,
    customer: { name: checkout.name, org: checkout.org, phone: checkout.phone, email: checkout.email, gstin: checkout.gstin, addr: checkout.addr, city: checkout.city, state: checkout.state, pin: checkout.pin },
    items: t.lines.map(function (x) { return { id: x.p.id, ci: x.l.ci, size: x.l.size, qty: x.l.qty, emb: x.emb }; }) };
  var local = localOrder(order, t);
  el.classList.add('busy');
  var card = null;
  orderCard(local).then(function (blob) {
    card = blob;
    var fd = new FormData(); fd.append('order', JSON.stringify(order)); if (blob) fd.append('card', blob, 'order-' + order.ref + '.jpg');
    return apiFetch('/orders', { method: 'POST', body: fd });
  }).then(function (r) {
    var o = Object.assign(local, { ref: r.ref, pageUrl: r.pageUrl, saved: true, subtotal: r.subtotal, discount: r.discount, gst: r.gst, gstPct: r.gstPct, shipping: r.shipping, total: r.total, quote: r.quote });
    finishOrder(o, card);
  }).catch(function (e) {
    el.classList.remove('busy');
    var d = e.data || {};
    if (e.status === 400 && d.fields) { fldErr(f, d.fields); err.textContent = e.message; return; }
    if (e.status === 409 || e.status === 404 || d.error === 'below_moq') {
      err.textContent = e.message;
      apiFetch('/store').then(function (s) { var fresh = normalize(s); [state, published].forEach(function (st) { st.products.forEach(function (p) { fresh.products.forEach(function (fp) { if (fp.id === p.id) { p.sizes = fp.sizes; p.hidden = fp.hidden; } }); }); }); refreshCart(); }).catch(function () { /* keep */ });
      return;
    }
    if (e.status === 0 && waNumber()) { finishOrder(Object.assign(local, { saved: false }), card); return; }
    err.textContent = e.message || 'Couldn’t send the request. Try again.';
  });
};
function localOrder(order, t) {
  return { ref: order.ref, at: Date.now(), customer: order.customer, payment: order.payment, note: order.note, coupon: t.code,
    items: t.lines.map(function (x) { return { id: x.p.id, name: x.p.name, code: x.p.code, color: x.col.name, size: x.l.size, qty: x.l.qty, emb: x.emb, unit: x.p.unit, price: x.p.price, lineTotal: x.p.price * x.l.qty, img: firstImg(x.p, x.l.ci), hex: x.col.hex, art: x.p.art }; }),
    subtotal: t.sub, discount: t.off, gst: t.gst, gstPct: +state.store.gstPct || 0, shipping: t.ship, total: t.total, quote: t.quote, pageUrl: '' };
}
var cardUrl = '', cardFile = null;
function finishOrder(o, blob) {
  if (cardUrl) URL.revokeObjectURL(cardUrl);
  cardUrl = blob ? URL.createObjectURL(blob) : ''; cardFile = null;
  if (blob) { try { cardFile = new File([blob], 'order-' + o.ref + '.jpg', { type: 'image/jpeg' }); } catch (e) { cardFile = null; } }
  if (o.saved) { cart = []; saveCart(); SS.del('rk:coupon'); }
  lastOrder = o; SS.set('rk:last', o);
  history.replaceState(history.state, '', '/cart?done=' + encodeURIComponent(o.ref));
  $('#main').innerHTML = doneHtml(o); window.scrollTo(0, 0);
  if (waNumber()) setTimeout(function () { var a = $('#sendwa'); if (a) a.focus(); }, 50);
}
function orderText(o) {
  var c = o.customer || {}, b = state.brand.name;
  var lines = o.items.map(function (it, i) {
    return (i + 1) + '. ' + it.name + (it.code ? ' (' + it.code + ')' : '') + '\n   ' + [it.color !== 'Standard' ? it.color : '', it.size !== 'Standard' ? 'Size ' + it.size : '', it.qty + ' ' + it.unit].filter(Boolean).join(' · ') +
      ' — ' + (it.price ? money(it.price) + ' × ' + it.qty + ' = ' + money(it.lineTotal) : 'price on request') + (it.emb ? '\n   Embroidery: ' + it.emb : '');
  }).join('\n');
  return '*' + (o.quote ? 'QUOTE REQUEST' : 'ORDER REQUEST') + ' — ' + b + '*\nRef: ' + o.ref + (o.pageUrl ? '\nSummary: ' + o.pageUrl : '') + '\n\n' + lines + '\n\n' +
    (o.subtotal ? (o.quote ? 'Priced items: ' : 'Subtotal: ') + money(o.subtotal) + '\n' : '') +
    (o.discount ? 'Coupon ' + o.coupon + ': −' + money(o.discount) + '\n' : '') +
    (o.subtotal && o.gst ? 'GST ' + o.gstPct + '%: ' + money(o.gst) + '\n' : '') +
    'Freight: ' + freightLabel(null, o) + '\n' +
    (o.subtotal ? '*Total' + (o.quote ? ' (priced items)' : '') + ': ' + money(o.total) + '*\n' : '*Prices: please quote*\n') +
    '\n*Customer*\n' + c.name + (c.org ? '\n' + c.org : '') + '\nPhone: ' + digits(c.phone) + (c.email ? '\nEmail: ' + c.email : '') + (c.gstin ? '\nGSTIN: ' + c.gstin : '') +
    '\nAddress: ' + c.addr + ', ' + c.city + (c.state ? ', ' + c.state : '') + ' - ' + digits(c.pin) +
    '\nPayment: ' + (PAYMENTS[o.payment] ? PAYMENTS[o.payment][0] : o.payment) + (o.note ? '\nNote: ' + o.note : '');
}
function doneHtml(o) {
  var canShare = false; try { canShare = !!(navigator.canShare && cardFile && navigator.canShare({ files: [cardFile] })); } catch (e) { canShare = false; }
  var wa = waLink(orderText(o)), em = state.store.email;
  return '<section class="wrap"><div class="done"><span class="tick">' + ic('check') + '</span>' +
    '<h1 class="d2">' + (o.saved ? (o.quote ? 'Quote request saved' : 'Order request saved') : 'Almost done') + '</h1>' +
    (o.saved ? '<p class="lede">Reference <b>' + esc(o.ref) + '</b>. Send it on WhatsApp so our team can reply right away.</p>'
      : '<p class="note warn">We couldn’t reach our server, so this request isn’t saved yet. Send it on WhatsApp to place it.</p>') +
    '<ol><li>Tap <b>Send on WhatsApp</b>. The chat opens with your list and an order summary link.</li><li>Press send in WhatsApp.</li><li>We reply with prices, freight and dispatch date.</li></ol>' +
    (cardUrl ? '<img class="done-img" src="' + cardUrl + '" alt="Order summary ' + esc(o.ref) + '">' : '') +
    (wa ? '<a class="btn btn-wa btn-lg" id="sendwa" href="' + esc(wa) + '" target="_blank" rel="noopener">' + ic('wa') + 'Send on WhatsApp</a>' : '') +
    '<div class="row">' + (canShare ? '<button class="btn btn-sm" data-act="oshare">' + ic('upload') + 'Share photo</button>' : '') +
      (cardUrl ? '<a class="btn btn-sm" href="' + cardUrl + '" download="order-' + esc(o.ref) + '.jpg">' + ic('download') + 'Save photo</a>' : '') +
      '<button class="btn btn-sm" data-act="ocopy">' + ic('copy') + 'Copy order text</button>' +
      (em ? '<a class="btn btn-sm" href="mailto:' + esc(em) + '?subject=' + encodeURIComponent((o.quote ? 'Quote request ' : 'Order request ') + o.ref) + '&body=' + encodeURIComponent(orderText(o).replace(/\*/g, '')) + '">' + ic('mail') + 'Email instead</a>' : '') + '</div>' +
    '<a href="/products" class="link">Continue browsing</a></div></section>';
}
A.ocopy = function () { if (lastOrder) copyText(orderText(lastOrder).replace(/\*/g, '')).then(function (ok) { toast(ok ? 'Order text copied.' : 'Couldn’t copy.'); }); };
A.oshare = function () { if (cardFile && lastOrder) navigator.share({ files: [cardFile], text: orderText(lastOrder) }).catch(function () { /* cancelled */ }); };

/* Order photo (1080×1350 JPEG): shown as the WhatsApp link preview and in the admin order list. */
function loadImg(src) {
  return new Promise(function (res) {
    if (!src) return res(null);
    var im = new Image(); im.crossOrigin = 'anonymous'; im.decoding = 'async';
    var done = false, t = setTimeout(function () { if (!done) { done = true; res(null); } }, 4000);
    im.onload = function () { if (!done) { done = true; clearTimeout(t); res(im); } };
    im.onerror = function () { if (!done) { done = true; clearTimeout(t); res(null); } };
    im.src = absUrl(src) || src;
  });
}
function svgImg(svg) { return loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" '))); }
function rrect(x, c, y, w, h, r) { x.beginPath(); x.moveTo(c + r, y); x.arcTo(c + w, y, c + w, y + h, r); x.arcTo(c + w, y + h, c, y + h, r); x.arcTo(c, y + h, c, y, r); x.arcTo(c, y, c + w, y, r); x.closePath(); }
function fit(x, text, maxW) { text = String(text || ''); if (x.measureText(text).width <= maxW) return text; while (text.length > 1 && x.measureText(text + '…').width > maxW) text = text.slice(0, -1); return text + '…'; }
function orderCard(o) {
  var items = o.items.slice(0, 6);
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(function () { return null; }) : Promise.resolve();
  return fontsReady.then(function () {
    return Promise.all(items.map(function (it) { return loadImg(it.img).then(function (im) { return im || svgImg(R.art(it.art, it.hex)); }); }));
  }).then(function (imgs) {
    return draw(imgs, true).catch(function () { return draw([], false); });
  }).catch(function () { return null; });
  function draw(imgs, withImgs) {
    return new Promise(function (resolve, reject) {
      var extra = o.items.length > items.length ? 50 : 0, H = Math.max(1080, Math.min(1350, 420 + items.length * 128 + extra + 330)), W = 1080, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var x = cv.getContext('2d'), F = 'Manrope,system-ui,sans-serif';
      var pri = state.brand.primary || '#1F5C52', ink = '#13263A', mute = '#5E7080', line = '#D3DEDB';
      x.fillStyle = '#F3F6F5'; x.fillRect(0, 0, W, H);
      x.fillStyle = pri; x.fillRect(0, 0, W, 250);
      x.fillStyle = '#fff'; x.font = '700 58px ' + F; x.fillText(fit(x, state.brand.name, 640), 64, 112);
      x.font = '500 30px ' + F; x.globalAlpha = .85; x.fillText(o.quote ? 'Quote request' : 'Order request', 64, 166); x.globalAlpha = 1;
      x.textAlign = 'right'; x.font = '700 44px ' + F; x.fillText(o.ref, W - 64, 112);
      x.font = '500 26px ' + F; x.globalAlpha = .85; x.fillText(new Date(o.at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), W - 64, 160); x.globalAlpha = 1; x.textAlign = 'left';
      var c = o.customer || {}, y = 320;
      x.fillStyle = ink; x.font = '700 38px ' + F; x.fillText(fit(x, c.org || c.name, W - 128), 64, y);
      x.fillStyle = mute; x.font = '400 28px ' + F; x.fillText(fit(x, (c.org ? c.name + ' · ' : '') + c.city + (c.state ? ', ' + c.state : '') + ' · ' + digits(c.phone), W - 128), 64, y + 46);
      y = 420;
      items.forEach(function (it, i) {
        var top = y + i * 128;
        x.fillStyle = '#fff'; rrect(x, 64, top, W - 128, 112, 14); x.fill();
        x.fillStyle = it.hex || '#DCE6E8'; rrect(x, 76, top + 12, 88, 88, 10); x.fill();
        if (withImgs && imgs[i]) { x.save(); rrect(x, 76, top + 12, 88, 88, 10); x.clip(); var im = imgs[i], s = Math.max(88 / im.width, 88 / im.height); x.drawImage(im, 120 - im.width * s / 2, top + 56 - im.height * s / 2, im.width * s, im.height * s); x.restore(); }
        x.fillStyle = ink; x.font = '600 30px ' + F; x.fillText(fit(x, it.name, 560), 190, top + 50);
        x.fillStyle = mute; x.font = '400 25px ' + F; x.fillText(fit(x, [it.color !== 'Standard' ? it.color : '', it.size !== 'Standard' ? 'Size ' + it.size : '', it.qty + ' ' + it.unit, it.emb ? 'Emb: ' + it.emb : ''].filter(Boolean).join(' · '), 560), 190, top + 88);
        x.textAlign = 'right'; x.fillStyle = it.price ? ink : pri; x.font = (it.price ? '700' : '600') + ' 28px ' + F; x.fillText(it.price ? money(it.lineTotal) : 'On request', W - 88, top + 66); x.textAlign = 'left';
      });
      y = 420 + items.length * 128 + 10;
      if (o.items.length > items.length) { x.fillStyle = mute; x.font = '500 26px ' + F; x.fillText('+ ' + plural(o.items.length - items.length, 'more item') + ' in this request', 64, y + 24); y += 50; }
      x.strokeStyle = line; x.lineWidth = 2; x.beginPath(); x.moveTo(64, y + 10); x.lineTo(W - 64, y + 10); x.stroke();
      var row = function (l, r, bold) { y += 46; x.fillStyle = bold ? ink : mute; x.font = (bold ? '700 32px ' : '400 27px ') + F; x.fillText(l, 64, y); x.textAlign = 'right'; x.fillText(r, W - 64, y); x.textAlign = 'left'; };
      if (o.subtotal) row(o.quote ? 'Priced items' : 'Subtotal', money(o.subtotal));
      if (o.discount) row('Coupon ' + o.coupon, '−' + money(o.discount));
      if (o.subtotal && o.gst) row('GST ' + o.gstPct + '%', money(o.gst));
      row('Freight', freightLabel(null, o));
      row(o.subtotal ? 'Total' : 'Prices', o.subtotal ? money(o.total) : 'To be quoted', true);
      x.fillStyle = mute; x.font = '400 24px ' + F;
      x.fillText(fit(x, [state.store.phone, location.host].filter(Boolean).join('   ·   '), W - 128), 64, H - 56);
      try { cv.toBlob(function (b) { if (b) resolve(b); else reject(new Error('no blob')); }, 'image/jpeg', 0.86); } catch (e) { reject(e); }
    });
  }
}
