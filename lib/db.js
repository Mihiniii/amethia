// Database: a single SQLite file, using Node's built-in SQLite (Node 22.13+).
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const config = require("./config");

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
const db = new DatabaseSync(config.dbPath);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'dress',
  price       INTEGER NOT NULL,
  badge       TEXT NOT NULL DEFAULT '',
  intro       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  fabric      TEXT NOT NULL DEFAULT '',
  colors      TEXT NOT NULL DEFAULT '[]',
  sizes       TEXT NOT NULL DEFAULT '["XS","S","M","L","XL"]',
  active      INTEGER NOT NULL DEFAULT 1,
  sold_out    INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  data       BLOB NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no       TEXT UNIQUE,
  access_key     TEXT NOT NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  address        TEXT NOT NULL,
  city           TEXT NOT NULL,
  district       TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL,              -- card | cod
  payment_status TEXT NOT NULL,              -- unpaid | pending | paid | failed | cancelled | chargeback
  status         TEXT NOT NULL DEFAULT 'new', -- new | processing | shipped | delivered | cancelled
  subtotal       INTEGER NOT NULL,
  delivery       INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  pay_attempts   INTEGER NOT NULL DEFAULT 0,
  payment_ref    TEXT NOT NULL DEFAULT '',
  payment_info   TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  size       TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  unit_price INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no   TEXT,
  valid      INTEGER NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// ---- default store settings (editable in the admin panel) ----
const DEFAULT_SETTINGS = {
  store_name: "Amethia",
  announcement: "Island-wide delivery · Cash on delivery · Free delivery over LKR 10,000",
  whatsapp: "94770000000",
  instagram: "amethia.lk",
  facebook: "amethia.lk",
  tiktok: "amethia.lk",
  email: "hello@amethia.lk",
  delivery_fee: "400",
  free_delivery_over: "10000",
  cod_enabled: "1",
};
const insSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

// ---- starter products (only added when the shop is empty) ----
// The Iris Dress is the first real design. The others are SAMPLES:
// edit or delete them in the admin panel.
const SEED = [
  ["iris-dress","Iris Dress","dresses","dress",6500,"First design",[["Royal Amethyst","#6A2C91"],["Deep Plum","#4A1F5C"]],
   "Our very first design. An A-line midi with a fitted bodice and a gold-trimmed waist seam.",
   "The skirt falls in long, easy panels, so it holds its shape without feeling stiff. Wear it with sandals for a day out or heels for an evening.",
   "Cotton-linen blend with a lined bodice. Hand wash cold or gentle machine wash. Dry in shade. Warm iron."],
  ["violet-tiered-maxi","Violet Tiered Maxi","dresses","maxi",7800,"Sample",[["Violet","#7B3FA6"],["Lilac","#B48AD6"]],
   "A floor-length tiered dress that moves beautifully with every step.",
   "Three soft tiers, a smocked back for an easy fit, and a flattering square neckline.",
   "Viscose crepe. Gentle wash cold, dry flat in shade."],
  ["twilight-slip-dress","Twilight Slip Dress","dresses","slip",5900,"Sample",[["Twilight","#3D1A4A"],["Mauve","#9E6FA8"]],
   "A bias-cut slip dress with adjustable straps.",
   "Layer it over a tee in the day or wear it alone for evenings out.",
   "Satin-finish polyester. Hand wash cold. Cool iron on reverse."],
  ["lilac-wrap-top","Lilac Wrap Top","tops","top",3900,"Sample",[["Lilac","#C8A2E8"],["Royal Amethyst","#6A2C91"]],
   "A cropped wrap top with short sleeves and a tie at the side.",
   "Pairs with the pleated skirt and wide-leg pants for an easy matched look.",
   "Cotton poplin. Machine wash cold. Warm iron."],
  ["lavender-puff-blouse","Lavender Puff-Sleeve Blouse","tops","blouse",3600,"Sample",[["Lavender","#B995DD"],["Ivory","#EFE6DA"]],
   "A relaxed blouse with gathered puff sleeves.",
   "Tuck it into a skirt or wear it loose over jeans.",
   "Cotton voile. Hand wash cold. Dry in shade."],
  ["plum-pleated-skirt","Plum Pleated Midi Skirt","bottoms","skirt",4200,"Sample",[["Plum","#5B2370"],["Lilac","#B48AD6"]],
   "A pleated midi skirt with an elastic back waistband.",
   "Knife pleats that keep their shape, with side pockets.",
   "Polyester crepe. Machine wash cold. Do not tumble dry."],
  ["orchid-wide-leg-pants","Orchid Wide-Leg Pants","bottoms","pants",4500,"Sample",[["Orchid","#8E4FB0"],["Deep Plum","#4A1F5C"]],
   "High-waisted wide-leg pants with a relaxed fall.",
   "A comfortable everyday pair that dresses up easily.",
   "Linen-viscose blend. Machine wash cold. Warm iron."],
  ["mauve-linen-coord","Mauve Linen Co-ord Set","coords","coord",8900,"Sample",[["Mauve","#9E6FA8"],["Lilac","#C8A2E8"]],
   "A matching wrap top and wide-leg pants, sold as a set.",
   "Wear them together or style each piece separately.",
   "Pure linen. Machine wash cold. Iron while slightly damp."],
];
if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n === 0) {
  const ins = db.prepare(`INSERT INTO products (id,name,category,type,price,badge,colors,intro,description,fabric,sort)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  SEED.forEach((p, i) => ins.run(p[0], p[1], p[2], p[3], p[4], p[5], JSON.stringify(p[6]), p[7], p[8], p[9], i));
  console.log("Added starter products. Only the Iris Dress is real; edit or delete the samples in /admin.");
}

// ---- helpers ----
function getSettings() {
  const out = {};
  for (const r of db.prepare("SELECT key, value FROM settings").all()) out[r.key] = r.value;
  return out;
}

function tx(fn) {
  db.exec("BEGIN");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { db.exec("ROLLBACK"); throw e; }
}

module.exports = { db, getSettings, tx, DEFAULT_SETTINGS };
