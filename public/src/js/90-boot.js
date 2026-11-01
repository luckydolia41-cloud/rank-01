/* ---------- start ---------- */
function boot() {
  applyBrand();
  shell();
  route({ top: false, focus: false });
  if (!API) return;
  var needFetch = !embedded || isAdmin;
  if (!needFetch) return;
  var p = isAdmin
    ? apiFetch('/admin/store').catch(function (e) { if (e.status === 401) return embedded ? null : apiFetch('/store'); throw e; })
    : apiFetch('/store');
  p.then(function (d) { if (d) applyRemote(d); }).catch(function () { if (!embedded) toast('Couldn’t reach the server. Check your connection and reload.'); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
