/* ---------- admin: orders & enquiries (live from the database) ---------- */
var OQ = { status: '', q: '', page: 1, data: null, stats: null, err: '' };
var O_STATUS = [['new', 'New'], ['confirmed', 'Confirmed'], ['shipped', 'Shipped'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
function loadOrders() {
  OQ.err = '';
  var q = '?page=' + OQ.page + '&limit=15' + (OQ.status ? '&status=' + OQ.status : '') + (OQ.q ? '&q=' + encodeURIComponent(OQ.q) : '');
  Promise.all([apiFetch('/admin/orders' + q), apiFetch('/admin/orders/stats')]).then(function (r) {
    OQ.data = r[0]; OQ.stats = r[1]; OQ.page = r[0].page; counts.orders = r[1].byStatus.new; tabBadges(); renderOrders();
  }).catch(function (e) { if (e.status === 401) return; OQ.err = e.message; renderOrders(); });
}
function renderOrders() {
  if (current.name !== 'admin' || adminTab !== 'orders') return;
  var p = $('#apanel'); if (!p) return;
  var q = $('#oq'), focus = q && document.activeElement === q, pos = focus ? q.selectionStart : 0;
  p.innerHTML = ordersPanel();
  if (focus) { var n = $('#oq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
}
function ordersPanel() {
  var st = OQ.stats, d = OQ.data;
  var tiles = '<div class="stats">' + [['New', 'new'], ['Confirmed', 'confirmed'], ['Shipped', 'shipped'], ['Delivered', 'delivered']].map(function (x) {
    return '<button class="stat' + (OQ.status === x[1] ? ' on' : '') + '" data-act="ofilter" data-v="' + x[1] + '"><span>' + x[0] + '</span><b>' + (st ? st.byStatus[x[1]] : '–') + '</b></button>';
  }).join('') + '</div>';
  var body;
  if (OQ.err) body = '<div class="note warn"><b>Couldn’t load orders.</b> ' + esc(OQ.err) + ' <button class="link" data-act="orefresh">Try again</button></div>';
  else if (!d) body = '<p class="muted">Loading orders…</p>';
  else if (!d.items.length) body = '<div class="empty" style="padding:32px 0"><h3>' + (OQ.status || OQ.q ? 'No orders match' : 'No orders yet') + '</h3><p class="muted">' + (OQ.status || OQ.q ? 'Try another filter or search.' : 'Requests sent from the quote basket appear here.') + '</p></div>';
  else body = '<div class="olist">' + d.items.map(orderRow).join('') + '</div>' + (d.pages > 1 ? '<div class="pager"><button class="btn btn-sm" data-act="opage" data-d="-1"' + (d.page <= 1 ? ' disabled' : '') + '>' + ic('left', 14) + 'Newer</button><span class="small muted">Page ' + d.page + ' of ' + d.pages + '</span><button class="btn btn-sm" data-act="opage" data-d="1"' + (d.page >= d.pages ? ' disabled' : '') + '>Older' + ic('right', 14) + '</button></div>' : '');
  return tiles + '<div class="card"><div class="card-h"><h2>Orders &amp; quote requests' + (d ? ' (' + d.total + ')' : '') + '</h2><button class="btn btn-sm" data-act="orefresh">' + ic('refresh', 16) + 'Refresh</button></div>' +
    (st ? '<p class="sub">Value of confirmed, shipped and delivered orders: <b>' + money(st.revenue) + '</b> · ' + plural(st.last24h, 'request') + ' in the last 24 hours. Confirming an order takes stock-tracked items out of stock; cancelling puts them back.</p>' : '') +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div class="seg" role="group" aria-label="Status"><button class="' + (!OQ.status ? 'on' : '') + '" data-act="ofilter" data-v="">All</button>' + O_STATUS.map(function (s) { return '<button class="' + (OQ.status === s[0] ? 'on' : '') + '" data-act="ofilter" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
    '<label class="searchbox" style="flex:1 1 220px">' + ic('search') + '<span class="sr">Search orders</span><input id="oq" placeholder="Name, hospital, phone, city or ref" value="' + esc(OQ.q) + '" autocomplete="off"></label></div>' + body + '</div>';
}
function itemLabel(x, code) {
  return x.name + (code && x.code ? ' (' + x.code + ')' : '') + ' · ' + [x.color !== 'Standard' ? x.color : '', x.size !== 'Standard' ? x.size : ''].filter(Boolean).concat([x.qty + ' ' + (x.unit || '')]).concat(x.emb ? ['Embroidery: ' + x.emb] : []).join(' · ');
}
function orderRow(o) {
  var c = o.customer || {}, items = o.items || [], phone = digits(c.phone);
  var when = new Date(o.createdAt), ws = isNaN(when) ? '' : when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  var waC = phone ? 'https://wa.me/91' + phone + '?text=' + encodeURIComponent('Hello ' + (c.name || '') + ', thank you for your ' + (o.quote ? 'quote request' : 'order') + ' ' + o.ref + ' with ' + state.brand.name + '.') : '';
  var thumb = o.cardUrl ? '<a class="th" href="' + esc(absUrl(o.cardUrl)) + '" target="_blank" rel="noopener"><img src="' + esc(absUrl(o.cardUrl)) + '" alt="Order photo ' + esc(o.ref) + '" loading="lazy"></a>' : '<span class="th"></span>';
  return '<div class="orow s-' + esc(o.status) + '">' + thumb + '<div style="min-width:0"><div class="orow-h"><b>' + esc(c.org || c.name) + '</b><span class="small muted">' + esc(o.ref) + ' · ' + esc(ws) + '</span>' + (o.quote ? '<span class="pill pr">Quote</span>' : '') + '</div>' +
    '<div class="meta">' + items.slice(0, 4).map(function (x) { return '<span>' + esc(itemLabel(x)) + '</span>'; }).join('') + (items.length > 4 ? '<span>+' + (items.length - 4) + ' more</span>' : '') + '</div>' +
    '<div class="meta"><span>' + esc(c.name) + '</span><span>' + esc(phone) + '</span><span>' + esc(c.city) + '</span><span>' + esc(PAYMENTS[o.payment] ? PAYMENTS[o.payment][0] : o.payment) + '</span><b style="color:var(--ink)">' + (o.subtotal ? money(o.total) : 'To quote') + '</b></div>' +
    '<details><summary>All details</summary><p>' + items.map(function (x) { return esc(itemLabel(x, true)) + ' — ' + (x.price ? money(x.lineTotal) : 'on request'); }).join('<br>') + '</p>' +
      '<p>' + esc(c.addr) + ', ' + esc(c.city) + (c.state ? ', ' + esc(c.state) : '') + ' - ' + esc(c.pin) + (c.email ? '<br>' + esc(c.email) : '') + (c.gstin ? '<br>GSTIN ' + esc(c.gstin) : '') + '</p>' +
      (o.note ? '<p><b>Note:</b> ' + esc(o.note) + '</p>' : '') + '<p>Subtotal ' + money(o.subtotal) + (o.discount ? ' · Coupon ' + esc(o.coupon) + ' −' + money(o.discount) : '') + (o.gst ? ' · GST ' + money(o.gst) : '') + ' · Freight ' + (o.shipping ? money(o.shipping) : 'to confirm') + '</p></details></div>' +
    '<div class="acts"><label class="sr" for="os-' + esc(o.ref) + '">Status of ' + esc(o.ref) + '</label><select id="os-' + esc(o.ref) + '" data-ostatus="' + esc(o.ref) + '">' + O_STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (o.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
      (waC ? '<a class="icon-btn" href="' + esc(waC) + '" target="_blank" rel="noopener" title="Message on WhatsApp" aria-label="Message customer on WhatsApp">' + ic('wa') + '</a>' : '') +
      (o.pageUrl ? '<a class="icon-btn" href="' + esc(absUrl(o.pageUrl)) + '" target="_blank" rel="noopener" title="Open order page" aria-label="Open order page">' + ic('eye') + '</a>' : '') +
      '<button class="icon-btn danger" data-act="odel" data-ref="' + esc(o.ref) + '" title="Delete" aria-label="Delete order">' + ic('trash') + '</button></div></div>';
}
A.ofilter = function (el) { OQ.status = el.dataset.v; OQ.page = 1; OQ.data = null; renderOrders(); loadOrders(); };
A.opage = function (el) { OQ.page = Math.max(1, OQ.page + (+el.dataset.d)); loadOrders(); };
A.orefresh = function () { loadOrders(); };
A.odel = function (el) {
  if (!el.classList.contains('confirming')) { el.classList.add('confirming'); el.textContent = 'Delete?'; setTimeout(function () { if (el.isConnected) { el.classList.remove('confirming'); el.innerHTML = ic('trash'); } }, 3000); return; }
  apiFetch('/admin/orders/' + encodeURIComponent(el.dataset.ref), { method: 'DELETE' }).then(function () { toast('Order deleted.'); loadOrders(); }).catch(function (e) { toast(e.message); });
};
function syncStock() {
  apiFetch('/admin/store').then(function (d) {
    var fresh = normalize(d), was = dirty();
    [state, published].forEach(function (st) { st.products.forEach(function (p) { fresh.products.forEach(function (fp) { if (fp.id === p.id) p.sizes = fp.sizes; }); }); });
    published.rev = fresh.rev; published.updated = fresh.updated;
    if (!was) state = clone(published); else LS.set('rk:draft', { base: published.rev, data: state, at: Date.now() });
    refreshActions();
  }).catch(function () { /* ignore */ });
}
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.dataset || !t.dataset.ostatus) return;
  var ref = t.dataset.ostatus, v = t.value; t.disabled = true;
  apiFetch('/admin/orders/' + encodeURIComponent(ref), { method: 'PATCH', body: { status: v } }).then(function (r) {
    toast('Order ' + ref + ' marked ' + v + (r.stockChanged ? (v === 'cancelled' || v === 'new' ? '. Stock put back.' : '. Stock updated.') : '.'));
    if (r.stockChanged) syncStock(); loadOrders();
  }).catch(function (err) { t.disabled = false; toast(err.message); loadOrders(); });
});
document.addEventListener('input', debounce(function (e) {
  if (e.target.id === 'oq') { OQ.q = e.target.value.trim(); OQ.page = 1; loadOrders(); }
  if (e.target.id === 'eq') { EQ.q = e.target.value.trim(); EQ.page = 1; loadEnq(); }
}, 350));

/* enquiries */
var EQ = { status: '', q: '', page: 1, data: null, err: '' };
var E_STATUS = [['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quoted'], ['closed', 'Closed']];
function loadEnq() {
  EQ.err = '';
  apiFetch('/admin/enquiries?page=' + EQ.page + '&limit=15' + (EQ.status ? '&status=' + EQ.status : '') + (EQ.q ? '&q=' + encodeURIComponent(EQ.q) : '')).then(function (r) {
    EQ.data = r; EQ.page = r.page; counts.enquiries = r.byStatus.new; tabBadges(); renderEnq();
  }).catch(function (e) { if (e.status === 401) return; EQ.err = e.message; renderEnq(); });
}
function renderEnq() {
  if (current.name !== 'admin' || adminTab !== 'enquiries') return;
  var p = $('#apanel'); if (!p) return;
  var q = $('#eq'), focus = q && document.activeElement === q, pos = focus ? q.selectionStart : 0;
  p.innerHTML = enqPanel();
  if (focus) { var n = $('#eq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
}
function enqPanel() {
  var d = EQ.data, by = d ? d.byStatus : null, body;
  if (EQ.err) body = '<div class="note warn"><b>Couldn’t load enquiries.</b> ' + esc(EQ.err) + ' <button class="link" data-act="erefresh">Try again</button></div>';
  else if (!d) body = '<p class="muted">Loading enquiries…</p>';
  else if (!d.items.length) body = '<div class="empty" style="padding:32px 0"><h3>' + (EQ.status || EQ.q ? 'No enquiries match' : 'No enquiries yet') + '</h3><p class="muted">Messages from the contact form appear here.</p></div>';
  else body = '<div class="olist">' + d.items.map(function (e) {
    var when = new Date(e.createdAt), ws = isNaN(when) ? '' : when.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }), ph = digits(e.phone);
    return '<div class="orow s-' + esc(e.status) + '" style="grid-template-columns:minmax(0,1fr) auto"><div style="min-width:0"><div class="orow-h"><b>' + esc(e.name) + (e.org ? ' · ' + esc(e.org) : '') + '</b><span class="small muted">' + esc(e.ref) + ' · ' + esc(ws) + '</span><span class="pill">' + esc(e.topic) + '</span></div>' +
      '<div class="meta">' + (e.product ? '<span>' + esc(e.product) + '</span>' : '') + '<span>' + esc(ph) + '</span>' + (e.email ? '<span>' + esc(e.email) + '</span>' : '') + (e.city ? '<span>' + esc(e.city) + '</span>' : '') + '</div>' +
      '<p style="margin-top:8px;white-space:pre-wrap">' + esc(e.message) + '</p>' + (e.note ? '<p class="small muted" style="margin-top:6px">Note: ' + esc(e.note) + '</p>' : '') + '</div>' +
      '<div class="acts"><select data-estatus="' + esc(e.ref) + '" aria-label="Status of ' + esc(e.ref) + '">' + E_STATUS.map(function (s) { return '<option value="' + s[0] + '"' + (e.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select>' +
      (ph ? '<a class="icon-btn" href="https://wa.me/' + (ph.length === 10 ? '91' + ph : ph) + '?text=' + encodeURIComponent('Hello ' + e.name + ', thank you for your enquiry with ' + state.brand.name + '.') + '" target="_blank" rel="noopener" aria-label="Reply on WhatsApp" title="Reply on WhatsApp">' + ic('wa') + '</a>' : '') +
      (e.email ? '<a class="icon-btn" href="mailto:' + esc(e.email) + '?subject=' + encodeURIComponent('Re: your enquiry ' + e.ref) + '" aria-label="Reply by email" title="Reply by email">' + ic('mail') + '</a>' : '') +
      '<button class="icon-btn danger" data-act="edel" data-ref="' + esc(e.ref) + '" aria-label="Delete enquiry" title="Delete">' + ic('trash') + '</button></div></div>';
  }).join('') + '</div>' + (d.pages > 1 ? '<div class="pager"><button class="btn btn-sm" data-act="epage" data-d="-1"' + (d.page <= 1 ? ' disabled' : '') + '>Newer</button><span class="small muted">Page ' + d.page + ' of ' + d.pages + '</span><button class="btn btn-sm" data-act="epage" data-d="1"' + (d.page >= d.pages ? ' disabled' : '') + '>Older</button></div>' : '');
  return '<div class="stats">' + E_STATUS.map(function (s) { return '<button class="stat' + (EQ.status === s[0] ? ' on' : '') + '" data-act="efilter" data-v="' + s[0] + '"><span>' + s[1] + '</span><b>' + (by ? by[s[0]] : '–') + '</b></button>'; }).join('') + '</div>' +
    '<div class="card"><div class="card-h"><h2>Enquiries' + (d ? ' (' + d.total + ')' : '') + '</h2><button class="btn btn-sm" data-act="erefresh">' + ic('refresh', 16) + 'Refresh</button></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div class="seg"><button class="' + (!EQ.status ? 'on' : '') + '" data-act="efilter" data-v="">All</button>' + E_STATUS.map(function (s) { return '<button class="' + (EQ.status === s[0] ? 'on' : '') + '" data-act="efilter" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
    '<label class="searchbox" style="flex:1 1 220px">' + ic('search') + '<span class="sr">Search enquiries</span><input id="eq" placeholder="Name, company, phone, product" value="' + esc(EQ.q) + '" autocomplete="off"></label></div>' + body + '</div>';
}
A.efilter = function (el) { EQ.status = el.dataset.v; EQ.page = 1; EQ.data = null; renderEnq(); loadEnq(); };
A.epage = function (el) { EQ.page = Math.max(1, EQ.page + (+el.dataset.d)); loadEnq(); };
A.erefresh = function () { loadEnq(); };
A.edel = function (el) {
  if (!el.classList.contains('confirming')) { el.classList.add('confirming'); el.textContent = 'Delete?'; setTimeout(function () { if (el.isConnected) { el.classList.remove('confirming'); el.innerHTML = ic('trash'); } }, 3000); return; }
  apiFetch('/admin/enquiries/' + encodeURIComponent(el.dataset.ref), { method: 'DELETE' }).then(function () { toast('Enquiry deleted.'); loadEnq(); }).catch(function (e) { toast(e.message); });
};
document.addEventListener('change', function (e) {
  var t = e.target; if (!t.dataset || !t.dataset.estatus) return;
  t.disabled = true;
  apiFetch('/admin/enquiries/' + encodeURIComponent(t.dataset.estatus), { method: 'PATCH', body: { status: t.value } }).then(function () { toast('Enquiry marked ' + t.value + '.'); loadEnq(); }).catch(function (err) { t.disabled = false; toast(err.message); });
});
