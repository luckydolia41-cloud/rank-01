/* ---------- product illustrations ----------
   Line drawings in the product's own colour, used whenever a product has no photo
   (or a photo link breaks). One shape per kind of product. */
function hexRgb(h) { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mixHex(h, t, a) { var A = hexRgb(h), B = hexRgb(t); return '#' + A.map(function (v, i) { return Math.round(v + (B[i] - v) * a).toString(16).padStart(2, '0'); }).join(''); }
function lum(h) { var c = hexRgb(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; }
R.lum = lum; R.mixHex = mixHex;

var ART = {
  scrub: function (f, s, d) {
    return '<path d="M64 120h72l6 66h-30l-12-44-12 44H58z" fill="' + f + '" stroke="' + s + '"/><path d="M64 130h72" stroke="' + d + '"/>' +
      '<path d="M60 40l24-8q16 18 32 0l24 8 26 26-14 14-12-8v50H60V72l-12 8-14-14z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M84 32l16 26 16-26" fill="none" stroke="' + d + '"/><rect x="112" y="84" width="18" height="15" rx="2" fill="none" stroke="' + d + '"/>';
  },
  coat: function (f, s, d) {
    return '<path d="M62 30l24-6 14 16 14-16 24 6 26 28 6 92-18 2-6-62v94H54V90l-6 62-18-2 6-92z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M86 24l14 46 14-46M100 70v114" fill="none" stroke="' + d + '"/><path d="M64 128h22v18H64zM114 128h22v18h-22zM118 82h16" fill="none" stroke="' + d + '"/>' +
      '<g fill="' + d + '"><circle cx="106" cy="92" r="2.4"/><circle cx="106" cy="114" r="2.4"/><circle cx="106" cy="136" r="2.4"/></g>';
  },
  gown: function (f, s, d) {
    return '<path d="M64 30q36 14 72 0l36 34 6 76-18 4-14-60 4 102H50l4-102-14 60-18-4 6-76z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M64 30q36 22 72 0M54 104h92M24 128l18 4M176 128l-18 4" fill="none" stroke="' + d + '"/><path d="M100 104l-8 22M100 104l8 22" stroke="' + d + '"/>';
  },
  patient: function (f, s, d, id) {
    var dots = ''; for (var y = 46; y < 180; y += 18) for (var x = 30; x < 180; x += 18) dots += '<circle cx="' + (x + (y / 18 % 2 ? 9 : 0)) + '" cy="' + y + '" r="2.6"/>';
    return '<defs><clipPath id="' + id + '"><path d="M66 32q34 12 68 0l34 32 6 64-18 4-12-48 2 90H54l2-90-12 48-18-4 6-64z"/></clipPath></defs>' +
      '<path d="M66 32q34 12 68 0l34 32 6 64-18 4-12-48 2 90H54l2-90-12 48-18-4 6-64z" fill="#FBFBFA" stroke="' + s + '"/>' +
      '<g clip-path="url(#' + id + ')" fill="' + f + '">' + dots + '</g><path d="M66 32q34 20 68 0M100 52v122" fill="none" stroke="' + s + '" stroke-opacity=".55"/>';
  },
  apron: function (f, s, d) {
    return '<path d="M78 30q22-26 44 0" fill="none" stroke="' + s + '"/><path d="M78 30h44v26l26 14v116H52V70l26-14z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M52 92l-24 8M148 92l24 8" stroke="' + s + '"/><path d="M78 120h44v26H78z" fill="none" stroke="' + d + '"/>';
  },
  coverall: function (f, s, d) {
    return '<path d="M70 44h60l30 26 8 58-16 2-12-44v34l-4 68h-30l-6-56-6 56H64l-4-68V86l-12 44-16-2 8-58z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M80 46q-4-34 20-34t20 34z" fill="' + f + '" stroke="' + s + '"/><ellipse cx="100" cy="32" rx="11" ry="12" fill="#FBFBFA" stroke="' + d + '"/>' +
      '<path d="M100 46v84" stroke="' + d + '" stroke-dasharray="3 3"/>';
  },
  sheet: function (f, s, d) {
    return '<rect x="34" y="122" width="132" height="28" rx="5" fill="' + f + '" stroke="' + s + '"/><rect x="40" y="94" width="120" height="30" rx="5" fill="' + f + '" stroke="' + s + '"/>' +
      '<rect x="46" y="62" width="108" height="34" rx="5" fill="' + f + '" stroke="' + s + '"/><path d="M46 79h108M40 109h120M34 136h132" stroke="' + d + '" stroke-dasharray="4 4"/><path d="M130 62l24 18V67a5 5 0 0 0-5-5z" fill="' + d + '" opacity=".35"/>';
  },
  pillow: function (f, s, d) {
    return '<path d="M30 82q0-24 24-22 46-6 92 0 24-2 24 22v44q0 24-24 20-46 6-92 0-24 4-24-20z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M42 86q0-14 16-14 42-4 84 0 16 0 16 14v36q0 14-16 12-42 4-84 0-16 2-16-12z" fill="none" stroke="' + d + '" stroke-dasharray="4 4"/>';
  },
  mattress: function (f, s, d) {
    return '<path d="M26 98l102-26 48 20-102 28z" fill="' + mixHex(f, '#ffffff', .25) + '" stroke="' + s + '"/><path d="M26 98l48 22v30l-48-22z" fill="' + f + '" stroke="' + s + '"/>' +
      '<path d="M74 120l102-28v30L74 150z" fill="' + mixHex(f, '#000000', .08) + '" stroke="' + s + '"/>' +
      '<g fill="' + d + '"><circle cx="66" cy="98" r="2"/><circle cx="92" cy="92" r="2"/><circle cx="118" cy="85" r="2"/><circle cx="84" cy="106" r="2"/><circle cx="110" cy="100" r="2"/><circle cx="136" cy="93" r="2"/><circle cx="102" cy="114" r="2"/><circle cx="128" cy="107" r="2"/><circle cx="154" cy="99" r="2"/></g>' +
      '<path d="M74 135l102-28" stroke="' + d + '" stroke-dasharray="4 4"/>';
  },
  blanket: function (f, s, d) {
    return '<rect x="34" y="62" width="132" height="98" rx="10" fill="' + f + '" stroke="' + s + '"/><rect x="34" y="62" width="132" height="24" rx="10" fill="' + mixHex(f, '#000000', .1) + '" stroke="' + s + '"/>' +
      '<path d="M78 86v74M122 86v74M34 112h132M34 136h132" stroke="' + d + '" stroke-dasharray="4 4"/>';
  },
  pack: function (f, s, d) {
    return '<rect x="46" y="38" width="108" height="134" rx="8" fill="' + f + '" stroke="' + s + '"/><path d="M46 62h108" stroke="' + d + '"/><path d="M46 46l18-8v24H46z" fill="' + d + '" opacity=".35"/>' +
      '<path d="M92 86h16v16h16v16h-16v16H92v-16H76v-16h16z" fill="#FBFBFA" stroke="' + s + '"/><path d="M68 152h64M78 160h44" stroke="' + d + '"/>';
  },
  drape: function (f, s, d) {
    return '<rect x="32" y="34" width="136" height="142" rx="6" fill="' + f + '" stroke="' + s + '"/><path d="M66 34v142M134 34v142" stroke="' + d + '" stroke-dasharray="4 4"/>' +
      '<ellipse cx="100" cy="90" rx="26" ry="19" fill="none" stroke="' + d + '" stroke-width="5" opacity=".45"/><ellipse cx="100" cy="90" rx="20" ry="14" fill="#FBFBFA" stroke="' + s + '"/>' +
      '<path d="M62 136h76v24q-38 12-76 0z" fill="' + mixHex(f, '#ffffff', .35) + '" stroke="' + s + '"/>';
  },
  bag: function (f, s, d) {
    return '<path d="M66 54q-4-16 8-16h52q12 0 8 16l16 116q-50 16-100 0z" fill="' + f + '" stroke="' + s + '"/><path d="M68 48q32 14 64 0" fill="none" stroke="' + d + '"/>' +
      '<path d="M100 55l-10 20M100 55l10 20" stroke="' + s + '"/><rect x="78" y="112" width="44" height="30" rx="3" fill="#FBFBFA" stroke="' + d + '"/>';
  },
  towel: function (f, s, d) {
    return '<rect x="38" y="76" width="124" height="88" rx="10" fill="' + f + '" stroke="' + s + '"/><rect x="38" y="76" width="124" height="26" rx="10" fill="' + mixHex(f, '#ffffff', .3) + '" stroke="' + s + '"/>' +
      '<rect x="38" y="136" width="124" height="10" fill="' + d + '" opacity=".4"/>';
  },
  warming: function (f, s, d) {
    var ch = ''; for (var y = 74; y <= 138; y += 16) ch += '<path d="M44 ' + y + 'h112" stroke="' + d + '" stroke-dasharray="1 6" stroke-width="2.4"/>';
    return '<rect x="28" y="58" width="144" height="96" rx="18" fill="' + f + '" stroke="' + s + '"/>' + ch +
      '<circle cx="172" cy="106" r="9" fill="#FBFBFA" stroke="' + s + '"/><path d="M181 106q14 0 14 24v34" fill="none" stroke="' + s + '" stroke-width="7" stroke-linecap="round" opacity=".55"/>';
  }
};
var artN = 0;
R.art = function (kind, hex, cls) {
  var f = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#DCE6E8';
  var s = mixHex(f, '#0B1620', 0.62), d = lum(f) < 110 ? mixHex(f, '#FFFFFF', 0.5) : mixHex(f, '#0B1620', 0.4);
  var fn = ART[kind] || ART.sheet;
  return '<svg class="art' + (cls ? ' ' + cls : '') + '" viewBox="0 0 200 200" fill="none" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">' + fn(f, s, d, 'ac' + (++artN)) + '</svg>';
};
