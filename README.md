# Rank INC — medical textiles website + MongoDB backend

A redevelopment of [rankinc.in](https://rankinc.in/) as a full working store, built on the LOWKEY store engine
(Node.js + Express + MongoDB) and reworked for a B2B medical-textile manufacturer.

**Design**: a clean retail layout modelled on leading Indian medical-apparel stores — rotating banner slides,
round “Shop by category” tiles, “Shop scrubs by colour”, product carousels with hover photo swap and quick add,
a slide-out quote basket, bulk-order banner, client strip, testimonials, SEO text block, FAQ and a full footer
with help, business and legal links.

**What visitors get**

- Full catalogue: **100 products in 8 categories** imported from the current rankinc.in site (scrub suits, lab coats,
  O.T. & ward linen, mattresses, procedure packs, surgical drapes, disposable gowns, preventive wear, warming blankets),
  with their real photos, colours, sizes and specs where the old site had them.
- Category pages with range filters (e.g. Orthopaedic / Cardiovascular drapes), search (press `/` anywhere), sorting.
- Product pages: colour swatches, sizes, quantity with **minimum order quantity**, “Price on request” or ₹ price + GST.
- **Quote basket**: mix any products, add hospital/company, GSTIN, delivery address and payment preference, then send.
  The request is **saved in MongoDB**, an **order photo** is generated, and WhatsApp opens with the full list
  (+91 98116 41315). Email fallback included.
- Contact page with an **enquiry form** (bulk quote, custom product, export, distributor) saved to the database.
- **Shop by department** (`/department/operation-theatre`, ICU & wards, maternity, orthopaedics, cardiac & cath lab,
  neurosurgery, doctors & nursing staff, infection control, housekeeping): every product a department uses in one place.
- **Hospital starter kits** (`/kits`): ready-made lists — ward bed, ICU bed, nursing uniform, OT starter, labour room,
  isolation ward. Pick how many beds/rooms/staff and the whole kit goes into the basket with scaled quantities.
- **Embroidery** on scrubs and lab coats: tick “Add embroidery”, type the hospital or staff name, and it is saved on
  that basket line, in the order, the WhatsApp message, the order photo and the admin order list.
- Quick-link chips under the banner, New arrivals carousel, brand statement, catalogue/price-list sign-up in the
  footer (saved as an enquiry) and accepted-payment chips.
- **Bulk order page** (`/bulk-order`) and **Track order** (`/track`: order reference + mobile number shows the
  status timeline, without exposing customer details).
- **Privacy policy** (`/privacy`) and **Terms of sale** (`/terms`), editable in admin.
- Saved products (wishlist), colour filter in the catalogue, dark mode, mobile layout, floating WhatsApp button.

**What staff get** (`/admin`)

- Orders & quote requests: filter, search, change status (stock moves automatically for stock-tracked products),
  message the customer on WhatsApp, open the order page.
- Enquiries: status (new → contacted → quoted → closed), reply on WhatsApp or email.
- Products: add/edit/duplicate/hide/reorder/delete, photo upload (stored in MongoDB), price, MRP, unit, MOQ,
  colours, custom sizes, optional stock tracking, specifications, tags.
- Departments (name, icon, keywords that pick the products) and starter kits (products + suggested quantities).
- Per-product “Offer embroidery” switch.
- **Size chart** per product: upload up to 6 size-chart photos (or paste links) and add size notes. They appear as a
  “Size guide” button next to the size picker and a “Size chart” section in the product description.
- Banner slides (title, text, button, photo upload, background colour), client list, home-page SEO text,
  categories, testimonials, numbers, company details, colours & logo, GST %, freight, coupon, payment options,
  About page, FAQ, privacy policy and terms.
- **Copy photos to this server**: pulls every photo still linked from the old WordPress site into MongoDB, so the new
  site keeps working if the old one is switched off.
- Backup download/restore, password change. Edits are a draft until **Publish**; two admins can’t overwrite each other.

**Optimisation**

- Real page URLs (`/product/lab-coat`, `/category/surgical-drapes`) instead of `#` links, each server-rendered with its
  own title, description, canonical link, Open Graph tags and JSON-LD (Organization, Product, BreadcrumbList,
  ItemList, FAQPage). Plain-HTML content for crawlers, `sitemap.xml`, `robots.txt`, proper 404 status.
- CSS and JS are bundled into one file each with a content hash → cached for a year, gzip on everything.
- Strict Content-Security-Policy (no inline scripts), lazy images with sizes, broken photo links fall back to drawn
  illustrations, web manifest + icons, reduced-motion and keyboard support.

---

## Run it

### Try it in 10 seconds (no MongoDB)

```bash
node dev/demo-server.js
```

Open http://localhost:5050 — admin at http://localhost:5050/admin, password `rankinc@admin`.
Data is kept in memory and resets when you stop it.

### Real setup with MongoDB

1. Install Node.js 20 or 22 (https://nodejs.org).
2. Create a free MongoDB Atlas cluster (Mumbai region), a database user, and allow your IP
   (`0.0.0.0/0` for hosting). Copy the connection string and add the database name `rank_store`:
   `mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/rank_store?retryWrites=true&w=majority`
   (encode special characters in the password: `@` → `%40`).
3. `cp .env.example .env` and fill in `MONGODB_URI`, `JWT_SECRET` (make one with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and `ADMIN_PASSWORD`.
4. ```bash
   npm install
   npm start
   ```
   On the first start the server creates the admin login and loads the Rank INC catalogue.
5. Check http://localhost:5000/api/health → `{"ok":true,"db":"up"}`.

### Put it online (Render + Atlas)

1. Push this folder to GitHub (`.env` is ignored).
2. Render → **New → Blueprint** → pick the repo (uses `render.yaml`), or a Web Service with
   build `npm install`, start `npm start`.
3. Set `MONGODB_URI`, `ADMIN_PASSWORD`, `JWT_SECRET`, `NODE_ENV=production`.
4. After the first deploy set **`PUBLIC_URL`** to the live address (e.g. `https://rankinc.in`) and redeploy —
   canonical links, the sitemap and WhatsApp order previews use it.
5. Point the rankinc.in domain at Render (Render → Settings → Custom domains), then submit
   `https://rankinc.in/sitemap.xml` in Google Search Console.
6. In Admin → Backup & security, press **Copy photos now** once, before the old WordPress site is turned off.

---

## Before going live — please check

- **Prices**: the old site had none, so every product shows “Price on request”. Add prices in Admin → Products
  where you want them; totals, GST and coupons then work automatically.
- **Photos**: product photos are linked from rankinc.in. A few products had no photo on the old site and show a
  drawn illustration (e.g. Elegance and Leisure scrub suits, German Blue).
- **Logo**: the header and footer use a new built-in Rank INC logo (fabric-panel medical cross + name). To use your
  own logo instead, upload it in Admin → Company & brand (“Use built-in logo” switches back).
- Working hours, dispatch time, GSTIN and social links were not on the old site, so they are empty — fill them in.
- Testimonials are the two short quotes shown on the old site.
- **Banner photos**: the three default slides use product photos from the old site. Replace them in
  Admin → Home page with wide lifestyle photos (staff in your scrubs, your OT, your factory) for the best look.
- **Kit quantities** are suggested starting points written for this site, not Rank INC’s own standards — review them
  in Admin → Departments & kits. Embroidery is priced by your team with the quote.
- **Clients strip** stays hidden until you add institutions that have agreed to be named.
- **Privacy policy and terms** are a plain-language starting point describing how this website handles data.
  Have them reviewed before relying on them.

---

## Folder

```
public/
  index.html            page template (the server fills in SEO tags, content and live data)
  src/css/*.css         styles, bundled into /assets/app.css
  src/js/*.js           the website + admin app, bundled into /assets/app.js
  favicon.svg, icon-*.png, manifest.webmanifest
src/
  server.js, app.js     start-up and Express setup
  routes.js, handlers.js, services.js
  models.js, db.js, repo/mongo.js   MongoDB (Mongoose + GridFS)
  lib/pages.js          SEO pages, order page, sitemap, robots
  lib/assets.js         CSS/JS bundling with cache hashes
  lib/order.js          pricing, GST, MOQ, stock, customer & enquiry checks
  lib/normalize.js      cleans everything the admin saves
scripts/seed-data.json  the Rank INC catalogue
dev/                    no-database demo server (used by the tests)
test/                   npm test
```

## API

| Method | URL | Who | What |
|---|---|---|---|
| GET | `/api/health` | anyone | server + database status |
| GET | `/api/store` | anyone | settings, categories, visible products |
| GET | `/api/products?cat=surgical-drapes` · `/api/products/:id` | anyone | products |
| POST | `/api/orders` | anyone (rate-limited) | place an order / quote request (JSON or form-data `order` + `card` photo) |
| POST | `/api/enquiries` | anyone (rate-limited) | contact / bulk-quote form |
| GET | `/api/track?ref=RA-XXXXXX&phone=98…` | anyone (rate-limited) | order status for the customer |
| GET | `/o/:token` | link holders | order page used for the WhatsApp preview |
| POST | `/api/auth/login` · `/api/auth/password` | admin | login / change password |
| GET, PUT | `/api/admin/store` | admin | read / publish everything (`{rev, data}`) |
| POST, PUT, DELETE | `/api/admin/products[/:id]` | admin | one product |
| GET, PATCH, DELETE | `/api/admin/orders[/:ref]`, `/api/admin/orders/stats` | admin | orders |
| GET, PATCH, DELETE | `/api/admin/enquiries[/:ref]` | admin | enquiries |
| POST | `/api/admin/uploads` · GET/DELETE `/api/admin/files[/:id]` | admin | photos in MongoDB |
| POST | `/api/admin/import-images` | admin | copy external photos into MongoDB |

## Commands

| Command | What it does |
|---|---|
| `npm start` | start with MongoDB |
| `npm run dev` | same, restarts on code changes |
| `npm run demo` | demo without MongoDB |
| `npm run seed` / `npm run seed:force` | load the catalogue (force replaces products and settings; orders are kept) |
| `npm run reset-password -- "newpass123"` | set a new admin password |
| `npm test` | automated tests (no MongoDB needed) |


### Menu is empty / old products show up

This site keeps its data in its own MongoDB database, **`rank_store`** (set `DB_NAME` to change it), even if
`MONGODB_URI` names another database such as `lowkey_store`. So it never mixes with another shop on the same cluster.
On start the server also upgrades a database saved by an older version: missing sections are filled in, and if the
database holds another store's catalogue it is backed up (Admin → Backup & security → Server backups) and replaced by
the Rank INC catalogue. You can also press **Reset catalogue** there at any time.
