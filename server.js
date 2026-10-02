// Amethia shop server. Run with:  npm start
// Uses only what comes with Node.js 22.13+ (no npm install needed).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const config = require("./lib/config");
const { db, getSettings, tx } = require("./lib/db");
const payhere = require("./lib/payhere");

const PUBLIC_DIR = path.join(__dirname, "public");
const CATEGORIES = ["dresses", "tops", "bottoms", "coords"];
const TYPES = ["dress", "maxi", "slip", "top", "blouse", "skirt", "pants", "coord"];
const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free size"];
const ORDER_STATUSES = ["new", "processing", "shipped", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "failed", "cancelled", "chargeback", "refunded"];
const PUBLIC_SETTINGS = ["store_name", "announcement", "whatsapp", "instagram", "facebook", "tiktok", "email", "delivery_fee", "free_delivery_over", "cod_enabled"];

/* ------------------------------------------------------------------ */
/* small helpers                                                       */
/* ------------------------------------------------------------------ */
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": isBuf ? "application/octet-stream" : typeof body === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers,
  });
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, "That upload is too large.")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
async function jsonBody(req, limit = 100_000) {
  if (!(req.headers["content-type"] || "").includes("application/json")) fail(415, "Expected JSON.");
  const raw = await readBody(req, limit);
  try { return raw ? JSON.parse(raw) : {}; } catch { fail(400, "Invalid JSON."); }
}
async function formBody(req) {
  const raw = await readBody(req, 50_000);
  return Object.fromEntries(new URLSearchParams(raw));
}

const str = (v, max, { required = true, label = "This field", min = 1 } = {}) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  if (!s && !required) return "";
  if (s.length < min) fail(400, `${label} is required.`);
  if (s.length > max) fail(400, `${label} is too long (max ${max} characters).`);
  return s;
};
const int = (v, lo, hi, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) fail(400, `${label} must be a whole number between ${lo} and ${hi}.`);
  return n;
};
const safeEqual = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y) && String(a).length === String(b).length;
};

function productRow(r, withImages = true) {
  return {
    id: r.id, name: r.name, category: r.category, type: r.type, price: r.price, badge: r.badge,
    intro: r.intro, description: r.description, fabric: r.fabric,
    colors: JSON.parse(r.colors), sizes: JSON.parse(r.sizes),
    active: !!r.active, soldOut: !!r.sold_out, sort: r.sort,
    images: withImages ? db.prepare("SELECT id FROM images WHERE product_id = ? ORDER BY sort, id").all(r.id).map(i => i.id) : [],
  };
}

function deliveryFor(subtotal, s) {
  const fee = Number(s.delivery_fee) || 0, freeOver = Number(s.free_delivery_over) || 0;
  return subtotal === 0 || (freeOver > 0 && subtotal >= freeOver) ? 0 : fee;
}

/* ------------------------------------------------------------------ */
/* admin sessions (signed cookie)                                     */
/* ------------------------------------------------------------------ */
const COOKIE = "am_admin";
const sign = v => crypto.createHmac("sha256", config.sessionSecret).update(v).digest("base64url");
function makeSession() {
  const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 hours
  return `${exp}.${sign(String(exp))}`;
}
function isAdmin(req) {
  const c = Object.fromEntries((req.headers.cookie || "").split(";").map(p => p.trim().split("=").map(decodeURIComponent)).filter(p => p[0]));
  const v = c[COOKIE]; if (!v) return false;
  const [exp, sig] = v.split(".");
  return Number(exp) > Date.now() && sig && safeEqual(sig, sign(exp));
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secureCookies ? "; Secure" : ""}`;
}
const loginAttempts = new Map();
function clientIp(req) { return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress; }

/* ------------------------------------------------------------------ */
/* routes                                                              */
/* ------------------------------------------------------------------ */
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  routes.push({ method, re, keys, handler, admin: !!opts.admin });
};

/* ---------- public store ---------- */
route("GET", "/api/store", () => {
  const s = getSettings();
  const settings = Object.fromEntries(PUBLIC_SETTINGS.map(k => [k, s[k]]));
  const products = db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY sort, created_at").all().map(r => productRow(r));
  return { settings, cardPayments: config.payhere.enabled, products };
});

route("GET", "/api/images/:id", (req, res, p) => {
  const img = db.prepare("SELECT mime, data FROM images WHERE id = ?").get(Number(p.id));
  if (!img) fail(404, "Image not found.");
  send(res, 200, Buffer.from(img.data), { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable" });
});

/* ---------- orders ---------- */
function loadOrderForCustomer(no, key) {
  const o = db.prepare("SELECT * FROM orders WHERE order_no = ?").get(String(no));
  if (!o || !key || !safeEqual(o.access_key, key)) fail(404, "We couldn't find that order.");
  return o;
}
function publicOrder(o) {
  const items = db.prepare("SELECT product_id, name, color, size, qty, unit_price FROM order_items WHERE order_id = ?").all(o.id);
  return {
    orderNo: o.order_no, firstName: o.first_name, paymentMethod: o.payment_method, paymentStatus: o.payment_status,
    status: o.status, subtotal: o.subtotal, delivery: o.delivery, total: o.total, createdAt: o.created_at, items,
  };
}

route("POST", "/api/orders", async req => {
  const body = await jsonBody(req);
  const s = getSettings();
  const c = body.customer || {};
  const customer = {
    first_name: str(c.firstName, 60, { label: "First name" }),
    last_name: str(c.lastName, 60, { label: "Last name" }),
    email: str(c.email, 120, { label: "Email" }),
    phone: str(c.phone, 20, { label: "Phone number" }),
    address: str(c.address, 200, { label: "Address", min: 5 }),
    city: str(c.city, 60, { label: "City" }),
    district: str(c.district, 60, { required: false, label: "District" }),
    notes: str(c.notes, 500, { required: false, label: "Notes" }),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) fail(400, "Please enter a valid email address.");
  const digits = customer.phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) fail(400, "Please enter a valid phone number.");

  const method = body.paymentMethod;
  if (method === "card" && !config.payhere.enabled) fail(400, "Card payments aren't available right now. Please choose cash on delivery.");
  if (method === "cod" && s.cod_enabled !== "1") fail(400, "Cash on delivery isn't available right now.");
  if (method !== "card" && method !== "cod") fail(400, "Please choose a payment method.");

  if (!Array.isArray(body.items) || body.items.length === 0) fail(400, "Your bag is empty.");
  if (body.items.length > 30) fail(400, "Too many items in one order.");
  const merged = new Map();
  for (const it of body.items) {
    const p = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(String(it.id || ""));
    if (!p) fail(400, "One of the items in your bag is no longer available. Please remove it and try again.");
    if (p.sold_out) fail(400, `${p.name} is sold out. Please remove it from your bag.`);
    const colors = JSON.parse(p.colors).map(x => x[0]);
    const sizes = JSON.parse(p.sizes);
    if (!colors.includes(it.color)) fail(400, `Please choose an available colour for ${p.name}.`);
    if (!sizes.includes(it.size)) fail(400, `Size ${it.size} isn't available for ${p.name}.`);
    const qty = int(it.qty, 1, 10, "Quantity");
    const k = `${p.id}|${it.color}|${it.size}`;
    const prev = merged.get(k);
    merged.set(k, { product_id: p.id, name: p.name, color: it.color, size: it.size, qty: Math.min(10, (prev ? prev.qty : 0) + qty), unit_price: p.price });
  }
  const items = [...merged.values()];
  const subtotal = items.reduce((a, i) => a + i.unit_price * i.qty, 0);
  const delivery = deliveryFor(subtotal, s);
  const total = subtotal + delivery;

  const order = tx(() => {
    const key = crypto.randomBytes(12).toString("base64url");
    const r = db.prepare(`INSERT INTO orders (access_key, first_name, last_name, email, phone, address, city, district, notes,
                           payment_method, payment_status, subtotal, delivery, total, pay_attempts)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(key, customer.first_name, customer.last_name, customer.email, customer.phone, customer.address, customer.city,
        customer.district, customer.notes, method, method === "card" ? "pending" : "unpaid", subtotal, delivery, total, method === "card" ? 1 : 0);
    const id = Number(r.lastInsertRowid);
    const orderNo = "AM" + (1000 + id);
    db.prepare("UPDATE orders SET order_no = ? WHERE id = ?").run(orderNo, id);
    const ins = db.prepare("INSERT INTO order_items (order_id, product_id, name, color, size, qty, unit_price) VALUES (?,?,?,?,?,?,?)");
    for (const i of items) ins.run(id, i.product_id, i.name, i.color, i.size, i.qty, i.unit_price);
    return db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  });

  console.log(`New order ${order.order_no}: ${method}, LKR ${total}`);
  const out = { orderNo: order.order_no, key: order.access_key, total };
  if (method === "card") out.payhere = payhere.checkoutFields(order, items, 1);
  return out;
});

route("GET", "/api/orders/:no", (req, res, p, url) => publicOrder(loadOrderForCustomer(p.no, url.searchParams.get("key"))));

// Try paying again after a cancelled or failed card payment.
route("POST", "/api/orders/:no/pay", async (req, res, p) => {
  const body = await jsonBody(req);
  const o = loadOrderForCustomer(p.no, body.key);
  if (o.payment_method !== "card") fail(400, "This order is cash on delivery.");
  if (o.payment_status === "paid") fail(400, "This order is already paid.");
  if (o.status === "cancelled") fail(400, "This order was cancelled.");
  if (!config.payhere.enabled) fail(400, "Card payments aren't available right now.");
  const attempt = o.pay_attempts + 1;
  db.prepare("UPDATE orders SET pay_attempts = ?, payment_status = 'pending', updated_at = datetime('now') WHERE id = ?").run(attempt, o.id);
  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  return { payhere: payhere.checkoutFields(o, items, attempt) };
});

/* ---------- PayHere server-to-server notification ---------- */
route("POST", "/api/payhere/notify", async (req, res) => {
  const p = await formBody(req);
  const valid = config.payhere.enabled && payhere.verifyNotification(p);
  const orderNo = String(p.order_id || "").replace(/-\d+$/, "");
  db.prepare("INSERT INTO payment_log (order_no, valid, payload) VALUES (?,?,?)").run(orderNo, valid ? 1 : 0, JSON.stringify(p));
  if (!valid) { console.warn(`PayHere notification rejected for ${p.order_id}: bad signature`); return send(res, 400, "Invalid signature"); }

  const o = db.prepare("SELECT * FROM orders WHERE order_no = ?").get(orderNo);
  if (!o) return send(res, 404, "Unknown order");
  if (p.payhere_currency !== "LKR" || payhere.money(p.payhere_amount) !== payhere.money(o.total)) {
    console.warn(`PayHere amount mismatch for ${orderNo}: got ${p.payhere_amount} ${p.payhere_currency}, expected ${o.total} LKR`);
    return send(res, 400, "Amount mismatch");
  }
  const next = payhere.STATUS[p.status_code] || "pending";
  // Never let a late "cancelled" or "pending" message overwrite a confirmed payment (chargebacks still apply).
  if (o.payment_status === "paid" && next !== "chargeback") return send(res, 200, "OK");
  db.prepare("UPDATE orders SET payment_status = ?, payment_ref = ?, payment_info = ?, updated_at = datetime('now') WHERE id = ?")
    .run(next, String(p.payment_id || ""), `${p.method || ""} ${p.status_message || ""}`.trim(), o.id);
  console.log(`PayHere: order ${orderNo} is now ${next}`);
  send(res, 200, "OK");
});

/* ---------- admin: login ---------- */
route("POST", "/api/admin/login", async (req, res) => {
  if (!config.adminPassword || config.adminPassword === "change-this-password") fail(503, "Set ADMIN_PASSWORD in the .env file first, then restart the server.");
  const ip = clientIp(req);
  const a = loginAttempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) fail(429, "Too many attempts. Please wait 15 minutes and try again.");
  const body = await jsonBody(req);
  if (!safeEqual(String(body.password || ""), config.adminPassword)) {
    a.n += 1; if (a.n >= 5) { a.until = Date.now() + 15 * 60 * 1000; a.n = 0; }
    loginAttempts.set(ip, a);
    fail(401, "That password isn't right.");
  }
  loginAttempts.delete(ip);
  send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(makeSession(), 60 * 60 * 12) });
});
route("POST", "/api/admin/logout", (req, res) => send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader("", 0) }));
route("GET", "/api/admin/me", () => ({ ok: true, payhere: { enabled: config.payhere.enabled, sandbox: config.payhere.sandbox } }), { admin: true });

/* ---------- admin: orders ---------- */
route("GET", "/api/admin/orders", (req, res, p, url) => {
  const where = [], args = [];
  const st = url.searchParams.get("status");
  if (st && ORDER_STATUSES.includes(st)) { where.push("status = ?"); args.push(st); }
  const pay = url.searchParams.get("payment");
  if (pay && PAYMENT_STATUSES.includes(pay)) { where.push("payment_status = ?"); args.push(pay); }
  const q = (url.searchParams.get("q") || "").trim();
  if (q) { where.push("(order_no LIKE ? OR first_name || ' ' || last_name LIKE ? OR phone LIKE ? OR email LIKE ?)"); args.push(...Array(4).fill(`%${q}%`)); }
  const sql = `SELECT o.*, (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS item_count FROM orders o
               ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.id DESC LIMIT 300`;
  const orders = db.prepare(sql).all(...args);
  const summary = {
    toProcess: db.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('new','processing') AND (payment_method = 'cod' OR payment_status = 'paid')").get().n,
    awaitingPayment: db.prepare("SELECT COUNT(*) n FROM orders WHERE payment_method = 'card' AND payment_status IN ('pending','failed','cancelled') AND status != 'cancelled'").get().n,
    paidThisMonth: db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE payment_status = 'paid' AND strftime('%Y-%m', created_at) = strftime('%Y-%m','now')").get().s,
    ordersThisMonth: db.prepare("SELECT COUNT(*) n FROM orders WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m','now') AND status != 'cancelled'").get().n,
  };
  return { orders, summary };
}, { admin: true });

route("GET", "/api/admin/orders/:id", (req, res, p) => {
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(p.id));
  if (!o) fail(404, "Order not found.");
  o.items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id);
  o.payments = db.prepare("SELECT valid, payload, created_at FROM payment_log WHERE order_no = ? ORDER BY id DESC").all(o.order_no)
    .map(l => { const d = JSON.parse(l.payload); return { valid: !!l.valid, at: l.created_at, status: payhere.STATUS[d.status_code] || d.status_code, method: d.method || "", message: d.status_message || "", paymentId: d.payment_id || "" }; });
  return o;
}, { admin: true });

route("PATCH", "/api/admin/orders/:id", async (req, res, p) => {
  const body = await jsonBody(req);
  const o = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(p.id));
  if (!o) fail(404, "Order not found.");
  const status = body.status ?? o.status;
  const paymentStatus = body.paymentStatus ?? o.payment_status;
  if (!ORDER_STATUSES.includes(status)) fail(400, "Unknown order status.");
  if (!PAYMENT_STATUSES.includes(paymentStatus)) fail(400, "Unknown payment status.");
  db.prepare("UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, paymentStatus, o.id);
  return { ok: true };
}, { admin: true });

/* ---------- admin: products ---------- */
function readProduct(b, existingId) {
  const name = str(b.name, 80, { label: "Name" });
  const id = existingId || str(b.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), 60, { label: "Link name" });
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(id)) fail(400, "Link name can only use lowercase letters, numbers and dashes.");
  if (!CATEGORIES.includes(b.category)) fail(400, "Please choose a category.");
  if (!TYPES.includes(b.type)) fail(400, "Please choose a drawing style.");
  if (!Array.isArray(b.colors) || b.colors.length < 1 || b.colors.length > 8) fail(400, "Add between 1 and 8 colours.");
  const colors = b.colors.map(c => {
    const cn = str(c && c[0], 40, { label: "Colour name" });
    const hex = String(c && c[1] || "");
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) fail(400, `Colour "${cn}" needs a valid colour value.`);
    return [cn, hex];
  });
  if (new Set(colors.map(c => c[0])).size !== colors.length) fail(400, "Each colour needs a different name.");
  if (!Array.isArray(b.sizes) || !b.sizes.length || !b.sizes.every(s => ALL_SIZES.includes(s))) fail(400, "Choose at least one size.");
  return {
    id, name, category: b.category, type: b.type,
    price: int(b.price, 0, 10_000_000, "Price"),
    badge: str(b.badge, 30, { required: false, label: "Badge" }),
    intro: str(b.intro, 300, { required: false, label: "Short intro" }),
    description: str(b.description, 2000, { required: false, label: "Description" }),
    fabric: str(b.fabric, 1000, { required: false, label: "Fabric & care" }),
    colors: JSON.stringify(colors),
    sizes: JSON.stringify(ALL_SIZES.filter(s => b.sizes.includes(s))),
    active: b.active ? 1 : 0, sold_out: b.soldOut ? 1 : 0,
    sort: int(b.sort ?? 0, -10000, 10000, "Order"),
  };
}

route("GET", "/api/admin/products", () => ({
  products: db.prepare("SELECT * FROM products ORDER BY sort, created_at").all().map(r => productRow(r)),
  categories: CATEGORIES, types: TYPES, sizes: ALL_SIZES,
}), { admin: true });

route("POST", "/api/admin/products", async req => {
  const p = readProduct(await jsonBody(req));
  if (db.prepare("SELECT 1 FROM products WHERE id = ?").get(p.id)) fail(400, "Another product already uses that link name.");
  db.prepare(`INSERT INTO products (id,name,category,type,price,badge,intro,description,fabric,colors,sizes,active,sold_out,sort)
              VALUES (:id,:name,:category,:type,:price,:badge,:intro,:description,:fabric,:colors,:sizes,:active,:sold_out,:sort)`).run(p);
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(p.id));
}, { admin: true });

route("PUT", "/api/admin/products/:id", async (req, res, params) => {
  if (!db.prepare("SELECT 1 FROM products WHERE id = ?").get(params.id)) fail(404, "Product not found.");
  const p = readProduct(await jsonBody(req), params.id);
  db.prepare(`UPDATE products SET name=:name, category=:category, type=:type, price=:price, badge=:badge, intro=:intro,
              description=:description, fabric=:fabric, colors=:colors, sizes=:sizes, active=:active, sold_out=:sold_out, sort=:sort
              WHERE id=:id`).run(p);
  return productRow(db.prepare("SELECT * FROM products WHERE id = ?").get(p.id));
}, { admin: true });

route("DELETE", "/api/admin/products/:id", (req, res, p) => {
  const r = db.prepare("DELETE FROM products WHERE id = ?").run(p.id);
  if (!r.changes) fail(404, "Product not found.");
  return { ok: true };
}, { admin: true });

route("POST", "/api/admin/products/:id/images", async (req, res, p) => {
  if (!db.prepare("SELECT 1 FROM products WHERE id = ?").get(p.id)) fail(404, "Product not found.");
  const body = await jsonBody(req, 8_000_000);
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
  if (!m) fail(400, "Please upload a JPG, PNG or WebP image.");
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 5_000_000) fail(413, "That photo is too large (max 5 MB).");
  const next = db.prepare("SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM images WHERE product_id = ?").get(p.id).s;
  const r = db.prepare("INSERT INTO images (product_id, mime, data, sort) VALUES (?,?,?,?)").run(p.id, m[1], buf, next);
  return { id: Number(r.lastInsertRowid) };
}, { admin: true });

route("POST", "/api/admin/images/:id/first", (req, res, p) => {
  const img = db.prepare("SELECT product_id FROM images WHERE id = ?").get(Number(p.id));
  if (!img) fail(404, "Photo not found.");
  const min = db.prepare("SELECT MIN(sort) m FROM images WHERE product_id = ?").get(img.product_id).m;
  db.prepare("UPDATE images SET sort = ? WHERE id = ?").run(min - 1, Number(p.id));
  return { ok: true };
}, { admin: true });

route("DELETE", "/api/admin/images/:id", (req, res, p) => {
  const r = db.prepare("DELETE FROM images WHERE id = ?").run(Number(p.id));
  if (!r.changes) fail(404, "Photo not found.");
  return { ok: true };
}, { admin: true });

/* ---------- admin: settings ---------- */
route("GET", "/api/admin/settings", () => getSettings(), { admin: true });
route("PUT", "/api/admin/settings", async req => {
  const b = await jsonBody(req);
  const clean = {
    store_name: str(b.store_name, 60, { label: "Store name" }),
    announcement: str(b.announcement, 160, { required: false, label: "Announcement" }),
    whatsapp: str(b.whatsapp, 20, { label: "WhatsApp number" }).replace(/\D/g, ""),
    instagram: str(b.instagram, 60, { required: false, label: "Instagram" }).replace(/^@/, ""),
    facebook: str(b.facebook, 80, { required: false, label: "Facebook" }),
    tiktok: str(b.tiktok, 60, { required: false, label: "TikTok" }).replace(/^@/, ""),
    email: str(b.email, 120, { required: false, label: "Email" }),
    delivery_fee: String(int(b.delivery_fee, 0, 100000, "Delivery fee")),
    free_delivery_over: String(int(b.free_delivery_over, 0, 10_000_000, "Free delivery amount")),
    cod_enabled: b.cod_enabled ? "1" : "0",
  };
  if (clean.whatsapp.length < 9) fail(400, "Enter the WhatsApp number with country code, e.g. 94771234567.");
  const up = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  tx(() => { for (const [k, v] of Object.entries(clean)) up.run(k, v); });
  return getSettings();
}, { admin: true });

/* ------------------------------------------------------------------ */
/* static files                                                        */
/* ------------------------------------------------------------------ */
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };

function serveFile(res, file, extra = {}) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "Not found");
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600", ...extra });
  });
}

function serveStatic(req, res, pathname) {
  if (pathname === "/admin" || pathname === "/admin/") return serveFile(res, path.join(PUBLIC_DIR, "admin.html"), { "X-Frame-Options": "DENY" });
  if (pathname === "/" || pathname.startsWith("/order/")) return serveFile(res, path.join(PUBLIC_DIR, "index.html"));
  const file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "Forbidden");
  fs.stat(file, (err, st) => {
    if (!err && st.isFile()) return serveFile(res, file);
    serveFile(res, path.join(PUBLIC_DIR, "index.html")); // unknown pages show the shop
  });
}

/* ------------------------------------------------------------------ */
/* server                                                              */
/* ------------------------------------------------------------------ */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  try {
    if (pathname.startsWith("/api/")) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(pathname);
        if (!m) continue;
        if (r.admin && !isAdmin(req)) fail(401, "Please log in again.");
        const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
        const result = await r.handler(req, res, params, url);
        if (!res.headersSent && result !== undefined) send(res, 200, result, { "Cache-Control": "no-store" });
        return;
      }
      fail(404, "Not found.");
    }
    if (req.method !== "GET" && req.method !== "HEAD") fail(405, "Method not allowed.");
    serveStatic(req, res, pathname);
  } catch (e) {
    if (res.headersSent) return;
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: "Something went wrong on our side. Please try again." });
  }
});

server.listen(config.port, () => {
  console.log(`Amethia shop running at ${config.siteUrl}  (admin: ${config.siteUrl}/admin)`);
  console.log(`PayHere: ${config.payhere.enabled ? (config.payhere.sandbox ? "sandbox (test payments)" : "LIVE") : "off"}`);
});
