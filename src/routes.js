'use strict';
/*
 * Every URL the server answers: [method, path, handler name, middleware names].
 * Middleware names:
 *   admin        - needs the admin login token (Authorization: Bearer ...)
 *   limitLogin   - max 10 tries per 15 minutes per IP
 *   limitOrders  - max 20 orders per 10 minutes per IP
 *   uploadFile   - accepts one file in the "file" form field (photos/videos)
 *   uploadCard   - accepts the optional order photo in the "card" form field
 */
const ROUTES = [
  // Public
  ['GET', '/api/health', 'health', []],
  ['GET', '/api/store', 'getStore', []],
  ['GET', '/api/products', 'listProducts', []],
  ['GET', '/api/products/:id', 'getProduct', []],
  ['POST', '/api/orders', 'placeOrder', ['limitOrders', 'uploadCard']],
  ['GET', '/api/files/:id', 'getFile', []],
  ['POST', '/api/enquiries', 'createEnquiry', ['limitOrders']],
  ['GET', '/api/track', 'trackOrder', ['limitTrack']],

  // Admin login
  ['POST', '/api/auth/login', 'login', ['limitLogin']],
  ['GET', '/api/auth/me', 'me', ['admin']],
  ['POST', '/api/auth/password', 'changePassword', ['admin', 'limitLogin']],

  // Admin: store, products, orders, files
  ['GET', '/api/admin/store', 'adminGetStore', ['admin']],
  ['PUT', '/api/admin/store', 'publishStore', ['admin']],
  ['GET', '/api/admin/products/:id', 'adminGetProduct', ['admin']],
  ['POST', '/api/admin/products', 'createProduct', ['admin']],
  ['PUT', '/api/admin/products/:id', 'updateProduct', ['admin']],
  ['DELETE', '/api/admin/products/:id', 'deleteProduct', ['admin']],
  ['GET', '/api/admin/orders', 'listOrders', ['admin']],
  ['GET', '/api/admin/orders/stats', 'orderStats', ['admin']],
  ['PATCH', '/api/admin/orders/:ref', 'updateOrder', ['admin']],
  ['DELETE', '/api/admin/orders/:ref', 'deleteOrder', ['admin']],
  ['GET', '/api/admin/files', 'listFiles', ['admin']],
  ['POST', '/api/admin/uploads', 'uploadFile', ['admin', 'uploadFile']],
  ['DELETE', '/api/admin/files/:id', 'deleteFile', ['admin']],
  ['POST', '/api/admin/import-images', 'importImages', ['admin']],
  ['POST', '/api/admin/reset-catalogue', 'resetCatalogue', ['admin']],
  ['GET', '/api/admin/backups', 'listBackups', ['admin']],
  ['GET', '/api/admin/backups/:id', 'getBackup', ['admin']],
  ['GET', '/api/admin/enquiries', 'listEnquiries', ['admin']],
  ['PATCH', '/api/admin/enquiries/:ref', 'updateEnquiry', ['admin']],
  ['DELETE', '/api/admin/enquiries/:ref', 'deleteEnquiry', ['admin']],

  // Pages
  ['GET', '/o/:token', 'orderPage', []],
  ['GET', '/o/:token/card.jpg', 'orderCard', []],
  ['GET', '/assets/:file', 'asset', []],
  ['GET', '/sitemap.xml', 'sitemap', []],
  ['GET', '/robots.txt', 'robots', []],
  ['GET', '/', 'page', []],
  ['GET', '/index.html', 'page', []],
  ['GET', '/products', 'page', []],
  ['GET', '/category/:cat', 'page', []],
  ['GET', '/product/:id', 'page', []],
  ['GET', '/department/:id', 'page', []],
  ['GET', '/kits', 'page', []],
  ['GET', '/about', 'page', []],
  ['GET', '/contact', 'page', []],
  ['GET', '/cart', 'page', []],
  ['GET', '/saved', 'page', []],
  ['GET', '/admin', 'page', []],
  ['GET', '/track', 'page', []],
  ['GET', '/bulk-order', 'page', []],
  ['GET', '/privacy', 'page', []],
  ['GET', '/terms', 'page', []],
];

const UPLOAD_LIMITS = {
  uploadFile: { field: 'file', maxBytes: 40 * 1024 * 1024 },
  uploadCard: { field: 'card', maxBytes: 3 * 1024 * 1024 },
};

module.exports = { ROUTES, UPLOAD_LIMITS };
